import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { Prediction } from '@layerto/types';
import { cn } from '../lib/cn';

export type { Prediction };

export interface BoundingBoxCanvasProps {
  imageSrc: string;
  predictions?: Prediction[];
  highlightedIndex?: number | null;
  onHoverBox?: (index: number | null) => void;
  confidenceThreshold?: number;
  className?: string;
  maxDisplayWidth?: number;
  imageAlt?: string;
}

export function BoundingBoxCanvas({
  imageSrc,
  predictions = [],
  highlightedIndex = null,
  onHoverBox,
  confidenceThreshold = 0,
  className,
  maxDisplayWidth = 800,
  imageAlt = 'Image being analysed',
}: BoundingBoxCanvasProps) {
  // Boxes are drawn in the image's natural pixel space; the SVG scales with the image,
  // so boxes stay aligned at any display size (responsive cards, zoom, mobile).
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const handleImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
  };

  const nw = naturalSize?.width ?? 800;
  const nh = naturalSize?.height ?? 600;
  const fontSize = Math.max(11, Math.round(nw / 55)); // label size relative to the image
  const chipH = Math.round(fontSize * 1.6);

  // Filter by confidence
  const visibleBoxes = predictions
    .map((p, idx) => ({ ...p, originalIndex: idx }))
    .filter((p) => p.confidence >= confidenceThreshold && p.bbox && p.bbox.length === 4);

  return (
    <div
      className={cn(
        'relative inline-block w-full rounded-l2 overflow-hidden border border-line bg-card shadow-l1 cursor-crosshair select-none',
        className
      )}
      style={{ maxWidth: `min(100%, ${maxDisplayWidth}px)` }}
    >
      <img
        src={imageSrc}
        alt={imageAlt}
        onLoad={handleImageLoad}
        className="block w-full h-auto"
      />

      {/* SVG overlay in natural image coordinates. Draw-in keyframes live in theme.css
          (no inline <style>, so the CSP style-src 'self' holds). */}
      {naturalSize && (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${nw} ${nh}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {visibleBoxes.map((pred, i) => {
          const [x, y, w, h] = pred.bbox!;

          const isHighlighted = highlightedIndex === pred.originalIndex;
          const isDimmed = highlightedIndex !== null && !isHighlighted;

          return (
            <g
              key={pred.originalIndex}
              className="pointer-events-auto cursor-pointer transition-opacity duration-140"
              style={{ opacity: isDimmed ? 0.3 : 1 }}
              onMouseEnter={() => onHoverBox && onHoverBox(pred.originalIndex)}
              onMouseLeave={() => onHoverBox && onHoverBox(null)}
            >
              {/* Box Outline */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={isHighlighted ? 'rgba(226, 58, 82, 0.15)' : 'rgba(163, 18, 42, 0.05)'}
                stroke={isHighlighted ? 'var(--color-crimson)' : 'var(--color-crimson)'}
                strokeWidth={isHighlighted ? 3 : 2}
                vectorEffect="non-scaling-stroke"
                pathLength={1000}
                rx={6}
                className="svg-box-animated"
                style={{ animationDelay: `${i * 80}ms` }}
              />

              {/* Label Chip */}
              <g transform={`translate(${x}, ${Math.max(chipH, y - 4)})`}>
                <rect
                  x={0}
                  y={-chipH}
                  width={(pred.label.length + 6) * fontSize * 0.62}
                  height={chipH}
                  rx={4}
                  fill="var(--color-crimson)"
                />
                <text
                  x={fontSize * 0.5}
                  y={-chipH * 0.3}
                  fill="#FFFFFF"
                  fontSize={fontSize}
                  fontWeight="600"
                  fontFamily="inherit"
                >
                  {pred.label} ({Math.round(pred.confidence * 100)}%)
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      )}
    </div>
  );
}
