package workflows

import (
	"bytes"
	"image"
	"image/draw"
	"image/jpeg"
	_ "image/png" // decoders for crops
	"sort"

	_ "golang.org/x/image/webp"
)

const minCropSide = 4

// cropDetections makes one Item per matching detection of the upstream step, best first,
// at most cfg.MaxItems. Boxes are padded, clamped to the item, and re-encoded as JPEG.
func cropDetections(item *Item, upstream *StepResult, cfg *ForEachConfig) []Item {
	preds := matching(upstream.Predictions, cfg.Labels, cfg.MinConfidence)
	sort.SliceStable(preds, func(a, b int) bool { return preds[a].Confidence > preds[b].Confidence })

	var src image.Image
	var crops []Item
	for _, p := range preds {
		if len(crops) >= cfg.MaxItems {
			break
		}
		if p.BBox == nil {
			continue
		}
		b := *p.BBox
		// Back to item coordinates.
		x, y, w, h := b[0]-item.OffsetX, b[1]-item.OffsetY, b[2], b[3]
		padW, padH := w*cfg.PaddingPct/100, h*cfg.PaddingPct/100
		rect := image.Rect(x-padW, y-padH, x+w+padW, y+h+padH).Intersect(image.Rect(0, 0, item.Width, item.Height))
		if rect.Dx() < minCropSide || rect.Dy() < minCropSide {
			continue
		}
		if src == nil {
			img, _, err := image.Decode(bytes.NewReader(item.Data))
			if err != nil {
				return crops
			}
			src = img
		}
		dst := image.NewRGBA(image.Rect(0, 0, rect.Dx(), rect.Dy()))
		draw.Draw(dst, dst.Bounds(), src, src.Bounds().Min.Add(rect.Min), draw.Src)
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 90}); err != nil {
			continue
		}
		crops = append(crops, Item{
			ImageIndex: item.ImageIndex,
			Data:       buf.Bytes(),
			Width:      rect.Dx(),
			Height:     rect.Dy(),
			OffsetX:    item.OffsetX + rect.Min.X,
			OffsetY:    item.OffsetY + rect.Min.Y,
			Parent: &ParentRef{
				Step:       upstream.Step,
				Label:      p.Label,
				Confidence: p.Confidence,
				BBox:       b,
			},
			Path: itemPath(item.Path, upstream.NodeID, len(crops)),
		})
	}
	return crops
}
