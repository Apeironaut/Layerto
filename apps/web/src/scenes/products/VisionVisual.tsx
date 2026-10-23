import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { BoundingBoxCanvas } from '@layerto/ui';
import type { Prediction } from '@layerto/ui';

// Example only: shows the response format, not a real model result.
const EXAMPLE: Prediction[] = [{ label: 'Chelonia mydas', confidence: 0.98, bbox: [100, 80, 250, 180] }];

const RESPONSE = `{
  "model": "turtle-id",
  "predictions": [{
    "label": "Chelonia mydas",
    "confidence": 0.98,
    "bbox": [100, 80, 250, 180]
  }]
}`;

/** An image with its box drawn in, next to the JSON that produced it. */
export function VisionVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  return (
    <div ref={ref} className="w-full space-y-3">
      <div className="aspect-[4/3] w-full rounded-l2 overflow-hidden bg-page border border-line">
        {inView && (
          <BoundingBoxCanvas
            imageSrc="/sample-image.png"
            predictions={EXAMPLE}
            maxDisplayWidth={800}
            className="w-full h-full border-0 shadow-none rounded-none"
          />
        )}
      </div>
      <pre className="p-4 rounded-l2 bg-[#15161A] text-[#ECEDEF] font-mono text-xs overflow-x-auto" aria-label="Example JSON response">
        {RESPONSE}
      </pre>
      <p className="text-xs text-muted">Illustrative example of the response format.</p>
    </div>
  );
}
