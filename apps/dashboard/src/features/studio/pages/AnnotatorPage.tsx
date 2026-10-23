import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { AnnotationBox, Dataset, DatasetImage } from '@layerto/types';
import { Button, Chip, Icon, Skeleton, cn, useNotify } from '@layerto/ui';
import { api } from '../../../lib/api';
import { AuthImage } from '../components/AuthImage';
import { classColor } from '../lib/format';

type Drag =
  | { kind: 'draw'; x0: number; y0: number }
  | { kind: 'move'; index: number; dx: number; dy: number }
  | { kind: 'resize'; index: number; corner: 'nw' | 'ne' | 'sw' | 'se'; anchorX: number; anchorY: number };

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

async function loadAll(id: string, filter: string): Promise<DatasetImage[]> {
  const out: DatasetImage[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await api.studioImages(id, { offset, limit: 500, filter: filter as 'all' | 'labeled' | 'unlabeled' });
    out.push(...page);
    if (page.length < 500) return out;
  }
}

/** Full-screen box annotation for one dataset. */
export function AnnotatorPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const notify = useNotify();
  const params = new URLSearchParams(window.location.search);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [images, setImages] = useState<DatasetImage[] | null>(null);
  const [index, setIndex] = useState(() => Math.max(0, Number(params.get('i')) || 0));
  const [boxes, setBoxes] = useState<AnnotationBox[]>([]);
  const [labeled, setLabeled] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [cls, setCls] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<AnnotationBox | null>(null);
  const [save, setSave] = useState<SaveState>('saved');
  const svgRef = useRef<SVGSVGElement>(null);
  const filter = params.get('f') ?? 'all';

  // load dataset + image list once
  useEffect(() => {
    let alive = true;
    Promise.all([api.studioDataset(id), loadAll(id, filter)])
      .then(([d, list]) => {
        if (!alive) return;
        setDataset(d);
        setImages(list);
        setIndex((i) => Math.min(i, Math.max(0, list.length - 1)));
      })
      .catch((err) => notify(errorMessage(err, "Couldn't open the dataset."), 'error'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const current = images?.[index];

  // show the current image's boxes
  useEffect(() => {
    if (!current) return;
    setBoxes(current.boxes);
    setLabeled(current.labeled);
    setSelected(null);
    setSave('saved');
    // only when the shown image changes, not when its saved copy is refreshed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const persist = useCallback(
    async (next: AnnotationBox[], nextLabeled: boolean) => {
      if (!current || !images) return;
      setSave('saving');
      try {
        const res = await api.studioSaveBoxes(id, current.id, next, nextLabeled);
        setImages((list) => (list ? list.map((im) => (im.id === current.id ? { ...im, boxes: res.boxes, labeled: res.labeled } : im)) : list));
        setSave('saved');
      } catch (err) {
        setSave('error');
        notify(errorMessage(err, "Couldn't save the boxes."), 'error');
      }
    },
    [current, id, images, notify],
  );

  // debounce saves after edits
  useEffect(() => {
    if (save !== 'dirty') return;
    const t = setTimeout(() => void persist(boxes, labeled), 700);
    return () => clearTimeout(t);
  }, [save, boxes, labeled, persist]);

  const change = (next: AnnotationBox[]) => {
    setBoxes(next);
    if (next.length > 0) setLabeled(true);
    setSave('dirty');
  };

  const go = useCallback(
    async (to: number) => {
      if (!images) return;
      if (save === 'dirty') await persist(boxes, labeled);
      setIndex(Math.max(0, Math.min(images.length - 1, to)));
    },
    [images, save, persist, boxes, labeled],
  );

  const markEmpty = async () => {
    setBoxes([]);
    setLabeled(true);
    await persist([], true);
    void go(index + 1);
  };

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && dataset && n <= dataset.classes.length) {
        setCls(n - 1);
        if (selected !== null) change(boxes.map((b, i) => (i === selected ? { ...b, c: n - 1 } : b)));
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        void go(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        void go(index - 1);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
        e.preventDefault();
        change(boxes.filter((_, i) => i !== selected));
        setSelected(null);
      } else if (e.key === 'Escape') {
        setSelected(null);
        setDrag(null);
        setDraft(null);
      } else if (e.key === 'e') {
        void markEmpty();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // warn before leaving with unsaved boxes
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (save === 'dirty' || save === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [save]);

  const point = (e: ReactPointerEvent) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const W = current!.width;
    const H = current!.height;
    return {
      x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)),
      y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)),
    };
  };

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!current || e.button !== 0) return;
    const p = point(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const target = e.target as Element;
    const handle = target.getAttribute('data-handle') as 'nw' | 'ne' | 'sw' | 'se' | null;
    const boxAttr = target.getAttribute('data-box');
    if (handle && boxAttr !== null) {
      const i = Number(boxAttr);
      const b = boxes[i];
      const anchorX = handle.includes('w') ? b.x + b.w : b.x;
      const anchorY = handle.includes('n') ? b.y + b.h : b.y;
      setSelected(i);
      setDrag({ kind: 'resize', index: i, corner: handle, anchorX, anchorY });
      return;
    }
    if (boxAttr !== null) {
      const i = Number(boxAttr);
      setSelected(i);
      setDrag({ kind: 'move', index: i, dx: p.x - boxes[i].x, dy: p.y - boxes[i].y });
      return;
    }
    setSelected(null);
    setDrag({ kind: 'draw', x0: p.x, y0: p.y });
    setDraft({ c: cls, x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || !current) return;
    const p = point(e);
    if (drag.kind === 'draw') {
      setDraft({ c: cls, x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) });
    } else if (drag.kind === 'move') {
      const b = boxes[drag.index];
      const x = Math.max(0, Math.min(current.width - b.w, p.x - drag.dx));
      const y = Math.max(0, Math.min(current.height - b.h, p.y - drag.dy));
      setBoxes(boxes.map((bb, i) => (i === drag.index ? { ...bb, x, y } : bb)));
    } else {
      const x = Math.min(drag.anchorX, p.x);
      const y = Math.min(drag.anchorY, p.y);
      setBoxes(boxes.map((bb, i) => (i === drag.index ? { ...bb, x, y, w: Math.abs(p.x - drag.anchorX), h: Math.abs(p.y - drag.anchorY) } : bb)));
    }
  };

  const onUp = () => {
    if (!drag) return;
    if (drag.kind === 'draw' && draft) {
      if (draft.w >= 4 && draft.h >= 4) {
        const next = [...boxes, draft];
        change(next);
        setSelected(next.length - 1);
      }
      setDraft(null);
    } else if (drag.kind !== 'draw') {
      change(boxes.filter((b) => b.w >= 2 && b.h >= 2));
    }
    setDrag(null);
  };

  if (!dataset || !images) {
    return (
      <div className="p-6">
        <Skeleton className="h-[70vh]" />
      </div>
    );
  }

  const total = images.length;
  const done = images.filter((im) => im.labeled).length;
  const stroke = current ? Math.max(2, current.width / 400) : 2;
  const handle = current ? Math.max(8, current.width / 90) : 8;

  return (
    <div className="flex flex-col h-screen min-h-0">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-card px-4 py-2.5">
        <Button size="sm" variant="ghost" icon="undo" onClick={async () => {
          if (save === 'dirty') await persist(boxes, labeled);
          navigate(`/datasets/${id}`);
        }}>
          {dataset.name}
        </Button>
        <span className="text-sm text-muted">
          {total ? `${index + 1} / ${total}` : '0 images'} · {done} labeled
        </span>
        <span className="ml-auto text-xs text-muted" aria-live="polite">
          {save === 'saving' ? 'Saving…' : save === 'dirty' ? 'Unsaved' : save === 'error' ? 'Not saved' : 'Saved'}
        </span>
        <Button size="sm" variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>← Prev</Button>
        <Button size="sm" variant="secondary" disabled={!current} onClick={markEmpty} title="No objects in this image (E)">Nothing here</Button>
        <Button size="sm" disabled={index >= total - 1} onClick={() => go(index + 1)}>Next →</Button>
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* classes */}
        <aside className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-card p-3 overflow-auto">
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Class</p>
          <div className="flex lg:flex-col gap-1 flex-wrap">
            {dataset.classes.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCls(i);
                  if (selected !== null) change(boxes.map((b, j) => (j === selected ? { ...b, c: i } : b)));
                }}
                className={cn(
                  'flex items-center gap-2 rounded-control px-2.5 py-1.5 text-sm text-left cursor-pointer',
                  cls === i ? 'bg-crimson-tint text-ink font-medium' : 'text-ink-secondary hover:bg-page',
                )}
              >
                <span className="size-3 rounded-sm shrink-0" style={{ background: classColor(i) }} />
                <span className="flex-1 truncate">{c}</span>
                {i < 9 && <kbd className="text-[10px] text-muted font-mono">{i + 1}</kbd>}
              </button>
            ))}
          </div>
          <div className="mt-4 hidden lg:block space-y-1 px-1 text-[11px] text-muted">
            <p>Drag on the image to draw a box.</p>
            <p>Drag a box to move it, corners to resize.</p>
            <p><kbd>1–9</kbd> class · <kbd>Del</kbd> remove</p>
            <p><kbd>A</kbd>/<kbd>D</kbd> prev/next · <kbd>E</kbd> nothing here</p>
          </div>
        </aside>

        {/* canvas */}
        <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-page p-3 sm:p-6 overflow-auto">
          {!current ? (
            <div className="text-center space-y-3">
              <p className="text-muted">No images to annotate.</p>
              <Button onClick={() => navigate(`/datasets/${id}`)}>Upload images</Button>
            </div>
          ) : (
            <div className="relative inline-block max-w-full select-none touch-none" key={current.id}>
              <AuthImage
                path={api.studioImagePath(id, current.id)}
                alt={current.file_name}
                className="block max-w-full max-h-[calc(100vh-9rem)] w-auto h-auto rounded-control shadow-l1"
              />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${current.width} ${current.height}`}
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full cursor-crosshair"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                role="application"
                aria-label="Annotation canvas"
              >
                {boxes.map((b, i) => {
                  const color = classColor(b.c);
                  const sel = selected === i;
                  return (
                    <g key={i}>
                      <rect
                        data-box={i}
                        x={b.x}
                        y={b.y}
                        width={b.w}
                        height={b.h}
                        fill={color}
                        fillOpacity={sel ? 0.25 : 0.12}
                        stroke={color}
                        strokeWidth={sel ? stroke * 1.6 : stroke}
                        className="cursor-move"
                      />
                      {sel &&
                        (['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                          <rect
                            key={h}
                            data-box={i}
                            data-handle={h}
                            x={(h.includes('w') ? b.x : b.x + b.w) - handle / 2}
                            y={(h.includes('n') ? b.y : b.y + b.h) - handle / 2}
                            width={handle}
                            height={handle}
                            fill="#fff"
                            stroke={color}
                            strokeWidth={stroke}
                            className={h === 'nw' || h === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}
                          />
                        ))}
                    </g>
                  );
                })}
                {draft && (
                  <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} fill="none" stroke={classColor(draft.c)} strokeWidth={stroke} strokeDasharray={`${stroke * 3} ${stroke * 2}`} />
                )}
              </svg>
            </div>
          )}
        </div>

        {/* boxes */}
        <aside className="lg:w-60 shrink-0 border-t lg:border-t-0 lg:border-l border-line bg-card p-3 overflow-auto">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Boxes</p>
            {current && (labeled ? <Chip variant="active">Labeled</Chip> : <Chip variant="muted">To do</Chip>)}
          </div>
          {boxes.length === 0 ? (
            <p className="px-1 text-sm text-muted">No boxes yet.</p>
          ) : (
            <ul className="space-y-1">
              {boxes.map((b, i) => (
                <li key={i}>
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-control px-2 py-1.5 text-sm',
                      selected === i ? 'bg-crimson-tint' : 'hover:bg-page',
                    )}
                  >
                    <button type="button" className="flex flex-1 items-center gap-2 text-left cursor-pointer" onClick={() => setSelected(i)}>
                      <span className="size-3 rounded-sm" style={{ background: classColor(b.c) }} />
                      <span className="flex-1 truncate text-ink">{dataset.classes[b.c] ?? '?'}</span>
                      <span className="text-[11px] text-muted font-mono">{Math.round(b.w)}×{Math.round(b.h)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Remove box"
                      className="text-muted hover:text-crimson cursor-pointer"
                      onClick={() => {
                        change(boxes.filter((_, j) => j !== i));
                        setSelected(null);
                      }}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {current && <p className="mt-4 px-1 text-[11px] text-muted break-all">{current.file_name} · {current.width}×{current.height}</p>}
        </aside>
      </div>
    </div>
  );
}
