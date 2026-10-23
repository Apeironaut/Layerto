package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"

	"golang.org/x/crypto/argon2"
)

const (
	ArgonMemory      = 19 * 1024 // 19 MiB
	ArgonIterations  = 2
	ArgonParallelism = 1
	ArgonSaltLength  = 16
	ArgonKeyLength   = 32
	MinPasswordLen   = 8
	MaxPasswordLen   = 128
)

var (
	ErrPasswordTooShort = errors.New("password must be at least 8 characters long")
	ErrPasswordTooLong  = errors.New("password must be at most 128 characters long")
	ErrInvalidHash      = errors.New("invalid password hash format")

	// DummyHash is pre-computed to match argon2id execution time on unknown email logins.
	DummyHash string

	// DummyHashRunCount is an atomic counter incremented whenever VerifyDummyPassword runs (for tests).
	DummyHashRunCount int64
)

func init() {
	hash, err := HashPassword("DummyPasswordForTimingMitigation123!")
	if err != nil {
		panic(fmt.Sprintf("failed to initialize dummy password hash: %v", err))
	}
	DummyHash = hash
}

// HashPassword hashes a password using argon2id per SPEC §2 and milestone parameters.
func HashPassword(password string) (string, error) {
	if len(password) < MinPasswordLen {
		return "", ErrPasswordTooShort
	}
	if len(password) > MaxPasswordLen {
		return "", ErrPasswordTooLong
	}

	salt := make([]byte, ArgonSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt error: %w", err)
	}

	hash := argon2.IDKey([]byte(password), salt, ArgonIterations, ArgonMemory, ArgonParallelism, ArgonKeyLength)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, ArgonMemory, ArgonIterations, ArgonParallelism, b64Salt, b64Hash)

	return encoded, nil
}

// VerifyPassword compares a plaintext password against an encoded argon2id hash.
func VerifyPassword(encodedHash, password string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	// Expected parts: ["", "argon2id", "v=19", "m=...,t=...,p=...", "<salt>", "<hash>"]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, ErrInvalidHash
	}

	var memory uint32
	var iterations uint32
	var parallelism uint8
	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism)
	if err != nil {
		return false, ErrInvalidHash
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, ErrInvalidHash
	}

	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, ErrInvalidHash
	}

	hash := argon2.IDKey([]byte(password), salt, iterations, memory, parallelism, uint32(len(expectedHash)))

	if subtle.ConstantTimeCompare(hash, expectedHash) == 1 {
		return true, nil
	}
	return false, nil
}

// VerifyDummyPassword executes an argon2id verification against DummyHash so response time matches.
func VerifyDummyPassword(password string) {
	atomic.AddInt64(&DummyHashRunCount, 1)
	_, _ = VerifyPassword(DummyHash, password)
}
