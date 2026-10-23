package gateway_test

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/testhelper"
)

type mockModelClient struct {
	callCount int32
}

func (m *mockModelClient) RunSync(ctx context.Context, endpoint, modelSlug, imageBase64, prompt string, params map[string]any) (*models.WorkerResponse, error) {
	atomic.AddInt32(&m.callCount, 1)
	return &models.WorkerResponse{
		ModelVersion: "2026.10.1",
		Predictions: []models.Prediction{
			{Label: "Chelonia mydas", Confidence: 0.99},
		},
	}, nil
}

func createTestPNG(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for x := 0; x < width; x++ {
		for y := 0; y < height; y++ {
			img.Set(x, y, color.RGBA{R: 255, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func TestGateway_NonImageUploadReturns400(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Create user & key
	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	queries := db.New(pool)
	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "gw-test@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	fullKey, _, err := keys.Create(ctx, pool, userID, "gw-key", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	client := &mockModelClient{}
	handler := gateway.NewHandler(pool, client)

	// Send non-image text as multipart image
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("image", "not-an-image.txt")
	_, _ = part.Write([]byte("this is plain text, not a picture"))
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/v1/vision/turtle-id", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+fullKey)

	rr := httptest.NewRecorder()
	handler.HandleVisionDirect(rr, req, "turtle-id")

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for non-image, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestGateway_OversizedUploadReturns413(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	queries := db.New(pool)
	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "gw-large@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	fullKey, _, err := keys.Create(ctx, pool, userID, "gw-large-key", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	client := &mockModelClient{}
	handler := gateway.NewHandler(pool, client)

	// Create body with dummy bytes exceeding 10 MB
	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		part, err := mw.CreateFormFile("image", "huge.jpg")
		if err != nil {
			return
		}
		// Write 11 MB of bytes
		chunk := make([]byte, 1024*1024)
		for i := 0; i < 11; i++ {
			if _, err := part.Write(chunk); err != nil {
				return
			}
		}
		_ = mw.Close()
	}()

	req := httptest.NewRequest(http.MethodPost, "/v1/vision/turtle-id", pr)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+fullKey)

	rr := httptest.NewRecorder()
	handler.HandleVisionDirect(rr, req, "turtle-id")

	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 Request Entity Too Large, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestGateway_FailClosedNoLedgerCommitModelNotCalled(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	queries := db.New(pool)
	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "gw-failclosed@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  0,
		FreeUsed: 0,
	})
	fullKey, _, err := keys.Create(ctx, pool, userID, "gw-failclosed-key", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	client := &mockModelClient{}
	handler := gateway.NewHandler(pool, client)

	// Inject failing ledger append
	handler.SetAppendFunc(func(ctx context.Context, tx pgx.Tx, in ledger.EventInput) (*db.Event, error) {
		return nil, errors.New("simulated disk/database failure on ledger append")
	})

	pngBytes := createTestPNG(20, 20)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("image", "valid.png")
	_, _ = part.Write(pngBytes)
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/v1/vision/turtle-id", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+fullKey)

	rr := httptest.NewRecorder()
	handler.HandleVisionDirect(rr, req, "turtle-id")

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 Internal Server Error when ledger fails, got %d: %s", rr.Code, rr.Body.String())
	}

	// Model client MUST NOT have been called!
	if atomic.LoadInt32(&client.callCount) != 0 {
		t.Fatalf("FAIL CLOSED VIOLATION: model client was called %d times when ledger commit failed!", client.callCount)
	}
}

func TestGateway_SuccessWorkflow(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	queries := db.New(pool)
	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "gw-success@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  0,
		FreeUsed: 0,
	})
	fullKey, _, err := keys.Create(ctx, pool, userID, "gw-success-key", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	client := &mockModelClient{}
	handler := gateway.NewHandler(pool, client)

	pngBytes := createTestPNG(50, 50)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("image", "turtle.png")
	_, _ = part.Write(pngBytes)
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/v1/vision/turtle-id", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+fullKey)

	rr := httptest.NewRecorder()
	handler.HandleVisionDirect(rr, req, "turtle-id")

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
	}

	if atomic.LoadInt32(&client.callCount) != 1 {
		t.Fatalf("expected model to be called once, got %d", client.callCount)
	}

	// Verify ledger has request.received and request.executed
	res, err := ledger.Verify(ctx, pool)
	if err != nil || !res.Ok {
		t.Fatalf("ledger chain should verify: %v", err)
	}
	// key.created (1) + request.received (2) + request.executed (3)
	if res.Checked < 3 {
		t.Fatalf("expected at least 3 events in ledger, got %d", res.Checked)
	}
}
