package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/mail"
	"layerto/services/core/internal/testhelper"
)

// captureMailer records messages so tests can read the reset link.
type captureMailer struct {
	mu   sync.Mutex
	msgs []mail.Message
}

func (c *captureMailer) Send(_ context.Context, m mail.Message) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.msgs = append(c.msgs, m)
	return nil
}

func (c *captureMailer) waitForMessage(t *testing.T) mail.Message {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		if len(c.msgs) > 0 {
			m := c.msgs[len(c.msgs)-1]
			c.mu.Unlock()
			return m
		}
		c.mu.Unlock()
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("no email was sent")
	return mail.Message{}
}

func (c *captureMailer) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.msgs)
}

func setupAccountApp(t *testing.T) (*chi.Mux, *db.Queries, *captureMailer) {
	t.Helper()
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)
	mailer := &captureMailer{}
	h := auth.NewHandler(pool, auth.NewLoginRateLimiter())
	h.ConfigureAccount(auth.AccountOptions{Mailer: mailer, DashboardURL: "http://dash.test"})
	origins := []string{"http://localhost:5174"}

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Route("/api", func(api chi.Router) {
		api.Use(auth.CSRF(origins))
		api.Post("/auth/signup", h.HandleSignup)
		api.Post("/auth/login", h.HandleLogin)
		api.Get("/auth/username-available", h.HandleUsernameAvailable)
		api.Post("/auth/forgot-password", h.HandleForgotPassword)
		api.Post("/auth/reset-password", h.HandleResetPassword)
		api.Group(func(a chi.Router) {
			a.Use(auth.AuthenticateSession(pool))
			a.Get("/me", h.HandleMe)
			a.Patch("/me", h.HandleUpdateProfile)
			a.Post("/me/password", h.HandleChangePassword)
		})
	})
	return r, db.New(pool), mailer
}

func call(r http.Handler, method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:5174")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func errCode(rec *httptest.ResponseRecorder) string {
	var e struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	return e.Error.Code
}

func sessionCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			return c
		}
	}
	return nil
}

func validSignup() map[string]string {
	return map[string]string{
		"first_name": "Naveen",
		"last_name":  "Chethiya",
		"username":   "naveen_c",
		"email":      "naveen@layerto.test",
		"password":   "Str0ng#Pass",
	}
}

func TestSignup_ValidatesEveryField(t *testing.T) {
	r, _, _ := setupAccountApp(t)
	cases := []struct {
		field, value, code string
	}{
		{"first_name", "", "invalid_first_name"},
		{"last_name", "R2D2", "invalid_last_name"},
		{"username", "ab", "invalid_username"},
		{"username", "admin", "username_reserved"},
		{"email", "not-an-email", "invalid_email"},
		{"password", "short1!", "weak_password"},
		{"password", "nodigits!!", "weak_password"},
		{"password", "nosymbol123", "weak_password"},
		{"password", "naveen_c#2026", "weak_password"}, // contains username
	}
	for _, c := range cases {
		body := validSignup()
		body[c.field] = c.value
		rec := call(r, http.MethodPost, "/api/auth/signup", body, nil)
		if rec.Code != http.StatusBadRequest || errCode(rec) != c.code {
			t.Errorf("%s=%q: got %d %s, want 400 %s", c.field, c.value, rec.Code, errCode(rec), c.code)
		}
	}
}

func TestSignup_CreatesProfileAndRejectsTakenUsername(t *testing.T) {
	r, q, _ := setupAccountApp(t)
	body := validSignup()
	body["username"] = "  Naveen_C " // normalized to lowercase
	if rec := call(r, http.MethodPost, "/api/auth/signup", body, nil); rec.Code != http.StatusCreated {
		t.Fatalf("signup: %d %s", rec.Code, rec.Body.String())
	}
	u, err := q.GetUserByEmail(context.Background(), "naveen@layerto.test")
	if err != nil || u.Role != "user" || u.Status != "pending" {
		t.Fatalf("user not created as pending user: %+v %v", u, err)
	}
	p, err := q.GetUserProfile(context.Background(), u.ID)
	if err != nil || p.Username != "naveen_c" || p.FirstName != "Naveen" || p.LastName != "Chethiya" {
		t.Fatalf("profile wrong: %+v %v", p, err)
	}

	other := validSignup()
	other["email"] = "other@layerto.test"
	rec := call(r, http.MethodPost, "/api/auth/signup", other, nil)
	if rec.Code != http.StatusConflict || errCode(rec) != "username_taken" {
		t.Fatalf("taken username: got %d %s", rec.Code, rec.Body.String())
	}

	avail := call(r, http.MethodGet, "/api/auth/username-available?username=NAVEEN_C", nil, nil)
	if !strings.Contains(avail.Body.String(), `"available":false`) {
		t.Fatalf("availability should be false: %s", avail.Body.String())
	}
	free := call(r, http.MethodGet, "/api/auth/username-available?username=someone_new", nil, nil)
	if !strings.Contains(free.Body.String(), `"available":true`) {
		t.Fatalf("availability should be true: %s", free.Body.String())
	}
}

