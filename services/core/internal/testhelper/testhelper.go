package testhelper

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

var setupOnce sync.Once

// GetTestPool connects to TEST_DATABASE_URL, ensuring the database exists and migrations are applied.
func GetTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	testURL := os.Getenv("TEST_DATABASE_URL")
	if testURL == "" {
		testURL = "postgres://layerto:layerto@localhost:5434/layerto_test?sslmode=disable"
	}

	setupOnce.Do(func() {
		ensureTestDatabaseExists(t, testURL)
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, testURL)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	return pool
}

// GetAppPool connects to TEST_APP_DATABASE_URL as the layerto_app role.
func GetAppPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	appURL := os.Getenv("TEST_APP_DATABASE_URL")
	if appURL == "" {
		appURL = "postgres://layerto_app:layerto_app_pass@localhost:5434/layerto_test?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, appURL)
	if err != nil {
		t.Fatalf("failed to connect as layerto_app to test database: %v", err)
	}

	return pool
}

// ResetTestDB resets the test database by dropping the public schema and re-applying migrations.
// This strictly avoids disabling triggers or mutating events directly (SPEC §17 rule 3).
func ResetTestDB(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	testURL := os.Getenv("TEST_DATABASE_URL")
	if testURL == "" {
		testURL = "postgres://layerto:layerto@localhost:5434/layerto_test?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Cleanly reset schema using DDL
	_, err := pool.Exec(ctx, "DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
	if err != nil {
		t.Fatalf("failed to reset public schema: %v", err)
	}

	// Re-run migrations fresh
	runMigrations(t, testURL)
}

func ensureTestDatabaseExists(t *testing.T, testURL string) {
	t.Helper()

	idx := strings.LastIndex(testURL, "/")
	if idx == -1 {
		return
	}
	dbPart := testURL[idx+1:]
	qIdx := strings.Index(dbPart, "?")
	dbName := dbPart
	query := ""
	if qIdx != -1 {
		dbName = dbPart[:qIdx]
		query = dbPart[qIdx:]
	}

	adminURL := testURL[:idx+1] + "layerto" + query

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		return
	}
	defer conn.Close(ctx)

	var exists bool
	_ = conn.QueryRow(ctx, "SELECT true FROM pg_database WHERE datname = $1", dbName).Scan(&exists)
	if !exists {
		_, err = conn.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s", dbName))
		if err != nil && !strings.Contains(err.Error(), "already exists") {
			t.Logf("create database warning: %v", err)
		}
	}

	runMigrations(t, testURL)
}

func runMigrations(t *testing.T, testURL string) {
	t.Helper()

	migrationsDir := findMigrationsDir()

	sqlDB, err := sql.Open("pgx", testURL)
	if err != nil {
		t.Fatalf("open migration db error: %v", err)
	}
	defer sqlDB.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("set dialect error: %v", err)
	}

	if err := goose.Up(sqlDB, migrationsDir); err != nil {
		t.Fatalf("apply test migrations error: %v", err)
	}
}

func findMigrationsDir() string {
	dir, _ := os.Getwd()
	for i := 0; i < 5; i++ {
		candidate := filepath.Join(dir, "db", "migrations")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		candidate = filepath.Join(dir, "services", "core", "db", "migrations")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		dir = filepath.Dir(dir)
	}
	return "db/migrations"
}
