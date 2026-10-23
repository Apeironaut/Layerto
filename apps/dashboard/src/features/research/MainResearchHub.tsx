import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { ResourcePoolDonutCharts } from './components/ResourcePoolDonutCharts';
import { ManageResourceAllocationsModal } from './components/ManageResourceAllocationsModal';
import type { ResearchArea, ResearchDiscipline, ResearchOverview } from '@layerto/types';

const DISCIPLINES: { id: ResearchDiscipline; label: string; desc: string }[] = [
  { id: 'zoology', label: 'Zoology & Wildlife Conservation', desc: 'Fauna photo-ID, GPS telemetry, scute graphs' },
  { id: 'ecology', label: 'Ecology & Field Science', desc: 'LiDAR canopy mapping, drone photogrammetry' },
  { id: 'cv_ai', label: 'Computer Vision & AI Engineering', desc: 'Deep learning models, ablation matrices' },
  { id: 'biomedical', label: 'Biomedical & Pathology', desc: 'Cell segmentation, digital pathology' },
  { id: 'interdisciplinary', label: 'Custom Interdisciplinary Studio', desc: 'Flexible cross-domain collaboration' },
];

export function MainResearchHub() {
  const { navigate } = useHub();
  const [isCreating, setIsCreating] = useState(false);
  const [isManagingAllocations, setIsManagingAllocations] = useState(false);

  // New Area Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0D9488');
  const [discipline, setDiscipline] = useState<ResearchDiscipline>('zoology');
  const [hypothesis, setHypothesis] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch real database records via api-client
  const areasResource = useResource<ResearchArea[]>(
    () => api.areas(),
    'main-research-areas',
  );

  const overviewResource = useResource<ResearchOverview>(
    () => api.researchOverview(),
    'main-research-overview',
  );

  const areas = areasResource.data || [];
  const overview = overviewResource.data;

  // Real shared metrics
  const storageUsedBytes = overview?.storage_bytes ?? 0;
  const storageLimitBytes = overview?.storage_limit_bytes ?? 53687091200; // 50 GB
  const storageAllocatedBytes = overview?.storage_allocated_bytes ?? 0;

  const gpuCreditsLimit = overview?.gpu_credits_limit || Math.round((overview?.gpu_hours || 24.5) * 100) || 2450;
  const gpuCreditsUsed = overview?.gpu_credits_used ?? 0;
  const gpuCreditsAllocated = overview?.gpu_credits_allocated ?? 0;

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const created = await api.createArea({
        name: name.trim(),
        description: description.trim(),
        color,
        discipline,
        hypothesis: hypothesis.trim(),
      } as any);

      setIsCreating(false);
      setName('');
      setDescription('');
      setHypothesis('');
      await areasResource.reload();
      await overviewResource.reload();

      // Automatically navigate into the newly created isolated vault
      if (created?.id) {
        navigate(`/research/area/${created.id}`);
      }
    } catch (err) {
      console.error('Failed to create research area', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEnterArea = (areaId: string) => {
    navigate(`/research/area/${areaId}`);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Level 1 Hero Banner & Shared Compute/Storage Pool */}
      <div className="relative overflow-hidden rounded-l3 border border-line bg-card p-5 sm:p-7 shadow-l1">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full blur-3xl opacity-20 bg-crimson"
        />

        <div className="relative flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-crimson">
              <Icon name="flask" size={15} /> Layerto Research Hub
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Research Areas & Zero-Trust Vaults
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-muted leading-relaxed">
              Every Research Area operates as an air-gapped sandboxed container with zero cross-area data leaks.
              Create isolated areas for specialized domains, allocate GPU credits and storage, and collaborate securely.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => setIsCreating(true)}
            className="cursor-pointer hover:shadow-md transition-all"
          >
            Create Research Area
          </Button>
        </div>

        {/* SHARED COMPUTE & STORAGE POOL (Global shared pool with Dual Donut Charts & Manage Resources) */}
        <div className="relative mt-6 rounded-l2 border border-line bg-page/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-control bg-crimson/10 text-crimson">
                <Icon name="gauge" size={16} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Shared Global Resource Pool
                </h3>
                <span className="text-xs text-muted">
                  Storage quota and GPU compute are pooled across all your research areas.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                icon="settings"
                onClick={() => setIsManagingAllocations(true)}
                className="cursor-pointer hover:border-line-strong hover:bg-page transition-all text-xs"
              >
                Manage Resources
              </Button>
              <div className="rounded-control bg-page px-3 py-1 font-mono text-xs font-bold text-ink border border-line">
                Plan: {overview?.plan || 'Researcher Pro'}
              </div>
            </div>
          </div>

          {/* Interactive Dual Donut/Pie Charts */}
          <ResourcePoolDonutCharts
            storageUsedBytes={storageUsedBytes}
            storageAllocatedBytes={storageAllocatedBytes}
            storageLimitBytes={storageLimitBytes}
            gpuCreditsUsed={gpuCreditsUsed}
            gpuCreditsAllocated={gpuCreditsAllocated}
            gpuCreditsLimit={gpuCreditsLimit}
          />
        </div>
      </div>

      {/* RESEARCH AREAS VAULT GALLERY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink">Isolated Research Area Vaults</h2>
            <span className="rounded-pill bg-page px-2.5 py-0.5 text-xs font-mono font-medium text-muted border border-line">
              {areas.length} Vaults
            </span>
          </div>
          <span className="text-xs text-muted">
            Click any area to enter its isolated workspace
          </span>
        </div>

        {areasResource.loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48 rounded-l2" />
            <Skeleton className="h-48 rounded-l2" />
            <Skeleton className="h-48 rounded-l2" />
          </div>
        ) : areas.length === 0 ? (
          <div className="rounded-l2 border border-line bg-card p-10 text-center space-y-3">
            <Icon name="compass" size={32} className="mx-auto text-muted opacity-50" />
            <h3 className="text-base font-bold text-ink">No Research Areas Created</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Create your first air-gapped research area to start cataloging specimens, running ML ablations, and collaborating with tech teams.
            </p>
            <Button variant="primary" size="sm" icon="plus" onClick={() => setIsCreating(true)} className="cursor-pointer">
              Create First Area
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => {
              const disciplineObj = DISCIPLINES.find((d) => d.id === a.discipline);
              return (
                <div
                  key={a.id}
                  onClick={() => handleEnterArea(a.id)}
                  className="group relative cursor-pointer overflow-hidden rounded-l2 border border-line bg-card p-5 shadow-l1 hover:border-line-strong hover:shadow-l2 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between space-y-4"
                >
                  {/* Color Accent Indicator Strip */}
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ background: a.color || 'var(--color-crimson)' }}
                  />

                  <div className="pl-2 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ background: a.color || 'var(--color-crimson)' }}
                        />
                        <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] font-semibold text-muted border border-line truncate max-w-[150px]">
                          {disciplineObj?.label || 'Zoology & Field Science'}
                        </span>
                      </div>
                      <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600">
                        AIR-GAPPED
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-ink group-hover:text-crimson transition-colors line-clamp-1">
                        {a.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">
                        {a.description || 'Dedicated zero-trust research workspace.'}
                      </p>
                    </div>

                    {/* Dedicated Resource Allocation Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
                      <span className="rounded bg-page px-2 py-0.5 border border-line text-muted">
                        Quota: <strong className="text-ink">{a.storage_quota_bytes > 0 ? `${(a.storage_quota_bytes / (1024 * 1024 * 1024)).toFixed(0)} GB` : 'Free Pool'}</strong>
                      </span>
                      <span className="rounded bg-page px-2 py-0.5 border border-line text-muted">
                        GPU: <strong className="text-ink">{a.gpu_credits_budget > 0 ? `${a.gpu_credits_budget.toLocaleString()} cr` : 'Free Pool'}</strong>
                      </span>
                    </div>

                    {a.hypothesis && (
                      <div className="rounded bg-page/60 p-2 text-[11px] text-ink-secondary italic border border-line/60 line-clamp-2">
                        "{a.hypothesis}"
                      </div>
                    )}
                  </div>

                  {/* Vault Stats & Enter Button */}
                  <div className="pl-2 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
                      <span><strong>{a.specimens || 0}</strong> spec</span>
                      <span>•</span>
                      <span><strong>{a.experiments || 0}</strong> runs</span>
                      <span>•</span>
                      <span><strong>{a.papers || 0}</strong> papers</span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-semibold text-crimson group-hover:translate-x-0.5 transition-transform">
                      <span>Enter Vault</span>
                      <Icon name="arrowRight" size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE RESEARCH AREA MODAL */}
      {isCreating && (
        <Modal
          open={isCreating}
          onClose={() => setIsCreating(false)}
          title="Create Air-Gapped Research Area"
          size="lg"
        >
          <form onSubmit={handleCreateArea} className="space-y-4 text-xs">
            <div className="rounded-control bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold">Zero-Trust Isolation Notice:</span> The new Research Area
              will be created as a completely air-gapped container with its own database scope.
              No existing specimens, datasets, or experiments will leak into this area.
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">
                Discipline Profile *
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DISCIPLINES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDiscipline(d.id)}
                    className={`rounded-control border p-3 text-left transition-all ${
                      discipline === d.id
                        ? 'border-crimson bg-crimson/5 font-bold text-ink ring-1 ring-crimson'
                        : 'border-line bg-page text-muted hover:text-ink'
                    }`}
                  >
                    <div className="text-xs">{d.label}</div>
                    <div className="text-[10px] text-muted mt-0.5">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="font-semibold text-ink block mb-1">Area Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marine Zoology & Fauna Photo-ID"
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-8 cursor-pointer rounded border border-line bg-transparent p-0"
                  />
                  <span className="font-mono text-xs">{color}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of research scope, field site, or species focus..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Core Hypothesis</label>
              <textarea
                rows={2}
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="State the scientific or technical hypothesis being evaluated..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} icon="plus">
                Create & Enter Vault
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MANAGE RESOURCE ALLOCATIONS MODAL */}
      {isManagingAllocations && (
        <ManageResourceAllocationsModal
          isOpen={isManagingAllocations}
          onClose={() => setIsManagingAllocations(false)}
          areas={areas}
          overview={overview}
          onSaved={() => {
            areasResource.reload();
            overviewResource.reload();
          }}
        />
      )}
    </div>
  );
}
