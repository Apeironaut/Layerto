package workflows

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	MaxDefinitionBytes = 64 * 1024
	MaxNodes           = 30
	MaxEdges           = 60
	MaxModelNodes      = 12
	MaxForEachNodes    = 3
	MaxForEachDepth    = 2
	MaxCallsPerImage   = 100
	MaxLabels          = 50
	MaxLabelChars      = 100
	MaxStepLabelChars  = 60
	MaxPosition        = 1e6
)

var (
	errTrailingData = errors.New("unexpected data after JSON value")

	idPattern     = regexp.MustCompile(`^[a-z0-9_]{1,32}$`)
	slugPattern   = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)
	aliasPattern  = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,31}$`)
	edgeIDPattern = regexp.MustCompile(`^[A-Za-z0-9_\-:.]{1,80}$`)

	// OutputFieldOrder is the order fields appear in (CSV columns and JSON keys).
	OutputFieldOrder = []string{"label", "confidence", "bbox", "step", "model", "model_version", "parent", "latency_ms", "request_id", "charge_usd"}

	validOutputFields = setOf(OutputFieldOrder...)
	validBBoxFormats  = setOf("xywh", "xyxy", "normalized_xywh", "center_xywh")
	validLayouts      = setOf("by_image", "by_step", "flat")
	validSorts        = setOf("confidence_desc", "label_asc", "step")
	validConfFormats  = setOf("decimal", "percent")
	validFormats      = setOf("json", "csv")
	validRules        = setOf("has_label", "count_at_least", "no_predictions")
	validInputModes   = setOf("single", "batch")
)

func setOf(items ...string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, i := range items {
		m[i] = true
	}
	return m
}

// ValidationError points at the node (and field) a problem belongs to. NodeID is empty for
// problems with the whole definition; EdgeID is set for problems with a connection.
type ValidationError struct {
	NodeID  string `json:"node_id"`
	EdgeID  string `json:"edge_id,omitempty"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ModelChecker reports whether a model slug exists and is enabled.
type ModelChecker func(ctx context.Context, slug string) (bool, error)

type validator struct {
	errs []ValidationError
}

func (v *validator) add(nodeID, field, format string, args ...any) {
	v.errs = append(v.errs, ValidationError{NodeID: nodeID, Field: field, Message: fmt.Sprintf(format, args...)})
}

func (v *validator) addEdge(edgeID, format string, args ...any) {
	v.errs = append(v.errs, ValidationError{EdgeID: edgeID, Field: "edge", Message: fmt.Sprintf(format, args...)})
}

// Validate parses and checks a definition (upgrading version 1 first). It returns every
// problem found; the definition is non-nil only when there are no problems.
func Validate(ctx context.Context, raw []byte, isModelActive ModelChecker) ([]ValidationError, *WorkflowDefinition) {
	v := &validator{}
	if len(raw) > MaxDefinitionBytes {
		v.add("", "definition", "The workflow is too large (max %d KB).", MaxDefinitionBytes/1024)
		return v.errs, nil
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		v.add("", "definition", "The workflow is empty.")
		return v.errs, nil
	}
	raw = upgradeV1(raw)

	var def WorkflowDefinition
	if err := strictDecode(raw, &def); err != nil {
		v.add("", "definition", "The workflow isn't valid JSON or has unknown fields: %v", err)
		return v.errs, nil
	}
	if def.Version != DefinitionVersion {
		v.add("", "version", "Unsupported workflow version %d (expected %d).", def.Version, DefinitionVersion)
		return v.errs, nil
	}

	v.checkNodes(&def)
	if len(v.errs) > 0 {
		return v.errs, nil
	}
	v.checkEdges(&def)
	if len(v.errs) > 0 {
		return v.errs, nil
	}
	v.checkGraph(&def)
	if len(v.errs) > 0 {
		return v.errs, nil
	}

	if _, maxCalls := CallBounds(&def); maxCalls > MaxCallsPerImage {
		v.add("", "definition", "This workflow could make up to %d model calls per image (limit %d). Lower \"max items\" in a For each step or remove steps.", maxCalls, MaxCallsPerImage)
	}

	if isModelActive != nil {
		checked := map[string]bool{}
		for _, n := range def.Nodes {
			if n.Type != NodeModel {
				continue
			}
			slug := n.ModelConfig.ModelSlug
			active, seen := checked[slug]
			if !seen {
				ok, err := isModelActive(ctx, slug)
				if err != nil {
					v.add(n.ID, "config.model_slug", "Couldn't check model %q right now.", slug)
					continue
				}
				active, checked[slug] = ok, ok
			}
			if !active {
				v.add(n.ID, "config.model_slug", "Model %q doesn't exist or is disabled.", slug)
			}
		}
	}

	if len(v.errs) > 0 {
		return v.errs, nil
	}
	return nil, &def
}

