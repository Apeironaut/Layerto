package auth

import (
	"sync"
	"time"
)

type failureRecord struct {
	attempts []time.Time
}

// LoginRateLimiter tracks failed login attempts by (IP, email) and by IP.
type LoginRateLimiter struct {
	mu           sync.Mutex
	userFailures map[string]*failureRecord // key: ip + ":" + email
	ipFailures   map[string]*failureRecord // key: ip
	window       time.Duration
	userLimit    int
	ipLimit      int
}

// NewLoginRateLimiter creates a LoginRateLimiter with 15-minute sliding windows.
func NewLoginRateLimiter() *LoginRateLimiter {
	return &LoginRateLimiter{
		userFailures: make(map[string]*failureRecord),
		ipFailures:   make(map[string]*failureRecord),
		window:       15 * time.Minute,
		userLimit:    5,
		ipLimit:      30,
	}
}

// Allow checks if the given IP and email are within allowed failure limits.
func (l *LoginRateLimiter) Allow(ip, email string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()

	// Check IP-only threshold (30 failures / 15m)
	if rec, ok := l.ipFailures[ip]; ok {
		cleanAttempts(rec, now, l.window)
		if len(rec.attempts) >= l.ipLimit {
			return false
		}
	}

	// Check IP+Email threshold (5 failures / 15m)
	pairKey := ip + ":" + email
	if rec, ok := l.userFailures[pairKey]; ok {
		cleanAttempts(rec, now, l.window)
		if len(rec.attempts) >= l.userLimit {
			return false
		}
	}

	return true
}

// RecordFailure records a login failure for the given IP and email.
func (l *LoginRateLimiter) RecordFailure(ip, email string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()

	// Record for IP
	if _, ok := l.ipFailures[ip]; !ok {
		l.ipFailures[ip] = &failureRecord{}
	}
	l.ipFailures[ip].attempts = append(l.ipFailures[ip].attempts, now)

	// Record for IP+Email
	pairKey := ip + ":" + email
	if _, ok := l.userFailures[pairKey]; !ok {
		l.userFailures[pairKey] = &failureRecord{}
	}
	l.userFailures[pairKey].attempts = append(l.userFailures[pairKey].attempts, now)
}

// Reset clears failure counts for a successful login.
func (l *LoginRateLimiter) Reset(ip, email string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	pairKey := ip + ":" + email
	delete(l.userFailures, pairKey)
}

// UserRateLimiter limits actions per user (e.g. 60 requests/minute for playground).
type UserRateLimiter struct {
	mu       sync.Mutex
	requests map[string]*failureRecord
	limit    int
	window   time.Duration
}

// NewUserRateLimiter creates a 60 requests/min rate limiter.
func NewUserRateLimiter(limit int, window time.Duration) *UserRateLimiter {
	return &UserRateLimiter{
		requests: make(map[string]*failureRecord),
		limit:    limit,
		window:   window,
	}
}

// Allow checks if the user is allowed to make a request.
func (u *UserRateLimiter) Allow(userID string) bool {
	u.mu.Lock()
	defer u.mu.Unlock()

	now := time.Now()
	rec, ok := u.requests[userID]
	if !ok {
		rec = &failureRecord{}
		u.requests[userID] = rec
	}

	cleanAttempts(rec, now, u.window)
	if len(rec.attempts) >= u.limit {
		return false
	}

	rec.attempts = append(rec.attempts, now)
	return true
}

func cleanAttempts(rec *failureRecord, now time.Time, window time.Duration) {
	cutoff := now.Add(-window)
	valid := rec.attempts[:0]
	for _, t := range rec.attempts {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	rec.attempts = valid
}
