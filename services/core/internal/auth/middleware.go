package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
)

type userContextKey struct{}

// WithUser adds the authenticated user to the context.
func WithUser(ctx context.Context, user *db.User) context.Context {
	return context.WithValue(ctx, userContextKey{}, user)
}

// UserFromContext retrieves the authenticated user from the context.
func UserFromContext(ctx context.Context) (*db.User, bool) {
	u, ok := ctx.Value(userContextKey{}).(*db.User)
	return u, ok && u != nil
}

// AuthenticateSession middleware extracts and verifies the lt_session cookie.
func AuthenticateSession(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie.Value == "" {
				httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
				return
			}

			queries := db.New(pool)
			session, err := LookupSessionByToken(r.Context(), queries, cookie.Value)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Invalid session")
					return
				}
				httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to lookup session")
				return
			}

			if session.ExpiresAt.Time.Before(time.Now().UTC()) {
				httpx.WriteError(w, r, http.StatusUnauthorized, "session_expired", "Session has expired")
				return
			}

			user, err := queries.GetUserByID(r.Context(), session.UserID)
			if err != nil {
				httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "User not found")
				return
			}

			if user.Status == "suspended" {
				httpx.WriteError(w, r, http.StatusForbidden, "account_suspended", "Account has been suspended")
				return
			}

			ctx := WithUser(r.Context(), &user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireActive ensures the authenticated user has status = 'active'.
func RequireActive(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok {
			httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
			return
		}

		if user.Status == "pending" {
			httpx.WriteError(w, r, http.StatusForbidden, "account_pending", "Account pending admin approval")
			return
		}

		if user.Status != "active" {
			httpx.WriteError(w, r, http.StatusForbidden, "account_not_active", "Account is not active")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RequireRole ensures the authenticated user has the specified role.
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok {
				httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
				return
			}

			if user.Role != role {
				if role == "user" {
					httpx.WriteError(w, r, http.StatusForbidden, "forbidden_role", "Admin accounts can't use the dashboard.")
					return
				}
				httpx.WriteError(w, r, http.StatusForbidden, "forbidden", "Insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CSRF enforces X-Requested-With header and validates Origin against allowed origins on mutating requests.
func CSRF(allowedOrigins []string) func(http.Handler) http.Handler {
	originsMap := make(map[string]bool)
	for _, o := range allowedOrigins {
		originsMap[strings.TrimSpace(o)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			method := r.Method
			if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete {
				// Require X-Requested-With
				if r.Header.Get("X-Requested-With") == "" {
					httpx.WriteError(w, r, http.StatusForbidden, "forbidden", "Missing required X-Requested-With header")
					return
				}

				// Check Origin
				origin := r.Header.Get("Origin")
				if origin == "" || !originsMap[origin] {
					httpx.WriteError(w, r, http.StatusForbidden, "forbidden", "Invalid or missing Origin header")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CORS handles Cross-Origin Resource Sharing for dashboard and admin origins with credentials.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	originsMap := make(map[string]bool)
	for _, o := range allowedOrigins {
		originsMap[strings.TrimSpace(o)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && originsMap[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-Id")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// PublicSubdomainCORS lets portfolio sites at https://<name>.<rootDomain> read the public,
// read-only /v1/public/ endpoints. Other paths and methods keep the normal origin allow-list.
func PublicSubdomainCORS(rootDomain string) func(http.Handler) http.Handler {
	suffix := "." + strings.ToLower(strings.TrimSpace(rootDomain))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.ToLower(r.Header.Get("Origin"))
			if rootDomain != "" && strings.HasPrefix(r.URL.Path, "/v1/public/") &&
				(r.Method == http.MethodGet || r.Method == http.MethodOptions) && strings.HasPrefix(origin, "https://") {
				host := strings.TrimPrefix(origin, "https://")
				if label, ok := strings.CutSuffix(host, suffix); ok && label != "" && !strings.ContainsAny(label, ".:/") {
					w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Request-Id")
					w.Header().Add("Vary", "Origin")
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
