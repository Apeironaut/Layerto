package workflows

import (
	"context"
	"strings"
	"testing"
)

func allModels(_ context.Context, slug string) (bool, error) { return slug != "disabled-model", nil }

func validate(t *testing.T, raw []byte) []ValidationError {
	t.Helper()
	errs, def := Validate(context.Background(), raw, allModels)
	if len(errs) == 0 && def == nil {
		t.Fatal("no errors but no definition")
	}
	return errs
}

func hasError(errs []ValidationError, substr string) bool {
	for _, e := range errs {
		if strings.Contains(e.Message, substr) {
			return true
		}
	}
	return false
}

func TestValidate_SimpleAndBranchingDefinitionsPass(t *testing.T) {
	if errs := validate(t, simpleDef().raw()); len(errs) != 0 {
		t.Fatalf("simple: %+v", errs)
	}
	d := simpleDef()
	d.Nodes = append(d.Nodes,
		tNode{"c1", NodeCondition, pos(), map[string]any{"rule": "has_label", "labels": []string{"Chelonia mydas"}, "min_confidence": 0.5, "count": 0}},
		modelNode("m2", "bioclip"),
		tNode{"f1", NodeForEach, pos(), map[string]any{"labels": []string{}, "min_confidence": 0.3, "max_items": 3, "padding_pct": 10}},
		modelNode("m3", "bioclip"),
	)
	d.Edges = append(d.Edges, edge("m1", "c1"), handleEdge("c1", HandleYes, "m2"), edge("m2", "output"), edge("m1", "f1"), edge("f1", "m3"), edge("m3", "output"))
	if errs := validate(t, d.raw()); len(errs) != 0 {
		t.Fatalf("branching: %+v", errs)
	}
}

func TestValidate_Rules(t *testing.T) {
	cases := []struct {
		name  string
		build func() tDef
		want  string
	}{
		{"no input", func() tDef { d := simpleDef(); d.Nodes = d.Nodes[1:]; d.Edges = d.Edges[1:]; return d }, "exactly one Input"},
		{"input to output", func() tDef { d := simpleDef(); d.Edges = append(d.Edges, edge("input", "output")); return d }, "can't connect to Output"},
		{"condition without handle", func() tDef {
			d := simpleDef()
			d.Nodes = append(d.Nodes, tNode{"c1", NodeCondition, pos(), map[string]any{"rule": "no_predictions", "labels": []string{}, "min_confidence": 0, "count": 0}}, modelNode("m2", "bioclip"))
			d.Edges = append(d.Edges, edge("m1", "c1"), edge("c1", "m2"), edge("m2", "output"))
			return d
		}, "Yes or No"},
		{"cycle", func() tDef {
			d := simpleDef()
			d.Nodes = append(d.Nodes, modelNode("m2", "bioclip"))
			d.Edges = []Edge{edge("input", "m1"), edge("m1", "m2"), edge("m2", "m1"), edge("m2", "output")}
			return d
		}, "needs exactly one incoming"},
		{"dangling model", func() tDef {
			d := simpleDef()
			d.Nodes = append(d.Nodes, modelNode("m2", "bioclip"))
			d.Edges = append(d.Edges, edge("input", "m2"))
			return d
		}, "Connect this step to Output"},
		{"unreachable", func() tDef {
			d := simpleDef()
			d.Nodes = append(d.Nodes, tNode{"f1", NodeForEach, pos(), map[string]any{"labels": []string{}, "min_confidence": 0, "max_items": 2, "padding_pct": 0}}, modelNode("m2", "bioclip"))
			d.Edges = append(d.Edges, edge("f1", "m2"), edge("m2", "output"))
			return d
		}, "needs exactly one incoming connection from a model"},
		{"unknown config key", func() tDef {
			d := simpleDef()
			d.Nodes[1].Config = map[string]any{"model_slug": "turtle-id", "min_confidence": 0, "label": "", "evil": true}
			return d
		}, "unknown field"},
		{"single with 2 images", func() tDef {
			d := simpleDef()
			d.Nodes[0].Config = map[string]any{"mode": "single", "max_images": 2}
			return d
		}, "exactly 1 image"},
		{"disabled model", func() tDef { d := simpleDef(); d.Nodes[1] = modelNode("m1", "disabled-model"); return d }, "disabled"},
		{"rename collision", func() tDef {
			c := DefaultOutputConfig()
			c.Rename = map[string]string{"label": "step"}
			d := simpleDef()
			d.Nodes[2] = outputNode(c)
			return d
		}, "both be called"},
		{"rename unselected field", func() tDef {
			c := DefaultOutputConfig()
			c.Rename = map[string]string{"latency_ms": "ms"}
			d := simpleDef()
			d.Nodes[2] = outputNode(c)
			return d
		}, "only rename fields you return"},
		{"bad bbox format", func() tDef {
			c := DefaultOutputConfig()
			c.BBoxFormat = "polygon"
			d := simpleDef()
			d.Nodes[2] = outputNode(c)
			return d
		}, "box format"},
		{"too many calls", func() tDef {
			d := simpleDef()
			d.Nodes = append(d.Nodes,
				tNode{"f1", NodeForEach, pos(), map[string]any{"labels": []string{}, "min_confidence": 0, "max_items": 10, "padding_pct": 0}},
				modelNode("m2", "bioclip"),
				tNode{"f2", NodeForEach, pos(), map[string]any{"labels": []string{}, "min_confidence": 0, "max_items": 10, "padding_pct": 0}},
				modelNode("m3", "bioclip"))
			d.Edges = append(d.Edges, edge("m1", "f1"), edge("f1", "m2"), edge("m2", "f2"), edge("f2", "m3"), edge("m3", "output"))
			return d
		}, "model calls per image"},
		{"for each nested too deep", func() tDef {
			d := simpleDef()
			fe := func(id string) tNode {
				return tNode{id, NodeForEach, pos(), map[string]any{"labels": []string{}, "min_confidence": 0, "max_items": 1, "padding_pct": 0}}
			}
			d.Nodes = append(d.Nodes, fe("f1"), modelNode("m2", "bioclip"), fe("f2"), modelNode("m3", "bioclip"), fe("f3"), modelNode("m4", "bioclip"))
			d.Edges = append(d.Edges, edge("m1", "f1"), edge("f1", "m2"), edge("m2", "f2"), edge("f2", "m3"), edge("m3", "f3"), edge("f3", "m4"), edge("m4", "output"))
			return d
		}, "nested at most"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			errs := validate(t, c.build().raw())
			if !hasError(errs, c.want) {
				t.Fatalf("want error containing %q, got %+v", c.want, errs)
			}
		})
	}
}

