package workflows

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/ledger"
)

const (
	MaxWorkflowsPerUser = 50
	MaxWorkflowNameLen  = 100
	MaxWorkflowDescLen  = 500
)

type Handler struct {
	pool            *pgxpool.Pool
	gwHandler       *gateway.Handler
	userRateLimiter *auth.UserRateLimiter
	appendFunc      billing.AppendFunc
}

func NewHandler(pool *pgxpool.Pool, gwHandler *gateway.Handler, userLimiter *auth.UserRateLimiter) *Handler {
	return &Handler{
		pool:            pool,
		gwHandler:       gwHandler,
		userRateLimiter: userLimiter,
		appendFunc:      ledger.Append,
	}
}

func (h *Handler) SetAppendFunc(fn billing.AppendFunc) {
	h.appendFunc = fn
}

type NodeCounts struct {
	Input     int `json:"input"`
	Model     int `json:"model"`
	Condition int `json:"condition"`
	ForEach   int `json:"for_each"`
	Output    int `json:"output"`
	Total     int `json:"total"`
}

type WorkflowListItem struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	NodeCounts  NodeCounts `json:"node_counts"`
	Models      []string   `json:"models"`
	Version     int32      `json:"version"`
	CreatedAt   string     `json:"created_at"`
	UpdatedAt   string     `json:"updated_at"`
}

