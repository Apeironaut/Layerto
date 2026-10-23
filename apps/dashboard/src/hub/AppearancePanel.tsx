import { useState } from 'react';
import { ACCENTS, applyAccent, applyDensity, applyThemeMode, readAccent, readDensity, readThemeMode, cn } from '@layerto/ui';
import type { Accent, Density, ThemeMode } from '@layerto/ui';
import { api } from '../lib/api';

const SWATCH: Record<Accent, string> = {
  crimson: '#A3122A',
  ocean: '#0E6BA8',
  forest: '#1F7A4C',
  violet: '#6D3FC9',
  amber: '#B45309',
  graphite: '#2F3542',
};

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string; desc?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold mb-2">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
            className={cn(
              'rounded-control border p-3 text-left cursor-pointer transition-colors',
              value === o.v ? 'border-crimson bg-crimson-tint' : 'border-line hover:border-line-strong',
            )}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            {o.desc && <span className="block text-xs text-muted mt-0.5">{o.desc}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Theme, accent colour and density. Saved on this device and to the account. */
export function AppearancePanel() {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);
  const [accent, setAccent] = useState<Accent>(readAccent);
  const [density, setDensity] = useState<Density>(readDensity);
  const persist = (ui: Record<string, unknown>) => void api.saveMySettings({ ui }).catch(() => undefined);
  return (
    <div className="space-y-6">
      <Choice
        label="Theme"
        value={mode}
        onChange={(v) => {
          applyThemeMode(v);
          setMode(v);
        }}
        options={[
          { v: 'light', label: 'Light' },
          { v: 'dark', label: 'Dark' },
          { v: 'system', label: 'System', desc: 'Follow your device' },
        ]}
      />
      <fieldset>
        <legend className="text-sm font-semibold mb-2">Accent colour</legend>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                applyAccent(a);
                setAccent(a);
                persist({ accent: a, density });
              }}
              aria-pressed={accent === a}
              aria-label={a}
              title={a}
              className={cn('flex flex-col items-center gap-1.5 cursor-pointer rounded-control p-2', accent === a && 'bg-page')}
            >
              <span
                className={cn('size-10 rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110', accent === a && 'ring-2 ring-ink')}
                style={{ background: SWATCH[a] }}
              />
              <span className="text-xs capitalize text-muted">{a}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Choice
        label="Density"
        value={density}
        onChange={(v) => {
          applyDensity(v);
          setDensity(v);
          persist({ accent, density: v });
        }}
        options={[
          { v: 'comfortable', label: 'Comfortable', desc: 'Default spacing' },
          { v: 'compact', label: 'Compact', desc: 'More on screen' },
        ]}
      />
      <p className="text-xs text-muted">Tip: press <kbd className="font-mono">[</kbd> to collapse the sidebar and <kbd className="font-mono">Ctrl K</kbd> to jump anywhere.</p>
    </div>
  );
}
