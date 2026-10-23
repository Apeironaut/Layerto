package workflows

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"math"
	"sort"
	"strconv"
	"strings"

	"layerto/services/core/internal/billing"
)

// ---------------------------------------------------------------- ordered JSON

// obj is a JSON object that keeps its keys in insertion order, so results read
// in the order the user chose their fields.
type obj []kv

type kv struct {
	K string
	V any
}

func (o obj) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, p := range o {
		if i > 0 {
			b.WriteByte(',')
		}
		k, _ := json.Marshal(p.K)
		b.Write(k)
		b.WriteByte(':')
		v, err := json.Marshal(p.V)
		if err != nil {
			return nil, err
		}
		b.Write(v)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// ---------------------------------------------------------------- rows

// row is one prediction that passed the output filters.
type row struct {
	image   int
	stepIdx int
	res     *StepResult
	label   string
	conf    float64
	bbox    *[4]int
}

// ImageMeta is what shaping needs to know about each input image.
type ImageMeta struct {
	Index  int
	Width  int
	Height int
}

// Shaped is the final response body.
type Shaped struct {
	ContentType string
	Body        []byte
}

var errorMessages = map[string]string{
	"insufficient_balance": "Not enough balance for this call.",
	"model_unavailable":    "The model is disabled or no longer exists.",
	"model_timeout":        "The model took too long to respond.",
	"model_error":          "The model failed to process this image.",
	"call_limit":           "The run reached its model-call limit.",
	"run_timeout":          "The run ran out of time before this step.",
	"run_cancelled":        "The run was cancelled.",
}

// shapeOutput turns step results into the response described by the output step's config.
func shapeOutput(def *WorkflowDefinition, results []StepResult, images []ImageMeta, workflowID, runID string) (Shaped, error) {
	out := def.Output()
	cfg := out.OutputConfig

	// Steps whose predictions go to the output, in graph order.
	included := map[string]int{}
	order, _ := topoOrder(def)
	idx := 0
	for _, id := range order {
		for _, e := range def.IncomingEdges(out.ID) {
			if e.Source == id {
				included[id] = idx
				idx++
			}
		}
	}

	include := lowerSet(cfg.LabelsInclude)
	exclude := lowerSet(cfg.LabelsExclude)

	var rows []row
	var failed []*StepResult
	var totalCharge int64
	calls := 0
	for i := range results {
		r := &results[i]
		totalCharge += r.ChargeMicro
		if r.ErrCode == "call_limit" || r.ErrCode == "run_timeout" || r.ErrCode == "run_cancelled" {
			// not attempted
		} else {
			calls++
		}
		stepIdx, ok := included[r.NodeID]
		if !ok {
			continue
		}
		if r.ErrCode != "" {
			failed = append(failed, r)
			continue
		}
		for _, p := range r.Predictions {
			if p.Confidence < cfg.MinConfidence {
				continue
			}
			l := strings.ToLower(p.Label)
			if len(include) > 0 && !include[l] {
				continue
			}
			if exclude[l] {
				continue
			}
			rows = append(rows, row{image: r.ImageIndex, stepIdx: stepIdx, res: r, label: p.Label, conf: p.Confidence, bbox: p.BBox})
		}
	}

	rows = applyTopK(rows, cfg.TopK)
	sortRows(rows, cfg.Sort)

	meta := map[int]ImageMeta{}
	for _, m := range images {
		meta[m.Index] = m
	}
	names := fieldNames(cfg)

	if cfg.Format == "csv" {
		body, err := renderCSV(rows, cfg, names, meta)
		return Shaped{ContentType: "text/csv; charset=utf-8", Body: body}, err
	}

	resp := obj{{"workflow_id", workflowID}, {"run_id", runID}}
	errorsFor := func(image int) []obj {
		var list []obj
		for _, f := range failed {
			if image >= 0 && f.ImageIndex != image {
				continue
			}
			e := obj{}
			if image < 0 {
				e = append(e, kv{"image_index", f.ImageIndex})
			}
			e = append(e, kv{"step", f.Step}, kv{"model", f.Model}, kv{"code", f.ErrCode}, kv{"message", errorMessages[f.ErrCode]})
			list = append(list, e)
		}
		if list == nil {
			list = []obj{}
		}
		return list
	}

	switch cfg.Layout {
	case "flat":
		list := make([]obj, 0, len(rows))
		for _, r := range rows {
			list = append(list, append(obj{{"image_index", r.image}}, renderRow(r, cfg, names, meta[r.image])...))
		}
		resp = append(resp, kv{"results", list})
		if cfg.IncludeErrors {
			resp = append(resp, kv{"errors", errorsFor(-1)})
		}
	default: // by_image, by_step
		imgs := make([]obj, 0, len(images))
		for _, m := range images {
			var mine []row
			for _, r := range rows {
				if r.image == m.Index {
					mine = append(mine, r)
				}
			}
			errs := errorsFor(m.Index)
			if !cfg.IncludeEmpty && len(mine) == 0 && len(errs) == 0 {
				continue
			}
			o := obj{{"index", m.Index}}
			if cfg.IncludeImageInfo {
				o = append(o, kv{"width", m.Width}, kv{"height", m.Height})
			}
			if cfg.Layout == "by_step" {
				steps := obj{}
				for _, id := range order {
					si, ok := included[id]
					if !ok {
						continue
					}
					list := []obj{}
					for _, r := range mine {
						if r.stepIdx == si {
							list = append(list, renderRow(r, cfg, names, m))
						}
					}
					steps = append(steps, kv{stepKey(def, id, steps), list})
				}
				o = append(o, kv{"steps", steps})
			} else {
				list := make([]obj, 0, len(mine))
				for _, r := range mine {
					list = append(list, renderRow(r, cfg, names, m))
				}
				o = append(o, kv{"results", list})
			}
			if cfg.IncludeErrors {
				o = append(o, kv{"errors", errs})
			}
			imgs = append(imgs, o)
		}
		resp = append(resp, kv{"images", imgs})
	}

	if cfg.IncludeSummary {
		resp = append(resp, kv{"summary", summary(rows, images, calls, len(failedAll(results)), totalCharge)})
	}
	resp = append(resp, kv{"total_charge_usd", billing.FormatMicroUSD(totalCharge)})

	body, err := json.Marshal(resp)
	return Shaped{ContentType: "application/json", Body: body}, err
}

func failedAll(results []StepResult) []StepResult {
	var f []StepResult
	for _, r := range results {
		if r.ErrCode != "" {
			f = append(f, r)
		}
	}
	return f
}

// stepKey names a step in by_step output, falling back to the id if two names collide.
func stepKey(def *WorkflowDefinition, id string, existing obj) string {
	name := def.Node(id).StepName()
	for _, p := range existing {
		if p.K == name {
			return id
		}
	}
	return name
}

func lowerSet(list []string) map[string]bool {
	m := map[string]bool{}
	for _, l := range list {
		m[strings.ToLower(strings.TrimSpace(l))] = true
	}
	return m
}

// applyTopK keeps the k most confident predictions per image and step (and per crop).
func applyTopK(rows []row, k *int) []row {
	if k == nil {
		return rows
	}
	type key struct {
		image, step int
		path        string
	}
	groups := map[key][]row{}
	var keys []key
	for _, r := range rows {
		g := key{r.image, r.stepIdx, r.res.Path}
		if _, ok := groups[g]; !ok {
			keys = append(keys, g)
		}
		groups[g] = append(groups[g], r)
	}
	var out []row
	for _, g := range keys {
		list := groups[g]
		sort.SliceStable(list, func(a, b int) bool { return list[a].conf > list[b].conf })
		if len(list) > *k {
			list = list[:*k]
		}
		out = append(out, list...)
	}
	return out
}

func sortRows(rows []row, mode string) {
	sort.SliceStable(rows, func(a, b int) bool {
		ra, rb := rows[a], rows[b]
		if ra.image != rb.image {
			return ra.image < rb.image
		}
		switch mode {
		case "label_asc":
			if la, lb := strings.ToLower(ra.label), strings.ToLower(rb.label); la != lb {
				return la < lb
			}
		case "step":
			if ra.stepIdx != rb.stepIdx {
				return ra.stepIdx < rb.stepIdx
			}
			if ra.res.Path != rb.res.Path {
				return ra.res.Path < rb.res.Path
			}
		}
		return ra.conf > rb.conf
	})
}

// fieldNames maps each selected field to its output name (after renames).
func fieldNames(cfg *OutputConfig) map[string]string {
	names := map[string]string{}
	for _, f := range cfg.Fields {
		names[f] = f
		if alias, ok := cfg.Rename[f]; ok && alias != "" {
			names[f] = alias
		}
	}
	return names
}

func selectedInOrder(cfg *OutputConfig) []string {
	chosen := setOf(cfg.Fields...)
	var list []string
	for _, f := range OutputFieldOrder {
		if chosen[f] {
			list = append(list, f)
		}
	}
	return list
}

func round(f float64, decimals int) float64 {
	p := math.Pow(10, float64(decimals))
	return math.Round(f*p) / p
}

func formatConfidence(c float64, cfg *OutputConfig) float64 {
	if cfg.ConfidenceFormat == "percent" {
		return round(c*100, cfg.Decimals)
	}
	return round(c, cfg.Decimals)
}

// formatBBox converts an original-image [x, y, w, h] into the chosen format.
func formatBBox(b [4]int, format string, m ImageMeta) []float64 {
	x, y, w, h := float64(b[0]), float64(b[1]), float64(b[2]), float64(b[3])
	switch format {
	case "xyxy":
		return []float64{x, y, x + w, y + h}
	case "normalized_xywh":
		if m.Width <= 0 || m.Height <= 0 {
			return []float64{0, 0, 0, 0}
		}
		W, H := float64(m.Width), float64(m.Height)
		return []float64{round(x/W, 6), round(y/H, 6), round(w/W, 6), round(h/H, 6)}
	case "center_xywh":
		return []float64{x + w/2, y + h/2, w, h}
	default:
		return []float64{x, y, w, h}
	}
}

func bboxColumns(format string) [4]string {
	switch format {
	case "xyxy":
		return [4]string{"x1", "y1", "x2", "y2"}
	case "center_xywh":
		return [4]string{"cx", "cy", "w", "h"}
	default:
		return [4]string{"x", "y", "w", "h"}
	}
}

func renderRow(r row, cfg *OutputConfig, names map[string]string, m ImageMeta) obj {
	o := obj{}
	for _, f := range selectedInOrder(cfg) {
		var v any
		switch f {
		case "label":
			v = r.label
		case "confidence":
			v = formatConfidence(r.conf, cfg)
		case "bbox":
			if r.bbox != nil {
				v = formatBBox(*r.bbox, cfg.BBoxFormat, m)
			}
		case "step":
			v = r.res.Step
		case "model":
			v = r.res.Model
		case "model_version":
			v = r.res.ModelVersion
		case "parent":
			if p := r.res.Parent; p != nil {
				v = obj{
					{"step", p.Step},
					{"label", p.Label},
					{"confidence", formatConfidence(p.Confidence, cfg)},
					{"bbox", formatBBox(p.BBox, cfg.BBoxFormat, m)},
				}
			}
		case "latency_ms":
			v = r.res.LatencyMs
		case "request_id":
			v = r.res.RequestID
		case "charge_usd":
			v = billing.FormatMicroUSD(r.res.ChargeMicro)
		}
		o = append(o, kv{names[f], v})
	}
	return o
}

func renderCSV(rows []row, cfg *OutputConfig, names map[string]string, meta map[int]ImageMeta) ([]byte, error) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	fields := selectedInOrder(cfg)
	header := []string{"image_index"}
	for _, f := range fields {
		switch f {
		case "bbox":
			for _, c := range bboxColumns(cfg.BBoxFormat) {
				header = append(header, names[f]+"_"+c)
			}
		case "parent":
			header = append(header, names[f]+"_label", names[f]+"_confidence")
		default:
			header = append(header, names[f])
		}
	}
	if err := w.Write(header); err != nil {
		return nil, err
	}
	num := func(f float64) string { return strconv.FormatFloat(f, 'f', -1, 64) }
	for _, r := range rows {
		rec := []string{strconv.Itoa(r.image)}
		for _, f := range fields {
			switch f {
			case "label":
				rec = append(rec, csvSafe(r.label))
			case "confidence":
				rec = append(rec, num(formatConfidence(r.conf, cfg)))
			case "bbox":
				if r.bbox == nil {
					rec = append(rec, "", "", "", "")
				} else {
					for _, n := range formatBBox(*r.bbox, cfg.BBoxFormat, meta[r.image]) {
						rec = append(rec, num(n))
					}
				}
			case "step":
				rec = append(rec, csvSafe(r.res.Step))
			case "model":
				rec = append(rec, r.res.Model)
			case "model_version":
				rec = append(rec, csvSafe(r.res.ModelVersion))
			case "parent":
				if p := r.res.Parent; p != nil {
					rec = append(rec, csvSafe(p.Label), num(formatConfidence(p.Confidence, cfg)))
				} else {
					rec = append(rec, "", "")
				}
			case "latency_ms":
				rec = append(rec, strconv.FormatInt(r.res.LatencyMs, 10))
			case "request_id":
				rec = append(rec, r.res.RequestID)
			case "charge_usd":
				rec = append(rec, billing.FormatMicroUSD(r.res.ChargeMicro))
			}
		}
		if err := w.Write(rec); err != nil {
			return nil, err
		}
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

// csvSafe stops spreadsheet apps from treating a value as a formula.
func csvSafe(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

func summary(rows []row, images []ImageMeta, calls, failed int, totalCharge int64) obj {
	counts := map[string]int{}
	for _, r := range rows {
		counts[r.label]++
	}
	labels := make([]string, 0, len(counts))
	for l := range counts {
		labels = append(labels, l)
	}
	sort.Slice(labels, func(a, b int) bool {
		if counts[labels[a]] != counts[labels[b]] {
			return counts[labels[a]] > counts[labels[b]]
		}
		return labels[a] < labels[b]
	})
	lc := obj{}
	for _, l := range labels {
		lc = append(lc, kv{l, counts[l]})
	}
	return obj{
		{"images", len(images)},
		{"predictions", len(rows)},
		{"model_calls", calls},
		{"failed_calls", failed},
		{"label_counts", lc},
		{"total_charge_usd", billing.FormatMicroUSD(totalCharge)},
	}
}
