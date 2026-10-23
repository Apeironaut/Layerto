/** The six planned model sizes as growing layers (sizes only, no scores). */
const SIZES = ['n', 's', 'm', 'l', 'x', 'xl'];
const COLOURS = ['bg-ink', 'bg-crimson', 'bg-[#6E0E1C]'];

export function LTVisionVisual() {
  return (
    <figure className="w-full">
      <div className="flex items-end justify-center gap-2 sm:gap-3 h-60" aria-hidden="true">
        {SIZES.map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-2 flex-1 max-w-16">
            <div className={`w-full rounded-control ${COLOURS[i % 3]}`} style={{ height: `${28 + i * 32}px` }} />
            <span className="font-mono text-xs text-muted">{s}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-4 text-center text-xs text-muted">Six sizes: pick speed or accuracy for each detector.</figcaption>
    </figure>
  );
}
