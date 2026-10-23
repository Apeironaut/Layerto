package workflows

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
)

func newRequestID() string { return httpx.NewUUIDv4() }

const (
	MaxMultipartBodyBytes = 60 << 20 // 60 MB per run request
	MaxImagesPerRun       = 20
	MaxCallsPerRun        = 400
	RunTimeout            = 120 * time.Second
	MaxConcurrency        = 4
)

var (
	ErrNoImages        = errors.New("add at least one image in the \"images\" field")
	ErrTooManyImages   = errors.New("too many images for this workflow")
	ErrNotMultipart    = errors.New("send images as multipart/form-data")
	ErrTooManyCalls    = errors.New("this run could need too many model calls")
	ErrModelNotEnabled = errors.New("a model in this workflow is disabled")
)

// ParseImages reads the multipart "images" fields into memory (never disk), validating each.
func ParseImages(r *http.Request, maxImages int) ([]Item, error) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		return nil, ErrNotMultipart
	}
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, ErrNotMultipart
	}
	var items []Item
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("couldn't read the upload: %w", err)
		}
		if part.FormName() != "images" {
			_ = part.Close()
			continue
		}
		if len(items) >= maxImages {
			return nil, fmt.Errorf("%w (max %d)", ErrTooManyImages, maxImages)
		}
		buf, err := io.ReadAll(io.LimitReader(part, gateway.MaxImageBytes+1))
		_ = part.Close()
		if err != nil {
			return nil, fmt.Errorf("couldn't read image %d: %w", len(items)+1, err)
		}
		if len(buf) > gateway.MaxImageBytes {
			return nil, fmt.Errorf("image %d is larger than 10 MB", len(items)+1)
		}
		if err := gateway.ValidateImage(buf); err != nil {
			return nil, fmt.Errorf("image %d: %v", len(items)+1, err)
		}
		cfg, _, err := image.DecodeConfig(bytes.NewReader(buf))
		if err != nil {
			return nil, fmt.Errorf("image %d: couldn't read its size", len(items)+1)
		}
		items = append(items, Item{ImageIndex: len(items), Data: buf, Width: cfg.Width, Height: cfg.Height})
	}
	if len(items) == 0 {
		return nil, ErrNoImages
	}
	return items, nil
}

// RunParams describes one workflow run.
type RunParams struct {
	WorkflowID string
	RunID      string
	UserID     string
	APIKeyID   *string
	Source     string // "playground" | "api"
	Images     []Item
	Definition *WorkflowDefinition
	GwHandler  *gateway.Handler
	Pool       *pgxpool.Pool
}

// Run checks limits and balance, executes the graph, and shapes the output.
func Run(ctx context.Context, p RunParams) (Shaped, error) {
	def := p.Definition
	_, maxPerImage := CallBounds(def)
	if maxPerImage*len(p.Images) > MaxCallsPerRun {
		return Shaped{}, fmt.Errorf("%w: up to %d calls for %d images (limit %d)", ErrTooManyCalls, maxPerImage*len(p.Images), len(p.Images), MaxCallsPerRun)
	}

	q := db.New(p.Pool)
	endpoints := map[string]string{}
	for _, n := range def.Nodes {
		if n.Type != NodeModel {
			continue
		}
		m, err := q.GetModelBySlug(ctx, n.ModelConfig.ModelSlug)
		if err != nil || !m.Enabled {
			return Shaped{}, fmt.Errorf("%w: %s", ErrModelNotEnabled, n.ModelConfig.ModelSlug)
		}
		endpoints[m.Slug] = m.RunpodEndpoint
	}

	if err := checkGuaranteedCost(ctx, q, p.UserID, def, len(p.Images)); err != nil {
		return Shaped{}, err
	}

	runCtx, cancel := context.WithTimeout(ctx, RunTimeout)
	defer cancel()

	call := func(ctx context.Context, slug string, img []byte) (*gateway.ExecuteCallResult, error) {
		return p.GwHandler.ExecuteBilledCall(ctx, gateway.ExecuteCallParams{
			RequestID:      newRequestID(),
			UserID:         p.UserID,
			APIKeyID:       p.APIKeyID,
			ModelSlug:      slug,
			ModelEndpoint:  endpoints[slug],
			Route:          "workflow",
			Source:         p.Source,
			MatchedKeyword: "workflow",
			ImageBytes:     img,
			WorkflowID:     &p.WorkflowID,
			RunID:          &p.RunID,
		})
	}
	results := newEngine(def, call, MaxConcurrency, MaxCallsPerRun).run(runCtx, p.Images)

	meta := make([]ImageMeta, len(p.Images))
	for i, it := range p.Images {
		meta[i] = ImageMeta{Index: it.ImageIndex, Width: it.Width, Height: it.Height}
	}
	return shapeOutput(def, results, meta, p.WorkflowID, p.RunID)
}

// checkGuaranteedCost refuses a run up front when the account can't pay for the calls
// that will certainly happen (steps reached without passing a Condition or For each).
// Later calls still reserve their own price and fail individually if the balance runs out.
func checkGuaranteedCost(ctx context.Context, q *db.Queries, userID string, def *WorkflowDefinition, images int) error {
	var uid pgtype.UUID
	if err := uid.Scan(userID); err != nil {
		return err
	}
	bal, err := q.GetBalance(ctx, uid)
	if err != nil {
		return billing.ErrUserNotFound
	}

	var prices []int64
	var walk func(id string)
	walk = func(id string) {
		for _, e := range def.OutgoingEdges(id, "") {
			n := def.Node(e.Target)
			if n == nil || n.Type != NodeModel {
				continue
			}
			m, err := q.GetModelBySlug(ctx, n.ModelConfig.ModelSlug)
			if err == nil {
				for i := 0; i < images; i++ {
					prices = append(prices, m.PricePerCall)
				}
			}
			walk(n.ID)
		}
	}
	walk(def.Input().ID)

	free := int64(billing.FreeCallsLimit) - int64(bal.FreeUsed)
	if free < 0 {
		free = 0
	}
	// Free calls cover whichever calls come first; assume the most expensive ones.
	sort.Slice(prices, func(a, b int) bool { return prices[a] > prices[b] })
	var need int64
	for i := int(min(free, int64(len(prices)))); i < len(prices); i++ {
		need += prices[i]
	}
	if bal.Balance < need {
		return billing.ErrInsufficientBalance
	}
	return nil
}
