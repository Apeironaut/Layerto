package workflows

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/png"
	"strings"
	"sync"
	"testing"

	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/models"
)

func testPNG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			img.Set(x, y, color.RGBA{R: uint8(x), G: uint8(y), B: 80, A: 255})
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

// fakeCalls answers per model slug and records the image size of each call.
type fakeCalls struct {
	mu    sync.Mutex
	sizes map[string][]image.Point
	fail  string
}

func (f *fakeCalls) call(_ context.Context, slug string, img []byte) (*gateway.ExecuteCallResult, error) {
	cfg, _, _ := image.DecodeConfig(bytes.NewReader(img))
	f.mu.Lock()
	if f.sizes == nil {
		f.sizes = map[string][]image.Point{}
	}
	f.sizes[slug] = append(f.sizes[slug], image.Pt(cfg.Width, cfg.Height))
	f.mu.Unlock()
	if slug == f.fail {
		return &gateway.ExecuteCallResult{RequestID: "req-fail"}, errors.New("boom")
	}
	box := func(x, y, w, h int) *[4]int { b := [4]int{x, y, w, h}; return &b }
	res := &gateway.ExecuteCallResult{RequestID: "req-" + slug, ModelVersion: "v1", LatencyMs: 12, ChargeMicro: 1000}
	switch slug {
	case "detector":
		res.Predictions = []models.Prediction{
			{Label: "turtle", Confidence: 0.91, BBox: box(10, 20, 30, 40)},
			{Label: "turtle", Confidence: 0.55, BBox: box(60, 10, 20, 20)},
			{Label: "rock", Confidence: 0.40, BBox: box(0, 0, 5, 5)},
		}
	case "classifier":
		res.Predictions = []models.Prediction{
			{Label: "Chelonia mydas", Confidence: 0.876543, BBox: box(1, 2, 3, 4)},
			{Label: "=cmd()", Confidence: 0.1, BBox: box(0, 0, 1, 1)},
		}
	}
	return res, nil
}

func mustValidate(t *testing.T, d tDef) *WorkflowDefinition {
	t.Helper()
	errs, def := Validate(context.Background(), d.raw(), nil)
	if len(errs) > 0 {
		t.Fatalf("invalid test definition: %+v", errs)
	}
	return def
}

func runShaped(t *testing.T, def *WorkflowDefinition, f *fakeCalls, images ...Item) (map[string]any, []StepResult) {
	t.Helper()
	results := newEngine(def, f.call, 4, 100).run(context.Background(), images)
	meta := make([]ImageMeta, len(images))
	for i, it := range images {
		meta[i] = ImageMeta{Index: it.ImageIndex, Width: it.Width, Height: it.Height}
	}
	out, err := shapeOutput(def, results, meta, "wf", "run")
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if strings.HasPrefix(out.ContentType, "application/json") {
		if err := json.Unmarshal(out.Body, &m); err != nil {
			t.Fatalf("bad json: %v\n%s", err, out.Body)
		}
		m["__raw"] = string(out.Body)
	} else {
		m = map[string]any{"csv": string(out.Body)}
	}
	return m, results
}

func img(index int) Item {
	data := testPNG(100, 80)
	return Item{ImageIndex: index, Data: data, Width: 100, Height: 80}
}

func conditionDef(rule string, labels []string, count int) tDef {
	return tDef{
		Nodes: []tNode{
			inputNode(5), modelNode("det", "detector"),
			{"c1", NodeCondition, pos(), map[string]any{"rule": rule, "labels": labels, "min_confidence": 0.5, "count": count}},
			modelNode("yes_m", "classifier"), modelNode("no_m", "other"),
			outputNode(DefaultOutputConfig()),
		},
		Edges: []Edge{edge("input", "det"), edge("det", "c1"), handleEdge("c1", HandleYes, "yes_m"), handleEdge("c1", HandleNo, "no_m"), edge("yes_m", "output"), edge("no_m", "output")},
	}
}

func TestEngine_ConditionBranches(t *testing.T) {
	cases := []struct {
		rule   string
		labels []string
		count  int
		want   string
	}{
		{"has_label", []string{"TURTLE"}, 0, "classifier"}, // case-insensitive match
		{"has_label", []string{"rock"}, 0, "other"},        // rock is below min_confidence 0.5
		{"count_at_least", []string{"turtle"}, 2, "classifier"},
		{"count_at_least", []string{"turtle"}, 3, "other"},
		{"no_predictions", []string{"shark"}, 0, "classifier"},
	}
	for _, c := range cases {
		f := &fakeCalls{}
		runShaped(t, mustValidate(t, conditionDef(c.rule, c.labels, c.count)), f, img(0))
		other := "other"
		if c.want == "other" {
			other = "classifier"
		}
		if len(f.sizes[c.want]) != 1 || len(f.sizes[other]) != 0 {
			t.Errorf("%s %v %d: calls = %v, want only %s", c.rule, c.labels, c.count, f.sizes, c.want)
		}
	}
}