// ---------------------------------------------------------------- nodes

func (v *validator) checkNodes(def *WorkflowDefinition) {
	if len(def.Nodes) == 0 {
		v.add("", "nodes", "The workflow has no steps.")
		return
	}
	if len(def.Nodes) > MaxNodes {
		v.add("", "nodes", "Too many steps (max %d).", MaxNodes)
		return
	}
	ids := map[string]bool{}
	counts := map[string]int{}
	for i := range def.Nodes {
		n := &def.Nodes[i]
		if !idPattern.MatchString(n.ID) {
			v.add(n.ID, "id", "Step id must be 1-32 lowercase letters, numbers or underscores.")
			continue
		}
		if ids[n.ID] {
			v.add(n.ID, "id", "Two steps share the id %q.", n.ID)
			continue
		}
		ids[n.ID] = true
		if !finite(n.Position.X) || !finite(n.Position.Y) || math.Abs(n.Position.X) > MaxPosition || math.Abs(n.Position.Y) > MaxPosition {
			v.add(n.ID, "position", "Step position is out of range.")
		}
		counts[n.Type]++
		v.parseConfig(n)
	}
	if counts[NodeInput] != 1 {
		v.add("", "nodes", "A workflow needs exactly one Input step.")
	}
	if counts[NodeOutput] != 1 {
		v.add("", "nodes", "A workflow needs exactly one Output step.")
	}
	if counts[NodeModel] < 1 {
		v.add("", "nodes", "Add at least one model step.")
	}
	if counts[NodeModel] > MaxModelNodes {
		v.add("", "nodes", "Too many model steps (max %d).", MaxModelNodes)
	}
	if counts[NodeForEach] > MaxForEachNodes {
		v.add("", "nodes", "Too many For each steps (max %d).", MaxForEachNodes)
	}
}

func finite(f float64) bool { return !math.IsNaN(f) && !math.IsInf(f, 0) }

