package ledger_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"layerto/services/core/internal/testhelper"
)

func TestRoles_LayertoAppPermissionsOnEvents(t *testing.T) {
	adminPool := testhelper.GetTestPool(t)
	defer adminPool.Close()
	testhelper.ResetTestDB(t, adminPool)

	appPool := testhelper.GetAppPool(t)
	defer appPool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Verify that we are connected as role layerto_app
	var currentUser string
	if err := appPool.QueryRow(ctx, "SELECT current_user;").Scan(&currentUser); err != nil {
		t.Fatalf("failed to query current_user: %v", err)
	}
	if currentUser != "layerto_app" {
		t.Fatalf("expected connected user to be 'layerto_app', got '%s'", currentUser)
	}

	// 2. Assert UPDATE fails with permission denied
	_, err := appPool.Exec(ctx, "UPDATE events SET type = 'malicious' WHERE seq = 1;")
	if err == nil {
		t.Fatalf("expected UPDATE on events as layerto_app to fail, but it succeeded")
	}
	if !strings.Contains(err.Error(), "permission denied for table events") {
		t.Fatalf("expected 'permission denied for table events', got: %v", err)
	}

	// 3. Assert DELETE fails with permission denied
	_, err = appPool.Exec(ctx, "DELETE FROM events WHERE seq = 1;")
	if err == nil {
		t.Fatalf("expected DELETE on events as layerto_app to fail, but it succeeded")
	}
	if !strings.Contains(err.Error(), "permission denied for table events") {
		t.Fatalf("expected 'permission denied for table events', got: %v", err)
	}

	// 4. Assert TRUNCATE fails with permission denied
	_, err = appPool.Exec(ctx, "TRUNCATE events;")
	if err == nil {
		t.Fatalf("expected TRUNCATE on events as layerto_app to fail, but it succeeded")
	}
	if !strings.Contains(err.Error(), "permission denied for table events") {
		t.Fatalf("expected 'permission denied for table events', got: %v", err)
	}

	// 5. Assert SELECT succeeds as layerto_app
	var count int
	if err := appPool.QueryRow(ctx, "SELECT count(*) FROM events;").Scan(&count); err != nil {
		t.Fatalf("expected SELECT on events to succeed for layerto_app, got error: %v", err)
	}
}