func TestEngine_ForEachCropsAndMapsBoxes(t *testing.T) {
	cfg := DefaultOutputConfig()
	cfg.Fields = []string{"label", "bbox", "step", "parent"}
	cfg.Layout = "flat"
	d := tDef{
		Nodes: []tNode{
			inputNode(5), modelNode("det", "detector"),
			{"f1", NodeForEach, pos(), map[string]any{"labels": []string{"turtle"}, "min_confidence": 0.5, "max_items": 5, "padding_pct": 0}},
			modelNode("cls", "classifier"), outputNode(cfg),
		},
		Edges: []Edge{edge("input", "det"), edge("det", "f1"), edge("f1", "cls"), edge("cls", "output")},
	}
	f := &fakeCalls{}
	out, _ := runShaped(t, mustValidate(t, d), f, img(0))

	// Two turtles pass the filter → two crops of exactly their box sizes.
	sizes := f.sizes["classifier"]
	if len(sizes) != 2 {
		t.Fatalf("classifier calls = %d, want 2", len(sizes))
	}
	got := map[image.Point]bool{sizes[0]: true, sizes[1]: true}
	if !got[image.Pt(30, 40)] || !got[image.Pt(20, 20)] {
		t.Fatalf("crop sizes = %v, want 30x40 and 20x20", sizes)
	}

	// Classifier boxes are moved back into original-image coordinates, and carry their parent.
	results := out["results"].([]any)
	first := results[0].(map[string]any)
	bbox := first["bbox"].([]any)
	parent := first["parent"].(map[string]any)
	if parent["label"] != "turtle" || parent["step"] != "det" {
		t.Fatalf("parent = %v", parent)
	}
	pb := parent["bbox"].([]any)
	if bbox[0].(float64) != pb[0].(float64)+1 || bbox[1].(float64) != pb[1].(float64)+2 {
		t.Fatalf("bbox %v not offset from parent %v", bbox, pb)
	}
}

func TestShape_FieldsRenameFormatTopKAndLayouts(t *testing.T) {
	cfg := DefaultOutputConfig()
	cfg.Fields = []string{"confidence", "label", "bbox"} // returned in canonical order regardless
	cfg.Rename = map[string]string{"label": "species", "bbox": "box"}
	cfg.ConfidenceFormat = "percent"
	cfg.Decimals = 1
	cfg.BBoxFormat = "xyxy"
	k := 1
	cfg.TopK = &k
	cfg.LabelsExclude = []string{"ROCK"}
	d := simpleDef()
	d.Nodes[1] = modelNode("m1", "detector")
	d.Nodes[2] = outputNode(cfg)
	out, _ := runShaped(t, mustValidate(t, d), &fakeCalls{}, img(0), img(1))

	images := out["images"].([]any)
	if len(images) != 2 {
		t.Fatalf("images = %d", len(images))
	}
	res := images[0].(map[string]any)["results"].([]any)
	if len(res) != 1 {
		t.Fatalf("top_k=1 should leave 1 result, got %d", len(res))
	}
	r := res[0].(map[string]any)
	if r["species"] != "turtle" || r["confidence"].(float64) != 91.0 {
		t.Fatalf("row = %v", r)
	}
	box := r["box"].([]any)
	if box[2].(float64) != 40 || box[3].(float64) != 60 { // xyxy: 10+30, 20+40
		t.Fatalf("xyxy box = %v", box)
	}
	// Keys appear in canonical order: label, confidence, bbox.
	raw := out["__raw"].(string)
	if !strings.Contains(raw, `{"species":"turtle","confidence":91,"box":[10,20,40,60]}`) {
		t.Fatalf("key order wrong: %s", raw)
	}
	sum := out["summary"].(map[string]any)
	if sum["model_calls"].(float64) != 2 || out["total_charge_usd"] != "0.002000" {
		t.Fatalf("summary = %v total=%v", sum, out["total_charge_usd"])
	}
}

func TestShape_ByStepNormalizedAndErrors(t *testing.T) {
	cfg := DefaultOutputConfig()
	cfg.Layout = "by_step"
	cfg.BBoxFormat = "normalized_xywh"
	cfg.Fields = []string{"label", "bbox"}
	d := tDef{
		Nodes: []tNode{inputNode(5), modelNode("det", "detector"), modelNode("bad", "broken"), outputNode(cfg)},
		Edges: []Edge{edge("input", "det"), edge("input", "bad"), edge("det", "output"), edge("bad", "output")},
	}
	out, _ := runShaped(t, mustValidate(t, d), &fakeCalls{fail: "broken"}, img(0))
	im := out["images"].([]any)[0].(map[string]any)
	steps := im["steps"].(map[string]any)
	det := steps["det"].([]any)
	if len(det) != 3 || len(steps["bad"].([]any)) != 0 {
		t.Fatalf("steps = %v", steps)
	}
	nb := det[0].(map[string]any)["bbox"].([]any)
	if nb[0].(float64) != 0.1 || nb[1].(float64) != 0.25 { // 10/100, 20/80
		t.Fatalf("normalized bbox = %v", nb)
	}
	errs := im["errors"].([]any)
	if len(errs) != 1 || errs[0].(map[string]any)["code"] != "model_error" {
		t.Fatalf("errors = %v", errs)
	}
}

func TestShape_CSVHeaderEscapingAndFormulaGuard(t *testing.T) {
	cfg := DefaultOutputConfig()
	cfg.Format = "csv"
	cfg.Fields = []string{"label", "confidence", "bbox", "charge_usd"}
	cfg.BBoxFormat = "center_xywh"
	d := simpleDef()
	d.Nodes[1] = modelNode("m1", "classifier")
	d.Nodes[2] = outputNode(cfg)
	out, _ := runShaped(t, mustValidate(t, d), &fakeCalls{}, img(0))
	rows, err := csv.NewReader(strings.NewReader(out["csv"].(string))).ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(rows[0], ",") != "image_index,label,confidence,bbox_cx,bbox_cy,bbox_w,bbox_h,charge_usd" {
		t.Fatalf("header = %v", rows[0])
	}
	if rows[1][1] != "Chelonia mydas" || rows[1][2] != "0.8765" || rows[1][3] != "2.5" {
		t.Fatalf("row 1 = %v", rows[1])
	}
	if rows[2][1] != "'=cmd()" {
		t.Fatalf("formula not neutralised: %v", rows[2])
	}
}