func (v *validator) parseConfig(n *Node) {
	raw := n.RawConfig
	if len(raw) == 0 || string(raw) == "null" {
		raw = []byte("{}")
	}
	bad := func(err error) { v.add(n.ID, "config", "Settings aren't valid: %v", err) }
	switch n.Type {
	case NodeInput:
		var c InputConfig
		if err := strictDecode(raw, &c); err != nil {
			bad(err)
			return
		}
		if !validInputModes[c.Mode] {
			v.add(n.ID, "config.mode", "Input must be \"single\" or \"batch\".")
		}
		if c.MaxImages < 1 || c.MaxImages > MaxImagesPerRun {
			v.add(n.ID, "config.max_images", "Max images must be 1-%d.", MaxImagesPerRun)
		}
		if c.Mode == "single" && c.MaxImages != 1 {
			v.add(n.ID, "config.max_images", "Single-image input takes exactly 1 image.")
		}
		n.InputConfig = &c
	case NodeModel:
		var c ModelConfig
		if err := strictDecode(raw, &c); err != nil {
			bad(err)
			return
		}
		if !slugPattern.MatchString(c.ModelSlug) {
			v.add(n.ID, "config.model_slug", "Choose a model for this step.")
		}
		checkConfidence(v, n.ID, "config.min_confidence", c.MinConfidence)
		c.Label = strings.TrimSpace(c.Label)
		if utf8.RuneCountInString(c.Label) > MaxStepLabelChars || hasControl(c.Label) {
			v.add(n.ID, "config.label", "Step name must be at most %d characters.", MaxStepLabelChars)
		}
		n.ModelConfig = &c
	case NodeCondition:
		var c ConditionConfig
		if err := strictDecode(raw, &c); err != nil {
			bad(err)
			return
		}
		if !validRules[c.Rule] {
			v.add(n.ID, "config.rule", "Choose a rule: has label, count at least, or no predictions.")
		}
		c.Labels = v.checkLabels(n.ID, "config.labels", c.Labels)
		checkConfidence(v, n.ID, "config.min_confidence", c.MinConfidence)
		if c.Rule == "count_at_least" && (c.Count < 1 || c.Count > 1000) {
			v.add(n.ID, "config.count", "Count must be 1-1000.")
		}
		if c.Count < 0 || c.Count > 1000 {
			v.add(n.ID, "config.count", "Count must be 0-1000.")
		}
		n.ConditionConfig = &c
	case NodeForEach:
		var c ForEachConfig
		if err := strictDecode(raw, &c); err != nil {
			bad(err)
			return
		}
		c.Labels = v.checkLabels(n.ID, "config.labels", c.Labels)
		checkConfidence(v, n.ID, "config.min_confidence", c.MinConfidence)
		if c.MaxItems < 1 || c.MaxItems > 10 {
			v.add(n.ID, "config.max_items", "Max items must be 1-10.")
		}
		if c.PaddingPct < 0 || c.PaddingPct > 50 {
			v.add(n.ID, "config.padding_pct", "Padding must be 0-50%%.")
		}
		n.ForEachConfig = &c
	case NodeOutput:
		var c OutputConfig
		if err := strictDecode(raw, &c); err != nil {
			bad(err)
			return
		}
		v.checkOutput(n.ID, &c)
		n.OutputConfig = &c
	default:
		v.add(n.ID, "type", "Unknown step type %q.", n.Type)
	}
}

func checkConfidence(v *validator, nodeID, field string, f float64) {
	if !finite(f) || f < 0 || f > 1 {
		v.add(nodeID, field, "Confidence must be between 0 and 1.")
	}
}

func hasControl(s string) bool {
	for _, r := range s {
		if unicode.IsControl(r) {
			return true
		}
	}
	return false
}

// checkLabels trims, de-duplicates and validates a label list.
func (v *validator) checkLabels(nodeID, field string, labels []string) []string {
	if len(labels) > MaxLabels {
		v.add(nodeID, field, "At most %d labels.", MaxLabels)
		return labels
	}
	seen := map[string]bool{}
	out := []string{}
	for _, l := range labels {
		l = strings.TrimSpace(l)
		if l == "" || utf8.RuneCountInString(l) > MaxLabelChars || hasControl(l) {
			v.add(nodeID, field, "Labels must be 1-%d characters.", MaxLabelChars)
			continue
		}
		key := strings.ToLower(l)
		if !seen[key] {
			seen[key] = true
			out = append(out, l)
		}
	}
	return out
}

func (v *validator) checkOutput(id string, c *OutputConfig) {
	if len(c.Fields) == 0 {
		v.add(id, "config.fields", "Pick at least one field to return.")
	}
	seen := map[string]bool{}
	for _, f := range c.Fields {
		if !validOutputFields[f] {
			v.add(id, "config.fields", "Unknown field %q.", f)
		} else if seen[f] {
			v.add(id, "config.fields", "Field %q is listed twice.", f)
		}
		seen[f] = true
	}
	if c.Rename == nil {
		c.Rename = map[string]string{}
	}
	finalNames := map[string]string{}
	for _, f := range c.Fields {
		finalNames[f] = f
	}
	for field, alias := range c.Rename {
		if !seen[field] {
			v.add(id, "config.rename", "You can only rename fields you return (%q isn't selected).", field)
			continue
		}
		if !aliasPattern.MatchString(alias) {
			v.add(id, "config.rename", "Name for %q must start with a letter or _ and use letters, numbers or _ (max 32).", field)
			continue
		}
		finalNames[field] = alias
	}
	used := map[string]bool{}
	for _, f := range c.Fields {
		name := finalNames[f]
		if used[name] {
			v.add(id, "config.rename", "Two fields would both be called %q.", name)
		}
		used[name] = true
	}
	checkConfidence(v, id, "config.min_confidence", c.MinConfidence)
	c.LabelsInclude = v.checkLabels(id, "config.labels_include", c.LabelsInclude)
	c.LabelsExclude = v.checkLabels(id, "config.labels_exclude", c.LabelsExclude)
	if c.TopK != nil && (*c.TopK < 1 || *c.TopK > 100) {
		v.add(id, "config.top_k", "Top results must be 1-100, or off.")
	}
	if !validSorts[c.Sort] {
		v.add(id, "config.sort", "Choose how results are sorted.")
	}
	if !validConfFormats[c.ConfidenceFormat] {
		v.add(id, "config.confidence_format", "Confidence must be shown as a decimal or a percent.")
	}
	if c.Decimals < 0 || c.Decimals > 6 {
		v.add(id, "config.decimals", "Decimals must be 0-6.")
	}
	if !validBBoxFormats[c.BBoxFormat] {
		v.add(id, "config.bbox_format", "Choose a box format.")
	}
	if !validLayouts[c.Layout] {
		v.add(id, "config.layout", "Choose a layout: by image, by step or flat.")
	}
	if !validFormats[c.Format] {
		v.add(id, "config.format", "Format must be JSON or CSV.")
	}
}

