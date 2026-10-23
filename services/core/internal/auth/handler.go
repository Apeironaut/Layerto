package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/ledger"
)

type Handler struct {
	pool        *pgxpool.Pool
	rateLimiter *LoginRateLimiter
	account     AccountOptions
}

func NewHandler(pool *pgxpool.Pool, rl *LoginRateLimiter) *Handler {
	return &Handler{
		pool:        pool,
		rateLimiter: rl,
		account:     defaultAccountOptions(),
	}
}

type SignupRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

// LoginRequest accepts an email or a username in "login". "email" is still read for older clients.
type LoginRequest struct {
	Login    string `json:"login"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
	Role      string `json:"role"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at,omitempty"`
}

// userResponse builds the public view of a user, including the profile when one exists.
func userResponse(ctx context.Context, q *db.Queries, u db.User) UserResponse {
	res := UserResponse{
		ID:     fmtUUID(u.ID),
		Email:  u.Email,
		Name:   u.Name.String,
		Role:   u.Role,
		Status: u.Status,
	}
	if u.CreatedAt.Valid {
		res.CreatedAt = u.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	if p, err := q.GetUserProfile(ctx, u.ID); err == nil {
		res.FirstName = p.FirstName
		res.LastName = p.LastName
		res.Username = p.Username
	}
	return res
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return ip
	}
	return r.RemoteAddr
}

// HandleSignup handles POST /api/auth/signup.
// Every field is validated on the server. A taken username returns 409 username_taken.
// If the email already exists, it returns the same 201 "account pending approval" response and creates nothing.
func (h *Handler) HandleSignup(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 16<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	firstName := NormalizeName(req.FirstName)
	lastName := NormalizeName(req.LastName)
	username := NormalizeUsername(req.Username)
	email := NormalizeEmail(req.Email)

	if ValidateName(firstName) != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_first_name", "First name must be 1-50 letters.")
		return
	}
	if ValidateName(lastName) != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_last_name", "Last name must be 1-50 letters.")
		return
	}
	if err := ValidateUsername(username); err != nil {
		code, msg := "invalid_username", "Username must be 3-30 characters: lowercase letters, numbers, dots or underscores, starting and ending with a letter or number."
		if errors.Is(err, ErrUsernameReserved) {
			code, msg = "username_reserved", "That username is reserved. Choose another."
		}
		httpx.WriteError(w, r, http.StatusBadRequest, code, msg)
		return
	}
	if !ValidateEmail(email) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_email", "Enter a valid email address.")
		return
	}
	if err := ValidatePasswordPolicy(req.Password, username, email); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "weak_password", PasswordPolicyMessage(err))
		return
	}

	queries := db.New(h.pool)

	if _, err := queries.GetUserProfileByUsername(r.Context(), username); err == nil {
		httpx.WriteError(w, r, http.StatusConflict, "username_taken", "That username is taken. Choose another.")
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database error")
		return
	}

	// Existing email: identical response, nothing created (no account enumeration).
	if existingUser, err := queries.GetUserByEmail(r.Context(), email); err == nil && existingUser.ID.Valid {
		VerifyDummyPassword(req.Password) // keep timing similar to the hashing path
		httpx.JSON(w, http.StatusCreated, map[string]string{
			"status":  "pending",
			"message": "account pending approval",
		})
		return
	}

	passwordHash, err := HashPassword(req.Password)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to hash password")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to start transaction")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	_, err = txQueries.CreateUser(r.Context(), db.CreateUserParams{
		ID:           userUUID,
		Email:        email,
		PasswordHash: passwordHash,
		Name:         pgtype.Text{String: firstName + " " + lastName, Valid: true},
		Role:         "user",
		Status:       "pending",
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to create user")
		return
	}

	if _, err := txQueries.CreateUserProfile(r.Context(), db.CreateUserProfileParams{
		UserID:    userUUID,
		FirstName: firstName,
		LastName:  lastName,
		Username:  username,
	}); err != nil {
		if isUniqueViolation(err) {
			httpx.WriteError(w, r, http.StatusConflict, "username_taken", "That username is taken. Choose another.")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to create profile")
		return
	}

	_ = txQueries.CreateBalance(r.Context(), db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  0,
		FreeUsed: 0,
	})

	_, err = ledger.Append(r.Context(), tx, ledger.EventInput{
		UserID: &userID,
		Type:   "user.signed_up",
		Payload: map[string]any{
			"email":    email,
			"username": username,
			"role":     "user",
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record signup in ledger")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit user creation")
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]string{
		"status":  "pending",
		"message": "account pending approval",
	})
}

// HandleUsernameAvailable handles GET /api/auth/username-available?username=…
// Rate-limited per IP. Answers only whether a valid username is free.
func (h *Handler) HandleUsernameAvailable(w http.ResponseWriter, r *http.Request) {
	if !h.account.LookupLimiter.Allow("username:" + getClientIP(r)) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Too many checks. Try again in a minute.")
		return
	}
	username := NormalizeUsername(r.URL.Query().Get("username"))
	if err := ValidateUsername(username); err != nil {
		reason := "invalid"
		if errors.Is(err, ErrUsernameReserved) {
			reason = "reserved"
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"username": username, "available": false, "reason": reason})
		return
	}
	_, err := db.New(h.pool).GetUserProfileByUsername(r.Context(), username)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		httpx.JSON(w, http.StatusOK, map[string]any{"username": username, "available": true})
	case err == nil:
		httpx.JSON(w, http.StatusOK, map[string]any{"username": username, "available": false, "reason": "taken"})
	default:
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database error")
	}
}

