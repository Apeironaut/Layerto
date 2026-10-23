package workflows

import "encoding/json"

// Test helpers for building definitions.

type tNode struct {
	ID     string `json:"id"`
	Type   string `json:"type"`
	Pos    any    `json:"position"`
	Config any    `json:"config"`
}

type tDef struct {
	Version int     `json:"version"`
	Nodes   []tNode `json:"nodes"`
	Edges   []Edge  `json:"edges"`
}

func pos() map[string]float64 { return map[string]float64{"x": 0, "y": 0} }

func inputNode(maxImages int) tNode {
	mode := "batch"
	if maxImages == 1 {
		mode = "single"
	}
	return tNode{"input", NodeInput, pos(), map[string]any{"mode": mode, "max_images": maxImages}}
}

func modelNode(id, slug string) tNode {
	return tNode{id, NodeModel, pos(), map[string]any{"model_slug": slug, "min_confidence": 0.0, "label": ""}}
}

func outputNode(cfg OutputConfig) tNode { return tNode{"output", NodeOutput, pos(), cfg} }

func edge(src, dst string) Edge { return Edge{ID: src + "-" + dst, Source: src, Target: dst} }

func handleEdge(src, handle, dst string) Edge {
	return Edge{ID: src + "-" + handle + "-" + dst, Source: src, Target: dst, SourceHandle: handle}
}

func (d tDef) raw() []byte {
	d.Version = DefinitionVersion
	b, _ := json.Marshal(d)
	return b
}

// simpleDef: input → m1(turtle-id) → output.
func simpleDef() tDef {
	return tDef{
		Nodes: []tNode{inputNode(5), modelNode("m1", "turtle-id"), outputNode(DefaultOutputConfig())},
		Edges: []Edge{edge("input", "m1"), edge("m1", "output")},
	}
}
