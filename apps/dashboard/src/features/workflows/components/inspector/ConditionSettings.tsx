import type { ConditionRule, WorkflowConditionConfig } from '@layerto/types';
import { ConfidenceSlider, NumberStepper, OptionCards, TagInput } from './controls';

const RULES: { value: ConditionRule; label: string; hint: string }[] = [
  { value: 'has_label', label: 'Something was found', hint: 'Yes when at least one matching prediction exists.' },
  { value: 'count_at_least', label: 'Found at least N', hint: 'Yes when the number of matching predictions reaches a count.' },
  { value: 'no_predictions', label: 'Nothing was found', hint: 'Yes when there are no matching predictions.' },
];

export function ConditionSettings({ config, onChange }: { config: WorkflowConditionConfig; onChange: (p: Partial<WorkflowConditionConfig>) => void }) {
  const what = config.labels.length ? config.labels.map((l) => `“${l}”`).join(' or ') : 'any label';
  const sentence =
    config.rule === 'has_label'
      ? `Yes if the previous step found ${what}`
      : config.rule === 'count_at_least'
        ? `Yes if the previous step found ${config.count} or more of ${what}`
        : `Yes if the previous step found no ${what}`;
  return (
    <div className="space-y-4">
      <OptionCards label="Continue on Yes when" options={RULES} value={config.rule} onChange={(rule) => onChange(rule === 'count_at_least' ? { rule, count: Math.max(config.count, 2) } : { rule })} />
      <TagInput label="Labels to look for" hint="Leave empty to count every label. Matching ignores upper/lower case." values={config.labels} onChange={(labels) => onChange({ labels })} placeholder="e.g. turtle, Enter" />
      {config.rule === 'count_at_least' && <NumberStepper label="At least" value={Math.max(config.count, 1)} min={1} max={1000} onChange={(count) => onChange({ count })} suffix="predictions" />}
      <ConfidenceSlider label="Only count predictions above" value={config.min_confidence} onChange={(min_confidence) => onChange({ min_confidence })} />
      <div className="rounded-l2 bg-page border border-line px-3 py-2.5 text-sm">
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{sentence}</span>
        <span className="text-muted">, otherwise No.</span>
      </div>
    </div>
  );
}
