import type { WorkflowInputConfig } from '@layerto/types';
import { SegmentedControl } from '@layerto/ui';
import { LIMITS } from '../../lib/definition';
import { NumberStepper } from './controls';

export function InputSettings({ config, onChange }: { config: WorkflowInputConfig; onChange: (p: Partial<WorkflowInputConfig>) => void }) {
  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Images per run"
        segments={[
          { value: 'single', label: 'One image' },
          { value: 'batch', label: 'Batch' },
        ]}
        value={config.mode}
        onChange={(mode) => onChange(mode === 'single' ? { mode, max_images: 1 } : { mode, max_images: Math.max(config.max_images, 2) })}
      />
      {config.mode === 'batch' && (
        <NumberStepper
          label="Most images per run"
          hint={`Send up to this many images in one request (max ${LIMITS.maxImages}, 60 MB in total).`}
          value={config.max_images}
          min={2}
          max={LIMITS.maxImages}
          onChange={(max_images) => onChange({ max_images })}
        />
      )}
      <p className="text-xs text-muted">Each image is checked (JPG, PNG or WebP, up to 10 MB) and processed in memory only. Images are never stored.</p>
    </div>
  );
}
