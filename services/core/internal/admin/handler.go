package admin

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/router"
)

type Handler struct {
	pool   *pgxpool.Pool
	router router.Router
}

func NewHandler(pool *pgxpool.Pool, rtr ...router.Router) *Handler {
	var r router.Router
	if len(rtr) > 0 {
		r = rtr[0]
	}
	return &Handler{pool: pool, router: r}
}

type UserSummary struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
	Role      string `json:"role"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

// HandleListUsers lists users, optionally filtered by status query param.
func (h *Handler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")

	queries := db.New(h.pool)
	users, err := queries.ListUsersByStatus(r.Context(), statusFilter)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list users")
		return
	}

	ids := make([]pgtype.UUID, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.ID)
	}
	profiles := map[[16]byte]db.UserProfile{}
	if list, err := queries.ListUserProfilesByIDs(r.Context(), ids); err == nil {
		for _, p := range list {
			profiles[p.UserID.Bytes] = p
		}
	}

	res := make([]UserSummary, 0, len(users))
	for _, u := range users {
		p := profiles[u.ID.Bytes]
		res = append(res, UserSummary{
			ID:        fmtUUID(u.ID),
			Email:     u.Email,
			Name:      u.Name.String,
			FirstName: p.FirstName,
			LastName:  p.LastName,
			Username:  p.Username,
			Role:      u.Role,
			Status:    u.Status,
			CreatedAt: u.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	httpx.JSON(w, http.StatusOK, res)
}

// HandleApproveUser approves a pending user in a single transaction with ledger event.
// Requirement 8: Approve only from pending.
func (h *Handler) HandleApproveUser(w http.ResponseWriter, r *http.Request) {
	adminUser, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Admin authentication required")
		return
	}
	adminID := fmtUUID(adminUser.ID)

	targetID := chi.URLParam(r, "id")
	var targetUUID pgtype.UUID
	if err := targetUUID.Scan(targetID); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_id", "Invalid user UUID")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to start transaction")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	user, err := txQueries.GetUserByID(r.Context(), targetUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "user_not_found", "User not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Database error")
		return
	}

	if user.Status != "pending" {
		httpx.WriteError(w, r, http.StatusConflict, "invalid_status", fmt.Sprintf("Cannot approve user in '%s' status; only pending users can be approved", user.Status))
		return
	}

	updatedUser, err := txQueries.ApproveUser(r.Context(), targetUUID)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to approve user")
		return
	}

	// Emit user.approved ledger event in the exact same transaction
	_, err = ledger.Append(r.Context(), tx, ledger.EventInput{
		UserID: &targetID,
		Type:   "user.approved",
		Payload: map[string]any{
			"by_admin_id": adminID,
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record approval in ledger")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit approval")
		return
	}

	httpx.JSON(w, http.StatusOK, UserSummary{
		ID:        fmtUUID(updatedUser.ID),
		Email:     updatedUser.Email,
		Name:      updatedUser.Name.String,
		Role:      updatedUser.Role,
		Status:    updatedUser.Status,
		CreatedAt: updatedUser.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// HandleSuspendUser suspends a user from any state, revokes all sessions, and emits ledger event in a single transaction.
func (h *Handler) HandleSuspendUser(w http.ResponseWriter, r *http.Request) {
	adminUser, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Admin authentication required")
		return
	}
	adminID := fmtUUID(adminUser.ID)

	targetID := chi.URLParam(r, "id")
	var targetUUID pgtype.UUID
	if err := targetUUID.Scan(targetID); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_id", "Invalid user UUID")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to start transaction")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	updatedUser, err := txQueries.UpdateUserStatus(r.Context(), db.UpdateUserStatusParams{
		ID:     targetUUID,
		Status: "suspended",
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "user_not_found", "User not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to suspend user")
		return
	}

	// Revoke all sessions for suspended user
	if err := txQueries.DeleteSessionsForUser(r.Context(), targetUUID); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to revoke user sessions")
		return
	}

	// Emit user.suspended ledger event in the exact same transaction
	_, err = ledger.Append(r.Context(), tx, ledger.EventInput{
		UserID: &targetID,
		Type:   "user.suspended",
		Payload: map[string]any{
			"by_admin_id": adminID,
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record suspension in ledger")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit suspension")
		return
	}

	httpx.JSON(w, http.StatusOK, UserSummary{
		ID:        fmtUUID(updatedUser.ID),
		Email:     updatedUser.Email,
		Name:      updatedUser.Name.String,
		Role:      updatedUser.Role,
		Status:    updatedUser.Status,
		CreatedAt: updatedUser.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// HandleCreditUser credits a user's balance in micro-USD.
// Requirement 2: amount_usd is a decimal STRING ("10.50"), parsed exactly into integer micro-USD. Max $10,000.
func (h *Handler) HandleCreditUser(w http.ResponseWriter, r *http.Request) {
	adminUser, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Admin authentication required")
		return
	}
	adminID := fmtUUID(adminUser.ID)

	targetID := chi.URLParam(r, "id")
	var targetUUID pgtype.UUID
	if err := targetUUID.Scan(targetID); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_id", "Invalid user UUID")
		return
	}

	var req struct {
		AmountUSD string `json:"amount_usd"`
		Note      string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	amountMicro, err := billing.ParseAmountUSD(req.AmountUSD)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_amount", err.Error())
		return
	}

	newBalance, err := billing.Credit(r.Context(), h.pool, adminID, targetID, amountMicro, req.Note)
	if err != nil {
		if errors.Is(err, billing.ErrUserNotFound) {
			httpx.WriteError(w, r, http.StatusNotFound, "user_not_found", "User not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to credit balance")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"status":                "credited",
		"amount_micro_usd":      amountMicro,
		"amount_usd":            billing.FormatMicroUSD(amountMicro),
		"new_balance_micro_usd": newBalance,
		"new_balance_usd":       billing.FormatMicroUSD(newBalance),
		"note":                  req.Note,
	})
}

type ModelItem struct {
	ID              string `json:"id"`
	Slug            string `json:"slug"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	License         string `json:"license"`
	IsOpen          bool   `json:"is_open"`
	PricePerCall    int64  `json:"price_per_call"`
	PricePerCallUSD string `json:"price_per_call_usd"`
	Enabled         bool   `json:"enabled"`
	CreatedAt       string `json:"created_at"`
}