// ---------------------------------------------------------------- edges

// allowedTargets lists which step types each step type may connect to.
var allowedTargets = map[string]map[string]bool{
	NodeInput:     setOf(NodeModel),
	NodeModel:     setOf(NodeModel, NodeCondition, NodeForEach, NodeOutput),
	NodeCondition: setOf(NodeModel),
	NodeForEach:   setOf(NodeModel),
	NodeOutput:    {},
}

var typeNames = map[string]string{
	NodeInput: "Input", NodeModel: "a model step", NodeCondition: "a Condition",
	NodeForEach: "a For each step", NodeOutput: "Output",
}

func (v *validator) checkEdges(def *WorkflowDefinition) {
	if len(def.Edges) > MaxEdges {
		v.add("", "edges", "Too many connections (max %d).", MaxEdges)
		return
	}
	ids := map[string]bool{}
	pairs := map[string]bool{}
	for _, e := range def.Edges {
		if !edgeIDPattern.MatchString(e.ID) {
			v.addEdge(e.ID, "Connection id is invalid.")
			continue
		}
		if ids[e.ID] {
			v.addEdge(e.ID, "Two connections share the id %q.", e.ID)
			continue
		}
		ids[e.ID] = true
		src, dst := def.Node(e.Source), def.Node(e.Target)
		if src == nil || dst == nil {
			v.addEdge(e.ID, "A connection points to a step that doesn't exist.")
			continue
		}
		if e.Source == e.Target {
			v.addEdge(e.ID, "A step can't connect to itself.")
			continue
		}
		if src.Type == NodeCondition {
			if e.SourceHandle != HandleYes && e.SourceHandle != HandleNo {
				v.addEdge(e.ID, "Connections from a Condition must leave from Yes or No.")
				continue
			}
		} else if e.SourceHandle != "" {
			v.addEdge(e.ID, "Only Condition steps have Yes/No outputs.")
			continue
		}
		if !allowedTargets[src.Type][dst.Type] {
			v.addEdge(e.ID, "%s can't connect to %s.", capitalize(typeNames[src.Type]), typeNames[dst.Type])
			continue
		}
		key := e.Source + "|" + e.SourceHandle + "|" + e.Target
		if pairs[key] {
			v.addEdge(e.ID, "These two steps are already connected.")
			continue
		}
		pairs[key] = true
	}
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	r, size := utf8.DecodeRuneInString(s)
	return string(unicode.ToUpper(r)) + s[size:]
}

// ---------------------------------------------------------------- graph

