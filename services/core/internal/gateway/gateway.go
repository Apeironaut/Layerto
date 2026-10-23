package gateway

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	_ "golang.org/x/image/webp"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/router"
)

const (
	MaxBodyBytes  = 12 << 20 // 12 MB
	MaxImageBytes = 10 << 20 // 10 MB
	MaxDimension  = 8000
)

// Handler serves public vision API endpoints.
type Handler struct {
	pool        *pgxpool.Pool
	modelClient models.Client
	router      router.Router
	// Optional custom ledger appender for fail-closed testing
	appendFunc func(ctx context.Context, tx pgx.Tx, in ledger.EventInput) (*db.Event, error)
}

// NewHandler creates a new gateway Handler.
func NewHandler(pool *pgxpool.Pool, client models.Client, rtr ...router.Router) *Handler {
	var r router.Router
	if len(rtr) > 0 {
		r = rtr[0]
	}
	return &Handler{
		pool:        pool,
		modelClient: client,
		router:      r,
		appendFunc:  ledger.Append,
	}
}

// SetAppendFunc allows testing fail-closed ledger errors.
func (h *Handler) SetAppendFunc(fn func(ctx context.Context, tx pgx.Tx, in ledger.EventInput) (*db.Event, error)) {
	h.appendFunc = fn
}

// HandleVisionDirect processes POST /v1/vision/{model_slug}
func (h *Handler) HandleVisionDirect(w http.ResponseWriter, r *http.Request, slug string) {
	reqID := httpx.GetRequestID(r.Context())

	// 1. Authenticate API key via Bearer token
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_api_key", "Missing or malformed Authorization header")
		return
	}
	rawKey := strings.TrimPrefix(authHeader, "Bearer ")

	verifiedKey, err := keys.Verify(r.Context(), h.pool, rawKey)
	if err != nil {
		if errors.Is(err, keys.ErrRoleNotAllowed) {
			httpx.WriteError(w, r, http.StatusForbidden, "forbidden_role", "Admin accounts can't use the API gateway.")
			return
		}
		if errors.Is(err, keys.ErrAccountNotActive) {
			httpx.WriteError(w, r, http.StatusForbidden, "account_not_active", "User account is pending approval or suspended")
			return
		}
		if errors.Is(err, keys.ErrKeyExpired) {
			httpx.WriteError(w, r, http.StatusUnauthorized, "api_key_expired", "This API key has expired.")
			return
		}
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_api_key", "Invalid or revoked API key")
		return
	}

	// 2. Validate input and read image into memory (never disk)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)

	imgBytes, prompt, params, _, err := h.parseInput(r)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) || strings.Contains(err.Error(), "too large") {
			httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, "image_too_large", "Image size exceeds 10 MB limit")
			return
		}
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", err.Error())
		return
	}

	// Requirement 4: Prompts are at most 1000 characters → otherwise 400 invalid_request
	if utf8.RuneCountInString(prompt) > 1000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Prompt exceeds maximum limit of 1000 characters")
		return
	}

	// Sniff magic bytes & dimensions
	if err := validateImage(imgBytes); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", err.Error())
		return
	}

	// 3. Resolve model
	queries := db.New(h.pool)
	modelRow, err := queries.GetModelBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "model_not_found", fmt.Sprintf("Model '%s' not found or disabled", slug))
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to resolve model")
		return
	}

	// 4-6. Execute single billed call
	callRes, err := h.ExecuteBilledCall(r.Context(), ExecuteCallParams{
		RequestID:      reqID,
		UserID:         verifiedKey.UserID,
		APIKeyID:       &verifiedKey.KeyID,
		ModelSlug:      slug,
		ModelEndpoint:  modelRow.RunpodEndpoint,
		Route:          "direct",
		Source:         "api",
		MatchedKeyword: "direct",
		Prompt:         prompt,
		Params:         params,
		ImageBytes:     imgBytes,
	})
	if err != nil {
		if errors.Is(err, billing.ErrInsufficientBalance) {
			httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Insufficient balance to execute model")
			return
		}
		if errors.Is(err, billing.ErrModelNotFound) {
			httpx.WriteError(w, r, http.StatusNotFound, "model_not_found", fmt.Sprintf("Model '%s' not found or disabled", slug))
			return
		}
		if errors.Is(err, models.ErrModelTimeout) {
			httpx.WriteError(w, r, http.StatusGatewayTimeout, "model_timeout", "Model worker execution timed out")
			return
		}
		if callRes != nil && callRes.RequestID != "" {
			log.Printf("[gateway] model error request_id=%s: %v", httpx.GetRequestID(r.Context()), err)
			httpx.WriteError(w, r, http.StatusBadGateway, "model_error", "The model failed to process this image. You were not charged.")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to reserve balance for request")
		return
	}

	// 7. Return normalized 200 response
	resp := map[string]any{
		"request_id":    callRes.RequestID,
		"model":         slug,
		"routed":        "direct",
		"predictions":   callRes.Predictions,
		"model_version": callRes.ModelVersion,
		"latency_ms":    callRes.LatencyMs,
		"charge_usd":    billing.FormatMicroUSD(callRes.ChargeMicro),
	}

	httpx.JSON(w, http.StatusOK, resp)
}