func TestValidate_UpgradesVersion1(t *testing.T) {
	v1 := `{"version":1,"nodes":[
	 {"id":"input","type":"input","position":{"x":0,"y":0},"config":{"mode":"batch","max_images":3}},
	 {"id":"m_1","type":"model","position":{"x":1,"y":1},"config":{"model_slug":"turtle-id","min_confidence":0.2}},
	 {"id":"output","type":"output","position":{"x":2,"y":2},"config":{"fields":["label","model"],"min_confidence":0,"labels_include":[],"top_k":null,"bbox_format":"xyxy","group_by":"image","merge_models":false,"include_summary":true,"format":"json"}}],
	 "edges":[{"id":"e1","source":"input","target":"m_1"},{"id":"e2","source":"m_1","target":"output"}]}`
	errs, def := Validate(context.Background(), []byte(v1), allModels)
	if len(errs) != 0 {
		t.Fatalf("v1 should upgrade cleanly: %+v", errs)
	}
	oc := def.Output().OutputConfig
	if oc.Layout != "by_step" || oc.BBoxFormat != "xyxy" || strings.Join(oc.Fields, ",") != "label,step" {
		t.Fatalf("upgrade mapped wrongly: %+v", oc)
	}
}

func TestCallBounds(t *testing.T) {
	d := simpleDef()
	d.Nodes = append(d.Nodes,
		tNode{"c1", NodeCondition, pos(), map[string]any{"rule": "has_label", "labels": []string{}, "min_confidence": 0, "count": 0}},
		modelNode("m2", "bioclip"), modelNode("m3", "bioclip"),
		tNode{"f1", NodeForEach, pos(), map[string]any{"labels": []string{}, "min_confidence": 0, "max_items": 4, "padding_pct": 0}},
		modelNode("m4", "bioclip"))
	d.Edges = append(d.Edges,
		edge("m1", "c1"), handleEdge("c1", HandleYes, "m2"), edge("m2", "m3"), edge("m3", "output"), edge("m2", "output"),
		edge("m1", "f1"), edge("f1", "m4"), edge("m4", "output"))
	errs, def := Validate(context.Background(), d.raw(), allModels)
	if len(errs) != 0 {
		t.Fatalf("%+v", errs)
	}
	minC, maxC := CallBounds(def)
	// min: m1 only (condition "no" branch is empty, for each finds nothing) = 1
	// max: m1 + yes branch (m2 + m3) + 4 crops × m4 = 1 + 2 + 4 = 7
	if minC != 1 || maxC != 7 {
		t.Fatalf("bounds = %d..%d, want 1..7", minC, maxC)
	}
}
