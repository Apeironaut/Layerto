import type { WorkflowForEachConfig } from '@layerto/types';
import { ConfidenceSlider, FieldLabel, NumberStepper, TagInput } from './controls';

export function ForEachSettings({ config, onChange }: { config: WorkflowForEachConfig; onChange: (p: Partial<WorkflowForEachConfig>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        For every object the previous step found, Layerto crops it out of the image and runs the next step on the crop. Results keep their position in the
        original image and include the object they came from.
      </p>
      <TagInput label="Only these labels" hint="Leave empty to loop over every detected object." values={config.labels} onChange={(labels) => onChange({ labels })} placeholder="e.g. turtle" />
      <ConfidenceSlider label="Skip objects below" value={config.min_confidence} onChange={(min_confidence) => onChange({ min_confidence })} />
      <NumberStepper label="Most objects per image" hint="The most confident ones are used first. Each one is a billed call per next step." value={config.max_items} min={1} max={10} onChange={(max_items) => onChange({ max_items })} />
      <div>
        <div className="flex items-baseline justify-between">
          <FieldLabel hint="Extra margin around each box, so the next model sees some context.">Padding</FieldLabel>
          <span className="font-mono text-sm font-semibold">{config.padding_pct}%</span>
        </div>
        <input type="range" min={0} max={50} step={5} value={config.padding_pct} onChange={(e) => onChange({ padding_pct: Number(e.target.value) })} className="w-full accent-crimson" aria-label="Padding" />
      </div>
    </div>
  );
}
