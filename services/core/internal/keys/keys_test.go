package keys_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/testhelper"
)

func createTestUser(t *testing.T, pool *pgxpool.Pool, email, status string) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	queries := db.New(pool)
	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        email,
		PasswordHash: "test_hash",
		Name:         pgtype.Text{String: "Test User", Valid: true},
		Role:         "user",
		Status:       status,
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}

	return userID
}

func TestKeys_Validation(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Create active user and key
	userID := createTestUser(t, pool, "active@layerto.test", "active")

	fullKey, keyRow, err := keys.Create(ctx, pool, userID, "primary", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	// 2. Valid key -> ok
	vk, err := keys.Verify(ctx, pool, fullKey)
	if err != nil {
		t.Fatalf("expected valid key to verify, got: %v", err)
	}
	if vk.UserID != userID || vk.KeyPrefix != keyRow.Prefix {
		t.Fatalf("unexpected verified key details: %+v", vk)
	}

	// 3. Wrong secret -> ErrInvalidKey
	parts := []string{"lt", keyRow.Prefix[3:], "wrongsecretwrongsecretwrongsecret1234"}
	wrongKey := parts[0] + "_" + parts[1] + "_" + parts[2]
	_, err = keys.Verify(ctx, pool, wrongKey)
	if !errors.Is(err, keys.ErrInvalidKey) {
		t.Fatalf("expected ErrInvalidKey, got: %v", err)
	}

	// 4. Revoked key -> ErrKeyRevoked
	err = keys.Revoke(ctx, pool, vk.KeyID, userID)
	if err != nil {
		t.Fatalf("revoke key error: %v", err)
	}

	_, err = keys.Verify(ctx, pool, fullKey)
	if !errors.Is(err, keys.ErrKeyRevoked) {
		t.Fatalf("expected ErrKeyRevoked, got: %v", err)
	}

	// 5. Suspended user's key -> ErrAccountNotActive
	suspendedUserID := createTestUser(t, pool, "suspended@layerto.test", "suspended")
	suspendedKey, _, err := keys.Create(ctx, pool, suspendedUserID, "suspended-key", nil)
	if err != nil {
		t.Fatalf("create suspended user key error: %v", err)
	}

	_, err = keys.Verify(ctx, pool, suspendedKey)
	if !errors.Is(err, keys.ErrAccountNotActive) {
		t.Fatalf("expected ErrAccountNotActive, got: %v", err)
	}

	// 6. Expired key -> ErrKeyExpired
	pastTime := time.Now().Add(-1 * time.Hour)
	expiredKey, _, err := keys.Create(ctx, pool, userID, "expired-key", &pastTime)
	if err != nil {
		t.Fatalf("create expired key error: %v", err)
	}

	_, err = keys.Verify(ctx, pool, expiredKey)
	if !errors.Is(err, keys.ErrKeyExpired) {
		t.Fatalf("expected ErrKeyExpired, got: %v", err)
	}
}
