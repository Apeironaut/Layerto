package workflows

import (
	"bytes"
	"encoding/json"
)

// Workflow definition format, version 2.
//
// A workflow is a directed acyclic graph:
//
//	input ──► model ──► output
//	            ├──► model           (run another model on the same image or crop)
//	            ├──► condition ─yes─► model …
//	            │              └─no──► model …
//	            └──► for_each ──► model …   (run the next model on every detected object, cropped)
//
// Results that reach the output are the predictions of every model node with an edge to output.

const DefinitionVersion = 2

const (
	NodeInput     = "input"
	NodeModel     = "model"
	NodeCondition = "condition"
	NodeForEach   = "for_each"
	NodeOutput    = "output"

	HandleYes = "yes"
	HandleNo  = "no"
)

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type InputConfig struct {
	Mode      string `json:"mode"`       // "single" | "batch"
	MaxImages int    `json:"max_images"` // 1..20 ("single" forces 1)
}

type ModelConfig struct {
	ModelSlug     string  `json:"model_slug"`
	MinConfidence float64 `json:"min_confidence"` // 0..1, drops this step's weaker predictions
	Label         string  `json:"label"`          // optional display name for the step (≤ 60)
}

type ConditionConfig struct {
	Rule          string   `json:"rule"`           // "has_label" | "count_at_least" | "no_predictions"
	Labels        []string `json:"labels"`         // empty = any label
	MinConfidence float64  `json:"min_confidence"` // predictions below are ignored
	Count         int      `json:"count"`          // for count_at_least, 1..1000
}

type ForEachConfig struct {
	Labels        []string `json:"labels"`         // empty = every label
	MinConfidence float64  `json:"min_confidence"` // skip weaker detections
	MaxItems      int      `json:"max_items"`      // 1..10 crops per image (or per parent crop)
	PaddingPct    int      `json:"padding_pct"`    // 0..50 % extra margin around each box
}

type OutputConfig struct {
	Fields           []string          `json:"fields"`
	Rename           map[string]string `json:"rename"`
	MinConfidence    float64           `json:"min_confidence"`
	LabelsInclude    []string          `json:"labels_include"`
	LabelsExclude    []string          `json:"labels_exclude"`
	TopK             *int              `json:"top_k"`
	Sort             string            `json:"sort"`              // "confidence_desc" | "label_asc" | "step"
	ConfidenceFormat string            `json:"confidence_format"` // "decimal" | "percent"
	Decimals         int               `json:"decimals"`          // 0..6
	BBoxFormat       string            `json:"bbox_format"`       // "xywh" | "xyxy" | "normalized_xywh" | "center_xywh"
	Layout           string            `json:"layout"`            // "by_image" | "by_step" | "flat"
	IncludeSummary   bool              `json:"include_summary"`
	IncludeErrors    bool              `json:"include_errors"`
	IncludeImageInfo bool              `json:"include_image_info"`
	IncludeEmpty     bool              `json:"include_empty"`
	Format           string            `json:"format"` // "json" | "csv"
}

type Node struct {
	ID              string           `json:"id"`
	Type            string           `json:"type"`
	Position        Position         `json:"position"`
	RawConfig       json.RawMessage  `json:"config"`
	InputConfig     *InputConfig     `json:"-"`
	ModelConfig     *ModelConfig     `json:"-"`
	ConditionConfig *ConditionConfig `json:"-"`
	ForEachConfig   *ForEachConfig   `json:"-"`
	OutputConfig    *OutputConfig    `json:"-"`
}

