package httpx

import (
	"log"
	"net/http"
	"time"
)

type statusResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *statusResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

// SanitizedLogger logs HTTP requests with request_id, suppressing sensitive headers and body contents.
func SanitizedLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		reqID := GetRequestID(r.Context())

		next.ServeHTTP(sw, r)

		duration := time.Since(start)
		log.Printf("[http] [%s] %s %s %d in %v", reqID, r.Method, r.URL.Path, sw.statusCode, duration)
	})
}
