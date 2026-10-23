package gateway

import (
	"encoding/json"
	"net/http"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
)

// PublicModelItem represents an enabled model in the public /v1/models endpoint (SPEC §8).
type PublicModelItem struct {
	Slug        string         `json:"slug"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	License     string         `json:"license"`
	IsOpen      bool           `json:"is_open"`
	PriceUSD    string         `json:"price_usd"`
	Meta        map[string]any `json:"meta"`
}

// HandleListPublicModels handles GET /v1/models.
// Public, no auth: returns enabled models with Cache-Control: public, max-age=60.
func (h *Handler) HandleListPublicModels(w http.ResponseWriter, r *http.Request) {
	queries := db.New(h.pool)
	modelsList, err := queries.ListEnabledModels(r.Context())
	if err != nil {
		httpx.WriteError(w, r, http.StatusInternalServerError, "internal_error", "Failed to list models")
		return
	}

	items := make([]PublicModelItem, 0, len(modelsList))
	for _, m := range modelsList {
		meta := make(map[string]any)
		if len(m.Meta) > 0 {
			_ = json.Unmarshal(m.Meta, &meta)
		}
		items = append(items, PublicModelItem{
			Slug:        m.Slug,
			Name:        m.Name,
			Description: m.Description,
			License:     m.License,
			IsOpen:      m.IsOpen,
			PriceUSD:    billing.FormatMicroUSD(m.PricePerCall),
			Meta:        meta,
		})
	}

	w.Header().Set("Cache-Control", "public, max-age=60")
	httpx.JSON(w, http.StatusOK, items)
}