// HandleListModels lists all models for admin inspection and configuration.
func (h *Handler) HandleListModels(w http.ResponseWriter, r *http.Request) {
	queries := db.New(h.pool)
	modelsList, err := queries.ListAllModels(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list models")
		return
	}

	items := make([]ModelItem, 0, len(modelsList))
	for _, m := range modelsList {
		items = append(items, ModelItem{
			ID:              fmtUUID(m.ID),
			Slug:            m.Slug,
			Name:            m.Name,
			Description:     m.Description,
			License:         m.License,
			IsOpen:          m.IsOpen,
			PricePerCall:    m.PricePerCall,
			PricePerCallUSD: billing.FormatMicroUSD(m.PricePerCall),
			Enabled:         m.Enabled,
			CreatedAt:       m.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	httpx.JSON(w, http.StatusOK, items)
}

// HandleUpdateModelPrice updates a model's price and emits model.price_changed event.
// Requirement 5: Model price limit: 1 to 10,000,000 micro-USD ($10 max per call).
func (h *Handler) HandleUpdateModelPrice(w http.ResponseWriter, r *http.Request) {
	adminUser, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Admin authentication required")
		return
	}
	adminID := fmtUUID(adminUser.ID)
	slug := chi.URLParam(r, "slug")

	var req struct {
		PricePerCall *int64  `json:"price_per_call"`
		PriceUSD     *string `json:"price_usd"`
		Enabled      *bool   `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	var newPrice *int64
	if req.PricePerCall != nil {
		newPrice = req.PricePerCall
	} else if req.PriceUSD != nil {
		parsed, err := billing.ParseAmountUSD(*req.PriceUSD)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_price", err.Error())
			return
		}
		newPrice = &parsed
	}

	if newPrice == nil && req.Enabled == nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "missing_field", "price_per_call, price_usd, or enabled is required")
		return
	}

	if newPrice != nil {
		// Requirement 5: Model price limit: 1 to 10,000,000 micro-USD ($10 max per call)
		if err := billing.ValidateModelPrice(*newPrice); err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_price", err.Error())
			return
		}
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to start transaction")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	currentModel, err := txQueries.GetModelBySlugAnyStatus(r.Context(), slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "model_not_found", fmt.Sprintf("Model '%s' not found", slug))
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to query model")
		return
	}

	resPrice := currentModel.PricePerCall
	if newPrice != nil {
		updated, err := txQueries.UpdateModelPrice(r.Context(), db.UpdateModelPriceParams{
			Slug:         slug,
			PricePerCall: *newPrice,
		})
		if err != nil {
			httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to update model price")
			return
		}
		resPrice = updated.PricePerCall

		// Emit model.price_changed in ledger
		_, err = ledger.Append(r.Context(), tx, ledger.EventInput{
			Type: "model.price_changed",
			Payload: map[string]any{
				"model_slug":  slug,
				"old_price":   currentModel.PricePerCall,
				"new_price":   *newPrice,
				"by_admin_id": adminID,
			},
		})
		if err != nil {
			httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record price change in ledger")
			return
		}
	}

	resEnabled := currentModel.Enabled
	if req.Enabled != nil {
		updated, err := txQueries.UpdateModelEnabled(r.Context(), db.UpdateModelEnabledParams{
			Slug:    slug,
			Enabled: *req.Enabled,
		})
		if err != nil {
			httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to update model status")
			return
		}
		resEnabled = updated.Enabled

		eventType := "model.disabled"
		if *req.Enabled {
			eventType = "model.enabled"
		}
		_, err = ledger.Append(r.Context(), tx, ledger.EventInput{
			Type: eventType,
			Payload: map[string]any{
				"by_admin_id": adminID,
				"model_slug":  slug,
			},
		})
		if err != nil {
			httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record status change in ledger")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit model update")
		return
	}

	// Requirement 6: Reload tokenized routes on model enable/disable
	if h.router != nil {
		_ = h.router.Reload(r.Context())
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"slug":                currentModel.Slug,
		"name":                currentModel.Name,
		"old_price_micro_usd": currentModel.PricePerCall,
		"new_price_micro_usd": resPrice,
		"new_price_usd":       billing.FormatMicroUSD(resPrice),
		"enabled":             resEnabled,
	})
}

type RouteItem struct {
	ID           string `json:"id"`
	Keyword      string `json:"keyword"`
	Priority     int32  `json:"priority"`
	ModelID      string `json:"model_id"`
	ModelSlug    string `json:"model_slug"`
	ModelName    string `json:"model_name"`
	ModelEnabled bool   `json:"model_enabled"`
}

// HandleListRoutes lists all routes configured in the system.
func (h *Handler) HandleListRoutes(w http.ResponseWriter, r *http.Request) {
	queries := db.New(h.pool)
	routesList, err := queries.ListAllRoutes(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list routes")
		return
	}

	items := make([]RouteItem, 0, len(routesList))
	for _, rt := range routesList {
		items = append(items, RouteItem{
			ID:           fmtUUID(rt.ID),
			Keyword:      rt.Keyword,
			Priority:     rt.Priority,
			ModelID:      fmtUUID(rt.ModelID),
			ModelSlug:    rt.ModelSlug,
			ModelName:    rt.ModelName,
			ModelEnabled: rt.ModelEnabled,
		})
	}

	httpx.JSON(w, http.StatusOK, items)
}

type CreateRouteReq struct {
	Keyword   string `json:"keyword"`
	ModelSlug string `json:"model_slug"`
	Priority  *int32 `json:"priority"`
}

// HandleCreateRoute creates a new route and emits route.created in ledger.
// Requirement 2: Keywords are globally unique (UNIQUE(keyword)), stored normalized:
// trimmed, single spaces, NFC, lowercase. Duplicate → 409.
// Requirement 5: Appends route.created (by_admin_id, keyword, model_slug) in the same transaction.
func (h *Handler) HandleCreateRoute(w http.ResponseWriter, r *http.Request) {
	adminUser, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Admin authentication required")
		return
	}
	adminID := fmtUUID(adminUser.ID)

	var req CreateRouteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid JSON request body")
		return
	}

	normKw := router.NormalizeKeyword(req.Keyword)
	if normKw == "" || len(router.Tokenize(normKw)) == 0 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_keyword", "Keyword must contain at least one alphanumeric or mark character")
		return
	}
	if utf8.RuneCountInString(normKw) > 100 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_keyword", "Keyword must be at most 100 characters")
		return
	}

	priority := int32(100)
	if req.Priority != nil {
		priority = *req.Priority
	}

	queries := db.New(h.pool)
	modelRow, err := queries.GetModelBySlugAnyStatus(r.Context(), req.ModelSlug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "model_not_found", fmt.Sprintf("Model '%s' not found", req.ModelSlug))
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to query model")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to start transaction")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)

	// Requirement 2: Duplicate → 409
	existing, err := txQueries.GetRouteByKeyword(r.Context(), normKw)
	if err == nil && existing.ID.Valid {
		httpx.WriteError(w, r, http.StatusConflict, "route_conflict", fmt.Sprintf("Keyword '%s' already exists", normKw))
		return
	}

	createdRoute, err := txQueries.CreateRoute(r.Context(), db.CreateRouteParams{
		Keyword:  normKw,
		ModelID:  modelRow.ID,
		Priority: priority,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.WriteError(w, r, http.StatusConflict, "route_conflict", fmt.Sprintf("Keyword '%s' already exists", normKw))
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to create route")
		return
	}

	// Requirement 5: Route create and delete append route.created / route.deleted ledger
	// events (by_admin_id, keyword, model_slug) in the same transaction.
	_, err = ledger.Append(r.Context(), tx, ledger.EventInput{
		Type: "route.created",
		Payload: map[string]any{
			"by_admin_id": adminID,
			"keyword":     normKw,
			"model_slug":  modelRow.Slug,
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record route.created in ledger")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit route transaction")
		return
	}

	// Requirement 6: Reload tokenized routes in memory on route change
	if h.router != nil {
		_ = h.router.Reload(r.Context())
	}

	httpx.JSON(w, http.StatusCreated, RouteItem{
		ID:           fmtUUID(createdRoute.ID),
		Keyword:      createdRoute.Keyword,
		Priority:     createdRoute.Priority,
		ModelID:      fmtUUID(modelRow.ID),
		ModelSlug:    modelRow.Slug,
		ModelName:    modelRow.Name,
		ModelEnabled: modelRow.Enabled,
	})
}

// HandleDeleteRoute deletes a route and appends route.deleted in ledger in the same transaction.
func (h *Handler) HandleDeleteRoute(w http.ResponseWriter, r *http.Request) {
	adminUser, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Admin authentication required")
		return
	}
	adminID := fmtUUID(adminUser.ID)

	routeIDStr := chi.URLParam(r, "id")
	var routeUUID pgtype.UUID
	if err := routeUUID.Scan(routeIDStr); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_id", "Invalid route UUID")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to start transaction")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	txQueries := db.New(tx)
	rt, err := txQueries.GetRouteByID(r.Context(), routeUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "route_not_found", "Route not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to query route")
		return
	}

	if err := txQueries.DeleteRoute(r.Context(), routeUUID); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to delete route")
		return
	}

	// Requirement 5: Route create and delete append route.created / route.deleted ledger
	// events (by_admin_id, keyword, model_slug) in the same transaction.
	_, err = ledger.Append(r.Context(), tx, ledger.EventInput{
		Type: "route.deleted",
		Payload: map[string]any{
			"by_admin_id": adminID,
			"keyword":     rt.Keyword,
			"model_slug":  rt.ModelSlug,
		},
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to record route.deleted in ledger")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to commit route deletion")
		return
	}

	// Requirement 6: Reload tokenized routes in memory on route change
	if h.router != nil {
		_ = h.router.Reload(r.Context())
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"status": "deleted",
		"id":     routeIDStr,
	})
}

// HandleLedgerVerify verifies the cryptographic hash chain of the ledger.
func (h *Handler) HandleLedgerVerify(w http.ResponseWriter, r *http.Request) {
	res, err := ledger.Verify(r.Context(), h.pool)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to verify ledger hash chain")
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

type AdminStatsUsers struct {
	Pending   int64 `json:"pending"`
	Active    int64 `json:"active"`
	Suspended int64 `json:"suspended"`
}

type AdminStatsModels struct {
	Enabled  int64 `json:"enabled"`
	Disabled int64 `json:"disabled"`
}

type AdminStatsResponse struct {
	Users              AdminStatsUsers  `json:"users"`
	Models             AdminStatsModels `json:"models"`
	Routes             int64            `json:"routes"`
	Requests24h        int64            `json:"requests_24h"`
	Revenue30dMicroUSD int64            `json:"revenue_30d_micro_usd"`
	Revenue30dUSD      string           `json:"revenue_30d_usd"`
}

type AdminUserDetail struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Name          string `json:"name,omitempty"`
	FirstName     string `json:"first_name,omitempty"`
	LastName      string `json:"last_name,omitempty"`
	Username      string `json:"username,omitempty"`
	Role          string `json:"role"`
	Status        string `json:"status"`
	CreatedAt     string `json:"created_at"`
	BalanceUSD    string `json:"balance_usd"`
	FreeCallsUsed int32  `json:"free_calls_used"`
	ActiveKeys    int64  `json:"active_keys"`
	Requests30d   int64  `json:"requests_30d"`
	Spend30dUSD   string `json:"spend_30d_usd"`
	// Keys lists every key of the user (never the secret or its hash).
	Keys []AdminKeyItem `json:"keys"`
}

// AdminKeyItem is one API key as admins see it.
type AdminKeyItem struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Prefix     string  `json:"prefix"`
	CreatedAt  string  `json:"created_at"`
	LastUsedAt *string `json:"last_used_at"`
	RevokedAt  *string `json:"revoked_at"`
	ExpiresAt  *string `json:"expires_at"`
}

func optTime(t pgtype.Timestamptz) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.Format(time.RFC3339)
	return &s
}

type AdminEventItem struct {
	Seq       int64  `json:"seq"`
	Type      string `json:"type"`
	CreatedAt string `json:"created_at"`
	UserEmail string `json:"user_email,omitempty"`
	RequestID string `json:"request_id,omitempty"`
	ModelSlug string `json:"model_slug,omitempty"`
}

// HandleGetStats computes overall system statistics from existing tables and ledger events.
func (h *Handler) HandleGetStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	queries := db.New(h.pool)

	userStats, err := queries.GetUserStats(ctx)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to get user stats")
		return
	}
	var users AdminStatsUsers
	for _, u := range userStats {
		switch u.Status {
		case "pending":
			users.Pending = u.Count
		case "active":
			users.Active = u.Count
		case "suspended":
			users.Suspended = u.Count
		}
	}

	modelStats, err := queries.GetModelStats(ctx)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to get model stats")
		return
	}
	var models AdminStatsModels
	for _, m := range modelStats {
		if m.Enabled {
			models.Enabled = m.Count
		} else {
			models.Disabled = m.Count
		}
	}

	routesCount, err := queries.CountRoutes(ctx)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to count routes")
		return
	}

	since24h := time.Now().Add(-24 * time.Hour)
	reqs24h, err := queries.CountRequestsSince(ctx, pgtype.Timestamptz{Time: since24h, Valid: true})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to count requests")
		return
	}

	since30d := time.Now().Add(-30 * 24 * time.Hour)
	rev30d, err := queries.GetRevenueSince(ctx, pgtype.Timestamptz{Time: since30d, Valid: true})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to calculate revenue")
		return
	}

	httpx.JSON(w, http.StatusOK, AdminStatsResponse{
		Users:              users,
		Models:             models,
		Routes:             routesCount,
		Requests24h:        reqs24h,
		Revenue30dMicroUSD: rev30d,
		Revenue30dUSD:      billing.FormatMicroUSD(rev30d),
	})
}

// HandleGetUser returns user summary, balance, active keys, and 30-day activity.
func (h *Handler) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userIDParam := chi.URLParam(r, "id")

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userIDParam); err != nil {
		httpx.WriteError(w, r, http.StatusNotFound, "not_found", "User not found")
		return
	}

	queries := db.New(h.pool)
	u, err := queries.GetUserByID(ctx, userUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, r, http.StatusNotFound, "not_found", "User not found")
			return
		}
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to get user")
		return
	}

	bal, err := queries.GetBalance(ctx, userUUID)
	var balanceMicro int64
	var freeUsed int32
	if err == nil {
		balanceMicro = bal.Balance
		freeUsed = bal.FreeUsed
	}

	activeKeys, err := queries.CountActiveKeysForUser(ctx, userUUID)
	if err != nil {
		activeKeys = 0
	}

	since30d := time.Now().Add(-30 * 24 * time.Hour)
	reqs30d, err := queries.GetUserRequestsCountSince(ctx, db.GetUserRequestsCountSinceParams{
		UserID:    userUUID,
		CreatedAt: pgtype.Timestamptz{Time: since30d, Valid: true},
	})
	if err != nil {
		reqs30d = 0
	}

	spend30d, err := queries.GetUserSpendSince(ctx, db.GetUserSpendSinceParams{
		UserID:    userUUID,
		CreatedAt: pgtype.Timestamptz{Time: since30d, Valid: true},
	})
	if err != nil {
		spend30d = 0
	}

	keyRows, err := queries.ListAPIKeysByUserID(ctx, userUUID)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list keys")
		return
	}
	keyItems := make([]AdminKeyItem, 0, len(keyRows))
	for _, k := range keyRows {
		keyItems = append(keyItems, AdminKeyItem{
			ID:         fmtUUID(k.ID),
			Name:       k.Name,
			Prefix:     k.Prefix,
			CreatedAt:  k.CreatedAt.Time.Format(time.RFC3339),
			LastUsedAt: optTime(k.LastUsedAt),
			RevokedAt:  optTime(k.RevokedAt),
			ExpiresAt:  optTime(k.ExpiresAt),
		})
	}

	profile, _ := queries.GetUserProfile(ctx, userUUID)
	httpx.JSON(w, http.StatusOK, AdminUserDetail{
		Keys:          keyItems,
		ID:            fmtUUID(u.ID),
		Email:         u.Email,
		Name:          u.Name.String,
		FirstName:     profile.FirstName,
		LastName:      profile.LastName,
		Username:      profile.Username,
		Role:          u.Role,
		Status:        u.Status,
		CreatedAt:     u.CreatedAt.Time.Format(time.RFC3339),
		BalanceUSD:    billing.FormatMicroUSD(balanceMicro),
		FreeCallsUsed: freeUsed,
		ActiveKeys:    activeKeys,
		Requests30d:   reqs30d,
		Spend30dUSD:   billing.FormatMicroUSD(spend30d),
	})
}

// HandleListEvents returns paginated ledger events without raw secrets or hashes.
func (h *Handler) HandleListEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	limit := int32(50)
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			if n > 100 {
				n = 100
			}
			limit = int32(n)
		}
	}

	var beforeSeq int64
	if b := r.URL.Query().Get("before_seq"); b != "" {
		if s, err := strconv.ParseInt(b, 10, 64); err == nil && s > 0 {
			beforeSeq = s
		}
	}

	typeFilter := r.URL.Query().Get("type")

	queries := db.New(h.pool)
	rows, err := queries.ListAdminEvents(ctx, db.ListAdminEventsParams{
		Column1: beforeSeq,
		Column2: typeFilter,
		Limit:   limit,
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list events")
		return
	}

	items := make([]AdminEventItem, 0, len(rows))
	for _, row := range rows {
		item := AdminEventItem{
			Seq:       row.Seq,
			Type:      row.Type,
			CreatedAt: row.CreatedAt.Time.Format(time.RFC3339),
			UserEmail: row.UserEmail,
			RequestID: row.RequestID,
			ModelSlug: row.ModelSlug,
		}
		items = append(items, item)
	}

	httpx.JSON(w, http.StatusOK, items)
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}
