package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/db"
)

const (
	SessionCookieName = "lt_session"
	SessionTTL        = 14 * 24 * time.Hour
)

// HashToken computes sha256_hex(token).
func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// GenerateSessionToken creates 32 cryptographically random bytes encoded as base64url.
func GenerateSessionToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("read random bytes error: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// CreateSession generates a session, stores sha256(token) in the database, and returns the plaintext token.
func CreateSession(ctx context.Context, queries *db.Queries, userUUID pgtype.UUID) (string, *db.Session, error) {
	token, err := GenerateSessionToken()
	if err != nil {
		return "", nil, err
	}

	tokenHash := HashToken(token)
	expiresAt := time.Now().UTC().Add(SessionTTL)

	session, err := queries.CreateSession(ctx, db.CreateSessionParams{
		ID:        tokenHash,
		UserID:    userUUID,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return "", nil, fmt.Errorf("insert session error: %w", err)
	}

	return token, &session, nil
}

// LookupSessionByToken hashes the incoming cookie token and fetches the session row.
func LookupSessionByToken(ctx context.Context, queries *db.Queries, token string) (*db.Session, error) {
	tokenHash := HashToken(token)
	session, err := queries.GetSessionByID(ctx, tokenHash)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// SetSessionCookie sets the lt_session cookie with HttpOnly and SameSite=Lax.
func SetSessionCookie(w http.ResponseWriter, r *http.Request, token string, expiresAt time.Time) {
	isSecure := r.TLS != nil || os.Getenv("ENV") == "production" || r.Header.Get("X-Forwarded-Proto") == "https"
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(SessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearSessionCookie clears the lt_session cookie.
func ClearSessionCookie(w http.ResponseWriter, r *http.Request) {
	isSecure := r.TLS != nil || os.Getenv("ENV") == "production" || r.Header.Get("X-Forwarded-Proto") == "https"
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
	})
}