type Edge struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"source_handle,omitempty"` // "yes" | "no" for condition nodes
}

type WorkflowDefinition struct {
	Version int    `json:"version"`
	Nodes   []Node `json:"nodes"`
	Edges   []Edge `json:"edges"`
}

// Node looks up a node by id.
func (d *WorkflowDefinition) Node(id string) *Node {
	for i := range d.Nodes {
		if d.Nodes[i].ID == id {
			return &d.Nodes[i]
		}
	}
	return nil
}

// Input returns the input node (validated definitions have exactly one).
func (d *WorkflowDefinition) Input() *Node { return d.firstOfType(NodeInput) }

// Output returns the output node (validated definitions have exactly one).
func (d *WorkflowDefinition) Output() *Node { return d.firstOfType(NodeOutput) }

func (d *WorkflowDefinition) firstOfType(t string) *Node {
	for i := range d.Nodes {
		if d.Nodes[i].Type == t {
			return &d.Nodes[i]
		}
	}
	return nil
}

// OutgoingEdges returns edges leaving id, optionally only from one handle ("" = all).
func (d *WorkflowDefinition) OutgoingEdges(id, handle string) []Edge {
	var out []Edge
	for _, e := range d.Edges {
		if e.Source == id && (handle == "" || e.SourceHandle == handle) {
			out = append(out, e)
		}
	}
	return out
}

// IncomingEdges returns edges entering id.
func (d *WorkflowDefinition) IncomingEdges(id string) []Edge {
	var in []Edge
	for _, e := range d.Edges {
		if e.Target == id {
			in = append(in, e)
		}
	}
	return in
}

// StepName is how a model step is named in results: its label, or its id.
func (n *Node) StepName() string {
	if n.ModelConfig != nil && n.ModelConfig.Label != "" {
		return n.ModelConfig.Label
	}
	return n.ID
}

// DefaultOutputConfig is used for new workflows and when upgrading version 1.
func DefaultOutputConfig() OutputConfig {
	return OutputConfig{
		Fields:           []string{"label", "confidence", "bbox", "step"},
		Rename:           map[string]string{},
		LabelsInclude:    []string{},
		LabelsExclude:    []string{},
		Sort:             "confidence_desc",
		ConfidenceFormat: "decimal",
		Decimals:         4,
		BBoxFormat:       "xywh",
		Layout:           "by_image",
		IncludeSummary:   true,
		IncludeErrors:    true,
		IncludeImageInfo: true,
		IncludeEmpty:     true,
		Format:           "json",
	}
}

// upgradeV1 converts a version 1 definition (input → models → output, older output options)
// into version 2. Anything that isn't version 1 is returned unchanged.
func upgradeV1(raw []byte) []byte {
	var probe struct {
		Version int `json:"version"`
	}
	if json.Unmarshal(raw, &probe) != nil || probe.Version != 1 {
		return raw
	}
	var v1 struct {
		Nodes []struct {
			ID       string          `json:"id"`
			Type     string          `json:"type"`
			Position Position        `json:"position"`
			Config   json.RawMessage `json:"config"`
		} `json:"nodes"`
		Edges []Edge `json:"edges"`
	}
	if json.Unmarshal(raw, &v1) != nil {
		return raw
	}
	type v2Node struct {
		ID       string   `json:"id"`
		Type     string   `json:"type"`
		Position Position `json:"position"`
		Config   any      `json:"config"`
	}
	out := struct {
		Version int      `json:"version"`
		Nodes   []v2Node `json:"nodes"`
		Edges   []Edge   `json:"edges"`
	}{Version: DefinitionVersion, Edges: v1.Edges}

	for _, n := range v1.Nodes {
		var cfg any = json.RawMessage(n.Config)
		if n.Type == NodeOutput {
			var old struct {
				Fields         []string `json:"fields"`
				MinConfidence  float64  `json:"min_confidence"`
				LabelsInclude  []string `json:"labels_include"`
				TopK           *int     `json:"top_k"`
				BBoxFormat     string   `json:"bbox_format"`
				MergeModels    bool     `json:"merge_models"`
				IncludeSummary bool     `json:"include_summary"`
				Format         string   `json:"format"`
			}
			_ = json.Unmarshal(n.Config, &old)
			c := DefaultOutputConfig()
			if len(old.Fields) > 0 {
				c.Fields = nil
				for _, f := range old.Fields {
					if f == "model" {
						f = "step"
					}
					if validOutputFields[f] {
						c.Fields = append(c.Fields, f)
					}
				}
			}
			c.MinConfidence = old.MinConfidence
			if old.LabelsInclude != nil {
				c.LabelsInclude = old.LabelsInclude
			}
			c.TopK = old.TopK
			if validBBoxFormats[old.BBoxFormat] {
				c.BBoxFormat = old.BBoxFormat
			}
			if !old.MergeModels {
				c.Layout = "by_step"
			}
			c.IncludeSummary = old.IncludeSummary
			if old.Format == "csv" {
				c.Format = "csv"
			}
			cfg = c
		}
		out.Nodes = append(out.Nodes, v2Node{ID: n.ID, Type: n.Type, Position: n.Position, Config: cfg})
	}
	b, err := json.Marshal(out)
	if err != nil {
		return raw
	}
	return b
}

// strictDecode decodes JSON into v and rejects unknown keys and trailing data.
func strictDecode(raw []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	if dec.More() {
		return errTrailingData
	}
	return nil
}
