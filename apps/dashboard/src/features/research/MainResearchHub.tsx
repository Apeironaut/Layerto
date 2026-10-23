import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { ResourcePoolDonutCharts } from './components/ResourcePoolDonutCharts';
import { ManageResourceAllocationsModal } from './components/ManageResourceAllocationsModal';
import { TEMPLATE_CATEGORIES, ALL_TEMPLATES, getDisciplineMeta } from './templates';
import type { DisciplineTemplate } from './templates';
import type { ResearchArea, ResearchOverview, ResearchCustomField, ResearchMetricCol, SupportedDataType, PrivacyShieldConfig } from '@layerto/types';

export function MainResearchHub() {
  const { navigate } = useHub();
  const [isCreating, setIsCreating] = useState(false);
  const [isManagingAllocations, setIsManagingAllocations] = useState(false);

  // New Area Form State
  const [selectedCategoryId, setSelectedCategoryId] = useState('life_sciences');
  const [selectedTemplate, setSelectedTemplate] = useState<DisciplineTemplate>(ALL_TEMPLATES[0]);
  const [name, setName] = useState('Marine Zoology & Fauna Photo-ID Research');
  const [description, setDescription] = useState(ALL_TEMPLATES[0].desc);
  const [color, setColor] = useState(ALL_TEMPLATES[0].color);
  const [hypothesis, setHypothesis] = useState('');
  const [customFields, setCustomFields] = useState<ResearchCustomField[]>(ALL_TEMPLATES[0].defaultCustomFields);
  const [dataTypes, setDataTypes] = useState<SupportedDataType[]>(ALL_TEMPLATES[0].defaultDataTypes);
  const [customMetrics, setCustomMetrics] = useState<ResearchMetricCol[]>(ALL_TEMPLATES[0].defaultMetrics);
  const [privacyShieldConfig, setPrivacyShieldConfig] = useState<PrivacyShieldConfig>(ALL_TEMPLATES[0].defaultPrivacyShield);
  const [complianceVaultType, setComplianceVaultType] = useState<string>(ALL_TEMPLATES[0].complianceVaultType);
  const [saving, setSaving] = useState(false);

  const handleSelectTemplate = (tmpl: DisciplineTemplate) => {
    setSelectedTemplate(tmpl);
    setName(tmpl.id === 'custom_blank' ? 'Custom Domain Research Studio' : tmpl.label + ' Lab');
    setDescription(tmpl.desc);
    setColor(tmpl.color);
    setCustomFields(tmpl.defaultCustomFields);
    setDataTypes(tmpl.defaultDataTypes);
    setCustomMetrics(tmpl.defaultMetrics);
    setPrivacyShieldConfig(tmpl.defaultPrivacyShield);
    setComplianceVaultType(tmpl.complianceVaultType);
  };

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
        discipline: selectedTemplate.id,
        hypothesis: hypothesis.trim(),
        custom_fields: customFields,
        data_types: dataTypes,
        custom_metrics: customMetrics,
        privacy_shield_config: privacyShieldConfig,
        compliance_vault_type: complianceVaultType,
      } as any);

      setIsCreating(false);
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
              const meta = getDisciplineMeta(a.discipline);
              const dataTypesList = a.data_types || meta.defaultDataTypes;
              const primaryMetrics = a.custom_metrics?.slice(0, 2) || meta.defaultMetrics.slice(0, 2);

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
                    style={{ background: a.color || meta.color || 'var(--color-crimson)' }}
                  />

                  <div className="pl-2 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ background: a.color || meta.color || 'var(--color-crimson)' }}
                        />
                        <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] font-semibold text-muted border border-line truncate max-w-[170px]">
                          {meta.label}
                        </span>
                      </div>
                      <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
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

                    {/* Supported Data Types & Privacy Shield Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {dataTypesList.slice(0, 3).map((dt) => (
                        <span
                          key={dt}
                          className="rounded bg-page px-2 py-0.5 text-[10px] font-mono font-semibold text-ink-secondary border border-line"
                        >
                          {dt}
                        </span>
                      ))}
                      {a.privacy_shield_config?.enabled && (
                        <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-teal-700 dark:text-teal-300 border border-teal-500/20">
                          {a.privacy_shield_config.shield_type === 'hipaa_dicom'
                            ? 'HIPAA SCRUB'
                            : a.privacy_shield_config.shield_type === 'nlp_pii'
                            ? 'PII REDACTED'
                            : a.privacy_shield_config.shield_type === 'nda_watermark'
                            ? 'NDA SEAL'
                            : 'GEO-SHIELD'}
                        </span>
                      )}
                    </div>

                    {/* Custom Metric Objectives Preview */}
                    {primaryMetrics.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted bg-page/50 p-1.5 rounded border border-line/60">
                        {primaryMetrics.map((m) => (
                          <span key={m.key} className="flex items-center gap-1">
                            <span className="text-muted">{m.label}:</span>
                            <span className="font-bold text-ink">{m.unit}</span>
                          </span>
                        ))}
                      </div>
                    )}

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
                      <span><strong>{a.specimens || 0}</strong> {meta.itemPlural.toLowerCase().slice(0, 10)}</span>
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
          title="Create Universal Research Area (Air-Gapped)"
          size="lg"
        >
          <form onSubmit={handleCreateArea} className="space-y-5 text-xs max-h-[80vh] overflow-y-auto pr-1">
            <div className="rounded-control bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold">Field-Agnostic Isolation:</span> Any discipline from medical clinical scans to ancient linguistic paleography or pure AI operates as a zero-trust vault with automated privacy shields and custom schemas.
            </div>

            {/* 6 Category Switcher */}
            <div>
              <label className="font-semibold text-ink block mb-2">
                1. Select Academic or Scientific Discipline Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      if (cat.templates.length > 0) {
                        handleSelectTemplate(cat.templates[0]);
                      }
                    }}
                    className={`rounded-control border p-2.5 text-left transition-all cursor-pointer ${
                      selectedCategoryId === cat.id
                        ? 'border-crimson bg-crimson/5 font-bold text-ink ring-1 ring-crimson shadow-xs'
                        : 'border-line bg-page text-muted hover:text-ink hover:border-line-strong'
                    }`}
                  >
                    <div className="font-semibold text-xs truncate">{cat.title}</div>
                    <div className="text-[10px] text-muted mt-0.5 line-clamp-1">{cat.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Presets within Selected Category */}
            <div>
              <label className="font-semibold text-ink block mb-2">
                2. Choose Discipline Starter Preset *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEMPLATE_CATEGORIES.find((c) => c.id === selectedCategoryId)?.templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className={`rounded-control border p-3 text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      selectedTemplate.id === t.id
                        ? 'border-teal-500 bg-teal-500/5 font-bold text-ink ring-1 ring-teal-500 shadow-xs'
                        : 'border-line bg-page text-muted hover:text-ink hover:border-line-strong'
                    }`}
                  >
                    <span
                      className="size-3 rounded-full mt-0.5 shrink-0"
                      style={{ background: t.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-ink">{t.label}</div>
                      <div className="text-[10px] text-muted mt-0.5 leading-relaxed">{t.desc}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.defaultDataTypes.map((dt) => (
                          <span key={dt} className="rounded bg-page px-1.5 py-0.5 text-[9px] font-mono text-muted border border-line">
                            {dt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Field & Metric Previews */}
            <div className="rounded-control border border-line bg-page/60 p-3 space-y-2">
              <span className="text-[11px] font-mono font-bold text-ink block">
                PRE-CONFIGURED SCHEMA & METRICS FOR {selectedTemplate.label.toUpperCase()}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-[10px] text-muted uppercase font-bold block mb-1">Custom Metadata Fields</span>
                  <div className="flex flex-wrap gap-1">
                    {customFields.map((cf) => (
                      <span key={cf.key} className="rounded bg-card px-2 py-0.5 text-[10px] font-mono border border-line text-ink">
                        {cf.label} ({cf.type})
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted uppercase font-bold block mb-1">Target Evaluation Metrics</span>
                  <div className="flex flex-wrap gap-1">
                    {customMetrics.map((cm) => (
                      <span key={cm.key} className="rounded bg-card px-2 py-0.5 text-[10px] font-mono border border-line text-teal-700 dark:text-teal-300">
                        {cm.label} ({cm.unit})
                      </span>
                    ))}
                  </div>
                </div>
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
                  placeholder="e.g. Clinical Radiology Lab or Low-Resource NLP"
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-none"
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
                placeholder="Brief summary of research scope, field site, or study focus..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink focus:border-crimson focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Core Hypothesis</label>
              <textarea
                rows={2}
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="State the scientific, medical, or technical hypothesis being evaluated..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink focus:border-crimson focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setIsCreating(false)} className="cursor-pointer">
                Cancel
              </Button>
              <Button variant="primary" loading={saving} icon="plus" className="cursor-pointer">
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
