export interface ScaledBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * calculateScaledBox calculates rendered coordinates for a bounding box [x, y, w, h]
 * scaled from natural image dimensions to rendered canvas/container dimensions.
 * Bounding box format is [x, y, w, h] per SPEC §8/§10.
 */
export function calculateScaledBox(
  bbox: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
  renderWidth: number,
  renderHeight: number
): ScaledBoundingBox {
  const [x, y, w, h] = bbox;

  if (imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scaleX = renderWidth / imageWidth;
  const scaleY = renderHeight / imageHeight;

  const scaledX = Math.max(0, Math.min(renderWidth, x * scaleX));
  const scaledY = Math.max(0, Math.min(renderHeight, y * scaleY));
  const scaledW = Math.max(0, Math.min(renderWidth - scaledX, w * scaleX));
  const scaledH = Math.max(0, Math.min(renderHeight - scaledY, h * scaleY));

  return {
    x: Math.round(scaledX * 100) / 100,
    y: Math.round(scaledY * 100) / 100,
    width: Math.round(scaledW * 100) / 100,
    height: Math.round(scaledH * 100) / 100,
  };
}

/**
 * drawBoundingBox draws an [x, y, w, h] bounding box and label badge on a 2D canvas context.
 */
export function drawBoundingBox(
  ctx: CanvasRenderingContext2D,
  box: ScaledBoundingBox,
  label: string,
  confidence: number,
  color = '#dc2626'
) {
  ctx.save();

  // Box stroke
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  // Box semi-transparent fill
  ctx.fillStyle = `${color}22`; // 13% opacity
  ctx.fillRect(box.x, box.y, box.width, box.height);

  // Label text formatting
  const confText = `${Math.round(confidence * 100)}%`;
  const text = `${label} (${confText})`;

  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  const textMetrics = ctx.measureText(text);
  const paddingX = 8;
  const badgeHeight = 22;
  const badgeWidth = textMetrics.width + paddingX * 2;

  // Position badge above box, or inside box if too close to top
  let badgeY = box.y - badgeHeight;
  if (badgeY < 0) {
    badgeY = box.y;
  }

  // Draw badge background
  ctx.fillStyle = color;
  ctx.fillRect(box.x, badgeY, badgeWidth, badgeHeight);

  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, box.x + paddingX, badgeY + 15);

  ctx.restore();
}
