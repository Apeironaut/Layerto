package gateway_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/testhelper"
)

func TestPublicModels_ListAndCacheHeaders(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	queries := db.New(pool)
	// Ensure bioclip and turtle-id are enabled with expected prices
	_, err := queries.UpdateModelEnabled(ctx, db.UpdateModelEnabledParams{
		Slug:    "turtle-id",
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("failed to enable turtle-id: %v", err)
	}
	_, err = queries.UpdateModelEnabled(ctx, db.UpdateModelEnabledParams{
		Slug:    "bioclip",
		Enabled: true,
	})
	if err != nil {
		t.Fatalf("failed to enable bioclip: %v", err)
	}

	mockClient := models.NewClient("fake-key")
	handler := gateway.NewHandler(pool, mockClient)

	// 1. Call GET /v1/models with no auth
	req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	rec := httptest.NewRecorder()
	handler.HandleListPublicModels(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	// 2. Check Cache-Control header
	cacheControl := rec.Header().Get("Cache-Control")
	if cacheControl != "public, max-age=60" {
		t.Fatalf("expected Cache-Control: public, max-age=60, got: %q", cacheControl)
	}

	// 3. Verify models payload
	var items []gateway.PublicModelItem
	if err := json.Unmarshal(rec.Body.Bytes(), &items); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}

	if len(items) != 2 {
		t.Fatalf("expected 2 enabled models, got %d", len(items))
	}

	foundTurtle := false
	foundBio := false
	for _, item := range items {
		if item.Slug == "turtle-id" {
			foundTurtle = true
			if item.PriceUSD != "0.002000" {
				t.Errorf("expected turtle-id price 0.002000, got %s", item.PriceUSD)
			}
			if item.IsOpen {
				t.Errorf("expected turtle-id is_open = false, got true")
			}
		}
		if item.Slug == "bioclip" {
			foundBio = true
			if item.PriceUSD != "0.001000" {
				t.Errorf("expected bioclip price 0.001000, got %s", item.PriceUSD)
			}
			if !item.IsOpen {
				t.Errorf("expected bioclip is_open = true, got false")
			}
			if item.License != "see model card" {
				t.Errorf("expected bioclip license 'see model card', got %s", item.License)
			}
		}
	}

	if !foundTurtle || !foundBio {
		t.Fatalf("missing expected models: turtle-id=%v, bioclip=%v", foundTurtle, foundBio)
	}

	// 4. Disable one model and verify it is hidden from GET /v1/models
	_, err = queries.UpdateModelEnabled(ctx, db.UpdateModelEnabledParams{
		Slug:    "turtle-id",
		Enabled: false,
	})
	if err != nil {
		t.Fatalf("failed to disable turtle-id: %v", err)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	rec2 := httptest.NewRecorder()
	handler.HandleListPublicModels(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK after disable, got %d", rec2.Code)
	}

	var itemsAfter []gateway.PublicModelItem
	if err := json.Unmarshal(rec2.Body.Bytes(), &itemsAfter); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}

	if len(itemsAfter) != 1 {
		t.Fatalf("expected 1 model after disabling turtle-id, got %d", len(itemsAfter))
	}
	if itemsAfter[0].Slug != "bioclip" {
		t.Fatalf("expected only bioclip, got %s", itemsAfter[0].Slug)
	}
}
