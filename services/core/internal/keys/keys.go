package keys

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/ledger"
)

var (
	ErrInvalidKeyFormat = errors.New("invalid API key format")
	ErrInvalidKey       = errors.New("invalid API key")
	ErrKeyRevoked       = errors.New("API key has been revoked")
	ErrAccountNotActive = errors.New("account is not active")
	ErrRoleNotAllowed   = errors.New("role not allowed")
	ErrKeyExpired       = errors.New("API key has expired")
	ErrMaxKeysReached   = errors.New("maximum 10 active API keys reached")
)

type VerifiedKey struct {
	KeyID      string
	UserID     string
	UserEmail  string
	UserRole   string
	UserStatus string
	KeyPrefix  string
}

// GenerateKey produces a full key: lt_<8_char_prefix>_<32_byte_secret_base64url> and its sha256 hash.
func GenerateKey() (fullKey, prefix, keyHash string, err error) {
	var prefixBytes [4]byte
	if _, err := rand.Read(prefixBytes[:]); err != nil {
		return "", "", "", fmt.Errorf("read prefix random error: %w", err)
	}
	prefixHex := hex.EncodeToString(prefixBytes[:])
	prefix = "lt_" + prefixHex

	var secretBytes [32]byte
	if _, err := rand.Read(secretBytes[:]); err != nil {
		return "", "", "", fmt.Errorf("read secret random error: %w", err)
	}
	secret := base64.RawURLEncoding.EncodeToString(secretBytes[:])

	fullKey = prefix + "_" + secret
	h := sha256.Sum256([]byte(fullKey))
	keyHash = hex.EncodeToString(h[:])

	return fullKey, prefix, keyHash, nil
}

