import { useMemo } from 'react';
import type { OutputConfig } from '@layerto/types';
import { CopyButton } from '@layerto/ui';
import { buildPreview } from '../../lib/outputPreview';
import type { PreviewStep } from '../../lib/outputPreview';

/** Shows what the response will look like, filled with example values. */
export function OutputPreview({ config, steps }: { config: OutputConfig; steps: PreviewStep[] }) {
  const text = useMemo(() => buildPreview(config, steps), [config, steps]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Example values; the shape matches real responses.</p>
        <CopyButton text={text} label="Copy" />
      </div>
      <pre className="max-h-80 overflow-auto rounded-l2 bg-[#15161A] text-[#ECEDEF] p-3 font-mono text-[11px] leading-relaxed whitespace-pre" tabIndex={0} aria-label="Example output">
        {text}
      </pre>
    </div>
  );
}
