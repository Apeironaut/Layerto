package gateway

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/router"
)

// HandlePlayground processes POST /api/playground/{model_slug} and POST /api/playground/auto
// Authenticated via user session, rate-limited per user, and records payload.source = "playground" with api_key_id = null.
func (h *Handler) HandlePlayground(w http.ResponseWriter, r *http.Request, slug string, userLimiter *auth.UserRateLimiter) {
	reqID := httpx.GetRequestID(r.Context())

	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}
	userID := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", user.ID.Bytes[0:4], user.ID.Bytes[4:6], user.ID.Bytes[6:8], user.ID.Bytes[8:10], user.ID.Bytes[10:16])

	// Rate limit per user (60 requests/min)
	if userLimiter != nil && !userLimiter.Allow(userID) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Rate limit exceeded: 60 requests per minute allowed")
		return
	}

	// Read image into memory (never disk)
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

	if err := validateImage(imgBytes); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", err.Error())
		return
	}

	// Resolve route
	var resolvedSlug string
	var routed string
	var matchedKw string

	if slug == "auto" {
		routed = "auto"
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
		resolvedSlug = routeRes.ModelSlug
		matchedKw = routeRes.MatchedKeyword
	} else {
		routed = "direct"
		resolvedSlug = slug
		matchedKw = "direct"
	}

	// Resolve model
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
		UserID:         userID,
		APIKeyID:       nil,
		ModelSlug:      resolvedSlug,
		ModelEndpoint:  modelRow.RunpodEndpoint,
		Route:          routed,
		Source:         "playground",
		MatchedKeyword: matchedKw,
		Prompt:         prompt,
		Params:         params,
		ImageBytes:     imgBytes,
	})
	if err != nil {
		if errors.Is(err, billing.ErrInsufficientBalance) {
			httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Insufficient balance to execute playground request")
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

	// 7. Return response
	resp := map[string]any{
		"request_id":    callRes.RequestID,
		"model":         resolvedSlug,
		"routed":        routed,
		"predictions":   callRes.Predictions,
		"model_version": callRes.ModelVersion,
		"latency_ms":    callRes.LatencyMs,
		"charge_usd":    billing.FormatMicroUSD(callRes.ChargeMicro),
	}

	httpx.JSON(w, http.StatusOK, resp)
}
