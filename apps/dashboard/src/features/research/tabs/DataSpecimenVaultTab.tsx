import { useState } from 'react';
import { Button, Icon, Modal, Skeleton, useResource } from '@layerto/ui';
import { useAreaVault } from '../ResearchAreaBoundary';
import { SplitLeakageGuard } from '../components/SplitLeakageGuard';
import type { DatasetSplitSnapshot, SpecimenItem } from '@layerto/types';

export function DataSpecimenVaultTab() {
  const { area, scopedClient, viewMode } = useAreaVault();
  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenItem | null>(null);
  const [isAddingSpecimen, setIsAddingSpecimen] = useState(false);

  // Form states for new specimen
  const [newTitle, setNewTitle] = useState('');
  const [newSpecies, setNewSpecies] = useState('');
  const [newCommonName, setNewCommonName] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newHabitat, setNewHabitat] = useState('');
  const [newGpsLat, setNewGpsLat] = useState('6.0329');
  const [newGpsLng, setNewGpsLng] = useState('80.2168');
  const [newNotes, setNewNotes] = useState('');
  const [savingSpecimen, setSavingSpecimen] = useState(false);

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

  const specimens = specimensResource.data || [];
  const splits = splitsResource.data || [];

  const handleCreateSpecimen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSpecies.trim()) return;

    setSavingSpecimen(true);
    try {
      await scopedClient.createSpecimen({
        area_id: area.id,
        title: newTitle.trim(),
        taxonomy_species: newSpecies.trim(),
        common_name: newCommonName.trim(),
        media_url: newMediaUrl.trim() || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
        media_type: 'photo',
        gps_lat: parseFloat(newGpsLat) || 0,
        gps_lng: parseFloat(newGpsLng) || 0,
        habitat: newHabitat.trim(),
        notes: newNotes.trim(),
        morphometrics: {
          scute_count: 4,
          observation_source: 'Field diver camera',
        },
      });
      setIsAddingSpecimen(false);
      setNewTitle('');
      setNewSpecies('');
      setNewCommonName('');
      setNewMediaUrl('');
      setNewHabitat('');
      setNewNotes('');
      specimensResource.reload();
    } catch (err) {
      console.error('Failed to create specimen', err);
    } finally {
      setSavingSpecimen(false);
    }
  };

  const showDomain = viewMode === 'domain' || viewMode === 'unified';
  const showTech = viewMode === 'tech' || viewMode === 'unified';

  return (
    <div className="space-y-8">
      {/* SECTION 1: SPECIMEN & MEDIA VAULT (Domain View) */}
      {showDomain && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-control bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Icon name="camera" size={14} />
                </span>
                <h3 className="text-base font-bold text-ink">
                  Specimen & Field Media Vault
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                High-resolution field media, GPS telemetry, taxonomy classifications, and morphometric logs.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => setIsAddingSpecimen(true)}
            >
              Add Specimen to Vault
            </Button>
          </div>

          {specimensResource.loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64 rounded-l2" />
              ))}
            </div>
          ) : specimens.length === 0 ? (
            <div className="rounded-l2 border border-line bg-card p-8 text-center text-sm text-muted">
              No specimens recorded in this research area yet. Click "Add Specimen to Vault" to log your first field observation.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {specimens.map((spec) => (
                <div
                  key={spec.id}
                  onClick={() => setSelectedSpecimen(spec)}
                  className="group cursor-pointer overflow-hidden rounded-l2 border border-line bg-card shadow-l1 hover:border-line-strong hover:shadow-l2 transition-all flex flex-col"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-black/50">
                    <img
                      src={spec.media_url}
                      alt={spec.title}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-2 top-2 flex items-center justify-between">
                      <span className="rounded-pill bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        {spec.media_type.toUpperCase()}
                      </span>
                      {spec.gps_lat && spec.gps_lng && (
                        <span className="rounded-pill bg-teal-950/80 px-2 py-0.5 text-[10px] font-mono text-teal-300 backdrop-blur-sm">
                          {spec.gps_lat.toFixed(2)}°N, {spec.gps_lng.toFixed(2)}°E
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 flex flex-col flex-1 justify-between space-y-2">
                    <div>
                      <h4 className="text-sm font-bold text-ink group-hover:text-crimson transition-colors line-clamp-1">
                        {spec.title}
                      </h4>
                      <p className="text-xs italic text-muted mt-0.5">
                        {spec.taxonomy_species} {spec.common_name && `(${spec.common_name})`}
                      </p>
                    </div>

                    {spec.morphometrics && Object.keys(spec.morphometrics).length > 0 && (
                      <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                        {Object.entries(spec.morphometrics).slice(0, 2).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded bg-page px-1.5 py-0.5 border border-line/60 text-muted"
                          >
                            {k.replace(/_/g, ' ')}: <strong className="text-ink">{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
                      <span>{spec.habitat || 'Coastal Reef'}</span>
                      <span className="font-mono">{new Date(spec.observation_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: DATASET & SPLIT INTEGRITY HUB (Tech Workbench View) */}
      {showTech && (
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-control bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Icon name="database" size={14} />
                </span>
                <h3 className="text-base font-bold text-ink">
                  Dataset Snapshots & Split Leakage Guard
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Immutable dataset versions, class distributions, and automated cross-split duplicate leakage detection.
              </p>
            </div>
            <span className="rounded-control bg-blue-500/10 px-3 py-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {splits.length} Version Snapshots
            </span>
          </div>

          {splitsResource.loading ? (
            <Skeleton className="h-44 rounded-l2" />
          ) : splits.length === 0 ? (
            <div className="rounded-l2 border border-line bg-card p-6 text-center text-sm text-muted">
              No dataset split snapshots found for this area.
            </div>
          ) : (
            <div className="space-y-4">
              {splits.map((s) => (
                <div key={s.id} className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-ink">{s.version_tag}</span>
                        <span className="rounded-pill bg-page px-2 py-0.5 text-[11px] font-mono text-muted border border-line">
                          {s.total_samples.toLocaleString()} total samples
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <div>Train: <strong className="text-emerald-600">{s.train_count.toLocaleString()}</strong></div>
                      <div>Val: <strong className="text-blue-600">{s.val_count.toLocaleString()}</strong></div>
                      <div>Test: <strong className="text-purple-600">{s.test_count.toLocaleString()}</strong></div>
                    </div>
                  </div>

                  {/* Class Balance Bars */}
                  {s.class_distribution && Object.keys(s.class_distribution).length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-muted block">Class Balance Distribution:</span>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Object.entries(s.class_distribution).map(([className, count]) => {
                          const pct = ((count / s.total_samples) * 100).toFixed(1);
                          return (
                            <div key={className} className="rounded bg-page p-2 border border-line text-xs font-mono">
                              <div className="flex justify-between text-muted text-[10px]">
                                <span className="truncate">{className}</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="mt-1 font-bold text-ink">{count.toLocaleString()}</div>
                              <div className="mt-1 h-1 w-full bg-line rounded-full overflow-hidden">
                                <div className="h-full bg-crimson" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Split Leakage Guard */}
                  <SplitLeakageGuard
                    split={s}
                    onAuditComplete={() => splitsResource.reload()}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Specimen Detail Viewer */}
      {selectedSpecimen && (
        <Modal
          open={!!selectedSpecimen}
          onClose={() => setSelectedSpecimen(null)}
          title={selectedSpecimen.title}
          size="lg"
        >
          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-l1 bg-black">
              <img
                src={selectedSpecimen.media_url}
                alt={selectedSpecimen.title}
                className="size-full object-cover"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-muted block">Taxonomy Species</span>
                <span className="font-bold text-ink italic">{selectedSpecimen.taxonomy_species}</span>
              </div>
              <div>
                <span className="text-muted block">Common Name</span>
                <span className="font-bold text-ink">{selectedSpecimen.common_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block">GPS Location</span>
                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                  {selectedSpecimen.gps_lat}° N, {selectedSpecimen.gps_lng}° E
                </span>
              </div>
              <div>
                <span className="text-muted block">Observation Date</span>
                <span className="font-mono text-ink">
                  {new Date(selectedSpecimen.observation_date).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="rounded-control bg-page p-3 text-xs space-y-1">
              <span className="font-semibold text-muted block">Habitat & Observation Field Notes:</span>
              <p className="text-ink-secondary leading-relaxed">{selectedSpecimen.notes || 'No field notes.'}</p>
            </div>

            {selectedSpecimen.morphometrics && (
              <div className="rounded-control border border-line p-3 text-xs space-y-2">
                <span className="font-semibold text-muted block">Morphometric Metrics:</span>
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
              <Button variant="secondary" onClick={() => setSelectedSpecimen(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Add Specimen Form */}
      {isAddingSpecimen && (
        <Modal
          open={isAddingSpecimen}
          onClose={() => setIsAddingSpecimen(false)}
          title="Add Specimen to Isolated Vault"
          size="md"
        >
          <form onSubmit={handleCreateSpecimen} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-ink block mb-1">Specimen Title / ID *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Green Turtle Adult Male (ID: SL-CM-048)"
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-ink block mb-1">Scientific Taxonomy *</label>
                <input
                  type="text"
                  required
                  value={newSpecies}
                  onChange={(e) => setNewSpecies(e.target.value)}
                  placeholder="e.g. Chelonia mydas"
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink italic"
                />
              </div>
              <div>
                <label className="font-semibold text-ink block mb-1">Common Name</label>
                <input
                  type="text"
                  value={newCommonName}
                  onChange={(e) => setNewCommonName(e.target.value)}
                  placeholder="e.g. Green Sea Turtle"
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
                placeholder="https://... (or leave blank for placeholder field photo)"
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-ink block mb-1">GPS Latitude</label>
                <input
                  type="text"
                  value={newGpsLat}
                  onChange={(e) => setNewGpsLat(e.target.value)}
                  placeholder="6.0329"
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs font-mono text-ink"
                />
              </div>
              <div>
                <label className="font-semibold text-ink block mb-1">GPS Longitude</label>
                <input
                  type="text"
                  value={newGpsLng}
                  onChange={(e) => setNewGpsLng(e.target.value)}
                  placeholder="80.2168"
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs font-mono text-ink"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Habitat Observation</label>
              <input
                type="text"
                value={newHabitat}
                onChange={(e) => setNewHabitat(e.target.value)}
                placeholder="e.g. Fringing coral reef, depth 6m, seagrass substrate"
                className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Observation Notes</label>
              <textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Condition, scute patterns, tag markers..."
                className="w-full rounded-control border border-line bg-page p-2.5 text-xs text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setIsAddingSpecimen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingSpecimen}>
                Save Specimen to Vault
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
