package balance

import (
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
)

type Handler struct {
	pool      *pgxpool.Pool
	freeCalls int
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	fc := 50
	if fcStr := os.Getenv("FREE_CALLS"); fcStr != "" {
		if val, err := strconv.Atoi(fcStr); err == nil && val >= 0 {
			fc = val
		}
	}
	return &Handler{
		pool:      pool,
		freeCalls: fc,
	}
}

type BalanceResponse struct {
	BalanceMicroUSD    int64  `json:"balance_micro_usd"`
	BalanceUSD         string `json:"balance_usd"`
	FreeUsed           int32  `json:"free_used"`
	FreeCallsRemaining int32  `json:"free_calls_remaining"`
}

// HandleGetBalance returns current user balance and free quota status.
func (h *Handler) HandleGetBalance(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	queries := db.New(h.pool)
	bal, err := queries.GetBalance(r.Context(), user.ID)
	if err != nil {
		// If balance row doesn't exist yet, return zero balance and full free quota
		remaining := int32(h.freeCalls)
		httpx.JSON(w, http.StatusOK, BalanceResponse{
			BalanceMicroUSD:    0,
			BalanceUSD:         "0.000000",
			FreeUsed:           0,
			FreeCallsRemaining: remaining,
		})
		return
	}

	remaining := int32(h.freeCalls) - bal.FreeUsed
	if remaining < 0 {
		remaining = 0
	}

	balUSD := fmt.Sprintf("%.6f", float64(bal.Balance)/1_000_000.0)

	httpx.JSON(w, http.StatusOK, BalanceResponse{
		BalanceMicroUSD:    bal.Balance,
		BalanceUSD:         balUSD,
		FreeUsed:           bal.FreeUsed,
		FreeCallsRemaining: remaining,
	})
}
