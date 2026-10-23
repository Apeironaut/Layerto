package usage

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
)

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

type ModelUsage struct {
	ModelSlug      string `json:"model_slug"`
	Requests       int64  `json:"requests"`
	ChargeMicroUSD int64  `json:"charge_micro_usd"`
	ChargeUSD      string `json:"charge_usd"`
}

type UsageResponse struct {
	From                string       `json:"from"`
	To                  string       `json:"to"`
	TotalRequests       int64        `json:"total_requests"`
	TotalChargeMicroUSD int64        `json:"total_charge_micro_usd"`
	TotalChargeUSD      string       `json:"total_charge_usd"`
	ByModel             []ModelUsage `json:"by_model"`
}

type RequestLogItem struct {
	Seq            int64  `json:"seq"`
	RequestID      string `json:"request_id"`
	CreatedAt      string `json:"created_at"`
	ModelSlug      string `json:"model_slug"`
	Routed         string `json:"routed"`
	Status         string `json:"status"` // pending, executed, failed, or abandoned
	LatencyMs      int64  `json:"latency_ms"`
	ChargeMicroUSD int64  `json:"charge_micro_usd"`
	ChargeUSD      string `json:"charge_usd"`
}

// HandleGetUsage handles GET /api/usage?from&to
// Derived from events table only. Max range 366 days (Requirement 7).
func (h *Handler) HandleGetUsage(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	now := time.Now().UTC()
	to := now
	from := now.AddDate(0, 0, -30) // default last 30 days

	if toParam := r.URL.Query().Get("to"); toParam != "" {
		parsedTo, err := time.Parse(time.RFC3339, toParam)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_date", "Invalid 'to' timestamp; expected RFC3339 format")
			return
		}
		to = parsedTo.UTC()
	}

	if fromParam := r.URL.Query().Get("from"); fromParam != "" {
		parsedFrom, err := time.Parse(time.RFC3339, fromParam)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_date", "Invalid 'from' timestamp; expected RFC3339 format")
			return
		}
		from = parsedFrom.UTC()
	}

	if from.After(to) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_range", "'from' timestamp must be before 'to' timestamp")
		return
	}

	// Requirement 7: The /api/usage range is at most 366 days.
	if to.Sub(from) > 366*24*time.Hour {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_range", "Date range cannot exceed 366 days")
		return
	}

	queries := db.New(h.pool)
	fromTimestamptz := pgtype.Timestamptz{Time: from, Valid: true}
	toTimestamptz := pgtype.Timestamptz{Time: to, Valid: true}

	totals, err := queries.GetUsageTotals(r.Context(), db.GetUsageTotalsParams{
		UserID:      user.ID,
		CreatedAt:   fromTimestamptz,
		CreatedAt_2: toTimestamptz,
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to query usage totals")
		return
	}

	byModelRows, err := queries.GetUsageByModel(r.Context(), db.GetUsageByModelParams{
		UserID:      user.ID,
		CreatedAt:   fromTimestamptz,
		CreatedAt_2: toTimestamptz,
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to query usage by model")
		return
	}

	modelList := make([]ModelUsage, 0, len(byModelRows))
	for _, row := range byModelRows {
		modelList = append(modelList, ModelUsage{
			ModelSlug:      row.ModelSlug,
			Requests:       row.RequestsCount,
			ChargeMicroUSD: row.TotalCharge,
			ChargeUSD:      billing.FormatMicroUSD(row.TotalCharge),
		})
	}

	httpx.JSON(w, http.StatusOK, UsageResponse{
		From:                from.Format(time.RFC3339),
		To:                  to.Format(time.RFC3339),
		TotalRequests:       totals.TotalRequests,
		TotalChargeMicroUSD: totals.TotalCharge,
		TotalChargeUSD:      billing.FormatMicroUSD(totals.TotalCharge),
		ByModel:             modelList,
	})
}

// HandleGetRequests handles GET /api/requests?cursor
// Requirement 7: Returns one row per request_id (status: pending, executed, failed or abandoned).
func (h *Handler) HandleGetRequests(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var cursor int64
	if cursorParam := r.URL.Query().Get("cursor"); cursorParam != "" {
		if c, err := strconv.ParseInt(cursorParam, 10, 64); err == nil && c > 0 {
			cursor = c
		}
	}

	queries := db.New(h.pool)
	rows, err := queries.GetRequestsList(r.Context(), db.GetRequestsListParams{
		UserID:  user.ID,
		Column2: cursor,
	})
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to query requests log")
		return
	}

	items := make([]RequestLogItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, RequestLogItem{
			Seq:            r.Seq,
			RequestID:      fmtUUID(r.RequestID),
			CreatedAt:      r.CreatedAt.Time.UTC().Format(time.RFC3339Nano),
			ModelSlug:      r.ModelSlug,
			Routed:         r.Routed,
			Status:         r.Status,
			LatencyMs:      r.LatencyMs,
			ChargeMicroUSD: r.ChargeMicroUsd,
			ChargeUSD:      billing.FormatMicroUSD(r.ChargeMicroUsd),
		})
	}

	httpx.JSON(w, http.StatusOK, items)
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

type EndpointUsage struct {
	Endpoint string `json:"endpoint"`
	Requests int64  `json:"requests"`
}

// HandleGetEndpointUsage handles GET /api/usage/endpoints?from&to: request counts per entry point
// (vision_auto, vision_model, workflow_run, workflow_test, playground, site_run), from the ledger.
func (h *Handler) HandleGetEndpointUsage(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}
	to := time.Now().UTC()
	from := to.AddDate(0, 0, -30)
	if v := r.URL.Query().Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_date", "Invalid 'to' timestamp; expected RFC3339 format")
			return
		}
		to = t.UTC()
	}
	if v := r.URL.Query().Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_date", "Invalid 'from' timestamp; expected RFC3339 format")
			return
		}
		from = t.UTC()
	}
	if from.After(to) || to.Sub(from) > 366*24*time.Hour {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_range", "Use a range of at most 366 days, with 'from' before 'to'")
		return
	}
	rows, err := h.pool.Query(r.Context(), `
		SELECT CASE
			WHEN payload ? 'workflow_id' AND payload->>'source' = 'api' THEN 'workflow_run'
			WHEN payload ? 'workflow_id' THEN 'workflow_test'
			WHEN payload->>'source' = 'site' THEN 'site_run'
			WHEN payload->>'source' = 'playground' THEN 'playground'
			WHEN payload->>'route' = 'auto' THEN 'vision_auto'
			ELSE 'vision_model' END AS endpoint, count(*)
		FROM events WHERE user_id = $1 AND type = 'request.received' AND created_at >= $2 AND created_at < $3
		GROUP BY 1 ORDER BY 2 DESC`, user.ID, from, to)
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to query endpoint usage")
		return
	}
	defer rows.Close()
	out := []EndpointUsage{}
	var total int64
	for rows.Next() {
		var e EndpointUsage
		if rows.Scan(&e.Endpoint, &e.Requests) == nil {
			total += e.Requests
			out = append(out, e)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "total_requests": total, "by_endpoint": out})
}
