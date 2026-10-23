package keys

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
)

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

type KeySummary struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Prefix     string  `json:"prefix"`
	LastUsedAt *string `json:"last_used_at,omitempty"`
	RevokedAt  *string `json:"revoked_at,omitempty"`
	ExpiresAt  *string `json:"expires_at"`
	CreatedAt  string  `json:"created_at"`
}

type CreateKeyResponse struct {
	Key       string  `json:"key"` // Shown only once!
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Prefix    string  `json:"prefix"`
	ExpiresAt *string `json:"expires_at"`
	CreatedAt string  `json:"created_at"`
}

// HandleListKeys lists all API keys for the current user.
func (h *Handler) HandleListKeys(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	queries := db.New(h.pool)
	keysList, err := queries.ListAPIKeysByUserID(r.Context(), user.ID)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list API keys")
		return
	}

	res := make([]KeySummary, 0, len(keysList))
	for _, k := range keysList {
		var lastUsed *string
		if k.LastUsedAt.Valid {
			s := k.LastUsedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			lastUsed = &s
		}
		var revoked *string
		if k.RevokedAt.Valid {
			s := k.RevokedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			revoked = &s
		}
		var expiresAt *string
		if k.ExpiresAt.Valid {
			s := k.ExpiresAt.Time.Format("2006-01-02T15:04:05Z07:00")
			expiresAt = &s
		}

		res = append(res, KeySummary{
			ID:         fmtUUID(k.ID),
			Name:       k.Name,
			Prefix:     k.Prefix,
			LastUsedAt: lastUsed,
			RevokedAt:  revoked,
			ExpiresAt:  expiresAt,
			CreatedAt:  k.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	httpx.JSON(w, http.StatusOK, res)
}

// HandleCreateKey creates a new API key (max 10 active keys) and shows full key once.
func (h *Handler) HandleCreateKey(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req struct {
		Name      string  `json:"name"`
		ExpiresAt *string `json:"expires_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "default"
	}
	if utf8.RuneCountInString(name) > 64 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Key name must be at most 64 characters")
		return
	}

	expiresAt, msg := parseExpiry(req.ExpiresAt)
	if msg != "" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", msg)
		return
	}

	userIDStr := fmtUUID(user.ID)
	fullKey, keyRow, err := Create(r.Context(), h.pool, userIDStr, name, expiresAt)
	if err != nil {
		if errors.Is(err, ErrMaxKeysReached) {
			httpx.WriteError(w, r, http.StatusBadRequest, "max_keys_reached", "Maximum 10 active API keys allowed per account")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", fmt.Sprintf("Failed to create API key: %v", err))
		return
	}

	var expiresAtStr *string
	if keyRow.ExpiresAt.Valid {
		s := keyRow.ExpiresAt.Time.Format("2006-01-02T15:04:05Z07:00")
		expiresAtStr = &s
	}

	httpx.JSON(w, http.StatusCreated, CreateKeyResponse{
		Key:       fullKey,
		ID:        fmtUUID(keyRow.ID),
		Name:      keyRow.Name,
		Prefix:    keyRow.Prefix,
		ExpiresAt: expiresAtStr,
		CreatedAt: keyRow.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// HandleRevokeKey revokes an API key.
func (h *Handler) HandleRevokeKey(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	keyID := chi.URLParam(r, "id")
	userIDStr := fmtUUID(user.ID)

	if err := Revoke(r.Context(), h.pool, keyID, userIDStr); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", fmt.Sprintf("Failed to revoke key: %v", err))
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"status": "revoked",
	})
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

// parseExpiry validates an RFC3339 expiry (nil or "" = never). Returns a user-facing message on error.
func parseExpiry(v *string) (*time.Time, string) {
	if v == nil || *v == "" {
		return nil, ""
	}
	t, err := time.Parse(time.RFC3339, *v)
	if err != nil {
		return nil, "Invalid RFC3339 format for expires_at"
	}
	utc := t.UTC()
	now := time.Now().UTC()
	if utc.Before(now.Add(1 * time.Hour)) {
		return nil, "Expiry date must be at least 1 hour in the future"
	}
	if utc.After(now.Add(365*24*time.Hour + 5*time.Minute)) {
		return nil, "Expiry date must be at most 365 days from now"
	}
	return &utc, ""
}
