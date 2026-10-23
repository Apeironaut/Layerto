import { useState } from 'react';
import { Button, Icon } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { useHub } from '../../../hub/HubContext';
import { api } from '../../../lib/api';
import { ALL_TEMPLATES, getDisciplineMeta } from '../templates';
import type { DisciplineTemplate } from '../templates';
import type {
  ResearchDiscipline,
  ResearchCustomField,
  ResearchMetricCol,
  SupportedDataType,
  PrivacyShieldConfig,
} from '@layerto/types';

const ALL_DATA_TYPES: SupportedDataType[] = [
  'Images',
  'Audio',
  'Text/Corpus',
  'Tabular/CSV',
  'DICOM/Medical',
  'Time-Series',
];

export function AreaVaultSettingsTab() {
  const { area, scopedClient, reloadArea } = useAreaVault();
  const { navigate } = useHub();
  const currentMeta = getDisciplineMeta(area.discipline);

  const [isDeletingArea, setIsDeletingArea] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [isDeletingProcess, setIsDeletingProcess] = useState(false);

  // Identity Form State
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description);
  const [color, setColor] = useState(area.color);
  const [discipline, setDiscipline] = useState<ResearchDiscipline>(area.discipline || 'zoology_ecology');
  const [hypothesis, setHypothesis] = useState(area.hypothesis || '');

  // Schema Designer State
  const [customFields, setCustomFields] = useState<ResearchCustomField[]>(
    area.custom_fields && area.custom_fields.length > 0 ? area.custom_fields : currentMeta.defaultCustomFields,
  );
  const [dataTypes, setDataTypes] = useState<SupportedDataType[]>(
    area.data_types && area.data_types.length > 0 ? area.data_types : currentMeta.defaultDataTypes,
  );
  const [customMetrics, setCustomMetrics] = useState<ResearchMetricCol[]>(
    area.custom_metrics && area.custom_metrics.length > 0 ? area.custom_metrics : currentMeta.defaultMetrics,
  );
  const [privacyShieldConfig, setPrivacyShieldConfig] = useState<PrivacyShieldConfig>(
    area.privacy_shield_config || currentMeta.defaultPrivacyShield,
  );
  const [complianceVaultType, setComplianceVaultType] = useState<string>(
    area.compliance_vault_type || currentMeta.complianceVaultType,
  );

  // Field Add Modal / Subform State
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<ResearchCustomField['type']>('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [isAddingField, setIsAddingField] = useState(false);

  // Metric Add Subform State
  const [newMetricKey, setNewMetricKey] = useState('');
  const [newMetricLabel, setNewMetricLabel] = useState('');
  const [newMetricUnit, setNewMetricUnit] = useState('%');
  const [isAddingMetric, setIsAddingMetric] = useState(false);

  // Area Compute & Budget Cap State
  const [storageQuotaGb, setStorageQuotaGb] = useState<number>(
    Math.round((area.storage_quota_bytes || 53687091200) / (1024 * 1024 * 1024)) || 50,
  );
  const [gpuCreditsBudget, setGpuCreditsBudget] = useState<number>(area.gpu_credits_budget || 2000);
  const [grantBudgetDollars, setGrantBudgetDollars] = useState<number>(5000);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleApplyTemplate = (tmpl: DisciplineTemplate) => {
    setDiscipline(tmpl.id);
    setColor(tmpl.color);
    setCustomFields(tmpl.defaultCustomFields);
    setDataTypes(tmpl.defaultDataTypes);
    setCustomMetrics(tmpl.defaultMetrics);
    setPrivacyShieldConfig(tmpl.defaultPrivacyShield);
    setComplianceVaultType(tmpl.complianceVaultType);
  };

  const toggleDataType = (type: SupportedDataType) => {
    setDataTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldKey.trim() || !newFieldLabel.trim()) return;
    const formattedKey = newFieldKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (customFields.some((f) => f.key === formattedKey)) return;

    setCustomFields((prev) => [
      ...prev,
      {
        key: formattedKey,
        label: newFieldLabel.trim(),
        type: newFieldType,
        unit: newFieldUnit.trim() || undefined,
      },
    ]);
    setNewFieldKey('');
    setNewFieldLabel('');
    setNewFieldUnit('');
    setIsAddingField(false);
  };

  const handleRemoveCustomField = (key: string) => {
    setCustomFields((prev) => prev.filter((f) => f.key !== key));
  };

  const handleAddMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMetricKey.trim() || !newMetricLabel.trim()) return;
    const formattedKey = newMetricKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (customMetrics.some((m) => m.key === formattedKey)) return;

    setCustomMetrics((prev) => [
      ...prev,
      {
        key: formattedKey,
        label: newMetricLabel.trim(),
        unit: newMetricUnit.trim() || '%',
      },
    ]);
    setNewMetricKey('');
    setNewMetricLabel('');
    setNewMetricUnit('%');
    setIsAddingMetric(false);
  };

  const handleRemoveMetric = (key: string) => {
    setCustomMetrics((prev) => prev.filter((m) => m.key !== key));
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await scopedClient.updateArea(area.id, {
        name: name.trim(),
        description: description.trim(),
        color,
        discipline,
        hypothesis: hypothesis.trim(),
        custom_fields: customFields,
        data_types: dataTypes,
        custom_metrics: customMetrics,
        privacy_shield_config: privacyShieldConfig,
        compliance_vault_type: complianceVaultType,
        storage_quota_bytes: storageQuotaGb * 1024 * 1024 * 1024,
        gpu_credits_budget: gpuCreditsBudget,
      } as any);

      await reloadArea();
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      console.error('Failed to update area settings', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Zero-Trust Air-Gapped Isolation Security Notice */}
      <div className="rounded-l2 border border-emerald-500/40 bg-emerald-500/5 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-control bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Icon name="shield" size={16} />
            </span>
            <h3 className="text-sm font-bold text-ink">
              Air-Gapped Universal Research Engine: Active
            </h3>
          </div>
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
            DISCIPLINE: {currentMeta.label.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          This Research Area is field-agnostic and cryptographically sandboxed. You can freely re-configure custom
          specimen metadata attributes, add novel ML evaluation benchmarks, toggle field-specific privacy shields, or
          adopt preset discipline schemas. All changes are committed directly to PostgreSQL.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1 font-mono text-[11px]">
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Boundary Scope</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Strict Area Isolation</span>
          </div>
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Data Modalities</span>
            <span className="font-bold text-ink">{dataTypes.length} Supported</span>
          </div>
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Metadata Fields</span>
            <span className="font-bold text-ink">{customFields.length} Registered</span>
          </div>
          <div className="rounded bg-card/80 p-2.5 border border-line">
            <span className="text-[10px] text-muted block">Privacy Shield</span>
            <span className="font-bold text-teal-600 dark:text-teal-400 uppercase">
              {privacyShieldConfig.shield_type.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveAll} className="space-y-8 text-xs">
        {/* SECTION 1: IDENTITY & DISCIPLINE TEMPLATES */}
        <div className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h4 className="text-sm font-bold text-ink">1. Discipline Profile & Identity</h4>
              <p className="text-xs text-muted mt-0.5">
                Switch or calibrate starter discipline presets across scientific and humanities fields.
              </p>
            </div>
            {savedNotice && (
              <span className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-fade">
                ✓ Vault Configuration Saved to Database!
              </span>
            )}
          </div>

          {/* Preset Picker by Categories */}
          <div className="space-y-3">
            <label className="font-semibold text-ink block">
              Quick Adopt Preset Template:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {ALL_TEMPLATES.slice(0, 6).map((tmpl) => {
                const isCurrent = discipline === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className={`rounded-control border p-2.5 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? 'border-crimson bg-crimson/5 font-bold text-ink ring-1 ring-crimson shadow-xs'
                        : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="size-2 rounded-full shrink-0" style={{ background: tmpl.color }} />
                      <span className="text-[11px] font-bold truncate text-ink">{tmpl.label}</span>
                    </div>
                    <span className="text-[9px] text-muted line-clamp-2">{tmpl.category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="font-semibold text-ink block mb-1">Research Area Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-none"
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
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-control border border-line bg-page p-3 text-xs text-ink leading-relaxed focus:border-crimson focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">Core Hypothesis</label>
            <textarea
              rows={2}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="State the core scientific, clinical, or technical hypothesis being evaluated..."
              className="w-full rounded-control border border-line bg-page p-3 text-xs text-ink leading-relaxed focus:border-crimson focus:outline-none"
            />
          </div>
        </div>

        {/* SECTION 2: CUSTOM METADATA FIELD DESIGNER */}
        <div className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h4 className="text-sm font-bold text-ink">2. Custom Metadata Field Designer</h4>
              <p className="text-xs text-muted mt-0.5">
                Define dynamic schema attributes tailored to your domain (e.g. Patient Age Group, Dialect Region, Crop Yield, Spectral Band).
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={() => setIsAddingField(!isAddingField)}
              className="cursor-pointer"
            >
              Add Custom Field
            </Button>
          </div>

          {/* Subform to add a new custom field */}
          {isAddingField && (
            <div className="rounded-control border border-teal-500/30 bg-teal-500/5 p-4 space-y-3">
              <span className="text-xs font-bold text-ink block">Define New Metadata Field</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-muted block mb-1">Field Key (snake_case) *</label>
                  <input
                    type="text"
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    placeholder="e.g. patient_age_group"
                    className="w-full rounded-control border border-line bg-page px-2.5 py-1.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Display Label *</label>
                  <input
                    type="text"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="e.g. Patient Age Group"
                    className="w-full rounded-control border border-line bg-page px-2.5 py-1.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Data Type</label>
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as any)}
                    className="w-full rounded-control border border-line bg-page px-2.5 py-1.5 text-xs text-ink"
                  >
                    <option value="text">Text / String</option>
                    <option value="number">Numeric</option>
                    <option value="category">Categorical</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Unit / Format (Optional)</label>
                  <input
                    type="text"
                    value={newFieldUnit}
                    onChange={(e) => setNewFieldUnit(e.target.value)}
                    placeholder="e.g. kg, cm, NTU, K"
                    className="w-full rounded-control border border-line bg-page px-2.5 py-1.5 text-xs text-ink"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingField(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={handleAddCustomField}>
                  Add to Schema
                </Button>
              </div>
            </div>
          )}

          {/* List of active custom fields */}
          <div className="space-y-2">
            {customFields.length === 0 ? (
              <p className="text-xs text-muted italic">No custom metadata fields configured.</p>
            ) : (
              <div className="divide-y divide-line border border-line rounded-control bg-page/40 overflow-hidden">
                {customFields.map((cf) => (
                  <div key={cf.key} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-card/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-bold text-ink">{cf.label}</span>
                      <span className="font-mono text-[10px] text-muted bg-card px-2 py-0.5 rounded border border-line">
                        key: {cf.key}
                      </span>
                      <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-mono text-indigo-700 dark:text-indigo-300">
                        {cf.type.toUpperCase()}{cf.unit ? ` (${cf.unit})` : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(cf.key)}
                      className="text-muted hover:text-crimson p-1 rounded transition-colors cursor-pointer"
                      title="Remove metadata field"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: DATA TYPES & EVALUATION METRICS DESIGNER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Supported Data Types */}
          <div className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-4">
            <h4 className="text-sm font-bold text-ink">3. Supported Primary Data Formats</h4>
            <p className="text-xs text-muted">
              Select all primary data modalities ingested into this area's isolated repository.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {ALL_DATA_TYPES.map((dt) => {
                const isActive = dataTypes.includes(dt);
                return (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => toggleDataType(dt)}
                    className={`rounded-control border p-2.5 text-left transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/10 font-bold text-ink ring-1 ring-indigo-500 shadow-xs'
                        : 'border-line bg-page text-muted hover:text-ink'
                    }`}
                  >
                    <span className="text-xs">{dt}</span>
                    <Icon name={isActive ? 'check' : 'plus'} size={13} className={isActive ? 'text-indigo-600' : 'text-muted'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Evaluation Metrics */}
          <div className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-ink">4. Evaluation Metrics Designer</h4>
                <p className="text-xs text-muted mt-0.5">Configure target benchmark objectives.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => setIsAddingMetric(!isAddingMetric)}
                className="cursor-pointer"
              >
                Add Metric
              </Button>
            </div>

            {isAddingMetric && (
              <div className="rounded-control border border-teal-500/30 bg-teal-500/5 p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newMetricKey}
                    onChange={(e) => setNewMetricKey(e.target.value)}
                    placeholder="key (e.g. roc_auc)"
                    className="rounded-control border border-line bg-page px-2 py-1 text-xs text-ink"
                  />
                  <input
                    type="text"
                    value={newMetricLabel}
                    onChange={(e) => setNewMetricLabel(e.target.value)}
                    placeholder="label (e.g. ROC-AUC)"
                    className="rounded-control border border-line bg-page px-2 py-1 text-xs text-ink"
                  />
                  <input
                    type="text"
                    value={newMetricUnit}
                    onChange={(e) => setNewMetricUnit(e.target.value)}
                    placeholder="unit (%, score, p)"
                    className="rounded-control border border-line bg-page px-2 py-1 text-xs text-ink"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingMetric(false)}>
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" size="sm" onClick={handleAddMetric}>
                    Add
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {customMetrics.map((cm) => (
                <div key={cm.key} className="flex items-center justify-between p-2 rounded border border-line bg-page/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{cm.label}</span>
                    <span className="rounded bg-teal-500/10 px-1.5 py-0.5 font-mono text-[10px] text-teal-700 dark:text-teal-300">
                      unit: {cm.unit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMetric(cm.key)}
                    className="text-muted hover:text-crimson p-0.5 cursor-pointer"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: AREA COMPUTE & GRANT BUDGET CAPS */}
        <div className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h4 className="text-sm font-bold text-ink">4. Area Compute & Grant Budget Caps</h4>
              <p className="text-xs text-muted mt-0.5">
                Regulate the maximum storage quota and GPU hours / credits consumed by collaborators in this vault.
              </p>
            </div>
            <span className="rounded bg-page px-2 py-0.5 text-xs font-mono text-muted border border-line">
              Hard Quota Limits
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Storage Quota Slider */}
            <div className="space-y-2 rounded-control border border-line bg-page/40 p-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Icon name="database" size={13} className="text-blue-500" />
                  Storage Quota Cap
                </span>
                <span className="font-mono font-bold text-ink">{storageQuotaGb} GB</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={storageQuotaGb}
                onChange={(e) => setStorageQuotaGb(parseInt(e.target.value) || 0)}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span>Used: {(area.storage_bytes_used / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                <span>Max: 500 GB</span>
              </div>
            </div>

            {/* GPU Credits Budget Slider */}
            <div className="space-y-2 rounded-control border border-line bg-page/40 p-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Icon name="cpu" size={13} className="text-crimson" />
                  GPU Credits Budget
                </span>
                <span className="font-mono font-bold text-ink">{gpuCreditsBudget.toLocaleString()} cr</span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="250"
                value={gpuCreditsBudget}
                onChange={(e) => setGpuCreditsBudget(parseInt(e.target.value) || 0)}
                className="w-full accent-crimson cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span>Used: {area.gpu_credits_used ?? 0} cr</span>
                <span>Max: 10,000 cr</span>
              </div>
            </div>

            {/* Grant / Escrow Budget Cap Slider */}
            <div className="space-y-2 rounded-control border border-line bg-page/40 p-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Icon name="coins" size={13} className="text-emerald-500" />
                  Grant Budget Cap
                </span>
                <span className="font-mono font-bold text-ink">${grantBudgetDollars.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="500"
                max="25000"
                step="500"
                value={grantBudgetDollars}
                onChange={(e) => setGrantBudgetDollars(parseInt(e.target.value) || 500)}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span>Bounty Cap</span>
                <span>Max: $25,000</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: ADAPTIVE UNIVERSAL PRIVACY & COMPLIANCE SHIELD */}
        <div className="rounded-l2 border border-line bg-card p-6 shadow-l1 space-y-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h4 className="text-sm font-bold text-ink">5. Universal Privacy & Compliance Shield</h4>
              <p className="text-xs text-muted mt-0.5">
                Automatically masks sensitive coordinates, scrubs medical PII, or fingerprints proprietary formulas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">Shield Active:</span>
              <button
                type="button"
                onClick={() =>
                  setPrivacyShieldConfig((prev) => ({ ...prev, enabled: !prev.enabled }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  privacyShieldConfig.enabled ? 'bg-teal-600' : 'bg-line'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    privacyShieldConfig.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              {
                id: 'hipaa_dicom',
                title: 'HIPAA & DICOM Sanitizer',
                desc: 'Scrubs patient MRN, names, DOB and removes DICOM header tags.',
                badge: 'Medical & Clinical',
              },
              {
                id: 'nlp_pii',
                title: 'Participant PII Redaction',
                desc: 'Pseudonymizes native speaker names and redacts informant contact records.',
                badge: 'Linguistics & Social',
              },
              {
                id: 'geo_privacy',
                title: 'EXIF & GPS Geo-Shield',
                desc: 'Applies ±10km conservation blur on coordinates to prevent wildlife poaching.',
                badge: 'Ecology & Wildlife',
              },
              {
                id: 'nda_watermark',
                title: 'NDA IP & Watermarking',
                desc: 'Injects cryptographic watermarks into proprietary models and material formulas.',
                badge: 'Engineering & R&D',
              },
            ].map((s) => {
              const isSelected = privacyShieldConfig.shield_type === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setPrivacyShieldConfig((prev) => ({ ...prev, shield_type: s.id as any }))
                  }
                  className={`rounded-control border p-3 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-teal-500 bg-teal-500/10 font-bold text-ink ring-1 ring-teal-500 shadow-xs'
                      : 'border-line bg-page text-muted hover:text-ink'
                  }`}
                >
                  <div>
                    <span className="rounded bg-page px-1.5 py-0.5 text-[9px] font-mono text-muted border border-line block w-fit mb-1.5">
                      {s.badge}
                    </span>
                    <div className="font-bold text-xs text-ink">{s.title}</div>
                    <p className="text-[10px] text-muted mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Save Button Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-line">
          <span className="text-xs text-muted">
            All schema attributes and security shields are committed directly to PostgreSQL.
          </span>
          <Button variant="primary" loading={saving} icon="check" className="cursor-pointer">
            Save Vault Configuration
          </Button>
        </div>
      </form>

      {/* DANGER ZONE: AIR-GAPPED AREA DELETION */}
      <div className="rounded-l3 border border-rose-500/30 bg-rose-500/[0.03] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-control bg-rose-500/10 text-rose-600">
            <Icon name="trash" size={16} />
          </span>
          <div>
            <h4 className="text-sm font-bold text-ink">Danger Zone: Permanent Area Deletion</h4>
            <p className="text-xs text-muted mt-0.5">
              Permanently remove this research area, including all scoped observation tables, methodology pipelines, reference papers, and neural checkpoints.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-muted">
            This action cannot be undone. All air-gapped tables and contracts will be permanently cascaded.
          </span>
          <Button
            variant="primary"
            onClick={() => setIsDeletingArea(true)}
            className="cursor-pointer text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            Delete Research Area
          </Button>
        </div>
      </div>

      {/* DELETE AREA CONFIRMATION MODAL */}
      {isDeletingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l3 border border-rose-500/40 bg-card p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <Icon name="alert" size={18} />
              Confirm Permanent Area Deletion
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to permanently delete <span className="font-bold text-ink">"{area.name}"</span>?
              Please type the area name below to confirm:
            </p>

            <input
              type="text"
              placeholder={area.name}
              value={deleteConfirmationName}
              onChange={(e) => setDeleteConfirmationName(e.target.value)}
              className="w-full rounded-control border border-rose-500/30 bg-page px-3 py-2 text-xs text-ink focus:border-rose-500 focus:outline-hidden font-bold"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsDeletingArea(false);
                  setDeleteConfirmationName('');
                }}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={isDeletingProcess}
                disabled={deleteConfirmationName.trim() !== area.name.trim()}
                onClick={async () => {
                  setIsDeletingProcess(true);
                  try {
                    await api.deleteArea(area.id);
                    navigate('/research');
                  } catch (err) {
                    console.error('Failed to delete area', err);
                  } finally {
                    setIsDeletingProcess(false);
                  }
                }}
                className="cursor-pointer bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40"
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
