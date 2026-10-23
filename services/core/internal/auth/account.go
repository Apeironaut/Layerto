package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/mail"
)

// AccountOptions configures profile, password change and password reset endpoints.
type AccountOptions struct {
	Mailer        mail.Mailer
	DashboardURL  string           // base URL for links in emails, e.g. https://app.layerto.com
	LookupLimiter *UserRateLimiter // username checks, per IP
	ResetLimiter  *UserRateLimiter // forgot/reset requests, per IP
	ResetTokenTTL time.Duration
	MaxResetsHour int // reset emails per account per hour
}

func defaultAccountOptions() AccountOptions {
	return AccountOptions{
		Mailer:        mail.DisabledMailer{},
		DashboardURL:  "http://localhost:5174",
		LookupLimiter: NewUserRateLimiter(30, time.Minute),
		ResetLimiter:  NewUserRateLimiter(10, time.Hour),
		ResetTokenTTL: 30 * time.Minute,
		MaxResetsHour: 3,
	}
}

// ConfigureAccount overrides the defaults; zero values keep the default.
func (h *Handler) ConfigureAccount(o AccountOptions) {
	d := defaultAccountOptions()
	if o.Mailer != nil {
		d.Mailer = o.Mailer
	}
	if o.DashboardURL != "" {
		d.DashboardURL = strings.TrimRight(o.DashboardURL, "/")
	}
	if o.LookupLimiter != nil {
		d.LookupLimiter = o.LookupLimiter
	}
	if o.ResetLimiter != nil {
		d.ResetLimiter = o.ResetLimiter
	}
	if o.ResetTokenTTL > 0 {
		d.ResetTokenTTL = o.ResetTokenTTL
	}
	if o.MaxResetsHour > 0 {
		d.MaxResetsHour = o.MaxResetsHour
	}
	h.account = d
}

// ---------------------------------------------------------------- profile

type updateProfileRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"` // only accepted when the account has no username yet
}

// HandleUpdateProfile handles PATCH /api/me. Names can always change; a username can be set
// once (accounts created before usernames existed) and never changed afterwards.
func (h *Handler) HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}
	var req updateProfileRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}
	first, last := NormalizeName(req.FirstName), NormalizeName(req.LastName)
	if ValidateName(first) != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_first_name", "First name must be 1-50 letters.")
		return
	}
	if ValidateName(last) != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_last_name", "Last name must be 1-50 letters.")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database error")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	q := db.New(tx)

	_, err = q.GetUserProfile(r.Context(), user.ID)
	switch {
	case err == nil:
		if req.Username != "" {
			httpx.WriteError(w, r, http.StatusBadRequest, "username_locked", "Your username can't be changed.")
			return
		}
		if _, err := q.UpdateUserProfileNames(r.Context(), db.UpdateUserProfileNamesParams{UserID: user.ID, FirstName: first, LastName: last}); err != nil {
			httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to update profile")
			return
		}
	case errors.Is(err, pgx.ErrNoRows):
		username := NormalizeUsername(req.Username)
		if verr := ValidateUsername(username); verr != nil {
			code := "invalid_username"
			if errors.Is(verr, ErrUsernameReserved) {
				code = "username_reserved"
			}
			httpx.WriteError(w, r, http.StatusBadRequest, code, "Choose a username: 3-30 lowercase letters, numbers, dots or underscores.")
			return
		}
		if _, err := q.CreateUserProfile(r.Context(), db.CreateUserProfileParams{UserID: user.ID, FirstName: first, LastName: last, Username: username}); err != nil {
			if isUniqueViolation(err) {
				httpx.WriteError(w, r, http.StatusConflict, "username_taken", "That username is taken. Choose another.")
				return
			}
			httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to save profile")
			return
		}
	default:
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database error")
		return
	}
	_ = q.UpdateUserName(r.Context(), db.UpdateUserNameParams{ID: user.ID, Name: pgtype.Text{String: first + " " + last, Valid: true}})

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to save profile")
		return
	}
	fresh, err := db.New(h.pool).GetUserByID(r.Context(), user.ID)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database error")
		return
	}
	httpx.JSON(w, http.StatusOK, userResponse(r.Context(), db.New(h.pool), fresh))
}

// ---------------------------------------------------------------- change password

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// HandleChangePassword handles POST /api/me/password. Signs out every other session.
func (h *Handler) HandleChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}
	var req changePasswordRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}
	ip := getClientIP(r)
	limitKey := "pwchange:" + fmtUUID(user.ID)
	if !h.rateLimiter.Allow(ip, limitKey) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Too many attempts. Try again later.")
		return
	}
	if valid, err := VerifyPassword(user.PasswordHash, req.CurrentPassword); err != nil || !valid {
		h.rateLimiter.RecordFailure(ip, limitKey)
		httpx.WriteError(w, r, http.StatusBadRequest, "wrong_password", "Your current password is incorrect.")
		return
	}
	h.rateLimiter.Reset(ip, limitKey)
	if req.NewPassword == req.CurrentPassword {
		httpx.WriteError(w, r, http.StatusBadRequest, "same_password", "Choose a password you haven't just used.")
		return
	}

	username := ""
	q := db.New(h.pool)
	if p, err := q.GetUserProfile(r.Context(), user.ID); err == nil {
		username = p.Username
	}
	if err := ValidatePasswordPolicy(req.NewPassword, username, user.Email); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "weak_password", PasswordPolicyMessage(err))
		return
	}

	currentSession := ""
	if c, err := r.Cookie(SessionCookieName); err == nil {
		currentSession = HashToken(c.Value)
	}
	if err := h.setPassword(r.Context(), user.ID, req.NewPassword, "change", currentSession); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to change password")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "password_changed"})
}

