package router_test

import (
	"context"
	"errors"
	"testing"

	"layerto/services/core/internal/router"
)

func TestTokenizer_UnicodeAndDelimiters(t *testing.T) {
	tests := []struct {
		name        string
		prompt      string
		keyword     string
		shouldMatch bool
	}{
		{
			name:        "Sinhala keyword in prompt matches",
			prompt:      "සාගර කැස්බෑවා",
			keyword:     "කැස්බෑවා",
			shouldMatch: true,
		},
		{
			name:        "Substring does not match whole token (turtleneck != turtle)",
			prompt:      "turtleneck",
			keyword:     "turtle",
			shouldMatch: false,
		},
		{
			name:        "Hyphenated delimiter matches multi-word (sea-turtle == sea turtle)",
			prompt:      "sea-turtle",
			keyword:     "sea turtle",
			shouldMatch: true,
		},
		{
			name:        "Multi-word Sinhala contiguous match",
			prompt:      "ලස්සන සාගර කැස්බෑවා මෙහේ ඉන්නවා",
			keyword:     "සාගර කැස්බෑවා",
			shouldMatch: true,
		},
		{
			name:        "Non-contiguous tokens do not match",
			prompt:      "sea blue turtle",
			keyword:     "sea turtle",
			shouldMatch: false,
		},
		{
			name:        "Case-insensitivity with mixed casing",
			prompt:      "Green SEA TURTLE sighted",
			keyword:     "sea turtle",
			shouldMatch: true,
		},
		{
			name:        "Punctuation stripped as tokens",
			prompt:      "Look: a turtle!",
			keyword:     "turtle",
			shouldMatch: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pTokens := router.Tokenize(tc.prompt)
			kWTokens := router.Tokenize(tc.keyword)
			matched := router.MatchContiguous(pTokens, kWTokens)
			if matched != tc.shouldMatch {
				t.Fatalf("expected MatchContiguous(%v, %v) = %v, got %v", pTokens, kWTokens, tc.shouldMatch, matched)
			}
		})
	}
}

func TestNormalizeKeyword(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"  Sea   Turtle  ", "sea turtle"},
		{"TURTLE", "turtle"},
		{"\t\n  කැස්බෑවා  \n", "කැස්බෑවා"},
		{"sea-turtle", "sea turtle"},
		{"  green    sea    turtle  ", "green sea turtle"},
	}

	for _, tc := range tests {
		got := router.NormalizeKeyword(tc.input)
		if got != tc.expected {
			t.Errorf("NormalizeKeyword(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}

func TestMemoryRouter_RoutingLogic(t *testing.T) {
	ctx := context.Background()
	r := router.NewMemoryRouter(nil)

	routes := []router.CachedRoute{
		{
			ID:           "r-turtle",
			Keyword:      "turtle",
			Tokens:       router.Tokenize("turtle"),
			Priority:     100,
			ModelSlug:    "turtle-id",
			ModelEnabled: true,
		},
		{
			ID:           "r-sea-turtle",
			Keyword:      "sea turtle",
			Tokens:       router.Tokenize("sea turtle"),
			Priority:     100,
			ModelSlug:    "turtle-id",
			ModelEnabled: true,
		},
		{
			ID:           "r-high-pri",
			Keyword:      "hawk",
			Tokens:       router.Tokenize("hawk"),
			Priority:     10,
			ModelSlug:    "hawk-model",
			ModelEnabled: true,
		},
		{
			ID:           "r-disabled-model",
			Keyword:      "disabled-critter",
			Tokens:       router.Tokenize("disabled-critter"),
			Priority:     5,
			ModelSlug:    "disabled-model",
			ModelEnabled: false,
		},
	}

	modelsEnabled := map[string]bool{
		"bioclip":        true,
		"turtle-id":      true,
		"hawk-model":     true,
		"disabled-model": false,
	}

	r.SetRoutesForTest(routes, modelsEnabled, "bioclip")

	// 1. Longest keyword tie-break: "sea turtle" vs "turtle" both priority 100
	res, err := r.Route(ctx, "I found a sea-turtle")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ModelSlug != "turtle-id" || res.MatchedKeyword != "sea turtle" {
		t.Fatalf("expected 'sea turtle' -> turtle-id, got matched=%q, slug=%q", res.MatchedKeyword, res.ModelSlug)
	}

	// 2. Substring "turtleneck" does NOT match "turtle" -> falls back to bioclip
	res, err = r.Route(ctx, "He wears a turtleneck sweater")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ModelSlug != "bioclip" || res.MatchedKeyword != "fallback" || !res.Fallback {
		t.Fatalf("expected fallback to bioclip, got matched=%q, slug=%q, fallback=%v", res.MatchedKeyword, res.ModelSlug, res.Fallback)
	}

	// 3. Lowest priority wins
	res, err = r.Route(ctx, "A hawk and a turtle")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ModelSlug != "hawk-model" || res.MatchedKeyword != "hawk" {
		t.Fatalf("expected priority 10 hawk to win, got %q -> %q", res.MatchedKeyword, res.ModelSlug)
	}

	// 4. Sinhala matching
	r.SetRoutesForTest(append(routes, router.CachedRoute{
		ID:           "r-sinhala",
		Keyword:      "කැස්බෑවා",
		Tokens:       router.Tokenize("කැස්බෑවා"),
		Priority:     50,
		ModelSlug:    "turtle-id",
		ModelEnabled: true,
	}), modelsEnabled, "bioclip")

	res, err = r.Route(ctx, "සාගර කැස්බෑවා")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ModelSlug != "turtle-id" || res.MatchedKeyword != "කැස්බෑවා" {
		t.Fatalf("expected 'කැස්බෑවා' -> turtle-id, got matched=%q, slug=%q", res.MatchedKeyword, res.ModelSlug)
	}

	// 5. Disabled model falls back to fallback model
	res, err = r.Route(ctx, "Here is a disabled-critter")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ModelSlug != "bioclip" || res.MatchedKeyword != "fallback" || !res.Fallback {
		t.Fatalf("expected fallback to bioclip when model is disabled, got %v", res)
	}

	// 6. When fallback model is also disabled -> 404 ErrModelNotFound
	modelsWithDisabledFallback := map[string]bool{
		"bioclip":        false,
		"turtle-id":      true,
		"disabled-model": false,
	}
	r.SetRoutesForTest(routes, modelsWithDisabledFallback, "bioclip")

	_, err = r.Route(ctx, "Unknown prompt with no match")
	if !errors.Is(err, router.ErrModelNotFound) {
		t.Fatalf("expected ErrModelNotFound when fallback model is disabled, got %v", err)
	}

	// 7. Empty prompt falls back to fallback model
	r.SetRoutesForTest(routes, modelsEnabled, "bioclip")
	res, err = r.Route(ctx, "")
	if err != nil {
		t.Fatalf("unexpected error on empty prompt: %v", err)
	}
	if res.ModelSlug != "bioclip" || res.MatchedKeyword != "fallback" {
		t.Fatalf("expected fallback on empty prompt, got %v", res)
	}
}
