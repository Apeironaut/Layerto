import { Card } from '@layerto/ui';

const EXAMPLE = `{
  "request_id": "uuid",            // use this when contacting support
  "model": "turtle-id",            // the model that ran
  "routed": "direct",              // "direct" or "auto"
  "predictions": [
    {
      "label": "Chelonia mydas",   // class or species
      "confidence": 0.98,          // 0.0 to 1.0
      "bbox": [100, 80, 250, 180], // [x, y, w, h] in image pixels, or null
      "extra": {}                  // model-specific details
    }
  ],
  "model_version": "2026.10.1",
  "latency_ms": 812,
  "charge_usd": "0.002000"         // exact, 6 decimals
}`;

/** The 200 response shape, with the bounding-box format explained. */
export function ResponseSchema() {
  return (
    <Card title="The response" subtitle="Every successful call returns the same shape.">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6">
        <pre className="p-4 rounded-control bg-page border border-line font-mono text-xs text-ink overflow-x-auto" tabIndex={0} aria-label="Example response">
          {EXAMPLE}
        </pre>
        <div className="text-sm text-ink-secondary space-y-3">
          <h3 className="font-semibold text-ink">Box format</h3>
          <p>
            <code>bbox</code> is <code>[x, y, w, h]</code>: the top-left corner, then width and height, in the
            original image's pixels.
          </p>
          <p>Classification models return <code>bbox: null</code>.</p>
        </div>
      </div>
    </Card>
  );
}
