import type { BBoxFormat, OutputConfig, WorkflowField, WorkflowSort } from '@layerto/types';
import { SegmentedControl, Select, Switch, cn } from '@layerto/ui';
import { BBOX_FORMATS, FIELD_META, FIELD_ORDER, LAYOUTS, SORTS } from '../../lib/definition';
import type { PreviewStep } from '../../lib/outputPreview';
import { ConfidenceSlider, NumberStepper, OptionCards, Section, TagInput } from './controls';
import { OutputPreview } from './OutputPreview';

const ALIAS = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

export interface OutputSettingsProps {
  config: OutputConfig;
  steps: PreviewStep[];
  onChange: (p: Partial<OutputConfig>) => void;
}

function FieldRow({ field, config, onChange }: { field: WorkflowField; config: OutputConfig; onChange: (p: Partial<OutputConfig>) => void }) {
  const on = config.fields.includes(field);
  const alias = config.rename[field] ?? '';
  const bad = alias !== '' && !ALIAS.test(alias);
  const toggle = () => {
    const fields = on ? config.fields.filter((f) => f !== field) : FIELD_ORDER.filter((f) => f === field || config.fields.includes(f));
    const rename = { ...config.rename };
    if (on) delete rename[field];
    onChange({ fields, rename });
  };
  return (
    <div className={cn('rounded-control border px-3 py-2 transition-colors', on ? 'border-crimson-border bg-crimson-tint/40' : 'border-line')}>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={on} onChange={toggle} className="mt-0.5 h-4 w-4 accent-crimson" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{FIELD_META[field].label}</span>
          <span className="block text-xs text-muted">{FIELD_META[field].description}</span>
        </span>
      </label>
      {on && (
        <div className="mt-2 ml-6.5 flex items-center gap-2">
          <span className="text-xs text-muted shrink-0">Name in output</span>
          <input
            value={alias}
            onChange={(e) => {
              const rename = { ...config.rename };
              if (e.target.value) rename[field] = e.target.value;
              else delete rename[field];
              onChange({ rename });
            }}
            placeholder={field}
            maxLength={32}
            aria-label={`Name for ${FIELD_META[field].label} in the output`}
            aria-invalid={bad}
            className={cn('flex-1 min-w-0 px-2 py-1 rounded-control border bg-card font-mono text-xs outline-none focus:border-crimson', bad ? 'border-crimson' : 'border-line')}
          />
        </div>
      )}
      {bad && <p className="mt-1 ml-6.5 text-xs text-crimson">Start with a letter or _, then letters, numbers or _.</p>}
    </div>
  );
}

/** Everything about what the API returns: fields, names, filters, format and layout. */
export function OutputSettings({ config, steps, onChange }: OutputSettingsProps) {
  const json = config.format === 'json';
  return (
    <div className="-mx-4 -mb-4">
      <Section title="What to return" aside={<span className="text-xs text-muted">{config.fields.length} fields</span>}>
        <div className="space-y-1.5">
          {FIELD_ORDER.map((f) => (
            <FieldRow key={f} field={f} config={config} onChange={onChange} />
          ))}
        </div>
      </Section>

      <Section title="Format">
        <SegmentedControl
          label="File format"
          segments={[
            { value: 'json', label: 'JSON' },
            { value: 'csv', label: 'CSV' },
          ]}
          value={config.format}
          onChange={(format) => onChange({ format })}
        />
        {json && <OptionCards label="Layout" options={LAYOUTS} value={config.layout} onChange={(layout) => onChange({ layout })} />}
        <Select
          label="Box format"
          value={config.bbox_format}
          onChange={(e) => onChange({ bbox_format: e.target.value as BBoxFormat })}
          options={BBOX_FORMATS.map((b) => ({ value: b.value, label: `${b.label} — ${b.hint}` }))}
        />
        <div className="grid grid-cols-2 gap-3 items-end">
          <SegmentedControl
            label="Confidence as"
            segments={[
              { value: 'decimal', label: '0.92' },
              { value: 'percent', label: '92%' },
            ]}
            value={config.confidence_format}
            onChange={(confidence_format) => onChange({ confidence_format })}
          />
          <NumberStepper label="Decimals" value={config.decimals} min={0} max={6} onChange={(decimals) => onChange({ decimals })} />
        </div>
        <Select label="Sort results" value={config.sort} onChange={(e) => onChange({ sort: e.target.value as WorkflowSort })} options={SORTS} />
      </Section>

      <Section title="Filter results" defaultOpen={false}>
        <ConfidenceSlider label="Drop results below" value={config.min_confidence} onChange={(min_confidence) => onChange({ min_confidence })} />
        <TagInput label="Only these labels" hint="Empty = keep every label." values={config.labels_include} onChange={(labels_include) => onChange({ labels_include })} placeholder="e.g. Chelonia mydas" />
        <TagInput label="Never these labels" values={config.labels_exclude} onChange={(labels_exclude) => onChange({ labels_exclude })} placeholder="e.g. background" />
        <Switch
          checked={config.top_k !== null}
          onChange={(on) => onChange({ top_k: on ? 3 : null })}
          label="Keep only the top results"
          description="Per image and step (and per object inside a loop)."
        />
        {config.top_k !== null && <NumberStepper label="Top" value={config.top_k} min={1} max={100} onChange={(top_k) => onChange({ top_k })} suffix="results" />}
      </Section>

      {json && (
        <Section title="Extras" defaultOpen={false}>
          <Switch checked={config.include_summary} onChange={(include_summary) => onChange({ include_summary })} label="Summary" description="Counts per label, calls made and total charge." />
          <Switch checked={config.include_errors} onChange={(include_errors) => onChange({ include_errors })} label="Errors" description="Which steps failed on which image (failed calls are never charged)." />
          {config.layout !== 'flat' && (
            <>
              <Switch checked={config.include_image_info} onChange={(include_image_info) => onChange({ include_image_info })} label="Image size" description="Width and height of each image." />
              <Switch checked={config.include_empty} onChange={(include_empty) => onChange({ include_empty })} label="Images with no results" description="Keep images that ended up with nothing." />
            </>
          )}
        </Section>
      )}

      <Section title="Preview">
        <OutputPreview config={config} steps={steps} />
      </Section>
    </div>
  );
}