// setPassword stores a new hash, invalidates reset tokens, signs out sessions (all, or all but
// keepSession) and records user.password_changed — in one transaction.
func (h *Handler) setPassword(ctx context.Context, userID pgtype.UUID, password, method, keepSession string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := db.New(tx)
	if err := q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: userID, PasswordHash: hash}); err != nil {
		return err
	}
	if err := q.InvalidatePasswordResetTokensForUser(ctx, userID); err != nil {
		return err
	}
	if keepSession != "" {
		err = q.DeleteOtherSessionsForUser(ctx, db.DeleteOtherSessionsForUserParams{UserID: userID, ID: keepSession})
	} else {
		err = q.DeleteSessionsForUser(ctx, userID)
	}
	if err != nil {
		return err
	}
	uid := fmtUUID(userID)
	if _, err := ledger.Append(ctx, tx, ledger.EventInput{
		UserID:  &uid,
		Type:    "user.password_changed",
		Payload: map[string]any{"method": method},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------- forgot / reset

const resetAcceptedMessage = "If an account exists for that email, we've sent a link to reset the password."

// HandleForgotPassword handles POST /api/auth/forgot-password {email}.
// Always answers the same way so it can't be used to discover accounts.
func (h *Handler) HandleForgotPassword(w http.ResponseWriter, r *http.Request) {
	if !h.account.ResetLimiter.Allow("forgot:" + getClientIP(r)) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again later.")
		return
	}
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}
	email := NormalizeEmail(req.Email)
	if !ValidateEmail(email) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_email", "Enter a valid email address.")
		return
	}

	// Do the work in the background so response time doesn't reveal whether the account exists.
	go h.issueResetToken(email)

	httpx.JSON(w, http.StatusAccepted, map[string]string{"status": "ok", "message": resetAcceptedMessage})
}

func (h *Handler) issueResetToken(email string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	q := db.New(h.pool)
	user, err := q.GetUserByEmail(ctx, email)
	if err != nil || user.Status == "suspended" {
		return
	}
	since := pgtype.Timestamptz{Time: time.Now().Add(-time.Hour), Valid: true}
	if n, err := q.CountRecentPasswordResetTokens(ctx, db.CountRecentPasswordResetTokensParams{UserID: user.ID, CreatedAt: since}); err != nil || n >= int64(h.account.MaxResetsHour) {
		return
	}

	token, err := newResetToken()
	if err != nil {
		return
	}
	expires := time.Now().Add(h.account.ResetTokenTTL)
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	tq := db.New(tx)
	if err := tq.InvalidatePasswordResetTokensForUser(ctx, user.ID); err != nil {
		return
	}
	if err := tq.CreatePasswordResetToken(ctx, db.CreatePasswordResetTokenParams{
		UserID:    user.ID,
		TokenHash: HashToken(token),
		ExpiresAt: pgtype.Timestamptz{Time: expires, Valid: true},
	}); err != nil {
		return
	}
	if err := tx.Commit(ctx); err != nil {
		return
	}

	link := h.account.DashboardURL + "/reset-password?token=" + token
	minutes := int(h.account.ResetTokenTTL.Minutes())
	body := fmt.Sprintf(`Someone asked to reset the password for your Layerto account (%s).

Reset it here (the link works once and expires in %d minutes):
%s

If you didn't ask for this, ignore this email. Your password won't change.

— Layerto`, user.Email, minutes, link)
	if err := h.account.Mailer.Send(ctx, mail.Message{To: user.Email, Subject: "Reset your Layerto password", Body: body}); err != nil {
		log.Printf("[auth] password reset email failed: %v", err)
	}
}

// newResetToken returns 32 random bytes, URL-safe encoded. Only its SHA-256 is stored.
func newResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HandleResetPassword handles POST /api/auth/reset-password {token, password}.
func (h *Handler) HandleResetPassword(w http.ResponseWriter, r *http.Request) {
	if !h.account.ResetLimiter.Allow("reset:" + getClientIP(r)) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again later.")
		return
	}
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}
	invalid := func() {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_reset_token", "This reset link is invalid or has expired. Request a new one.")
	}
	token := strings.TrimSpace(req.Token)
	if len(token) < 20 || len(token) > 100 {
		invalid()
		return
	}
	q := db.New(h.pool)
	row, err := q.GetPasswordResetTokenByHash(r.Context(), HashToken(token))
	if err != nil || row.UsedAt.Valid || !row.ExpiresAt.Time.After(time.Now()) {
		invalid()
		return
	}
	user, err := q.GetUserByID(r.Context(), row.UserID)
	if err != nil || user.Status == "suspended" {
		invalid()
		return
	}
	username := ""
	if p, err := q.GetUserProfile(r.Context(), user.ID); err == nil {
		username = p.Username
	}
	if err := ValidatePasswordPolicy(req.Password, username, user.Email); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "weak_password", PasswordPolicyMessage(err))
		return
	}
	// Claim the token first; a second request with the same token gets 0 rows.
	if n, err := q.MarkPasswordResetTokenUsed(r.Context(), row.ID); err != nil || n != 1 {
		invalid()
		return
	}
	if err := h.setPassword(r.Context(), user.ID, req.Password, "reset", ""); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to reset password")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "password_reset"})
}
