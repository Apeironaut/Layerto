// Package studio is Layerto Studio: datasets + annotation, training (Layerto GPUs or the user's
// own notebook), custom models, the marketplace with creator rewards, the researcher workspace
// (projects, public profiles), subscription plans and model sites.
//
// Queries are written directly against pgx here (no sqlc) to keep this feature self-contained.
package studio

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/storage"
)

// Options configures the studio.
type Options struct {
	PublicAPIURL string // where notebooks and workers reach the API, e.g. https://api.layerto.com
	WorkerToken  string // shared secret for Layerto GPU training workers and inference workers
}

type Handler struct {
	pool      *pgxpool.Pool
	store     *storage.Store
	gw        *gateway.Handler
	opt       Options
	siteLimit *auth.UserRateLimiter // per visitor IP on model sites
}

func NewHandler(pool *pgxpool.Pool, store *storage.Store, gw *gateway.Handler, opt Options) *Handler {
	if opt.PublicAPIURL == "" {
		opt.PublicAPIURL = "http://localhost:8080"
	}
	return &Handler{pool: pool, store: store, gw: gw, opt: opt, siteLimit: auth.NewUserRateLimiter(20, time.Minute)}
}

// ---- helpers

func uuidStr(u pgtype.UUID) string {
	b := u.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func currentUser(w http.ResponseWriter, r *http.Request) (string, bool) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return "", false
	}
	return uuidStr(u.ID), true
}

var uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func validID(s string) bool { return uuidRe.MatchString(s) }

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return false
	}
	return true
}

func notFound(w http.ResponseWriter, r *http.Request, what string) {
	httpx.WriteError(w, r, http.StatusNotFound, "not_found", what+" not found")
}

func internal(w http.ResponseWriter, r *http.Request, err error) {
	httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Something went wrong")
	if err != nil {
		logf("internal error %s %s: %v", r.Method, r.URL.Path, err)
	}
}

var slugClean = regexp.MustCompile(`[^a-z0-9]+`)

// slugify turns a name into a URL slug ("Turtle Finder v2" -> "turtle-finder-v2").
func slugify(s string, max int) string {
	s = strings.Trim(slugClean.ReplaceAllString(strings.ToLower(s), "-"), "-")
	if len(s) > max {
		s = strings.Trim(s[:max], "-")
	}
	if len(s) < 2 {
		s = "item"
	}
	return s
}

func newToken() (plain, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	plain = "ltj_" + hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(plain))
	return plain, hex.EncodeToString(sum[:])
}

func hashToken(t string) string {
	sum := sha256.Sum256([]byte(t))
	return hex.EncodeToString(sum[:])
}

func isNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

func tsOrNil(t pgtype.Timestamptz) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.UTC().Format(time.RFC3339)
	return &s
}

func ts(t time.Time) string { return t.UTC().Format(time.RFC3339) }

func ctxTimeout(r *http.Request, d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), d)
}