func TestLogin_ByEmailOrUsername(t *testing.T) {
	r, _, _ := setupAccountApp(t)
	call(r, http.MethodPost, "/api/auth/signup", validSignup(), nil)

	for _, login := range []string{"naveen@layerto.test", "NAVEEN_C", "naveen_c"} {
		rec := call(r, http.MethodPost, "/api/auth/login", map[string]string{"login": login, "password": "Str0ng#Pass"}, nil)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"username":"naveen_c"`) {
			t.Fatalf("login %q: %d %s", login, rec.Code, rec.Body.String())
		}
	}
	bad := call(r, http.MethodPost, "/api/auth/login", map[string]string{"login": "naveen_c", "password": "wrong#Pass1"}, nil)
	if bad.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password should be 401, got %d", bad.Code)
	}
}

var tokenInLink = regexp.MustCompile(`reset-password\?token=([A-Za-z0-9_-]+)`)

func TestForgotAndResetPassword(t *testing.T) {
	r, _, mailer := setupAccountApp(t)
	call(r, http.MethodPost, "/api/auth/signup", validSignup(), nil)
	login := call(r, http.MethodPost, "/api/auth/login", map[string]string{"login": "naveen_c", "password": "Str0ng#Pass"}, nil)
	oldSession := sessionCookie(login)

	// Unknown email: same response, no email sent.
	unknown := call(r, http.MethodPost, "/api/auth/forgot-password", map[string]string{"email": "nobody@layerto.test"}, nil)
	known := call(r, http.MethodPost, "/api/auth/forgot-password", map[string]string{"email": "naveen@layerto.test"}, nil)
	if unknown.Code != http.StatusAccepted || known.Code != http.StatusAccepted || unknown.Body.String() != known.Body.String() {
		t.Fatalf("forgot-password responses must match: %d %s / %d %s", unknown.Code, unknown.Body, known.Code, known.Body)
	}
	msg := mailer.waitForMessage(t)
	if msg.To != "naveen@layerto.test" || !strings.Contains(msg.Body, "http://dash.test/reset-password?token=") {
		t.Fatalf("unexpected email: %+v", msg)
	}
	m := tokenInLink.FindStringSubmatch(msg.Body)
	if m == nil {
		t.Fatal("no token in email")
	}
	token := m[1]

	weak := call(r, http.MethodPost, "/api/auth/reset-password", map[string]string{"token": token, "password": "weakpass"}, nil)
	if errCode(weak) != "weak_password" {
		t.Fatalf("weak password should be rejected: %s", weak.Body.String())
	}
	ok := call(r, http.MethodPost, "/api/auth/reset-password", map[string]string{"token": token, "password": "N3w#Password"}, nil)
	if ok.Code != http.StatusOK {
		t.Fatalf("reset failed: %d %s", ok.Code, ok.Body.String())
	}
	reuse := call(r, http.MethodPost, "/api/auth/reset-password", map[string]string{"token": token, "password": "An0ther#Pass"}, nil)
	if errCode(reuse) != "invalid_reset_token" {
		t.Fatalf("token must be single-use: %s", reuse.Body.String())
	}
	// Old session signed out, old password rejected, new password works.
	if me := call(r, http.MethodGet, "/api/me", nil, oldSession); me.Code != http.StatusUnauthorized {
		t.Fatalf("old session should be revoked, got %d", me.Code)
	}
	if rec := call(r, http.MethodPost, "/api/auth/login", map[string]string{"login": "naveen_c", "password": "Str0ng#Pass"}, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("old password should fail, got %d", rec.Code)
	}
	if rec := call(r, http.MethodPost, "/api/auth/login", map[string]string{"login": "naveen_c", "password": "N3w#Password"}, nil); rec.Code != http.StatusOK {
		t.Fatalf("new password should work, got %d", rec.Code)
	}
	if mailer.count() != 1 {
		t.Fatalf("expected exactly 1 email, got %d", mailer.count())
	}
}

func TestChangePasswordAndProfile(t *testing.T) {
	r, _, _ := setupAccountApp(t)
	call(r, http.MethodPost, "/api/auth/signup", validSignup(), nil)
	s1 := sessionCookie(call(r, http.MethodPost, "/api/auth/login", map[string]string{"login": "naveen_c", "password": "Str0ng#Pass"}, nil))
	s2 := sessionCookie(call(r, http.MethodPost, "/api/auth/login", map[string]string{"login": "naveen@layerto.test", "password": "Str0ng#Pass"}, nil))

	wrong := call(r, http.MethodPost, "/api/me/password", map[string]string{"current_password": "nope#Nope1", "new_password": "N3w#Password"}, s1)
	if errCode(wrong) != "wrong_password" {
		t.Fatalf("wrong current password: %s", wrong.Body.String())
	}
	ok := call(r, http.MethodPost, "/api/me/password", map[string]string{"current_password": "Str0ng#Pass", "new_password": "N3w#Password"}, s1)
	if ok.Code != http.StatusOK {
		t.Fatalf("change password: %d %s", ok.Code, ok.Body.String())
	}
	if call(r, http.MethodGet, "/api/me", nil, s1).Code != http.StatusOK {
		t.Fatal("current session should stay signed in")
	}
	if call(r, http.MethodGet, "/api/me", nil, s2).Code != http.StatusUnauthorized {
		t.Fatal("other sessions should be signed out")
	}

	upd := call(r, http.MethodPatch, "/api/me", map[string]string{"first_name": "Nav", "last_name": "C"}, s1)
	if upd.Code != http.StatusOK || !strings.Contains(upd.Body.String(), `"first_name":"Nav"`) {
		t.Fatalf("update profile: %d %s", upd.Code, upd.Body.String())
	}
	locked := call(r, http.MethodPatch, "/api/me", map[string]string{"first_name": "Nav", "last_name": "C", "username": "new_name"}, s1)
	if errCode(locked) != "username_locked" {
		t.Fatalf("username must not change: %s", locked.Body.String())
	}
}