// Create generates and stores a new API key for a user, recording a ledger event.
func Create(ctx context.Context, pool *pgxpool.Pool, userID, name string, expiresAt *time.Time) (fullKey string, keyRow *db.ApiKey, err error) {
	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return "", nil, fmt.Errorf("invalid user uuid: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", nil, fmt.Errorf("begin transaction error: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := db.New(tx)

	// Check max 10 active keys
	count, err := queries.CountActiveKeysForUser(ctx, userUUID)
	if err != nil {
		return "", nil, fmt.Errorf("count active keys error: %w", err)
	}
	if count >= 10 {
		return "", nil, ErrMaxKeysReached
	}

	fullKey, prefix, keyHash, err := GenerateKey()
	if err != nil {
		return "", nil, err
	}

	keyID := httpx.NewUUIDv4()
	var keyUUID pgtype.UUID
	_ = keyUUID.Scan(keyID)

	var expiresAtPg pgtype.Timestamptz
	var expiresAtStr *string
	if expiresAt != nil {
		expiresAtPg = pgtype.Timestamptz{
			Time:  *expiresAt,
			Valid: true,
		}
		s := expiresAt.UTC().Format("2006-01-02T15:04:05Z07:00")
		expiresAtStr = &s
	}

	createdKey, err := queries.CreateAPIKey(ctx, db.CreateAPIKeyParams{
		ID:        keyUUID,
		UserID:    userUUID,
		Name:      name,
		Prefix:    prefix,
		KeyHash:   keyHash,
		ExpiresAt: expiresAtPg,
	})
	if err != nil {
		return "", nil, fmt.Errorf("create api key error: %w", err)
	}

	// Ledger: key.created
	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		UserID:   &userID,
		APIKeyID: &keyID,
		Type:     "key.created",
		Payload: map[string]any{
			"key_id":     keyID,
			"prefix":     prefix,
			"name":       name,
			"expires_at": expiresAtStr,
		},
	})
	if err != nil {
		return "", nil, fmt.Errorf("ledger append key.created error: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", nil, fmt.Errorf("commit transaction error: %w", err)
	}

	row := &db.ApiKey{
		ID:         createdKey.ID,
		UserID:     createdKey.UserID,
		Name:       createdKey.Name,
		Prefix:     createdKey.Prefix,
		KeyHash:    createdKey.KeyHash,
		LastUsedAt: createdKey.LastUsedAt,
		RevokedAt:  createdKey.RevokedAt,
		ExpiresAt:  createdKey.ExpiresAt,
		CreatedAt:  createdKey.CreatedAt,
	}

	return fullKey, row, nil
}

// Verify validates an incoming bearer token in constant time and checks user active status.
func Verify(ctx context.Context, pool *pgxpool.Pool, fullKey string) (*VerifiedKey, error) {
	parts := strings.SplitN(fullKey, "_", 3)
	// Expected parts: ["lt", "<8-hex-prefix>", "<secret>"]
	if len(parts) != 3 || parts[0] != "lt" || len(parts[1]) != 8 || len(parts[2]) == 0 {
		return nil, ErrInvalidKeyFormat
	}

	prefix := parts[0] + "_" + parts[1]

	queries := db.New(pool)
	keyRow, err := queries.GetAPIKeyByPrefix(ctx, prefix)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidKey
		}
		return nil, fmt.Errorf("lookup key error: %w", err)
	}

	if keyRow.RevokedAt.Valid {
		return nil, ErrKeyRevoked
	}

	// Constant-time compare hashes
	actualHash := sha256.Sum256([]byte(fullKey))
	actualHashHex := hex.EncodeToString(actualHash[:])

	if subtle.ConstantTimeCompare([]byte(strings.ToLower(keyRow.KeyHash)), []byte(strings.ToLower(actualHashHex))) != 1 {
		return nil, ErrInvalidKey
	}

	// Expiry is checked only after the secret matched, so an unauthenticated caller
	// can't learn anything about a key from its prefix alone.
	if keyRow.ExpiresAt.Valid && !time.Now().UTC().Before(keyRow.ExpiresAt.Time.UTC()) {
		return nil, ErrKeyExpired
	}

	// Check user active status
	userRow, err := queries.GetUserByID(ctx, keyRow.UserID)
	if err != nil {
		return nil, fmt.Errorf("lookup user error: %w", err)
	}

	if userRow.Status != "active" {
		return nil, ErrAccountNotActive
	}

	if userRow.Role != "user" {
		return nil, ErrRoleNotAllowed
	}

	// Asynchronously update last_used_at
	go func() {
		bgCtx := context.Background()
		_ = queries.UpdateAPIKeyLastUsed(bgCtx, keyRow.ID)
	}()

	keyIDStr := fmt.Sprintf("%x-%x-%x-%x-%x", keyRow.ID.Bytes[0:4], keyRow.ID.Bytes[4:6], keyRow.ID.Bytes[6:8], keyRow.ID.Bytes[8:10], keyRow.ID.Bytes[10:16])
	userIDStr := fmt.Sprintf("%x-%x-%x-%x-%x", userRow.ID.Bytes[0:4], userRow.ID.Bytes[4:6], userRow.ID.Bytes[6:8], userRow.ID.Bytes[8:10], userRow.ID.Bytes[10:16])

	return &VerifiedKey{
		KeyID:      keyIDStr,
		UserID:     userIDStr,
		UserEmail:  userRow.Email,
		UserRole:   userRow.Role,
		UserStatus: userRow.Status,
		KeyPrefix:  keyRow.Prefix,
	}, nil
}

// Revoke revokes an existing API key and records key.revoked event in the ledger.
func Revoke(ctx context.Context, pool *pgxpool.Pool, keyID, userID string) error {
	var keyUUID, userUUID pgtype.UUID
	if err := keyUUID.Scan(keyID); err != nil {
		return fmt.Errorf("invalid key uuid: %w", err)
	}
	if err := userUUID.Scan(userID); err != nil {
		return fmt.Errorf("invalid user uuid: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction error: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := db.New(tx)
	if err := queries.RevokeAPIKey(ctx, db.RevokeAPIKeyParams{
		ID:     keyUUID,
		UserID: userUUID,
	}); err != nil {
		return fmt.Errorf("revoke key error: %w", err)
	}

	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		UserID:   &userID,
		APIKeyID: &keyID,
		Type:     "key.revoked",
		Payload: map[string]any{
			"key_id": keyID,
		},
	})
	if err != nil {
		return fmt.Errorf("ledger append key.revoked error: %w", err)
	}

	return tx.Commit(ctx)
}
