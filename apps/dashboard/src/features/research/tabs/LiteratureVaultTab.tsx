import { useState, useMemo } from 'react';
import { Button, Icon, Skeleton, useResource } from '@layerto/ui';
import type { Reference } from '@layerto/types';
import { useAreaVault } from '../ResearchAreaBoundary';

type ReadingStatus = 'all' | 'to_read' | 'reading' | 'read';

interface ReferenceFormData {
  title: string;
  authors: string;
  year: number | '';
  venue: string;
  url: string;
  doi: string;
  bibtex: string;
  status: 'to_read' | 'reading' | 'read';
  rating: number;
  notes: string;
}

const DEFAULT_FORM: ReferenceFormData = {
  title: '',
  authors: '',
  year: new Date().getFullYear(),
  venue: '',
  url: '',
  doi: '',
  bibtex: '',
  status: 'to_read',
  rating: 4,
  notes: '',
};

export function LiteratureVaultTab() {
  const { area, scopedClient } = useAreaVault();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReadingStatus>('all');
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Reference | null>(null);
  const [deletingRefId, setDeletingRefId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ReferenceFormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Fetch literature references strictly scoped to this area
  const litResource = useResource<Reference[]>(
    () => scopedClient.literature({ area: area.id }),
    `literature-${area.id}`,
  );

  const references = litResource.data || [];

  // Filter & Search
  const filteredReferences = useMemo(() => {
    return references.filter((ref) => {
      if (statusFilter !== 'all' && ref.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = ref.title.toLowerCase().includes(q);
        const authMatch = ref.authors?.toLowerCase().includes(q);
        const venueMatch = ref.venue?.toLowerCase().includes(q);
        const doiMatch = ref.doi?.toLowerCase().includes(q);
        const notesMatch = ref.notes?.toLowerCase().includes(q);
        return titleMatch || authMatch || venueMatch || doiMatch || notesMatch;
      }
      return true;
    });
  }, [references, statusFilter, searchQuery]);

  // Statistics
  const totalCount = references.length;
  const toReadCount = references.filter((r) => r.status === 'to_read').length;
  const readingCount = references.filter((r) => r.status === 'reading').length;
  const readCount = references.filter((r) => r.status === 'read').length;

  // Citation Generators
  const copyCitation = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCitation(label);
    setTimeout(() => setCopiedCitation(null), 2500);
  };

  const getApaCitation = (ref: Reference) => {
    const authors = ref.authors || 'Unknown Author';
    const year = ref.year ? `(${ref.year})` : '(n.d.)';
    const venue = ref.venue ? ` ${ref.venue}.` : '';
    const doi = ref.doi ? ` https://doi.org/${ref.doi}` : ref.url ? ` ${ref.url}` : '';
    return `${authors} ${year}. ${ref.title}.${venue}${doi}`;
  };

  const getIeeeCitation = (ref: Reference, index = 1) => {
    const authors = ref.authors || 'Unknown';
    const venue = ref.venue ? `, ${ref.venue}` : '';
    const year = ref.year ? `, ${ref.year}` : '';
    return `[${index}] ${authors}, "${ref.title}"${venue}${year}.`;
  };

  const getBibtexCitation = (ref: Reference) => {
    if (ref.bibtex?.trim()) return ref.bibtex.trim();
    const citeKey = (ref.authors?.split(' ')[0] || 'ref') + (ref.year || '2026');
    return `@article{${citeKey.toLowerCase().replace(/[^a-z0-9]/g, '')},
  title={${ref.title}},
  author={${ref.authors || 'Unknown'}},
  journal={${ref.venue || 'Preprint'}},
  year={${ref.year || 2026}},
  doi={${ref.doi || ''}}
}`;
  };

  const handleOpenAdd = () => {
    setEditingRef(null);
    setFormData(DEFAULT_FORM);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (ref: Reference) => {
    setEditingRef(ref);
    setFormData({
      title: ref.title,
      authors: ref.authors || '',
      year: ref.year || '',
      venue: ref.venue || '',
      url: ref.url || '',
      doi: ref.doi || '',
      bibtex: ref.bibtex || '',
      status: ref.status || 'to_read',
      rating: ref.rating || 4,
      notes: ref.notes || '',
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSubmitting(true);
    try {
      const payload: Partial<Reference> = {
        area_id: area.id,
        title: formData.title.trim(),
        authors: formData.authors.trim(),
        year: formData.year ? Number(formData.year) : null,
        venue: formData.venue.trim(),
        url: formData.url.trim(),
        doi: formData.doi.trim(),
        bibtex: formData.bibtex.trim(),
        status: formData.status,
        rating: formData.rating,
        notes: formData.notes.trim(),
      };

      if (editingRef) {
        await scopedClient.updateLiterature(editingRef.id, payload);
      } else {
        await scopedClient.createLiterature(payload);
      }

      await litResource.reload();
      setIsAddOpen(false);
      setEditingRef(null);
    } catch (err) {
      console.error('Failed to save reference', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await scopedClient.deleteLiterature(id);
      await litResource.reload();
      setDeletingRefId(null);
    } catch (err) {
      console.error('Failed to delete reference', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-l2 border border-line bg-card p-4 shadow-xs">
          <div className="text-[11px] font-mono text-muted uppercase tracking-wider">Total Literature</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-ink">{totalCount}</span>
            <span className="text-xs text-muted">Papers cataloged</span>
          </div>
        </div>

        <div className="rounded-l2 border border-blue-500/20 bg-blue-500/5 p-4 shadow-xs">
          <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 uppercase tracking-wider">Currently Reading</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{readingCount}</span>
            <span className="text-xs text-muted">In synthesis</span>
          </div>
        </div>

        <div className="rounded-l2 border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Synthesized & Read</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{readCount}</span>
            <span className="text-xs text-muted">Cited in protocol</span>
          </div>
        </div>

        <div className="rounded-l2 border border-amber-500/20 bg-amber-500/5 p-4 shadow-xs">
          <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider">To Read Queue</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{toReadCount}</span>
            <span className="text-xs text-muted">Awaiting review</span>
          </div>
        </div>
      </div>

      {/* Main Reference Manager Container */}
      <div className="rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs space-y-5">
        {/* Header Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-control bg-crimson/10 text-crimson">
                <Icon name="book" size={15} />
              </span>
              <h3 className="text-sm font-bold text-ink">Academic Literature & Reference Vault</h3>
              <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] font-mono font-bold text-muted border border-line">
                Air-Gapped BibTeX Engine
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              Curate domain reference papers, synthesize prior art, and copy 1-click APA, IEEE, and BibTeX citations directly into your research manuscripts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={handleOpenAdd}
              className="cursor-pointer text-xs"
            >
              Add Reference Paper
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="inline-flex rounded-control border border-line bg-page p-1 text-xs font-semibold">
            {[
              { id: 'all', label: 'All References' },
              { id: 'reading', label: 'Reading' },
              { id: 'read', label: 'Read' },
              { id: 'to_read', label: 'To Read' },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as ReadingStatus)}
                  className={`rounded-control px-3 py-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-card text-ink shadow-xs font-bold border border-line/60'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <input
              type="text"
              placeholder="Search by title, author, venue, DOI..."
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
        </div>

        {/* Citation Copy Toast Alert */}
        {copiedCitation && (
          <div className="rounded-l2 border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-2">
              <Icon name="check" size={14} />
              <span>{copiedCitation}</span>
            </span>
            <span className="text-[10px] font-mono text-muted">Ready to paste into manuscript</span>
          </div>
        )}

        {/* Literature Papers List */}
        {litResource.loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-l2" />
            <Skeleton className="h-28 w-full rounded-l2" />
          </div>
        ) : filteredReferences.length === 0 ? (
          <div className="rounded-l2 border border-line bg-page/50 p-8 text-center space-y-3">
            <div className="flex size-10 items-center justify-center rounded-control bg-card mx-auto border border-line text-muted">
              <Icon name="book" size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-ink">No Literature References Found</h4>
              <p className="text-xs text-muted max-w-md mx-auto">
                {searchQuery
                  ? `No references matched "${searchQuery}". Clear your search query to see all papers.`
                  : 'Start cataloging foundational studies, benchmark papers, and field guides for this research area.'}
              </p>
            </div>
            <Button variant="secondary" size="sm" icon="plus" onClick={handleOpenAdd} className="cursor-pointer text-xs">
              Add First Paper
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReferences.map((ref, idx) => {
              const statusBadge =
                ref.status === 'read'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : ref.status === 'reading'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';

              const statusText =
                ref.status === 'read' ? 'Read' : ref.status === 'reading' ? 'In Progress' : 'To Read';

              return (
                <div
                  key={ref.id}
                  className="rounded-l2 border border-line bg-page/40 p-4 sm:p-5 shadow-xs hover:border-line-strong transition-all space-y-3"
                >
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-pill border px-2 py-0.5 text-[10px] font-semibold ${statusBadge}`}>
                          {statusText}
                        </span>
                        {ref.year && (
                          <span className="rounded-pill bg-card px-2 py-0.5 text-[10px] font-mono font-bold text-muted border border-line">
                            {ref.year}
                          </span>
                        )}
                        {ref.venue && (
                          <span className="text-xs font-semibold text-muted italic">
                            {ref.venue}
                          </span>
                        )}
                        {/* Rating Stars */}
                        <div className="flex items-center text-amber-500 text-xs pl-1">
                          {'★'.repeat(ref.rating || 0)}
                          {'☆'.repeat(5 - (ref.rating || 0))}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-ink leading-snug">
                        {ref.title}
                      </h4>

                      <p className="text-xs text-muted font-medium">
                        {ref.authors || 'Authors unlisted'}
                      </p>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ref)}
                        title="Edit Reference"
                        className="rounded-control border border-line bg-card p-1.5 text-muted hover:text-ink cursor-pointer transition-colors"
                      >
                        <Icon name="pen" size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRefId(ref.id)}
                        title="Delete Reference"
                        className="rounded-control border border-line bg-card p-1.5 text-muted hover:text-rose-600 cursor-pointer transition-colors"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Synthesis Notes */}
                  {ref.notes && (
                    <div className="rounded-l1 border border-line/80 bg-card p-3 text-xs text-ink/90 leading-relaxed font-sans space-y-1">
                      <span className="text-[10px] uppercase font-mono font-bold text-muted block">
                        Synthesis & Protocol Notes:
                      </span>
                      <p className="whitespace-pre-wrap">{ref.notes}</p>
                    </div>
                  )}

                  {/* Bottom Bar: Links & 1-Click Citation Copy Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/60 text-xs">
                    <div className="flex items-center gap-3 text-muted">
                      {ref.doi && (
                        <a
                          href={`https://doi.org/${ref.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-ink flex items-center gap-1 text-[11px] font-mono text-crimson"
                        >
                          <span>DOI: {ref.doi}</span>
                          <span>↗</span>
                        </a>
                      )}
                      {ref.url && (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-ink flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400"
                        >
                          <span>Paper Link</span>
                          <span>↗</span>
                        </a>
                      )}
                    </div>

                    {/* 1-Click Citation Buttons */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono font-bold text-muted">1-Click Citation:</span>
                      <button
                        type="button"
                        onClick={() => copyCitation(getApaCitation(ref), 'Copied APA 7th Citation!')}
                        className="rounded-control border border-line bg-card px-2 py-1 text-[11px] font-semibold text-ink hover:border-line-strong hover:bg-page transition-all cursor-pointer"
                      >
                        APA 7th
                      </button>
                      <button
                        type="button"
                        onClick={() => copyCitation(getIeeeCitation(ref, idx + 1), 'Copied IEEE Citation!')}
                        className="rounded-control border border-line bg-card px-2 py-1 text-[11px] font-semibold text-ink hover:border-line-strong hover:bg-page transition-all cursor-pointer"
                      >
                        IEEE
                      </button>
                      <button
                        type="button"
                        onClick={() => copyCitation(getBibtexCitation(ref), 'Copied BibTeX Entry!')}
                        className="rounded-control border border-line bg-card px-2 py-1 text-[11px] font-semibold text-ink hover:border-line-strong hover:bg-page transition-all cursor-pointer font-mono"
                      >
                        BibTeX
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingRefId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l2 border border-line bg-card p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Icon name="trash" size={16} />
              Confirm Delete Reference
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete this reference paper from your literature vault?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingRefId(null)} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDelete(deletingRefId)}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Delete Paper
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Reference Modal */}
      {(isAddOpen || editingRef) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l3 border border-line bg-card p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-sm font-bold text-ink">
                {editingRef ? 'Edit Reference Paper' : 'Add Reference Paper to Literature Vault'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingRef(null);
                }}
                className="text-muted hover:text-ink cursor-pointer"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Paper Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Improved allometric models to estimate the aboveground biomass of tropical trees"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Authors</label>
                  <input
                    type="text"
                    placeholder="e.g. Chave, J., Réjou-Méchain, M., et al."
                    value={formData.authors}
                    onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Publication Year</label>
                  <input
                    type="number"
                    min={1500}
                    max={2200}
                    placeholder="2026"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value ? Number(e.target.value) : '' })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Venue / Journal / Conference</label>
                  <input
                    type="text"
                    placeholder="e.g. Global Change Biology"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">DOI (Digital Object Identifier)</label>
                  <input
                    type="text"
                    placeholder="e.g. 10.1111/gcb.12629"
                    value={formData.doi}
                    onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Reading Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-hidden"
                  >
                    <option value="to_read">To Read</option>
                    <option value="reading">Reading</option>
                    <option value="read">Read</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Rating</label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink focus:border-crimson focus:outline-hidden"
                  >
                    <option value={5}>★★★★★ (5 Stars)</option>
                    <option value={4}>★★★★☆ (4 Stars)</option>
                    <option value={3}>★★★☆☆ (3 Stars)</option>
                    <option value={2}>★★☆☆☆ (2 Stars)</option>
                    <option value={1}>★☆☆☆☆ (1 Star)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Synthesis Notes & Methodology Takeaways</label>
                <textarea
                  rows={3}
                  placeholder="Key mathematical formulas, empirical findings, or critical baselines to incorporate into our own paper..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Raw BibTeX (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="@article{...}"
                  value={formData.bibtex}
                  onChange={(e) => setFormData({ ...formData, bibtex: e.target.value })}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-hidden resize-none font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingRef(null);
                  }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={submitting} className="cursor-pointer">
                  {editingRef ? 'Update Reference' : 'Save Reference'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
