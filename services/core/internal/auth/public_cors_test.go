package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublicSubdomainCORS(t *testing.T) {
	h := PublicSubdomainCORS("layerto.com")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	cases := []struct {
		method, path, origin string
		allowed              bool
	}{
		{"GET", "/v1/public/portfolio/naveen", "https://naveen.layerto.com", true},
		{"OPTIONS", "/v1/public/papers", "https://naveen.layerto.com", true},
		{"POST", "/v1/public/portfolio/naveen", "https://naveen.layerto.com", false},
		{"GET", "/api/me", "https://naveen.layerto.com", false},
		{"GET", "/v1/public/papers", "http://naveen.layerto.com", false},
		{"GET", "/v1/public/papers", "https://a.b.layerto.com", false},
		{"GET", "/v1/public/papers", "https://evil-layerto.com", false},
		{"GET", "/v1/public/papers", "https://layerto.com.evil.io", false},
	}
	for _, c := range cases {
		r := httptest.NewRequest(c.method, c.path, nil)
		r.Header.Set("Origin", c.origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		got := w.Header().Get("Access-Control-Allow-Origin") != ""
		if got != c.allowed {
			t.Errorf("%s %s from %s: allowed=%v, want %v", c.method, c.path, c.origin, got, c.allowed)
		}
	}
}
