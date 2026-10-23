package router

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"sync"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
)

var ErrModelNotFound = errors.New("model_not_found")

type RouteResult struct {
	ModelSlug      string
	MatchedKeyword string
	Priority       int32
	Fallback       bool
}

type Router interface {
	Route(ctx context.Context, prompt string) (*RouteResult, error)
	Reload(ctx context.Context) error
}

type CachedRoute struct {
	ID           string
	Keyword      string
	Tokens       []string
	Priority     int32
	ModelSlug    string
	ModelEnabled bool
}

type MemoryRouter struct {
	mu            sync.RWMutex
	pool          *pgxpool.Pool
	fallbackModel string
	routes        []CachedRoute
	modelsEnabled map[string]bool
}

// NewMemoryRouter creates a new in-memory keyword router.
func NewMemoryRouter(pool *pgxpool.Pool) *MemoryRouter {
	fallback := os.Getenv("FALLBACK_MODEL")
	if fallback == "" {
		fallback = "bioclip"
	}

	return &MemoryRouter{
		pool:          pool,
		fallbackModel: fallback,
		routes:        make([]CachedRoute, 0),
		modelsEnabled: make(map[string]bool),
	}
}

// SetRoutesForTest configures routes and models directly for unit tests without a database pool.
func (r *MemoryRouter) SetRoutesForTest(routes []CachedRoute, modelsEnabled map[string]bool, fallbackModel string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.routes = make([]CachedRoute, len(routes))
	copy(r.routes, routes)
	r.modelsEnabled = make(map[string]bool, len(modelsEnabled))
	for k, v := range modelsEnabled {
		r.modelsEnabled[k] = v
	}
	if fallbackModel != "" {
		r.fallbackModel = fallbackModel
	}
	r.sortRoutes()
}

func (r *MemoryRouter) sortRoutes() {
	// Lowest priority wins; ties broken by keyword length (longer wins, rune count), then keyword ASC
	sort.SliceStable(r.routes, func(i, j int) bool {
		if r.routes[i].Priority != r.routes[j].Priority {
			return r.routes[i].Priority < r.routes[j].Priority
		}
		lenI := utf8.RuneCountInString(r.routes[i].Keyword)
		lenJ := utf8.RuneCountInString(r.routes[j].Keyword)
		if lenI != lenJ {
			return lenI > lenJ
		}
		return r.routes[i].Keyword < r.routes[j].Keyword
	})
}

// Reload queries the database for all routes and models and updates the in-memory cache.
func (r *MemoryRouter) Reload(ctx context.Context) error {
	if r.pool == nil {
		return nil
	}

	queries := db.New(r.pool)

	modelsList, err := queries.ListAllModels(ctx)
	if err != nil {
		return fmt.Errorf("list models for router error: %w", err)
	}

	routesList, err := queries.ListActiveRoutes(ctx)
	if err != nil {
		return fmt.Errorf("list routes for router error: %w", err)
	}

	modelsEnabled := make(map[string]bool, len(modelsList))
	for _, m := range modelsList {
		modelsEnabled[m.Slug] = m.Enabled
	}

	cachedRoutes := make([]CachedRoute, 0, len(routesList))
	for _, rt := range routesList {
		normKw := NormalizeKeyword(rt.Keyword)
		tokens := Tokenize(normKw)
		if len(tokens) == 0 {
			continue
		}

		cachedRoutes = append(cachedRoutes, CachedRoute{
			ID:           fmtUUID(rt.ID),
			Keyword:      normKw,
			Tokens:       tokens,
			Priority:     rt.Priority,
			ModelSlug:    rt.ModelSlug,
			ModelEnabled: rt.ModelEnabled,
		})
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.modelsEnabled = modelsEnabled
	r.routes = cachedRoutes
	r.sortRoutes()

	return nil
}

// Route resolves a prompt to a model based on contiguous token keyword matching.
func (r *MemoryRouter) Route(ctx context.Context, prompt string) (*RouteResult, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	fallbackSlug := r.fallbackModel
	fallbackEnabled := r.modelsEnabled[fallbackSlug]

	promptTokens := Tokenize(prompt)

	// If prompt is empty or has no letter/digit/mark tokens -> fallback
	if len(promptTokens) == 0 {
		if !fallbackEnabled {
			return nil, ErrModelNotFound
		}
		return &RouteResult{
			ModelSlug:      fallbackSlug,
			MatchedKeyword: "fallback",
			Priority:       0,
			Fallback:       true,
		}, nil
	}

	// Scan routes in sorted order (lowest priority first, then longest keyword)
	for _, route := range r.routes {
		if MatchContiguous(promptTokens, route.Tokens) {
			if route.ModelEnabled {
				return &RouteResult{
					ModelSlug:      route.ModelSlug,
					MatchedKeyword: route.Keyword,
					Priority:       route.Priority,
					Fallback:       false,
				}, nil
			}

			// Model is disabled: fall back to fallback model
			if !fallbackEnabled {
				return nil, ErrModelNotFound
			}
			return &RouteResult{
				ModelSlug:      fallbackSlug,
				MatchedKeyword: "fallback",
				Priority:       route.Priority,
				Fallback:       true,
			}, nil
		}
	}

	// No route matched: fall back to fallback model
	if !fallbackEnabled {
		return nil, ErrModelNotFound
	}

	return &RouteResult{
		ModelSlug:      fallbackSlug,
		MatchedKeyword: "fallback",
		Priority:       0,
		Fallback:       true,
	}, nil
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}
