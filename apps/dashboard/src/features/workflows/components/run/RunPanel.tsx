import { useEffect, useState } from 'react';
import type { OutputConfig, PublicModelItem, WorkflowDefinition } from '@layerto/types';
import { Alert, Button, Drawer, useNotify } from '@layerto/ui';
import { costPerImage, formatMicro } from '../../lib/cost';
import { useWorkflowRun } from '../../hooks/useWorkflowRun';
import { RunUploader } from './RunUploader';
import { RunResults } from './RunResults';

export interface RunPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  definition: WorkflowDefinition;
  models: PublicModelItem[];
  onRunningChange: (running: boolean) => void;
  onCharged: () => void;
}

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: 1, height: 1 };
  }
}

/** Test a saved workflow on real images from the dashboard (billed like any call). */
export function RunPanel({ isOpen, onClose, workflowId, definition, models, onRunningChange, onCharged }: RunPanelProps) {
  const notify = useNotify();
  const [files, setFiles] = useState<File[]>([]);
  const [sizes, setSizes] = useState<{ width: number; height: number }[]>([]);
  const run = useWorkflowRun(workflowId);
  const input = definition.nodes.find((n) => n.type === 'input');
  const max = input?.type === 'input' ? input.config.max_images : 1;
  const output = definition.nodes.find((n) => n.type === 'output')?.config as OutputConfig;
  const cost = costPerImage(definition, models);
  const n = Math.max(files.length, 1);

  useEffect(() => onRunningChange(run.running), [run.running, onRunningChange]);

  const start = async () => {
    const measured = await Promise.all(files.map(imageSize));
    setSizes(measured);
    const res = await run.run(files);
    if (res) onCharged();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Test run"
      description="Runs the saved workflow on your images. Calls are billed like API calls; failed calls are free."
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">
            Estimated {cost.min === cost.max ? formatMicro(cost.max * n) : `${formatMicro(cost.min * n)}–${formatMicro(cost.max * n)}`}
          </span>
          <div className="flex gap-2">
            {run.result && (
              <Button
                variant="ghost"
                onClick={() => {
                  run.reset();
                  setFiles([]);
                }}
              >
                Start over
              </Button>
            )}
            <Button icon="play" loading={run.running} disabled={files.length === 0} onClick={() => void start()}>
              Run on {files.length || ''} image{files.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {run.error && <Alert tone="error">{run.error}</Alert>}
        <RunUploader files={files} max={max} onChange={(next) => { if (run.result) run.reset(); setFiles(next); }} onProblem={(m) => notify(m, 'error')} disabled={run.running} />
        {run.result && <RunResults result={run.result} files={files} sizes={sizes} output={output} />}
      </div>
    </Drawer>
  );
}
