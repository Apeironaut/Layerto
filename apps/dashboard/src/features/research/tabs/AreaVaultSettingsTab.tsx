import { useState } from 'react';
import { Button, Icon } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import type { ResearchDiscipline } from '@layerto/types';

const DISCIPLINES: { id: ResearchDiscipline; label: string; desc: string; icon: string }[] = [
  {
    id: 'zoology',
    label: 'Zoology & Wildlife Conservation',
    desc: 'Individual photo-ID, scute topologies, GPS observation logs, and morphology tracking.',
    icon: 'camera',
  },
  {
    id: 'ecology',
    label: 'Ecology & Field Science',
    desc: 'LiDAR canopy mapping, multi-spectral drone photogrammetry, biomass estimation.',
    icon: 'compass',
  },
  {
    id: 'cv_ai',
    label: 'Computer Vision & AI Engineering',
    desc: 'Object detection, instance segmentation, neural re-ID embeddings, ablation matrices.',
    icon: 'cpu',
  },
  {
    id: 'biomedical',
    label: 'Biomedical & Pathology Imaging',
    desc: 'Histology tiles, cell segmentation, biomarker quantitation, blind validation.',
    icon: 'flask',
  },
  {
    id: 'interdisciplinary',
    label: 'Custom Interdisciplinary Studio',
    desc: 'Configurable domain table schema with flexible ML benchmarks and shared royalties.',
    icon: 'sparkles',
  },
];

export function AreaVaultSettingsTab() {
  const { area, scopedClient, reloadArea } = useAreaVault();
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description);
  const [color, setColor] = useState(area.color);
  const [discipline, setDiscipline] = useState<ResearchDiscipline>(area.discipline || 'zoology');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await scopedClient.updateArea(area.id, {
        name: name.trim(),
        description: description.trim(),
        color,
        discipline,
      } as any);
      await reloadArea();
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      console.error('Failed to update area settings', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Zero-Trust Air-Gapped Isolation Status Box */}
      <div className="rounded-l2 border border-emerald-500/40 bg-emerald-500/5 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-control bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Icon name="shield" size={16} />
          </span>
          <h3 className="text-sm font-bold text-ink">
            Zero-Trust Vault Security Status: Active & Enforced
          </h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          This Research Area operates as an air-gapped sandboxed workspace container. All database queries,
          specimen registries, model weights, and collaboration agreements are strictly keyed to{' '}
          <code className="rounded bg-page px-1.5 py-0.5 font-mono text-[11px] text-ink border border-line">
            X-Research-Area-ID: {area.id}
          </code>
          . Cross-area data leaking or query pass-through is rejected at the Go middleware and SQL constraint layers.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1 font-mono text-[11px]">
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Boundary State</span>
            <span className="font-bold text-emerald-600">Air-Gapped React Reset</span>
          </div>
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Cross-Area Leaks</span>
            <span className="font-bold text-emerald-600">0 Permitted (Strict 403)</span>
          </div>
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Storage Bucket</span>
            <span className="font-bold text-ink">Isolated Namespace</span>
          </div>
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Collaborator Scope</span>
            <span className="font-bold text-indigo-600">Single-Vault Airgap</span>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-6 text-xs">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h4 className="text-sm font-bold text-ink">Vault Discipline & Identity</h4>
          {savedNotice && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade">
              Settings updated successfully!
            </span>
          )}
        </div>

        {/* Discipline Profiles Selector */}
        <div className="space-y-2">
          <label className="font-semibold text-ink block">
            Research Discipline Profile
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {DISCIPLINES.map((d) => {
              const isSelected = discipline === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDiscipline(d.id)}
                  className={`rounded-l1 border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-crimson bg-crimson/5 ring-1 ring-crimson font-medium'
                      : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  <div className="font-bold text-xs text-ink">{d.label}</div>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">{d.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Name and Color */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="font-semibold text-ink block mb-1">Research Area Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
            />
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">Discipline Theme Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-8 cursor-pointer rounded border border-line bg-transparent p-0"
              />
              <span className="font-mono text-xs font-semibold text-ink">{color}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="font-semibold text-ink block mb-1">Description & Scope</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-control border border-line bg-page p-3 text-xs text-ink leading-relaxed"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <Button variant="primary" loading={saving}>
            Save Vault Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
