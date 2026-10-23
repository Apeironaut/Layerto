import { useState, useMemo } from 'react';
import { Button, Icon, Skeleton, useResource } from '@layerto/ui';
import type { DatasetSplitSnapshot, ResearchArea, ResearchCustomField, SpecimenItem } from '@layerto/types';
import { useAreaVault } from '../ResearchAreaBoundary';

type SubView = 'tables' | 'datasets';

export function ObservationsDatasetsTab() {
  const { area, scopedClient, updateAreaLocally } = useAreaVault();
  const [subView, setSubView] = useState<SubView>('tables');
  const [searchQuery, setSearchQuery] = useState('');

  // Observation records
  const specimensResource = useResource<SpecimenItem[]>(
    () => scopedClient.specimens({ area: area.id }),
    `specimens-${area.id}`,
  );

  // Dataset splits & snapshots
  const splitsResource = useResource<DatasetSplitSnapshot[]>(
    () => scopedClient.datasetSplits({ area: area.id }),
    `dataset-splits-${area.id}`,
  );

  const rawRecords = specimensResource.data || [];
  const rawSplits = splitsResource.data || [];

  // Custom Columns from Area
  const customColumns: ResearchCustomField[] = area.custom_fields && area.custom_fields.length > 0
    ? area.custom_fields
    : [
        { key: 'sample_id', label: 'Sample / Transect ID', type: 'text' },
        { key: 'confidence_score', label: 'Confidence Score', type: 'number', unit: '%' },
      ];

  // Modals for Table View
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [deletingColumnKey, setDeletingColumnKey] = useState<string | null>(null);
  const [newColKey, setNewColKey] = useState('');
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<ResearchCustomField['type']>('text');
  const [newColUnit, setNewColUnit] = useState('');

  // Add / Edit / Delete Record
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [inspectingRecord, setInspectingRecord] = useState<SpecimenItem | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState({
    title: '',
    taxonomy_species: '',
    common_name: '',
    habitat: '',
    observation_date: new Date().toISOString().split('T')[0],
    notes: '',
    custom_attributes: {} as Record<string, any>,
  });

  // Dataset Split creation
  const [isAddSplitOpen, setIsAddSplitOpen] = useState(false);
  const [deletingSplitId, setDeletingSplitId] = useState<string | null>(null);
  const [splitForm, setSplitForm] = useState({
    version_tag: 'v1.0.0',
    description: '',
    train_count: 80,
    val_count: 10,
    test_count: 10,
    anonymized: true,
  });

  // Filter records
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return rawRecords;
    const q = searchQuery.toLowerCase().trim();
    return rawRecords.filter((r) => {
      return (
        r.title?.toLowerCase().includes(q) ||
        r.taxonomy_species?.toLowerCase().includes(q) ||
        r.common_name?.toLowerCase().includes(q) ||
        r.habitat?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    });
  }, [rawRecords, searchQuery]);

  // Column Actions
  const handleSaveColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColKey.trim() || !newColLabel.trim()) return;
    const cleanKey = newColKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (customColumns.some((c) => c.key === cleanKey)) {
      setIsAddColumnOpen(false);
      return;
    }

    const updatedCols: ResearchCustomField[] = [
      ...customColumns,
      {
        key: cleanKey,
        label: newColLabel.trim(),
        type: newColType,
        unit: newColUnit.trim() || undefined,
      },
    ];

    try {
      await scopedClient.updateArea(area.id, {
        custom_fields: updatedCols,
      } as Partial<ResearchArea>);
      updateAreaLocally({ custom_fields: updatedCols });
      setIsAddColumnOpen(false);
      setNewColKey('');
      setNewColLabel('');
      setNewColUnit('');
    } catch (err) {
      console.error('Failed to add custom column', err);
    }
  };

  const handleDeleteColumn = async (key: string) => {
    const updatedCols = customColumns.filter((c) => c.key !== key);
    try {
      await scopedClient.updateArea(area.id, {
        custom_fields: updatedCols,
      } as Partial<ResearchArea>);
      updateAreaLocally({ custom_fields: updatedCols });
      setDeletingColumnKey(null);
    } catch (err) {
      console.error('Failed to delete custom column', err);
    }
  };

  // Record CRUD
  const handleOpenAddRecord = () => {
    const initCustom: Record<string, any> = {};
    customColumns.forEach((c) => {
      initCustom[c.key] = '';
    });
    setRecordForm({
      title: '',
      taxonomy_species: '',
      common_name: '',
      habitat: '',
      observation_date: new Date().toISOString().split('T')[0],
      notes: '',
      custom_attributes: initCustom,
    });
    setIsAddRecordOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.title.trim()) return;

    try {
      const payload: Partial<SpecimenItem> = {
        area_id: area.id,
        title: recordForm.title.trim(),
        taxonomy_species: recordForm.taxonomy_species.trim() || 'Specimen',
        common_name: recordForm.common_name.trim(),
        habitat: recordForm.habitat.trim(),
        observation_date: recordForm.observation_date,
        notes: recordForm.notes.trim(),
        morphometrics: recordForm.custom_attributes,
        custom_attributes: recordForm.custom_attributes,
      };

      await scopedClient.createSpecimen(payload);
      await specimensResource.reload();
      setIsAddRecordOpen(false);
    } catch (err) {
      console.error('Failed to create observation record', err);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await scopedClient.deleteSpecimen(id);
      await specimensResource.reload();
      setDeletingRecordId(null);
      if (inspectingRecord?.id === id) setInspectingRecord(null);
    } catch (err) {
      console.error('Failed to delete record', err);
    }
  };

  // Dataset Split CRUD
  const handleSaveSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitForm.version_tag.trim()) return;

    try {
      const total = splitForm.train_count + splitForm.val_count + splitForm.test_count;
      const payload: Partial<DatasetSplitSnapshot> = {
        area_id: area.id,
        version_tag: splitForm.version_tag.trim(),
        description: splitForm.description.trim(),
        train_count: splitForm.train_count,
        val_count: splitForm.val_count,
        test_count: splitForm.test_count,
        total_samples: total,
        leakage_detected: false,
        created_at: new Date().toISOString(),
      };

      await scopedClient.createDatasetSplit(payload);
      await splitsResource.reload();
      setIsAddSplitOpen(false);
    } catch (err) {
      console.error('Failed to create dataset split', err);
    }
  };

  const handleDeleteSplit = async (id: string) => {
    try {
      await scopedClient.researchDelete('dataset-splits', id);
      await splitsResource.reload();
      setDeletingSplitId(null);
    } catch (err) {
      console.error('Failed to delete dataset split', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub-View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-crimson/10 text-crimson">
              <Icon name="camera" size={15} />
            </span>
            <h3 className="text-sm font-bold text-ink">Observations & Datasets Manager</h3>
            <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Zero-Trust Isolated Storage
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Maintain dynamic tabular observations with customizable schemas and versioned archive storage for reproducibility.
          </p>
        </div>

        {/* Dual Mode Switcher */}
        <div className="inline-flex rounded-control border border-line bg-page p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSubView('tables')}
            className={`rounded-control px-3.5 py-1.5 transition-all cursor-pointer flex items-center gap-2 ${
              subView === 'tables'
                ? 'bg-card text-ink shadow-xs font-bold border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span>📊 Structured Observations Table</span>
            <span className="rounded-pill bg-page px-1.5 py-0.2 text-[10px] font-mono border border-line">
              {rawRecords.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('datasets')}
            className={`rounded-control px-3.5 py-1.5 transition-all cursor-pointer flex items-center gap-2 ${
              subView === 'datasets'
                ? 'bg-card text-ink shadow-xs font-bold border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span>📁 Dataset Folders & Archives</span>
            <span className="rounded-pill bg-page px-1.5 py-0.2 text-[10px] font-mono border border-line">
              {rawSplits.length}
            </span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: STRUCTURED OBSERVATION TABLES */}
      {subView === 'tables' && (
        <div className="rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs space-y-5">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[280px]">
                <input
                  type="text"
                  placeholder="Search observation records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden pr-8"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-muted hover:text-ink text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="text-xs text-muted font-mono">{filteredRecords.length} records</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => setIsAddColumnOpen(true)}
                className="cursor-pointer text-xs"
              >
                + Add Custom Column
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="plus"
                onClick={handleOpenAddRecord}
                className="cursor-pointer text-xs"
              >
                + Add Record
              </Button>
            </div>
          </div>

          {/* Dynamic Table */}
          {specimensResource.loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-control" />
              <Skeleton className="h-16 w-full rounded-control" />
              <Skeleton className="h-16 w-full rounded-control" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-l2 border border-line bg-page/50 p-8 text-center space-y-3">
              <div className="flex size-10 items-center justify-center rounded-control bg-card mx-auto border border-line text-muted">
                <Icon name="camera" size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-ink">No Observation Records Logged</h4>
                <p className="text-xs text-muted max-w-md mx-auto">
                  {searchQuery
                    ? `No observation records match "${searchQuery}".`
                    : 'Log empirical field observations, clinical measurements, or corpus instances into this structured table.'}
                </p>
              </div>
              <Button variant="secondary" size="sm" icon="plus" onClick={handleOpenAddRecord} className="cursor-pointer text-xs">
                Log First Record
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-l2 border border-line">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line bg-page text-muted uppercase text-[10px] font-mono">
                    <th className="py-3 px-4 font-bold">Record Title / Sample</th>
                    <th className="py-3 px-4 font-bold">Taxonomy / Class</th>
                    <th className="py-3 px-4 font-bold">Location / Habitat</th>
                    <th className="py-3 px-4 font-bold">Date</th>
                    {/* Render Dynamic Custom Columns */}
                    {customColumns.map((col) => (
                      <th key={col.key} className="py-3 px-4 font-bold group">
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {col.unit && <span className="text-muted lowercase">({col.unit})</span>}
                          <button
                            type="button"
                            title={`Delete column ${col.label}`}
                            onClick={() => setDeletingColumnKey(col.key)}
                            className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-600 transition-opacity cursor-pointer text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-card">
                  {filteredRecords.map((rec) => {
                    const attrs = (rec.custom_attributes || rec.morphometrics || {}) as Record<string, any>;
                    return (
                      <tr key={rec.id} className="hover:bg-page/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-ink">
                          <button
                            type="button"
                            onClick={() => setInspectingRecord(rec)}
                            className="text-ink hover:text-crimson transition-colors font-bold text-left cursor-pointer"
                          >
                            {rec.title}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-muted">
                          <span className="italic">{rec.taxonomy_species || '—'}</span>
                          {rec.common_name && <span className="block text-[11px] text-muted">({rec.common_name})</span>}
                        </td>
                        <td className="py-3 px-4 text-muted">{rec.habitat || '—'}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-muted">
                          {rec.observation_date || '—'}
                        </td>
                        {/* Dynamic Column Values */}
                        {customColumns.map((col) => (
                          <td key={col.key} className="py-3 px-4 font-mono text-[11px] text-ink">
                            {attrs[col.key] !== undefined && attrs[col.key] !== null && attrs[col.key] !== ''
                              ? String(attrs[col.key])
                              : '—'}
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectingRecord(rec)}
                              title="Inspect Details"
                              className="rounded p-1 text-muted hover:text-ink cursor-pointer"
                            >
                              <Icon name="search" size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRecordId(rec.id)}
                              title="Delete Record"
                              className="rounded p-1 text-muted hover:text-rose-600 cursor-pointer"
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: DATASET FOLDERS & ARCHIVE STORAGE */}
      {subView === 'datasets' && (
        <div className="rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h4 className="text-sm font-bold text-ink">Versioned Dataset Splits & Reproducibility Archives</h4>
              <p className="text-xs text-muted mt-0.5">
                Cryptographically tracked data snapshots with automated train/val/test partitions and leak prevention.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => setIsAddSplitOpen(true)}
              className="cursor-pointer text-xs"
            >
              + Create Dataset Version
            </Button>
          </div>

          {splitsResource.loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-l2" />
              <Skeleton className="h-24 w-full rounded-l2" />
            </div>
          ) : rawSplits.length === 0 ? (
            <div className="rounded-l2 border border-line bg-page/50 p-8 text-center space-y-3">
              <div className="flex size-10 items-center justify-center rounded-control bg-card mx-auto border border-line text-muted">
                <Icon name="folder" size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-ink">No Dataset Archives Created</h4>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Package current observation records into a versioned dataset snapshot to preserve reproducibility or share with collaborators.
                </p>
              </div>
              <Button variant="secondary" size="sm" icon="plus" onClick={() => setIsAddSplitOpen(true)} className="cursor-pointer text-xs">
                Create First Snapshot
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rawSplits.map((split) => (
                <div
                  key={split.id}
                  className="rounded-l2 border border-line bg-page/40 p-4 shadow-xs hover:border-line-strong transition-all space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-control bg-page border border-line text-ink">
                        <Icon name="folder" size={14} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-bold text-ink">{split.version_tag}</h5>
                          <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-600 border border-emerald-500/20">
                            LEAK GUARD: {split.leakage_detected ? 'LEAK DETECTED' : 'PASSED'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeletingSplitId(split.id)}
                      title="Delete Split"
                      className="rounded p-1 text-muted hover:text-rose-600 cursor-pointer"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>

                  {split.description && (
                    <p className="text-xs text-muted leading-relaxed line-clamp-2">{split.description}</p>
                  )}

                  {/* Partition Breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line/60 text-center font-mono">
                    <div className="rounded bg-card p-2 border border-line">
                      <span className="text-[10px] text-muted block">Train</span>
                      <span className="text-xs font-bold text-ink">{split.train_count}</span>
                    </div>
                    <div className="rounded bg-card p-2 border border-line">
                      <span className="text-[10px] text-muted block">Validation</span>
                      <span className="text-xs font-bold text-ink">{split.val_count}</span>
                    </div>
                    <div className="rounded bg-card p-2 border border-line">
                      <span className="text-[10px] text-muted block">Test</span>
                      <span className="text-xs font-bold text-ink">{split.test_count}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                    <span>Total items: {split.total_samples || split.train_count + split.val_count + split.test_count}</span>
                    <span>Created: {new Date(split.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD CUSTOM COLUMN */}
      {isAddColumnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l3 border border-line bg-card p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-sm font-bold text-ink">Add Custom Column to Schema</h4>
              <button type="button" onClick={() => setIsAddColumnOpen(false)} className="text-muted hover:text-ink cursor-pointer">
                <Icon name="close" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveColumn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Column Label (Display Name) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Canopy Height, Core Necrosis Volume, Glyph Unicode"
                  value={newColLabel}
                  onChange={(e) => {
                    setNewColLabel(e.target.value);
                    if (!newColKey) {
                      setNewColKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Data Type</label>
                  <select
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value as any)}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-hidden"
                  >
                    <option value="text">Text / String</option>
                    <option value="number">Numeric (Continuous / Discrete)</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean (Yes / No)</option>
                    <option value="geo">Geo / Coordinates</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Unit (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. meters, mm³, %, dB"
                    value={newColUnit}
                    onChange={(e) => setNewColUnit(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddColumnOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="cursor-pointer">
                  Save Column
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE COLUMN CONFIRMATION */}
      {deletingColumnKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l2 border border-line bg-card p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Icon name="trash" size={16} />
              Confirm Delete Column
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete column <span className="font-mono font-bold text-ink">"{deletingColumnKey}"</span>?
              Historical values stored in records will no longer be visible in the table.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingColumnKey(null)} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDeleteColumn(deletingColumnKey)}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Delete Column
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD OBSERVATION RECORD */}
      {isAddRecordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l3 border border-line bg-card p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-sm font-bold text-ink">Log Observation Record</h4>
              <button type="button" onClick={() => setIsAddRecordOpen(false)} className="text-muted hover:text-ink cursor-pointer">
                <Icon name="close" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Record Title / Sample Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Canopy Quad #12 - Emergent Stratum"
                  value={recordForm.title}
                  onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Taxonomy / Classification</label>
                  <input
                    type="text"
                    placeholder="e.g. Entandrophragma cylindricum"
                    value={recordForm.taxonomy_species}
                    onChange={(e) => setRecordForm({ ...recordForm, taxonomy_species: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Common / Descriptive Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sapele Mahogany"
                    value={recordForm.common_name}
                    onChange={(e) => setRecordForm({ ...recordForm, common_name: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Habitat / Site Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Primary Lowland Forest Transect A"
                    value={recordForm.habitat}
                    onChange={(e) => setRecordForm({ ...recordForm, habitat: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Observation Date</label>
                  <input
                    type="date"
                    value={recordForm.observation_date}
                    onChange={(e) => setRecordForm({ ...recordForm, observation_date: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Dynamic Inputs for Custom Columns */}
              {customColumns.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-line">
                  <span className="text-xs font-bold text-ink block">Domain Custom Fields</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customColumns.map((col) => (
                      <div key={col.key}>
                        <label className="block text-[11px] font-semibold text-muted mb-1">
                          {col.label} {col.unit ? `(${col.unit})` : ''}
                        </label>
                        <input
                          type={col.type === 'number' ? 'number' : 'text'}
                          value={recordForm.custom_attributes[col.key] || ''}
                          onChange={(e) =>
                            setRecordForm({
                              ...recordForm,
                              custom_attributes: {
                                ...recordForm.custom_attributes,
                                [col.key]: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-control border border-line bg-page px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Field Observations & Protocol Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional context, instrumentation readings, or morphological anomalies..."
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddRecordOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="cursor-pointer">
                  Save Observation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE RECORD CONFIRMATION */}
      {deletingRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l2 border border-line bg-card p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Icon name="trash" size={16} />
              Confirm Delete Observation Record
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete this observation record from the isolated area vault?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingRecordId(null)} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDeleteRecord(deletingRecordId)}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Delete Record
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE DATASET SPLIT */}
      {isAddSplitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l3 border border-line bg-card p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-sm font-bold text-ink">Create Dataset Version / Split</h4>
              <button type="button" onClick={() => setIsAddSplitOpen(false)} className="text-muted hover:text-ink cursor-pointer">
                <Icon name="close" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveSplit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Version Tag *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v1.0.0-verified"
                  value={splitForm.version_tag}
                  onChange={(e) => setSplitForm({ ...splitForm, version_tag: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Description / Release Notes</label>
                <textarea
                  rows={2}
                  placeholder="Summary of this dataset release or benchmark partition..."
                  value={splitForm.description}
                  onChange={(e) => setSplitForm({ ...splitForm, description: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Train Count</label>
                  <input
                    type="number"
                    min={0}
                    value={splitForm.train_count}
                    onChange={(e) => setSplitForm({ ...splitForm, train_count: Number(e.target.value) })}
                    className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Val Count</label>
                  <input
                    type="number"
                    min={0}
                    value={splitForm.val_count}
                    onChange={(e) => setSplitForm({ ...splitForm, val_count: Number(e.target.value) })}
                    className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Test Count</label>
                  <input
                    type="number"
                    min={0}
                    value={splitForm.test_count}
                    onChange={(e) => setSplitForm({ ...splitForm, test_count: Number(e.target.value) })}
                    className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs text-ink"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddSplitOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="cursor-pointer">
                  Save Snapshot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE DATASET SPLIT CONFIRMATION */}
      {deletingSplitId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l2 border border-line bg-card p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Icon name="trash" size={16} />
              Confirm Delete Dataset Snapshot
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete this dataset split snapshot? Models trained on this version tag may lose reproducibility tracking.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingSplitId(null)} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDeleteSplit(deletingSplitId)}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Delete Snapshot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