type WorkflowDetail struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Definition  json.RawMessage `json:"definition"`
	Version     int32           `json:"version"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

type CreateWorkflowRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Definition  json.RawMessage `json:"definition"`
}

type UpdateWorkflowRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Definition  json.RawMessage `json:"definition"`
	Version     int32           `json:"version"`
}

type ValidateWorkflowRequest struct {
	Definition json.RawMessage `json:"definition"`
}

func (h *Handler) isModelActive(ctx context.Context, slug string) (bool, error) {
	queries := db.New(h.pool)
	mRow, err := queries.GetModelBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return mRow.Enabled, nil
}

// HandleList lists all active workflows for current user.
func (h *Handler) HandleList(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	queries := db.New(h.pool)
	rows, err := queries.ListWorkflowsByUserID(r.Context(), user.ID)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list workflows")
		return
	}

	res := make([]WorkflowListItem, 0, len(rows))
	for _, row := range rows {
		var def struct {
			Nodes []struct {
				Type   string `json:"type"`
				Config struct {
					ModelSlug string `json:"model_slug"`
				} `json:"config"`
			} `json:"nodes"`
		}
		_ = json.Unmarshal(upgradeV1(row.Definition), &def)

		counts := NodeCounts{Total: len(def.Nodes)}
		modelsUsed := []string{}
		seen := map[string]bool{}
		for _, n := range def.Nodes {
			switch n.Type {
			case NodeInput:
				counts.Input++
			case NodeModel:
				counts.Model++
				if slug := n.Config.ModelSlug; slug != "" && !seen[slug] {
					seen[slug] = true
					modelsUsed = append(modelsUsed, slug)
				}
			case NodeCondition:
				counts.Condition++
			case NodeForEach:
				counts.ForEach++
			case NodeOutput:
				counts.Output++
			}
		}

		res = append(res, WorkflowListItem{
			ID:          fmtUUID(row.ID),
			Name:        row.Name,
			Description: row.Description,
			NodeCounts:  counts,
			Models:      modelsUsed,
			Version:     row.Version,
			CreatedAt:   row.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt:   row.UpdatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	httpx.JSON(w, http.StatusOK, res)
}

// HandleCreate creates a new workflow.
func (h *Handler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req CreateWorkflowRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, MaxDefinitionBytes+8<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	nameLen := utf8.RuneCountInString(req.Name)
	if nameLen < 1 || nameLen > MaxWorkflowNameLen {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Name must be between 1 and 100 characters")
		return
	}

	descLen := utf8.RuneCountInString(req.Description)
	if descLen > MaxWorkflowDescLen {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Description must be at most 500 characters")
		return
	}

	// Validate definition
	valErrs, _ := Validate(r.Context(), req.Definition, h.isModelActive)
	if len(valErrs) > 0 {
		httpx.JSON(w, http.StatusBadRequest, map[string]any{
			"error":  "invalid_definition",
			"errors": valErrs,
		})
		return
	}

	queries := db.New(h.pool)
	count, err := queries.CountWorkflowsForUser(r.Context(), user.ID)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to check workflow count")
		return
	}
	if count >= MaxWorkflowsPerUser {
		httpx.WriteError(w, r, http.StatusBadRequest, "max_workflows_reached", "Maximum limit of 50 workflows reached")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database transaction error")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	created, err := txQueries.CreateWorkflow(r.Context(), db.CreateWorkflowParams{
		UserID:      user.ID,
		Name:        req.Name,
		Description: req.Description,
		Definition:  req.Definition,
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to create workflow")
		return
	}

	wfID := fmtUUID(created.ID)
	userIDStr := fmtUUID(user.ID)

	// Append ledger event workflow.created (no definition in payload)
	_, err = h.appendFunc(r.Context(), tx, ledger.EventInput{
		UserID: &userIDStr,
		Type:   "workflow.created",
		Payload: map[string]any{
			"workflow_id": wfID,
			"version":     created.Version,
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record ledger event")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit workflow creation")
		return
	}

	httpx.JSON(w, http.StatusCreated, WorkflowDetail{
		ID:          wfID,
		UserID:      userIDStr,
		Name:        created.Name,
		Description: created.Description,
		Definition:  created.Definition,
		Version:     created.Version,
		CreatedAt:   created.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   created.UpdatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// HandleGet returns a single workflow by ID.
func (h *Handler) HandleGet(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	idParam := chi.URLParam(r, "id")
	var wfUUID pgtype.UUID
	if err := wfUUID.Scan(idParam); err != nil {
		httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
		return
	}

	queries := db.New(h.pool)
	wf, err := queries.GetWorkflowByIDAndUserID(r.Context(), db.GetWorkflowByIDAndUserIDParams{
		ID:     wfUUID,
		UserID: user.ID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to fetch workflow")
		return
	}

	httpx.JSON(w, http.StatusOK, WorkflowDetail{
		ID:          fmtUUID(wf.ID),
		UserID:      fmtUUID(wf.UserID),
		Name:        wf.Name,
		Description: wf.Description,
		Definition:  wf.Definition,
		Version:     wf.Version,
		CreatedAt:   wf.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   wf.UpdatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// HandleUpdate updates an existing workflow.
func (h *Handler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	idParam := chi.URLParam(r, "id")
	var wfUUID pgtype.UUID
	if err := wfUUID.Scan(idParam); err != nil {
		httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
		return
	}

	var req UpdateWorkflowRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, MaxDefinitionBytes+8<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	nameLen := utf8.RuneCountInString(req.Name)
	if nameLen < 1 || nameLen > MaxWorkflowNameLen {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Name must be between 1 and 100 characters")
		return
	}

	descLen := utf8.RuneCountInString(req.Description)
	if descLen > MaxWorkflowDescLen {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Description must be at most 500 characters")
		return
	}

	if req.Version <= 0 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Valid current version required")
		return
	}

	// Validate definition
	valErrs, _ := Validate(r.Context(), req.Definition, h.isModelActive)
	if len(valErrs) > 0 {
		httpx.JSON(w, http.StatusBadRequest, map[string]any{
			"error":  "invalid_definition",
			"errors": valErrs,
		})
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database transaction error")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	existing, err := txQueries.GetWorkflowByIDAndUserID(r.Context(), db.GetWorkflowByIDAndUserIDParams{
		ID:     wfUUID,
		UserID: user.ID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to fetch workflow")
		return
	}

	if existing.Version != req.Version {
		httpx.WriteError(w, r, http.StatusConflict, "version_conflict", fmt.Sprintf("Workflow version conflict: expected version %d, got %d", existing.Version, req.Version))
		return
	}

	updated, err := txQueries.UpdateWorkflow(r.Context(), db.UpdateWorkflowParams{
		ID:          wfUUID,
		UserID:      user.ID,
		Name:        req.Name,
		Description: req.Description,
		Definition:  req.Definition,
		Version:     req.Version,
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to update workflow")
		return
	}

	wfID := fmtUUID(updated.ID)
	userIDStr := fmtUUID(user.ID)

	// Append ledger event workflow.updated
	_, err = h.appendFunc(r.Context(), tx, ledger.EventInput{
		UserID: &userIDStr,
		Type:   "workflow.updated",
		Payload: map[string]any{
			"workflow_id": wfID,
			"version":     updated.Version,
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record ledger event")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit workflow update")
		return
	}

	httpx.JSON(w, http.StatusOK, WorkflowDetail{
		ID:          wfID,
		UserID:      userIDStr,
		Name:        updated.Name,
		Description: updated.Description,
		Definition:  updated.Definition,
		Version:     updated.Version,
		CreatedAt:   updated.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   updated.UpdatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// HandleDelete soft deletes a workflow.
func (h *Handler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	idParam := chi.URLParam(r, "id")
	var wfUUID pgtype.UUID
	if err := wfUUID.Scan(idParam); err != nil {
		httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database transaction error")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	existing, err := txQueries.GetWorkflowByIDAndUserID(r.Context(), db.GetWorkflowByIDAndUserIDParams{
		ID:     wfUUID,
		UserID: user.ID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to fetch workflow")
		return
	}

	rowsAffected, err := txQueries.SoftDeleteWorkflow(r.Context(), db.SoftDeleteWorkflowParams{
		ID:     wfUUID,
		UserID: user.ID,
	})
	if err != nil || rowsAffected == 0 {
		httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
		return
	}

	wfID := fmtUUID(existing.ID)
	userIDStr := fmtUUID(user.ID)

	// Append ledger event workflow.deleted
	_, err = h.appendFunc(r.Context(), tx, ledger.EventInput{
		UserID: &userIDStr,
		Type:   "workflow.deleted",
		Payload: map[string]any{
			"workflow_id": wfID,
			"version":     existing.Version,
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record ledger event")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit workflow deletion")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"status": "deleted",
	})
}

// HandleValidate validates a workflow definition without saving.
func (h *Handler) HandleValidate(w http.ResponseWriter, r *http.Request) {
	var req ValidateWorkflowRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, MaxDefinitionBytes+8<<10)).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	valErrs, def := Validate(r.Context(), req.Definition, h.isModelActive)
	if valErrs == nil {
		valErrs = []ValidationError{}
	}
	resp := map[string]any{
		"valid":  len(valErrs) == 0,
		"errors": valErrs,
	}
	if def != nil {
		minCalls, maxCalls := CallBounds(def)
		resp["calls_per_image"] = map[string]int{"min": minCalls, "max": maxCalls}
	}
	httpx.JSON(w, http.StatusOK, resp)
}

// HandleRunDashboard runs a workflow from the dashboard (session auth, source "playground").
func (h *Handler) HandleRunDashboard(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}
	h.runForUser(w, r, fmtUUID(user.ID), nil, "playground")
}

// HandleRunAPI runs a workflow with an API key (source "api").
func (h *Handler) HandleRunAPI(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_api_key", "Missing or malformed Authorization header")
		return
	}
	verifiedKey, err := keys.Verify(r.Context(), h.pool, strings.TrimPrefix(authHeader, "Bearer "))
	if err != nil {
		switch {
		case errors.Is(err, keys.ErrRoleNotAllowed):
			httpx.WriteError(w, r, http.StatusForbidden, "forbidden_role", "Admin accounts can't run workflows")
		case errors.Is(err, keys.ErrAccountNotActive):
			httpx.WriteError(w, r, http.StatusForbidden, "account_not_active", "User account is pending approval or suspended")
		case errors.Is(err, keys.ErrKeyExpired):
			httpx.WriteError(w, r, http.StatusUnauthorized, "api_key_expired", "This API key has expired")
		default:
			httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_api_key", "Invalid or revoked API key")
		}
		return
	}
	keyID := verifiedKey.KeyID
	h.runForUser(w, r, verifiedKey.UserID, &keyID, "api")
}

// runForUser loads the caller's workflow, reads the images and runs it.
func (h *Handler) runForUser(w http.ResponseWriter, r *http.Request, userID string, apiKeyID *string, source string) {
	if h.userRateLimiter != nil && !h.userRateLimiter.Allow(userID) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Rate limit exceeded. Try again in a minute.")
		return
	}

	idParam := chi.URLParam(r, "id")
	var wfUUID, userUUID pgtype.UUID
	if wfUUID.Scan(idParam) != nil || userUUID.Scan(userID) != nil {
		httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
		return
	}
	wfRow, err := db.New(h.pool).GetWorkflowByIDAndUserID(r.Context(), db.GetWorkflowByIDAndUserIDParams{ID: wfUUID, UserID: userUUID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "workflow_not_found", "Workflow not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to fetch workflow")
		return
	}

	valErrs, def := Validate(r.Context(), wfRow.Definition, h.isModelActive)
	if len(valErrs) > 0 || def == nil {
		httpx.WriteError(w, r, http.StatusUnprocessableEntity, "invalid_definition", "This workflow has problems. Open it in the editor to fix them, then save.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, MaxMultipartBodyBytes)
	images, err := ParseImages(r, def.Input().InputConfig.MaxImages)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, "request_too_large", "The upload is larger than 60 MB in total.")
			return
		}
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_images", capitalizeFirst(err.Error()))
		return
	}

	out, err := Run(r.Context(), RunParams{
		WorkflowID: idParam,
		RunID:      httpx.NewUUIDv4(),
		UserID:     userID,
		APIKeyID:   apiKeyID,
		Source:     source,
		Images:     images,
		Definition: def,
		GwHandler:  h.gwHandler,
		Pool:       h.pool,
	})
	if err != nil {
		switch {
		case errors.Is(err, billing.ErrInsufficientBalance):
			httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Your balance doesn't cover this run. Add credit or use fewer images.")
		case errors.Is(err, ErrTooManyCalls):
			httpx.WriteError(w, r, http.StatusBadRequest, "too_many_calls", capitalizeFirst(err.Error())+".")
		case errors.Is(err, ErrModelNotEnabled):
			httpx.WriteError(w, r, http.StatusUnprocessableEntity, "model_unavailable", "A model in this workflow is disabled. Choose another model in the editor.")
		default:
			log.Printf("[workflows] run failed request_id=%s: %v", httpx.GetRequestID(r.Context()), err)
			httpx.WriteError(w, r, http.StatusInternalServerError, "run_failed", "The run failed. You were not charged for calls that didn't complete.")
		}
		return
	}

	w.Header().Set("Content-Type", out.ContentType)
	if strings.HasPrefix(out.ContentType, "text/csv") {
		w.Header().Set("Content-Disposition", `attachment; filename="workflow-results.csv"`)
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out.Body)
}

func capitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}
