package workflows

import (
	"context"
	"errors"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/models"
)

// Item is what a step works on: a whole image, or a crop of it made by a For each step.
type Item struct {
	ImageIndex int
	Data       []byte
	Width      int
	Height     int
	OffsetX    int // crop position in the original image
	OffsetY    int
	Parent     *ParentRef
	Path       string // stable ordering key, "" for the whole image
}

// ParentRef describes the detection a crop was made from.
type ParentRef struct {
	Step       string
	Label      string
	Confidence float64
	BBox       [4]int // x, y, w, h in the original image
}

// StepResult is one billed model call.
type StepResult struct {
	NodeID       string
	Step         string
	Model        string
	ModelVersion string
	RequestID    string
	ImageIndex   int
	Parent       *ParentRef
	Path         string
	Predictions  []models.Prediction // boxes in original-image coordinates, step min_confidence applied
	LatencyMs    int64
	ChargeMicro  int64
	ErrCode      string
}

// CallFunc performs one billed model call. In production it wraps gateway.ExecuteBilledCall.
type CallFunc func(ctx context.Context, slug string, image []byte) (*gateway.ExecuteCallResult, error)

type engine struct {
	def      *WorkflowDefinition
	call     CallFunc
	sem      chan struct{}
	maxCalls int64
	calls    atomic.Int64

	mu      sync.Mutex
	results []StepResult
}

func newEngine(def *WorkflowDefinition, call CallFunc, concurrency int, maxCalls int) *engine {
	return &engine{def: def, call: call, sem: make(chan struct{}, concurrency), maxCalls: int64(maxCalls)}
}

// run processes every image and returns all step results in a stable order.
func (e *engine) run(ctx context.Context, images []Item) []StepResult {
	var wg sync.WaitGroup
	for i := range images {
		item := images[i]
		wg.Add(1)
		go func() {
			defer wg.Done()
			e.visitAll(ctx, e.def.OutgoingEdges(e.def.Input().ID, ""), &item, nil)
		}()
	}
	wg.Wait()

	order := map[string]int{}
	if ids, ok := topoOrder(e.def); ok {
		for i, id := range ids {
			order[id] = i
		}
	}
	sort.SliceStable(e.results, func(a, b int) bool {
		ra, rb := e.results[a], e.results[b]
		if ra.ImageIndex != rb.ImageIndex {
			return ra.ImageIndex < rb.ImageIndex
		}
		if ra.Path != rb.Path {
			return ra.Path < rb.Path
		}
		return order[ra.NodeID] < order[rb.NodeID]
	})
	return e.results
}

func (e *engine) visitAll(ctx context.Context, edges []Edge, item *Item, upstream *StepResult) {
	var wg sync.WaitGroup
	for _, edge := range edges {
		target := e.def.Node(edge.Target)
		if target == nil || target.Type == NodeOutput {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			e.visit(ctx, target, item, upstream)
		}()
	}
	wg.Wait()
}

func (e *engine) visit(ctx context.Context, n *Node, item *Item, upstream *StepResult) {
	switch n.Type {
	case NodeModel:
		res := e.runModel(ctx, n, item)
		e.mu.Lock()
		e.results = append(e.results, res)
		e.mu.Unlock()
		if res.ErrCode == "" {
			e.visitAll(ctx, e.def.OutgoingEdges(n.ID, ""), item, &res)
		}
	case NodeCondition:
		if upstream == nil {
			return
		}
		handle := HandleNo
		if evaluateCondition(n.ConditionConfig, upstream.Predictions) {
			handle = HandleYes
		}
		e.visitAll(ctx, e.def.OutgoingEdges(n.ID, handle), item, nil)
	case NodeForEach:
		if upstream == nil {
			return
		}
		crops := cropDetections(item, upstream, n.ForEachConfig)
		var wg sync.WaitGroup
		for i := range crops {
			c := crops[i]
			wg.Add(1)
			go func() {
				defer wg.Done()
				e.visitAll(ctx, e.def.OutgoingEdges(n.ID, ""), &c, nil)
			}()
		}
		wg.Wait()
	}
}

func (e *engine) runModel(ctx context.Context, n *Node, item *Item) StepResult {
	cfg := n.ModelConfig
	res := StepResult{
		NodeID:     n.ID,
		Step:       n.StepName(),
		Model:      cfg.ModelSlug,
		ImageIndex: item.ImageIndex,
		Parent:     item.Parent,
		Path:       item.Path,
	}
	if e.calls.Add(1) > e.maxCalls {
		res.ErrCode = "call_limit"
		return res
	}
	select {
	case e.sem <- struct{}{}:
		defer func() { <-e.sem }()
	case <-ctx.Done():
		res.ErrCode = "run_timeout"
		return res
	}
	if ctx.Err() != nil {
		res.ErrCode = "run_timeout"
		return res
	}

	out, err := e.call(ctx, cfg.ModelSlug, item.Data)
	if out != nil {
		res.RequestID = out.RequestID
		res.LatencyMs = out.LatencyMs
	}
	if err != nil {
		res.ErrCode = callErrorCode(err)
		return res
	}
	res.ModelVersion = out.ModelVersion
	res.ChargeMicro = out.ChargeMicro
	for _, p := range out.Predictions {
		if p.Confidence < cfg.MinConfidence {
			continue
		}
		if p.BBox != nil {
			b := *p.BBox
			moved := [4]int{b[0] + item.OffsetX, b[1] + item.OffsetY, b[2], b[3]}
			p.BBox = &moved
		}
		res.Predictions = append(res.Predictions, p)
	}
	return res
}

func callErrorCode(err error) string {
	switch {
	case errors.Is(err, billing.ErrInsufficientBalance):
		return "insufficient_balance"
	case errors.Is(err, billing.ErrModelNotFound):
		return "model_unavailable"
	case errors.Is(err, models.ErrModelTimeout), errors.Is(err, context.DeadlineExceeded):
		return "model_timeout"
	case errors.Is(err, context.Canceled):
		return "run_cancelled"
	default:
		return "model_error"
	}
}

// matching returns predictions whose label is in labels (any label when empty), case-insensitive,
// with confidence at or above minConf.
func matching(preds []models.Prediction, labels []string, minConf float64) []models.Prediction {
	want := map[string]bool{}
	for _, l := range labels {
		want[strings.ToLower(strings.TrimSpace(l))] = true
	}
	var out []models.Prediction
	for _, p := range preds {
		if p.Confidence < minConf {
			continue
		}
		if len(want) > 0 && !want[strings.ToLower(p.Label)] {
			continue
		}
		out = append(out, p)
	}
	return out
}

func evaluateCondition(c *ConditionConfig, preds []models.Prediction) bool {
	m := matching(preds, c.Labels, c.MinConfidence)
	switch c.Rule {
	case "has_label":
		return len(m) > 0
	case "count_at_least":
		return len(m) >= c.Count
	case "no_predictions":
		return len(m) == 0
	}
	return false
}

func itemPath(parent string, step string, k int) string {
	return parent + "/" + step + "#" + leftPad(k)
}

func leftPad(k int) string {
	s := strconv.Itoa(k)
	for len(s) < 3 {
		s = "0" + s
	}
	return s
}