// HandleLogin handles POST /api/auth/login with an email or username.
// Enforces rate limits, runs dummy hash on unknown accounts, and rotates session on success.
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	ip := getClientIP(r)

	var req LoginRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	identifier := strings.TrimSpace(req.Login)
	if identifier == "" {
		identifier = req.Email
	}
	identifier = strings.ToLower(strings.TrimSpace(identifier))

	// Check rate limit: 5 failures per IP+identifier, 30 failures per IP
	if !h.rateLimiter.Allow(ip, identifier) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Too many failed login attempts. Please try again later.")
		return
	}

	queries := db.New(h.pool)
	user, err := h.lookupLoginUser(r.Context(), queries, identifier)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Run dummy argon2id verification so response timing matches
			VerifyDummyPassword(req.Password)
			h.rateLimiter.RecordFailure(ip, identifier)
			httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_credentials", "Incorrect email, username or password")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database error")
		return
	}

	valid, vErr := VerifyPassword(user.PasswordHash, req.Password)
	if vErr != nil || !valid {
		h.rateLimiter.RecordFailure(ip, identifier)
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_credentials", "Incorrect email, username or password")
		return
	}

	if user.Status == "suspended" {
		httpx.WriteError(w, r, http.StatusForbidden, "account_suspended", "Account has been suspended")
		return
	}

	h.rateLimiter.Reset(ip, identifier)

	// Session rotation: delete any existing session associated with the incoming cookie
	if oldCookie, err := r.Cookie(SessionCookieName); err == nil && oldCookie.Value != "" {
		_ = queries.DeleteSession(r.Context(), HashToken(oldCookie.Value))
	}

	// Create new session: cookie holds plaintext token, DB stores sha256(token)
	token, session, err := CreateSession(r.Context(), queries, user.ID)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to create session")
		return
	}

	SetSessionCookie(w, r, token, session.ExpiresAt.Time)
	httpx.JSON(w, http.StatusOK, userResponse(r.Context(), queries, user))
}

// lookupLoginUser finds a user by email (contains "@") or by username.
func (h *Handler) lookupLoginUser(ctx context.Context, q *db.Queries, identifier string) (db.User, error) {
	if identifier == "" {
		return db.User{}, pgx.ErrNoRows
	}
	if strings.Contains(identifier, "@") {
		return q.GetUserByEmail(ctx, identifier)
	}
	profile, err := q.GetUserProfileByUsername(ctx, identifier)
	if err != nil {
		return db.User{}, err
	}
	return q.GetUserByID(ctx, profile.UserID)
}

// HandleLogout handles POST /api/auth/logout.
func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(SessionCookieName); err == nil && cookie.Value != "" {
		queries := db.New(h.pool)
		_ = queries.DeleteSession(r.Context(), HashToken(cookie.Value))
	}

	ClearSessionCookie(w, r)
	httpx.JSON(w, http.StatusOK, map[string]string{
		"status": "logged_out",
	})
}

// HandleMe handles GET /api/me.
func (h *Handler) HandleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}
	httpx.JSON(w, http.StatusOK, userResponse(r.Context(), db.New(h.pool), *user))
}

// isUniqueViolation reports a Postgres unique_violation (23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func fmtUUID(u pgtype.UUID) string {
	return strings.ToLower(strings.TrimSpace(
		string([]byte{
			hexDigit(u.Bytes[0] >> 4), hexDigit(u.Bytes[0] & 0xf),
			hexDigit(u.Bytes[1] >> 4), hexDigit(u.Bytes[1] & 0xf),
			hexDigit(u.Bytes[2] >> 4), hexDigit(u.Bytes[2] & 0xf),
			hexDigit(u.Bytes[3] >> 4), hexDigit(u.Bytes[3] & 0xf),
			'-',
			hexDigit(u.Bytes[4] >> 4), hexDigit(u.Bytes[4] & 0xf),
			hexDigit(u.Bytes[5] >> 4), hexDigit(u.Bytes[5] & 0xf),
			'-',
			hexDigit(u.Bytes[6] >> 4), hexDigit(u.Bytes[6] & 0xf),
			hexDigit(u.Bytes[7] >> 4), hexDigit(u.Bytes[7] & 0xf),
			'-',
			hexDigit(u.Bytes[8] >> 4), hexDigit(u.Bytes[8] & 0xf),
			hexDigit(u.Bytes[9] >> 4), hexDigit(u.Bytes[9] & 0xf),
			'-',
			hexDigit(u.Bytes[10] >> 4), hexDigit(u.Bytes[10] & 0xf),
			hexDigit(u.Bytes[11] >> 4), hexDigit(u.Bytes[11] & 0xf),
			hexDigit(u.Bytes[12] >> 4), hexDigit(u.Bytes[12] & 0xf),
			hexDigit(u.Bytes[13] >> 4), hexDigit(u.Bytes[13] & 0xf),
			hexDigit(u.Bytes[14] >> 4), hexDigit(u.Bytes[14] & 0xf),
			hexDigit(u.Bytes[15] >> 4), hexDigit(u.Bytes[15] & 0xf),
		}),
	))
}

func hexDigit(b byte) byte {
	if b < 10 {
		return '0' + b
	}
	return 'a' + (b - 10)
}