func (v *validator) checkGraph(def *WorkflowDefinition) {
	for _, n := range def.Nodes {
		in := len(def.IncomingEdges(n.ID))
		out := len(def.OutgoingEdges(n.ID, ""))
		switch n.Type {
		case NodeInput:
			if out == 0 {
				v.add(n.ID, "edges", "Connect Input to a model step.")
			}
		case NodeModel:
			if in != 1 {
				v.add(n.ID, "edges", "A model step needs exactly one incoming connection (it has %d).", in)
			}
			if out == 0 {
				v.add(n.ID, "edges", "Connect this step to Output or to another step.")
			}
		case NodeCondition:
			if in != 1 {
				v.add(n.ID, "edges", "A Condition needs exactly one incoming connection from a model step.")
			}
			if out == 0 {
				v.add(n.ID, "edges", "Connect Yes or No to a model step.")
			}
		case NodeForEach:
			if in != 1 {
				v.add(n.ID, "edges", "A For each step needs exactly one incoming connection from a model step.")
			}
			if out == 0 {
				v.add(n.ID, "edges", "Connect this For each step to the model to run on each object.")
			}
		case NodeOutput:
			if in == 0 {
				v.add(n.ID, "edges", "Connect at least one model step to Output.")
			}
		}
	}
	if len(v.errs) > 0 {
		return
	}

	order, ok := topoOrder(def)
	if !ok {
		v.add("", "edges", "The workflow has a loop of connections. Use a For each step to repeat work instead.")
		return
	}

	// Everything must be reachable from Input.
	reach := map[string]bool{def.Input().ID: true}
	for _, id := range order {
		if !reach[id] {
			continue
		}
		for _, e := range def.OutgoingEdges(id, "") {
			reach[e.Target] = true
		}
	}
	for _, n := range def.Nodes {
		if !reach[n.ID] {
			v.add(n.ID, "edges", "This step isn't connected to Input.")
		}
	}

	// For each nesting depth.
	depth := map[string]int{}
	for _, id := range order {
		n := def.Node(id)
		d := depth[id]
		if n.Type == NodeForEach {
			d++
			if d > MaxForEachDepth {
				v.add(id, "edges", "For each steps can be nested at most %d deep.", MaxForEachDepth)
			}
		}
		for _, e := range def.OutgoingEdges(id, "") {
			if d > depth[e.Target] {
				depth[e.Target] = d
			}
		}
	}
}

// topoOrder returns node ids in dependency order, or false if there is a cycle.
func topoOrder(def *WorkflowDefinition) ([]string, bool) {
	indeg := map[string]int{}
	for _, n := range def.Nodes {
		indeg[n.ID] = 0
	}
	for _, e := range def.Edges {
		indeg[e.Target]++
	}
	var queue []string
	for _, n := range def.Nodes {
		if indeg[n.ID] == 0 {
			queue = append(queue, n.ID)
		}
	}
	sort.Strings(queue)
	var order []string
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		order = append(order, id)
		for _, e := range def.OutgoingEdges(id, "") {
			indeg[e.Target]--
			if indeg[e.Target] == 0 {
				queue = append(queue, e.Target)
			}
		}
	}
	return order, len(order) == len(def.Nodes)
}

// ---------------------------------------------------------------- cost

// CallBounds returns the fewest and the most billed model calls one image can cause.
// Conditions take the cheaper/dearer branch; For each assumes 0 / max_items objects.
func CallBounds(def *WorkflowDefinition) (minCalls, maxCalls int) {
	in := def.Input()
	if in == nil {
		return 0, 0
	}
	for _, e := range def.OutgoingEdges(in.ID, "") {
		minCalls += callsFrom(def, e.Target, 1, false, 0)
		maxCalls += callsFrom(def, e.Target, 1, true, 0)
	}
	return minCalls, maxCalls
}

func callsFrom(def *WorkflowDefinition, id string, mult int, worst bool, guard int) int {
	if guard > MaxNodes || mult > 100000 {
		return MaxCallsPerImage + 1 // defensive: treat runaway graphs as over the limit
	}
	n := def.Node(id)
	if n == nil {
		return 0
	}
	sum := func(handle string, m int) int {
		total := 0
		for _, e := range def.OutgoingEdges(id, handle) {
			total += callsFrom(def, e.Target, m, worst, guard+1)
		}
		return total
	}
	switch n.Type {
	case NodeModel:
		return mult + sum("", mult)
	case NodeCondition:
		yes, no := sum(HandleYes, mult), sum(HandleNo, mult)
		if worst {
			return max(yes, no)
		}
		return min(yes, no)
	case NodeForEach:
		if !worst {
			return 0
		}
		return sum("", mult*n.ForEachConfig.MaxItems)
	default:
		return 0
	}
}