// HandleVisionAuto processes POST /v1/vision/auto
func (h *Handler) HandleVisionAuto(w http.ResponseWriter, r *http.Request) {
	reqID := httpx.GetRequestID(r.Context())

	// 1. Authenticate API key via Bearer token
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_api_key", "Missing or malformed Authorization header")
		return
	}
	rawKey := strings.TrimPrefix(authHeader, "Bearer ")

	verifiedKey, err := keys.Verify(r.Context(), h.pool, rawKey)
	if err != nil {
		if errors.Is(err, keys.ErrRoleNotAllowed) {
			httpx.WriteError(w, r, http.StatusForbidden, "forbidden_role", "Admin accounts can't use the API gateway.")
			return
		}
		if errors.Is(err, keys.ErrAccountNotActive) {
			httpx.WriteError(w, r, http.StatusForbidden, "account_not_active", "User account is pending approval or suspended")
			return
		}
		if errors.Is(err, keys.ErrKeyExpired) {
			httpx.WriteError(w, r, http.StatusUnauthorized, "api_key_expired", "This API key has expired.")
			return
		}
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_api_key", "Invalid or revoked API key")
		return
	}

	// 2. Validate input and read image into memory (never disk)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)

	imgBytes, prompt, params, _, err := h.parseInput(r)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) || strings.Contains(err.Error(), "too large") {
			httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, "image_too_large", "Image size exceeds 10 MB limit")
			return
		}
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", err.Error())
		return
	}

	// Requirement 4: Prompts are at most 1000 characters → otherwise 400 invalid_request
	if utf8.RuneCountInString(prompt) > 1000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Prompt exceeds maximum limit of 1000 characters")
		return
	}

	// Sniff magic bytes & dimensions
	if err := validateImage(imgBytes); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", err.Error())
		return
	}

	// 3. Resolve model via auto router
	if h.router == nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Auto router not configured")
		return
	}

	routeRes, err := h.router.Route(r.Context(), prompt)
	if err != nil {
		if errors.Is(err, router.ErrModelNotFound) {
			httpx.WriteError(w, r, http.StatusNotFound, "model_not_found", "No enabled model available for auto routing")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Routing error")
		return
	}

	resolvedSlug := routeRes.ModelSlug
	matchedKw := routeRes.MatchedKeyword

	queries := db.New(h.pool)
	modelRow, err := queries.GetModelBySlug(r.Context(), resolvedSlug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "model_not_found", fmt.Sprintf("Model '%s' not found or disabled", resolvedSlug))
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to resolve model")
		return
	}

	// 4-6. Execute single billed call
	callRes, err := h.ExecuteBilledCall(r.Context(), ExecuteCallParams{
		RequestID:      reqID,
		UserID:         verifiedKey.UserID,
		APIKeyID:       &verifiedKey.KeyID,
		ModelSlug:      resolvedSlug,
		ModelEndpoint:  modelRow.RunpodEndpoint,
		Route:          "auto",
		Source:         "api",
		MatchedKeyword: matchedKw,
		Prompt:         prompt,
		Params:         params,
		ImageBytes:     imgBytes,
	})
	if err != nil {
		if errors.Is(err, billing.ErrInsufficientBalance) {
			httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Insufficient balance to execute model")
			return
		}
		if errors.Is(err, billing.ErrModelNotFound) {
			httpx.WriteError(w, r, http.StatusNotFound, "model_not_found", fmt.Sprintf("Model '%s' not found or disabled", resolvedSlug))
			return
		}
		if errors.Is(err, models.ErrModelTimeout) {
			httpx.WriteError(w, r, http.StatusGatewayTimeout, "model_timeout", "Model worker execution timed out")
			return
		}
		if callRes != nil && callRes.RequestID != "" {
			log.Printf("[gateway] model error request_id=%s: %v", httpx.GetRequestID(r.Context()), err)
			httpx.WriteError(w, r, http.StatusBadGateway, "model_error", "The model failed to process this image. You were not charged.")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to reserve balance for request")
		return
	}

	// 7. Return 200 response with routed: "auto" and model: resolvedSlug
	resp := map[string]any{
		"request_id":    callRes.RequestID,
		"model":         resolvedSlug,
		"routed":        "auto",
		"predictions":   callRes.Predictions,
		"model_version": callRes.ModelVersion,
		"latency_ms":    callRes.LatencyMs,
		"charge_usd":    billing.FormatMicroUSD(callRes.ChargeMicro),
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) parseInput(r *http.Request) (imgBytes []byte, prompt string, params map[string]any, mime string, err error) {
	ct := r.Header.Get("Content-Type")

	if strings.HasPrefix(ct, "multipart/form-data") {
		mr, err := r.MultipartReader()
		if err != nil {
			return nil, "", nil, "", fmt.Errorf("failed to read multipart stream: %w", err)
		}

		for {
			part, err := mr.NextPart()
			if err != nil {
				if errors.Is(err, io.EOF) {
					break
				}
				return nil, "", nil, "", fmt.Errorf("read part error: %w", err)
			}

			formName := part.FormName()
			if formName == "image" {
				lr := io.LimitReader(part, MaxImageBytes+1)
				buf, err := io.ReadAll(lr)
				if err != nil {
					return nil, "", nil, "", fmt.Errorf("read image error: %w", err)
				}
				if len(buf) > MaxImageBytes {
					return nil, "", nil, "", errors.New("image too large: exceeds 10 MB limit")
				}
				imgBytes = buf
				mime = part.Header.Get("Content-Type")
			} else if formName == "prompt" {
				pBuf, _ := io.ReadAll(io.LimitReader(part, 10<<10))
				prompt = string(pBuf)
			} else if formName == "params" {
				jsonBytes, _ := io.ReadAll(io.LimitReader(part, 64<<10))
				_ = json.Unmarshal(jsonBytes, &params)
			}
		}

		if len(imgBytes) == 0 {
			return nil, "", nil, "", errors.New("missing image file in multipart form")
		}

		return imgBytes, prompt, params, mime, nil
	}

	if strings.HasPrefix(ct, "application/json") {
		var req struct {
			ImageBase64 string         `json:"image_base64"`
			Prompt      string         `json:"prompt"`
			Params      map[string]any `json:"params"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			return nil, "", nil, "", fmt.Errorf("invalid json request: %w", err)
		}

		if req.ImageBase64 == "" {
			return nil, "", nil, "", errors.New("missing image_base64 field")
		}

		data, err := base64.StdEncoding.DecodeString(req.ImageBase64)
		if err != nil {
			return nil, "", nil, "", errors.New("invalid base64 image data")
		}

		if len(data) > MaxImageBytes {
			return nil, "", nil, "", errors.New("image too large: exceeds 10 MB limit")
		}

		return data, req.Prompt, req.Params, "application/octet-stream", nil
	}

	return nil, "", nil, "", fmt.Errorf("unsupported Content-Type: %s", ct)
}

func validateImage(data []byte) error {
	if len(data) < 8 {
		return errors.New("file is too small to be a valid image")
	}

	// Sniff magic bytes
	isJPEG := len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF
	isPNG := len(data) >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 &&
		data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A
	isWebP := len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP"

	if !isJPEG && !isPNG && !isWebP {
		return errors.New("unsupported image format (supported: jpg, png, webp)")
	}

	// Decode dimensions
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to decode image header: %w", err)
	}

	if cfg.Width > MaxDimension || cfg.Height > MaxDimension {
		return fmt.Errorf("image dimensions (%dx%d) exceed maximum %dx%d cap", cfg.Width, cfg.Height, MaxDimension, MaxDimension)
	}

	return nil
}

// ValidateImage validates magic bytes and image dimensions using existing logic.
func ValidateImage(data []byte) error {
	return validateImage(data)
}

type ExecuteCallParams struct {
	RequestID      string
	UserID         string
	APIKeyID       *string
	ModelSlug      string
	ModelEndpoint  string
	Route          string
	Source         string
	MatchedKeyword string
	Prompt         string
	Params         map[string]any
	ImageBytes     []byte
	WorkflowID     *string
	RunID          *string
	// Extra is merged into the request ledger events (e.g. site_id for model sites).
	Extra map[string]any
}

type ExecuteCallResult struct {
	RequestID    string
	ModelSlug    string
	ModelVersion string
	Predictions  []models.Prediction
	LatencyMs    int64
	ChargeMicro  int64
	IsFree       bool
}

// ExecuteBilledCall performs a single billed model call:
// reserve → run model → settle or refund → ledger events.
func (h *Handler) ExecuteBilledCall(ctx context.Context, p ExecuteCallParams) (*ExecuteCallResult, error) {
	// User-trained models: private ones answer only their owner; the worker gets the weights id.
	custom, err := catalog.Lookup(ctx, h.pool, p.ModelSlug)
	if err != nil {
		return nil, err
	}
	if !catalog.CanUse(custom, p.UserID) {
		return nil, billing.ErrModelNotFound
	}
	if custom != nil {
		params := make(map[string]any, len(p.Params)+2)
		for k, v := range p.Params {
			params[k] = v
		}
		params["ltvision_weights"] = custom.WeightsKey
		params["classes"] = custom.Classes
		p.Params = params
	}

	res, err := billing.Reserve(ctx, h.pool, h.appendFunc, billing.ReserveParams{
		UserID:         p.UserID,
		ModelSlug:      p.ModelSlug,
		RequestID:      p.RequestID,
		APIKeyID:       p.APIKeyID,
		Route:          p.Route,
		Source:         p.Source,
		MatchedKeyword: p.MatchedKeyword,
		PromptChars:    utf8.RuneCountInString(p.Prompt),
		WorkflowID:     p.WorkflowID,
		RunID:          p.RunID,
	})
	if err != nil {
		return nil, err
	}

	// Settling or refunding must finish even if the caller's context is cancelled
	// (client disconnect, workflow timeout); otherwise the reservation would be left open.
	finalCtx, cancelFinal := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	defer cancelFinal()

	imgBase64 := base64.StdEncoding.EncodeToString(p.ImageBytes)
	start := time.Now()
	workerResp, err := h.modelClient.RunSync(ctx, p.ModelEndpoint, p.ModelSlug, imgBase64, p.Prompt, p.Params)
	latencyMs := time.Since(start).Milliseconds()

	var extra map[string]any
	if len(p.Extra) > 0 {
		extra = make(map[string]any, len(p.Extra)+2)
		for k, v := range p.Extra {
			extra[k] = v
		}
	}
	if p.WorkflowID != nil || p.RunID != nil {
		if extra == nil {
			extra = make(map[string]any)
		}
		if p.WorkflowID != nil {
			extra["workflow_id"] = *p.WorkflowID
		}
		if p.RunID != nil {
			extra["run_id"] = *p.RunID
		}
	}

	if err != nil {
		errCode := "model_error"
		if errors.Is(err, models.ErrModelTimeout) {
			errCode = "model_timeout"
		}
		if extra != nil {
			_ = billing.Refund(finalCtx, h.pool, h.appendFunc, p.RequestID, p.UserID, p.ModelSlug, res.Reserved, res.Free, errCode, latencyMs, extra)
		} else {
			_ = billing.Refund(finalCtx, h.pool, h.appendFunc, p.RequestID, p.UserID, p.ModelSlug, res.Reserved, res.Free, errCode, latencyMs)
		}
		return &ExecuteCallResult{
			RequestID: p.RequestID,
			ModelSlug: p.ModelSlug,
			LatencyMs: latencyMs,
		}, err
	}

	chargeMicro := res.Reserved
	var settleErr error
	var settledCharge int64
	if extra != nil {
		settledCharge, settleErr = billing.SettleExecuted(finalCtx, h.pool, h.appendFunc, p.RequestID, p.UserID, p.APIKeyID, p.ModelSlug, workerResp.ModelVersion, res.Reserved, res.Free, latencyMs, p.Source, extra)
	} else {
		settledCharge, settleErr = billing.SettleExecuted(finalCtx, h.pool, h.appendFunc, p.RequestID, p.UserID, p.APIKeyID, p.ModelSlug, workerResp.ModelVersion, res.Reserved, res.Free, latencyMs, p.Source)
	}
	if settleErr == nil {
		chargeMicro = settledCharge
		h.rewardCreator(finalCtx, custom, p, chargeMicro)
	}

	return &ExecuteCallResult{
		RequestID:    p.RequestID,
		ModelSlug:    p.ModelSlug,
		ModelVersion: workerResp.ModelVersion,
		Predictions:  workerResp.Predictions,
		LatencyMs:    latencyMs,
		ChargeMicro:  chargeMicro,
		IsFree:       res.Free,
	}, nil
}

// rewardCreator credits the creator of a public user-trained model with their share of a paid
// call made by someone else. Credit is spendable on Layerto (cash payouts come later).
func (h *Handler) rewardCreator(ctx context.Context, custom *catalog.Custom, p ExecuteCallParams, charge int64) {
	if custom == nil || custom.Visibility != "public" || custom.OwnerID == p.UserID || charge <= 0 {
		return
	}
	bps := catalog.IntSetting(ctx, h.pool, "creator_reward_bps", 2500)
	reward := charge * bps / 10000
	if reward <= 0 {
		return
	}
	if _, err := billing.Adjust(ctx, h.pool, custom.OwnerID, reward, "creator.reward", map[string]any{
		"model_slug": p.ModelSlug, "request_id": p.RequestID, "charge": charge, "bps": bps,
	}); err != nil {
		log.Printf("[gateway] creator reward failed request_id=%s: %v", p.RequestID, err)
	}
}
