import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { SplitLeakageGuard } from '../components/SplitLeakageGuard';
import { EthicsPermitVaultDrawer } from '../components/EthicsPermitVaultDrawer';
import { ExpertVerificationQueue } from '../components/ExpertVerificationQueue';
import { getDisciplineMeta } from '../templates';
import type { DatasetSplitSnapshot, ResearchCustomField, SpecimenItem } from '@layerto/types';

export function DataSpecimenVaultTab() {
  const { area, scopedClient, viewMode, reloadArea } = useAreaVault();
  const meta = getDisciplineMeta(area.discipline);
  const shieldType = area.privacy_shield_config?.shield_type || meta.defaultPrivacyShield.shield_type;

  const [selectedSpecimenIndex, setSelectedSpecimenIndex] = useState<number | null>(null);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [ethicsDrawerOpen, setEthicsDrawerOpen] = useState(false);
  const [geoShieldActive, setGeoShieldActive] = useState(true);
  const [modalityFilter, setModalityFilter] = useState<'all' | 'image' | 'tabular' | 'text' | 'audio'>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('grid');

  // Form states for new record
  const [newTitle, setNewTitle] = useState('');
  const [newSpecies, setNewSpecies] = useState('');
  const [newCommonName, setNewCommonName] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newModality, setNewModality] = useState<'image' | 'tabular' | 'text' | 'audio'>('image');
  const [newHabitat, setNewHabitat] = useState('');
  const [newGpsLat, setNewGpsLat] = useState('6.0329');
  const [newGpsLng, setNewGpsLng] = useState('80.2168');
  const [newNotes, setNewNotes] = useState('');
  const [customAttributeValues, setCustomAttributeValues] = useState<Record<string, string>>({});
  const [savingRecord, setSavingRecord] = useState(false);

  // New inline custom domain field definition
  const [isDefiningNewField, setIsDefiningNewField] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<ResearchCustomField['type']>('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [savingField, setSavingField] = useState(false);

  // Fetch specimens from PostgreSQL via scoped client
  const specimensResource = useResource<SpecimenItem[]>(
    () => scopedClient.specimens({ area: area.id }),
    `specimens-${area.id}`,
  );

  // Fetch dataset splits from PostgreSQL via scoped client
  const splitsResource = useResource<DatasetSplitSnapshot[]>(
    () => scopedClient.datasetSplits({ area: area.id }),
    `splits-${area.id}`,
  );

  const rawSpecimens = specimensResource.data || [];
  const splits = splitsResource.data || [];

  // Filter specimens by modality
  const filteredSpecimens = useMemo(() => {
    if (modalityFilter === 'all') return rawSpecimens;
    return rawSpecimens.filter((s) => {
      const mod = s.modality || (s.media_type === 'video' ? 'image' : s.media_type === 'audio' ? 'audio' : 'image');
      return mod === modalityFilter;
    });
  }, [rawSpecimens, modalityFilter]);

  const selectedSpecimen = selectedSpecimenIndex !== null ? filteredSpecimens[selectedSpecimenIndex] : null;

  // Keyboard navigation for detail modal (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (selectedSpecimenIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedSpecimenIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedSpecimenIndex((prev) =>
          prev !== null && prev < filteredSpecimens.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedSpecimenIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSpecimenIndex, filteredSpecimens.length]);

  const activeCustomFields = useMemo(() => {
    return area.custom_fields && area.custom_fields.length > 0
      ? area.custom_fields
      : meta.defaultCustomFields;
  }, [area.custom_fields, meta.defaultCustomFields]);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSpecies.trim()) return;

    setSavingRecord(true);
    try {
      await scopedClient.createSpecimen({
        area_id: area.id,
        title: newTitle.trim(),
        taxonomy_species: newSpecies.trim(),
        common_name: newCommonName.trim(),
        media_url:
          newMediaUrl.trim() ||
          'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
        media_type: newModality === 'audio' ? 'audio' : 'photo',
        modality: newModality,
        gps_lat: parseFloat(newGpsLat) || 0,
        gps_lng: parseFloat(newGpsLng) || 0,
        habitat: newHabitat.trim(),
        notes: newNotes.trim(),
        morphometrics: {
          ...customAttributeValues,
          observation_source: 'Researcher Ingestion Portal',
        },
        custom_attributes: customAttributeValues,
      } as any);

      setIsAddingRecord(false);
      setNewTitle('');
      setNewSpecies('');
      setNewCommonName('');
      setNewMediaUrl('');
      setNewHabitat('');
      setNewNotes('');
      setCustomAttributeValues({});
      specimensResource.reload();
    } catch (err) {
      console.error('Failed to create specimen record', err);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleAddCustomFieldToSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldKey.trim() || !newFieldLabel.trim()) return;
    const formattedKey = newFieldKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (activeCustomFields.some((f) => f.key === formattedKey)) return;

    setSavingField(true);
    try {
      const updatedFields: ResearchCustomField[] = [
        ...activeCustomFields,
        {
          key: formattedKey,
          label: newFieldLabel.trim(),
          type: newFieldType,
          unit: newFieldUnit.trim() || undefined,
        },
      ];

      await scopedClient.updateArea(area.id, {
        custom_fields: updatedFields,
      } as any);

      await reloadArea();
      setIsDefiningNewField(false);
      setNewFieldKey('');
      setNewFieldLabel('');
      setNewFieldUnit('');
    } catch (err) {
      console.error('Failed to append custom field to area schema', err);
    } finally {
      setSavingField(false);
    }
  };

  const showDomain = viewMode === 'domain' || viewMode === 'unified';
  const showTech = viewMode === 'tech' || viewMode === 'unified';

  const shield = (() => {
    switch (shieldType) {
      case 'hipaa_dicom':
        return {
          icon: 'shield' as const,
          activeLabel: 'HIPAA Shield: ON (Safe Harbor De-ID)',
          inactiveLabel: 'HIPAA Shield: OFF (Raw PHI Exposed)',
          activeTitle: 'HIPAA Safe Harbor De-identification active: 18 HIPAA identifiers & DICOM header tags scrubbed',
          inactiveTitle: 'Warning: Raw patient identifiers & DICOM headers exposed',
          badgeText: 'HIPAA SAFE HARBOR',
          badgeColor: 'border-indigo-500/30 bg-indigo-950/80 text-indigo-300',
          modalTitle: 'HIPAA Safe Harbor & DICOM De-Identification Active',
          modalDesc:
            'All 18 Protected Health Information (PHI) identifiers—including patient names, medical record numbers, dates of service, and direct DICOM header tags—have been automatically scrubbed in accordance with 45 CFR § 164.514(b).',
        };
      case 'nlp_pii':
        return {
          icon: 'shield' as const,
          activeLabel: 'PII Shield: ON (Informant Redacted)',
          inactiveLabel: 'PII Shield: OFF (Unredacted Corpus)',
          activeTitle: 'Informant PII redaction active: Names, phone numbers, and informant geolocations masked',
          inactiveTitle: 'Warning: Raw informant transcripts and metadata exposed',
          badgeText: 'PII REDACTED',
          badgeColor: 'border-amber-500/30 bg-amber-950/80 text-amber-300',
          modalTitle: 'Linguistic Informant & Participant Privacy Shield Active',
          modalDesc:
            'Informant identifiers, speaker names, audio biometric timestamps, and geographic participant references have been redacted pursuant to IRB and UNESCO ethics guidelines.',
        };
      case 'nda_watermark':
        return {
          icon: 'shield' as const,
          activeLabel: 'NDA Shield: ON (Watermarked)',
          inactiveLabel: 'NDA Shield: OFF (Raw Proprietary)',
          activeTitle: 'Proprietary R&D Shield active: Dynamic forensic watermarking and strict IP hash verification enabled',
          inactiveTitle: 'Warning: Unwatermarked proprietary research data exposed',
          badgeText: 'NDA WATERMARKED',
          badgeColor: 'border-purple-500/30 bg-purple-950/80 text-purple-300',
          modalTitle: 'Proprietary NDA & Forensic Watermarking Shield Active',
          modalDesc:
            'All proprietary IP, experimental formulations, and sensor streams are dynamically fingerprinted with cryptographic watermarks before rendering.',
        };
      case 'geo_privacy':
      default:
        return {
          icon: 'shield' as const,
          activeLabel: 'Geo-Shield: ON (±10km Blur)',
          inactiveLabel: 'Geo-Shield: OFF (Raw Telemetry)',
          activeTitle: 'Geo-Privacy Shield is ACTIVE: Coordinates fuzzed (±10km conservation blur) to protect wildlife',
          inactiveTitle: 'Caution: Raw coordinates exposed to collaborators',
          badgeText: '±10km FUZZED GPS',
          badgeColor: 'border-emerald-500/30 bg-emerald-950/80 text-emerald-300',
          modalTitle: 'Ethics & Geo-Privacy Shield Active',
          modalDesc:
            'Specimen coordinates and camera EXIF metadata are fuzzed with a ±10km conservation blur to prevent poaching and habitat exploitation of vulnerable wildlife.',
        };
    }
  })();

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTROL BAR */}
      <div className="rounded-l2 border border-line bg-card p-4 shadow-l1 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Modality Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink uppercase tracking-wider mr-1">Modality:</span>
          {[
            { id: 'all', label: 'All Modalities' },
            { id: 'image', label: '📷 Images/Media' },
            { id: 'tabular', label: '📊 Tabular/CSV' },
            { id: 'text', label: '📝 Text/Corpus' },
            { id: 'audio', label: '🎙️ Audio/Sensor' },
          ].map((m) => {
            const isActive = modalityFilter === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setModalityFilter(m.id as any)}
                className={`rounded-control px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-crimson text-white border-crimson shadow-xs'
                    : 'bg-page text-muted hover:text-ink hover:bg-card border-line'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Right: Adaptive Privacy & Ethics Shield + Permit Badge + Add Record Modal */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Ethics & Permit Vault Trigger */}
          <button
            type="button"
            onClick={() => setEthicsDrawerOpen(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-control border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-all shadow-xs"
            title={`Open ${meta.complianceVaultTitle}`}
          >
            <span>📜</span>
            <span>Permit/IRB Shield</span>
          </button>

          {/* Adaptive Privacy Shield Toggle */}
          <button
            type="button"
            onClick={() => setGeoShieldActive(!geoShieldActive)}
            className={`cursor-pointer inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs ${
              geoShieldActive
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
            title={geoShieldActive ? shield.activeTitle : shield.inactiveTitle}
          >
            <Icon name={geoShieldActive ? 'shield' : 'globe'} size={14} />
            <span>{geoShieldActive ? shield.activeLabel : shield.inactiveLabel}</span>
          </button>

          {/* Add Record / Custom Field Button */}
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setIsAddingRecord(true)}
            className="cursor-pointer"
          >
            + Add Record / Custom Field
          </Button>
        </div>
      </div>

      {/* 2. MAIN SPLIT GRID (12 Columns: Left 8 Cols | Right 4 Cols) */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT 8 COLUMNS: Domain Gallery/Table OR Tech Snapshots */}
        {/* ========================================================= */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* DOMAIN VIEW: Gallery & Dense Table */}
          {showDomain && (
            <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-control bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <Icon name={(meta.icon as any) || 'camera'} size={14} />
                    </span>
                    <h3 className="text-base font-bold text-ink">
                      {meta.itemPlural || 'Specimens'} & Data Repository ({filteredSpecimens.length})
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {meta.desc || 'High-resolution field media, telemetry, taxonomy classifications, and morphometric logs.'}
                  </p>
                </div>

                {/* View Layout Toggle: Grid vs Table */}
                <div className="inline-flex rounded-control border border-line bg-page p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewLayout('grid')}
                    className={`px-2.5 py-1 rounded-control font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                      viewLayout === 'grid' ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <span>🖼️</span>
                    <span>Gallery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewLayout('table')}
                    className={`px-2.5 py-1 rounded-control font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                      viewLayout === 'table' ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <span>📋</span>
                    <span>Table View</span>
                  </button>
                </div>
              </div>

              {specimensResource.loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-64 rounded-l2" />
                  ))}
                </div>
              ) : filteredSpecimens.length === 0 ? (
                <div className="rounded-l2 border border-line bg-page/40 p-8 text-center text-xs text-muted">
                  No records match current modality filter. Click &quot;+ Add Record / Custom Field&quot; to log data.
                </div>
              ) : viewLayout === 'grid' ? (
                /* Grid Gallery View */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredSpecimens.map((spec, idx) => (
                    <div
                      key={spec.id}
                      data-testid={`specimen-card-${idx}`}
                      onClick={() => setSelectedSpecimenIndex(idx)}
                      className="group cursor-pointer overflow-hidden rounded-l1 border border-line bg-card shadow-xs hover:border-line-strong hover:shadow-md transition-all flex flex-col"
                    >
                      <div className="relative aspect-4/3 overflow-hidden bg-black/60">
                        <img
                          src={spec.media_url}
                          alt={spec.title}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-2 top-2 flex items-center justify-between">
                          <span className="rounded-pill bg-black/70 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                            {(spec.modality || spec.media_type).toUpperCase()}
                          </span>
                          <span
                            className={`rounded-pill px-2 py-0.5 text-[9px] font-mono backdrop-blur-sm flex items-center gap-1 ${
                              geoShieldActive
                                ? shield.badgeColor
                                : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            <Icon name={geoShieldActive ? 'shield' : 'globe'} size={9} />
                            {geoShieldActive ? shield.badgeText : 'RAW EXPOSED'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 flex flex-col flex-1 justify-between space-y-2">
                        <div>
                          <h4 className="text-xs font-bold text-ink group-hover:text-crimson transition-colors line-clamp-1">
                            {spec.title}
                          </h4>
                          <p className="text-[11px] italic text-muted mt-0.5 line-clamp-1">
                            {spec.taxonomy_species} {spec.common_name && `(${spec.common_name})`}
                          </p>
                        </div>

                        {spec.morphometrics && Object.keys(spec.morphometrics).length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[9px] font-mono">
                            {Object.entries(spec.morphometrics)
                              .filter(([k]) => k !== 'observation_source')
                              .slice(0, 2)
                              .map(([k, v]) => (
                                <span key={k} className="rounded bg-page px-1.5 py-0.5 border border-line/60 text-muted">
                                  {k.replace(/_/g, ' ')}: <strong className="text-ink">{String(v)}</strong>
                                </span>
                              ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-line/50 flex items-center justify-between text-[10px] text-muted">
                          <span>{spec.habitat || 'Vault Repository'}</span>
                          <span className="font-mono">{new Date(spec.observation_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Dense Domain Table View */
                <div className="overflow-x-auto border border-line rounded-control bg-page/30">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line bg-page/60 text-muted font-mono text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Record Title</th>
                        <th className="py-2.5 px-3">{meta.labelNoun || 'Classification'}</th>
                        <th className="py-2.5 px-3">Location / Habitat</th>
                        {activeCustomFields.slice(0, 2).map((cf) => (
                          <th key={cf.key} className="py-2.5 px-3">
                            {cf.label}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {filteredSpecimens.map((spec, idx) => (
                        <tr
                          key={spec.id}
                          onClick={() => setSelectedSpecimenIndex(idx)}
                          className="hover:bg-card/70 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3 font-bold text-ink">
                            <div className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-teal-500" />
                              <span className="line-clamp-1">{spec.title}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 italic text-muted">{spec.taxonomy_species}</td>
                          <td className="py-2.5 px-3 text-muted">{spec.habitat || 'Vault Repository'}</td>
                          {activeCustomFields.slice(0, 2).map((cf) => (
                            <td key={cf.key} className="py-2.5 px-3 font-mono text-muted">
                              {spec.morphometrics?.[cf.key] ?? '-'}
                            </td>
                          ))}
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-[11px] font-semibold text-crimson hover:underline">Inspect →</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TECH WORKBENCH VIEW: Immutable Dataset Snapshots & Leakage Guard */}
          {showTech && (
            <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-control bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Icon name="database" size={14} />
                    </span>
                    <h3 className="text-base font-bold text-ink">
                      Immutable Dataset Snapshots & Split Leakage Guard
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    Deterministic train/val/test splits with automated hash-based near-duplicate leakage detection.
                  </p>
                </div>
                <span className="rounded-control bg-blue-500/10 px-2.5 py-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                  {splits.length} Version Snapshots
                </span>
              </div>

              {splitsResource.loading ? (
                <Skeleton className="h-44 rounded-l1" />
              ) : splits.length === 0 ? (
                <div className="rounded-l1 border border-line bg-page/40 p-6 text-center text-xs text-muted">
                  No dataset split snapshots found for this area.
                </div>
              ) : (
                <div className="space-y-4">
                  {splits.map((s) => (
                    <div key={s.id} className="rounded-l1 border border-line bg-page/40 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-ink">{s.version_tag}</span>
                            <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] font-mono text-muted border border-line">
                              {s.total_samples.toLocaleString()} samples
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">{s.description}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <div>
                            Train: <strong className="text-emerald-600">{s.train_count.toLocaleString()}</strong>
                          </div>
                          <div>
                            Val: <strong className="text-blue-600">{s.val_count.toLocaleString()}</strong>
                          </div>
                          <div>
                            Test: <strong className="text-purple-600">{s.test_count.toLocaleString()}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Split Leakage Guard Panel */}
                      <SplitLeakageGuard split={s} onAuditComplete={() => splitsResource.reload()} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT 4 COLUMNS: HITL Expert Verification Flashcard Queue */}
        {/* ========================================================= */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <ExpertVerificationQueue
            areaId={area.id}
            scopedClient={scopedClient}
            discipline={area.discipline}
          />
        </div>
      </div>

      {/* 3. MODAL: Record Detail Viewer with Keyboard Arrow Navigation */}
      {selectedSpecimen && (
        <Modal
          open={!!selectedSpecimen}
          onClose={() => setSelectedSpecimenIndex(null)}
          title={`Record #${(selectedSpecimenIndex ?? 0) + 1}: ${selectedSpecimen.title}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Top Navigation Strip */}
            <div className="flex items-center justify-between border-b border-line pb-2.5 text-xs font-mono text-muted">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="arrowLeft"
                  disabled={selectedSpecimenIndex === 0}
                  onClick={() => setSelectedSpecimenIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                  className="cursor-pointer text-xs"
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="arrowRight"
                  disabled={selectedSpecimenIndex === filteredSpecimens.length - 1}
                  onClick={() =>
                    setSelectedSpecimenIndex((prev) =>
                      prev !== null && prev < filteredSpecimens.length - 1 ? prev + 1 : prev,
                    )
                  }
                  className="cursor-pointer text-xs"
                >
                  Next
                </Button>
                <span>
                  Record {(selectedSpecimenIndex ?? 0) + 1} of {filteredSpecimens.length}
                </span>
              </div>
              <span>Press ← or → arrow keys to flip</span>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-l1 bg-black">
              <img src={selectedSpecimen.media_url} alt={selectedSpecimen.title} className="size-full object-cover" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted block">{meta.labelNoun || 'Taxonomy Species'}</span>
                <span className="font-bold text-ink italic">{selectedSpecimen.taxonomy_species}</span>
              </div>
              <div>
                <span className="text-muted block">Common / Descriptive Name</span>
                <span className="font-bold text-ink">{selectedSpecimen.common_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block">
                  {shieldType === 'hipaa_dicom'
                    ? 'Clinical PHI Scrub'
                    : shieldType === 'nlp_pii'
                    ? 'Informant Redaction'
                    : 'GPS Telemetry'}
                </span>
                <span className="font-mono font-bold flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                  <Icon name={geoShieldActive ? 'shield' : 'globe'} size={13} />
                  {shieldType === 'hipaa_dicom'
                    ? geoShieldActive
                      ? 'HIPAA Safe Harbor (18 PHI Stripped)'
                      : 'Warning: Unscrubbed DICOM Tags'
                    : shieldType === 'nlp_pii'
                    ? geoShieldActive
                      ? 'Participant Identity Scrubbed'
                      : 'Warning: Unredacted Speaker Data'
                    : geoShieldActive
                    ? `${(Math.floor((selectedSpecimen.gps_lat ?? 0) * 10) / 10).toFixed(1)}0° N, ${(Math.floor((selectedSpecimen.gps_lng ?? 0) * 10) / 10).toFixed(1)}0° E (±10km Fuzzed)`
                    : `${selectedSpecimen.gps_lat?.toFixed(4)}° N, ${selectedSpecimen.gps_lng?.toFixed(4)}° E (Raw Telemetry)`}
                </span>
              </div>
              <div>
                <span className="text-muted block">Observation Date</span>
                <span className="font-mono text-ink">
                  {new Date(selectedSpecimen.observation_date).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Privacy Protection Banner */}
            <div
              className={`rounded-control p-3 text-xs space-y-1 border ${
                geoShieldActive
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200'
                  : 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Icon name={geoShieldActive ? 'shield' : 'alert'} size={14} />
                <span>{geoShieldActive ? shield.modalTitle : 'Caution: Raw Telemetry / PHI Exposed'}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                {geoShieldActive
                  ? shield.modalDesc
                  : 'Full high-precision coordinates or raw identifiers are exposed. Ensure this is only enabled within authenticated internal teams.'}
              </p>
            </div>

            <div className="rounded-control bg-page p-3 text-xs space-y-1">
              <span className="font-semibold text-muted block">Metadata & Observation Field Notes:</span>
              <p className="text-ink leading-relaxed">{selectedSpecimen.notes || 'No notes.'}</p>
            </div>

            {selectedSpecimen.morphometrics && (
              <div className="rounded-control border border-line p-3 text-xs space-y-2">
                <span className="font-semibold text-muted block">Custom Metadata & Metrics:</span>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  {Object.entries(selectedSpecimen.morphometrics).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-line/40 pb-1">
                      <span className="text-muted">{k.replace(/_/g, ' ')}:</span>
                      <span className="font-bold text-ink">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedSpecimenIndex(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. MODAL: Add Record / Custom Field Modal */}
      {isAddingRecord && (
        <Modal
          open={isAddingRecord}
          onClose={() => setIsAddingRecord(false)}
          title={`Add ${meta.itemNoun || 'Record'} & Custom Fields to Vault`}
          size="lg"
        >
          <div className="space-y-5">
            {/* Top tab to toggle: Add Data Record vs Add Custom Schema Column */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="inline-flex rounded-control border border-line bg-page p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsDefiningNewField(false)}
                  className={`px-3 py-1.5 rounded-control transition-all ${
                    !isDefiningNewField ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'
                  }`}
                >
                  1. Ingest Data Record
                </button>
                <button
                  type="button"
                  onClick={() => setIsDefiningNewField(true)}
                  className={`px-3 py-1.5 rounded-control transition-all flex items-center gap-1 ${
                    isDefiningNewField ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'
                  }`}
                >
                  <span>✨</span>
                  <span>2. Define Custom Domain Field</span>
                </button>
              </div>
              <span className="text-xs font-mono text-muted">
                {activeCustomFields.length} Custom Columns Active
              </span>
            </div>

            {isDefiningNewField ? (
              /* Inline Custom Field Creator */
              <form onSubmit={handleAddCustomFieldToSchema} className="space-y-4 text-xs">
                <div className="rounded-control bg-teal-500/10 p-3 text-teal-800 dark:text-teal-200 leading-relaxed">
                  <strong>Define Domain Column:</strong> Add custom attributes tailored to your field (e.g.,{' '}
                  <em>Patient Age Group</em>, <em>Dialect Region</em>, <em>Soil Salinity</em>, or <em>Scute Pattern</em>).
                  This immediately extends your area schema in PostgreSQL.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-ink block mb-1">Column Key (snake_case) *</label>
                    <input
                      type="text"
                      required
                      value={newFieldKey}
                      onChange={(e) => setNewFieldKey(e.target.value)}
                      placeholder="e.g. tumor_grade"
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Display Label *</label>
                    <input
                      type="text"
                      required
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      placeholder="e.g. Tumor Histology Grade"
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Data Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as any)}
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    >
                      <option value="text">Text / String</option>
                      <option value="number">Numeric</option>
                      <option value="category">Categorical</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Unit / Notation (Optional)</label>
                    <input
                      type="text"
                      value={newFieldUnit}
                      onChange={(e) => setNewFieldUnit(e.target.value)}
                      placeholder="e.g. mm, %, WHO Grade"
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <Button variant="secondary" onClick={() => setIsDefiningNewField(false)}>
                    Back to Record Ingestion
                  </Button>
                  <Button variant="primary" loading={savingField} icon="plus">
                    Add Column to Schema
                  </Button>
                </div>
              </form>
            ) : (
              /* Record Ingestion Form with Dynamic Custom Fields */
              <form onSubmit={handleCreateRecord} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-ink block mb-1">Record Title / Identifier *</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Specimen #04, Brain MRI Scan S6..."
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Data Modality</label>
                    <select
                      value={newModality}
                      onChange={(e) => setNewModality(e.target.value as any)}
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    >
                      <option value="image">📷 Image / Visual Scan</option>
                      <option value="tabular">📊 Tabular / CSV Record</option>
                      <option value="text">📝 Text / Linguistic Transcript</option>
                      <option value="audio">🎙️ Audio / Sensor Acoustic</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-ink block mb-1">{meta.labelNoun || 'Classification'} *</label>
                    <input
                      type="text"
                      required
                      value={newSpecies}
                      onChange={(e) => setNewSpecies(e.target.value)}
                      placeholder="Primary label / taxon..."
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink italic"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Common / Secondary Name</label>
                    <input
                      type="text"
                      value={newCommonName}
                      onChange={(e) => setNewCommonName(e.target.value)}
                      placeholder="Secondary descriptor..."
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-ink block mb-1">High-Res Media URL</label>
                  <input
                    type="url"
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    placeholder="https://... (or leave blank for placeholder media)"
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-ink block mb-1">Sampling Site / Hospital</label>
                    <input
                      type="text"
                      value={newHabitat}
                      onChange={(e) => setNewHabitat(e.target.value)}
                      placeholder="Field site or scanner..."
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Latitude</label>
                    <input
                      type="text"
                      value={newGpsLat}
                      onChange={(e) => setNewGpsLat(e.target.value)}
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs font-mono text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Longitude</label>
                    <input
                      type="text"
                      value={newGpsLng}
                      onChange={(e) => setNewGpsLng(e.target.value)}
                      className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs font-mono text-ink"
                    />
                  </div>
                </div>

                {/* Dynamic Custom Fields Inputs */}
                {activeCustomFields.length > 0 && (
                  <div className="rounded-control border border-line bg-page/40 p-3 space-y-2">
                    <span className="font-bold text-ink block">
                      Custom Domain Attributes ({activeCustomFields.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeCustomFields.map((cf) => (
                        <div key={cf.key}>
                          <label className="text-[11px] font-semibold text-muted block mb-1">
                            {cf.label} {cf.unit ? `(${cf.unit})` : ''}
                          </label>
                          <input
                            type={cf.type === 'number' ? 'number' : 'text'}
                            value={customAttributeValues[cf.key] ?? ''}
                            onChange={(e) =>
                              setCustomAttributeValues((prev) => ({ ...prev, [cf.key]: e.target.value }))
                            }
                            placeholder={`Enter ${cf.label.toLowerCase()}...`}
                            className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-ink block mb-1">Observation Notes</label>
                  <textarea
                    rows={2}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Field conditions, clinical annotations, scanner parameters..."
                    className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <Button variant="secondary" onClick={() => setIsAddingRecord(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" loading={savingRecord} icon="check">
                    Save Record to Vault
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* 5. Ethics, IRB & Permit Vault Drawer */}
      <EthicsPermitVaultDrawer
        open={ethicsDrawerOpen}
        onClose={() => setEthicsDrawerOpen(false)}
        areaId={area.id}
        areaName={area.name}
        scopedClient={scopedClient}
        customTitle={meta.complianceVaultTitle}
      />
    </div>
  );
}
