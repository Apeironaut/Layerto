import { useEffect, useMemo, useState } from 'react';
import type { OutputConfig, WorkflowRunResult } from '@layerto/types';
import { BoundingBoxCanvas, Button, Chip, CopyButton, EmptyState, SegmentedControl, usd } from '@layerto/ui';
import { boxesForImages } from '../../lib/runView';

export interface RunResultsProps {
  result: WorkflowRunResult;
  files: File[];
  sizes: { width: number; height: number }[];
  output: OutputConfig;
}

type View = 'visual' | 'raw';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A run's output: boxes drawn on each image, plus the exact response. */
export function RunResults({ result, files, sizes, output }: RunResultsProps) {
  const [view, setView] = useState<View>(result.format === 'json' && output.fields.includes('bbox') ? 'visual' : 'raw');
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const pretty = result.format === 'json' ? JSON.stringify(result.data, null, 2) : result.raw;
  const boxes = useMemo(() => (result.format === 'json' ? boxesForImages(result.data, output, sizes) : new Map()), [result, output, sizes]);
  const data = result.format === 'json' ? result.data : null;
  const errors = data ? [...(data.errors ?? []), ...(data.images ?? []).flatMap((i) => (i.errors ?? []).map((e) => ({ ...e, image_index: i.index })))] : [];

  return (
    <div className="space-y-4">
      {data && (
        <div className="flex flex-wrap gap-1.5">
          {data.summary && (
            <>
              <Chip variant="neutral">{data.summary.images} images</Chip>
              <Chip variant="neutral">{data.summary.predictions} results</Chip>
              <Chip variant="neutral">{data.summary.model_calls} model calls</Chip>
              {data.summary.failed_calls > 0 && <Chip variant="danger">{data.summary.failed_calls} failed (not charged)</Chip>}
            </>
          )}
          <Chip variant="brand">Charged {usd(data.total_charge_usd)}</Chip>
        </div>
      )}
      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((e, i) => (
            <li key={i} className="rounded-control bg-crimson-tint px-3 py-2 text-xs text-crimson">
              Image {e.image_index ?? '?'} · {e.step}: {e.message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {result.format === 'json' ? (
          <SegmentedControl
            label="View"
            segments={[
              { value: 'visual', label: 'On the images' },
              { value: 'raw', label: 'JSON' },
            ]}
            value={view}
            onChange={setView}
          />
        ) : (
          <span className="text-sm font-semibold">CSV</span>
        )}
        <div className="flex gap-2">
          <CopyButton text={pretty} label="Copy" />
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={() => (result.format === 'json' ? download('workflow-results.json', pretty, 'application/json') : download('workflow-results.csv', result.raw, 'text/csv'))}
          >
            Download
          </Button>
        </div>
      </div>

      {view === 'visual' && result.format === 'json' ? (
        output.fields.includes('bbox') ? (
          <div className="space-y-4">
            {files.map((f, i) => (
              <figure key={urls[i]} className="space-y-1.5">
                <BoundingBoxCanvas imageSrc={urls[i]} imageAlt={f.name} predictions={boxes.get(i) ?? []} maxDisplayWidth={560} />
                <figcaption className="text-xs text-muted">
                  Image {i} · {boxes.get(i)?.length ?? 0} results
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <EmptyState icon="image" title="No boxes to draw" description="Add the Box field to the Output step to see results on the images." />
        )
      ) : (
        <pre className="max-h-[50svh] overflow-auto rounded-l2 bg-[#15161A] text-[#ECEDEF] p-3 font-mono text-xs whitespace-pre" tabIndex={0}>
          {pretty}
        </pre>
      )}
    </div>
  );
}
