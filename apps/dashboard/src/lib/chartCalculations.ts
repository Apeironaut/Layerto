export interface PieInputItem {
  label: string;
  value: number;
  color?: string;
}

export interface PieSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
  startAngle: number;
  endAngle: number;
  path: string;
}

/** Curated harmonious colors for slices that look striking in both dark and light modes. */
export const CHART_PALETTE: string[] = [
  '#A3122A', // crimson primary
  '#E05263', // rose
  '#2563EB', // cobalt blue
  '#0D9488', // teal
  '#D97706', // amber
  '#7C3AED', // purple
  '#059669', // emerald
  '#EC4899', // pink
  '#4B5563', // slate gray
];

/**
 * Returns human-readable label and description for API endpoints.
 */
export function formatEndpointName(raw: string): { name: string; path: string } {
  switch (raw) {
    case 'vision_auto':
      return { name: 'Auto-Routing Vision API', path: '/v1/vision/auto' };
    case 'vision_model':
      return { name: 'Direct Model Vision API', path: '/v1/vision/{model}' };
    case 'workflow_run':
      return { name: 'Workflow Execution API', path: '/v1/workflows/{id}/run' };
    case 'workflow_test':
      return { name: 'Workflow Canvas Test Run', path: 'Dashboard' };
    case 'playground':
      return { name: 'Vision Playground', path: 'Dashboard' };
    case 'site_run':
      return { name: 'Hosted Model Site Run', path: '/v1/sites/{slug}/run' };
    default:
      return { name: raw || 'API Request', path: '/v1/…' };
  }
}

/**
 * Computes SVG donut path for an arc between startAngle and endAngle (in radians).
 * Angle 0 is at 12 o'clock (top).
 */
export function describeDonutArc(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  // Clamp full circle
  const delta = endAngle - startAngle;
  const isFull = delta >= 2 * Math.PI - 0.0001;

  if (isFull) {
    // Render as two half-circles to avoid SVG arc singularity
    const midAngle = startAngle + Math.PI;
    const p1 = polarToCartesian(cx, cy, outerRadius, startAngle);
    const p2 = polarToCartesian(cx, cy, outerRadius, midAngle);
    const p3 = polarToCartesian(cx, cy, innerRadius, midAngle);
    const p4 = polarToCartesian(cx, cy, innerRadius, startAngle);

    return [
      `M ${p1.x} ${p1.y}`,
      `A ${outerRadius} ${outerRadius} 0 0 1 ${p2.x} ${p2.y}`,
      `A ${outerRadius} ${outerRadius} 0 0 1 ${p1.x} ${p1.y}`,
      `M ${p4.x} ${p4.y}`,
      `A ${innerRadius} ${innerRadius} 0 0 0 ${p3.x} ${p3.y}`,
      `A ${innerRadius} ${innerRadius} 0 0 0 ${p4.x} ${p4.y}`,
      'Z',
    ].join(' ');
  }

  const startOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);

  const largeArcFlag = delta > Math.PI ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInRadians: number): { x: number; y: number } {
  // Angle 0 at top (-y axis), rotating clockwise
  return {
    x: Math.round((cx + radius * Math.sin(angleInRadians)) * 100) / 100,
    y: Math.round((cy - radius * Math.cos(angleInRadians)) * 100) / 100,
  };
}

/**
 * Calculates donut/pie chart slices with paths, angles, and percentages.
 */
export function calculatePieSlices(
  items: PieInputItem[],
  cx = 100,
  cy = 100,
  outerRadius = 80,
  innerRadius = 48,
  palette: string[] = CHART_PALETTE
): PieSlice[] {
  const filtered = items.filter((it) => it.value > 0);
  const total = filtered.reduce((acc, it) => acc + it.value, 0);

  if (total <= 0) return [];

  let currentAngle = 0;
  return filtered.map((it, idx) => {
    const fraction = it.value / total;
    const angleSpan = fraction * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    currentAngle = endAngle;

    const color = it.color || palette[idx % palette.length];
    const path = describeDonutArc(cx, cy, outerRadius, innerRadius, startAngle, endAngle);

    return {
      label: it.label,
      value: it.value,
      percentage: Math.round(fraction * 1000) / 10, // 1 decimal place e.g. 35.4%
      color,
      startAngle,
      endAngle,
      path,
    };
  });
}
