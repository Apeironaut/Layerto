package httpx

import (
	"context"
	"net/http"
)

type contextKey string

const (
	requestIDKey        contextKey = "request_id"
	researchAreaIDKey   contextKey = "research_area_id"
)

// RequestID middleware extracts or generates a UUID v4 for X-Request-Id.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = NewUUIDv4()
		}

		ctx := context.WithValue(r.Context(), requestIDKey, reqID)
		w.Header().Set("X-Request-Id", reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID retrieves the request ID from the context, or generates one if absent.
func GetRequestID(ctx context.Context) string {
	if v, ok := ctx.Value(requestIDKey).(string); ok && v != "" {
		return v
	}
	return NewUUIDv4()
}

// ResearchAreaScope middleware extracts the isolated research area ID from the X-Research-Area-ID header
// or ?area= query param and attaches it to the request context.
func ResearchAreaScope(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		areaID := r.Header.Get("X-Research-Area-ID")
		if areaID == "" {
			areaID = r.URL.Query().Get("area")
		}
		if areaID != "" {
			ctx := context.WithValue(r.Context(), researchAreaIDKey, areaID)
			w.Header().Set("X-Research-Area-ID", areaID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireResearchAreaScope middleware enforces that an isolated research area is explicitly selected.
func RequireResearchAreaScope(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		areaID := GetResearchAreaID(r.Context())
		if areaID == "" {
			JSON(w, http.StatusBadRequest, map[string]string{
				"error":   "missing_area_scope",
				"message": "X-Research-Area-ID header is required for isolated research operations",
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GetResearchAreaID retrieves the research area ID from context, or empty string if absent.
func GetResearchAreaID(ctx context.Context) string {
	if v, ok := ctx.Value(researchAreaIDKey).(string); ok {
		return v
	}
	return ""
}
