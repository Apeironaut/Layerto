import { useState, useMemo } from 'react';
import { Button, Icon, Skeleton, useResource } from '@layerto/ui';
import { RuledSheetComposerModal } from './RuledSheetComposerModal';
import { RuledSheetReaderModal } from './RuledSheetReaderModal';
import type { LayertoClient } from '@layerto/api-client';
import type { ResearchNote } from '@layerto/types';

interface LabNotebookScratchpadProps {
  areaId: string;
  areaName: string;
  scopedClient: LayertoClient;
}

type SortOption = 'newest' | 'oldest' | 'entry_number';

export function LabNotebookScratchpad({
  areaId,
  areaName,
  scopedClient,
}: LabNotebookScratchpadProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Modals state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ResearchNote | null>(null);

  const [readerOpen, setReaderOpen] = useState(false);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);

  // Load notes strictly scoped to areaId
  const notesResource = useResource<ResearchNote[]>(
    () => scopedClient.notes({ area: areaId }),
    `notes-${areaId}`,
  );

  const rawNotes = notesResource.data || [];

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    let result = rawNotes.filter((n) => n.area_id === areaId);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((n) => {
        const titleMatch = n.title.toLowerCase().includes(q);
        const bodyMatch = n.body.toLowerCase().includes(q);
        const numMatch =
          n.entry_number !== undefined &&
          (`#${n.entry_number}`.includes(q) || String(n.entry_number).includes(q));
        return titleMatch || bodyMatch || numMatch;
      });
    }

    // Sort notes
    return [...result].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      if (sortOption === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOption === 'entry_number') {
        return (a.entry_number ?? 0) - (b.entry_number ?? 0);
      }
      return 0;
    });
  }, [rawNotes, areaId, searchQuery, sortOption]);

  const nextEntryNumber = useMemo(() => {
    const areaNotes = rawNotes.filter((n) => n.area_id === areaId);
    if (areaNotes.length === 0) return 1;
    const maxEntry = Math.max(...areaNotes.map((n) => n.entry_number ?? 0));
    return maxEntry + 1;
  }, [rawNotes, areaId]);

  const handleOpenReader = (index: number) => {
    setSelectedNoteIndex(index);
    setReaderOpen(true);
  };

  const handleEditFromReader = (noteToEdit: ResearchNote) => {
    setReaderOpen(false);
    setEditingNote(noteToEdit);
    setIsComposerOpen(true);
  };

  return (
    <div className="rounded-l2 border border-line bg-card p-5 shadow-l1 space-y-4 flex flex-col h-full min-h-[580px]">
      {/* 1. HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-control bg-crimson/10 text-crimson">
            <Icon name="pen" size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-ink">Lab Notebook & Field Scratchpad</h3>
              <span className="rounded-pill bg-crimson/10 px-2 py-0.5 text-xs font-mono font-bold text-crimson border border-crimson/20">
                {rawNotes.filter((n) => n.area_id === areaId).length} Notes
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Sequential research observations & evidence attachments ({areaName})
            </p>
          </div>
        </div>

        {/* Prominent + Add Entry Button */}
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          onClick={() => {
            setEditingNote(null);
            setIsComposerOpen(true);
          }}
          className="cursor-pointer font-bold shadow-xs flex items-center gap-1.5"
          title="Open authentic Ruled Research Lab Sheet composer"
        >
          <span>Add Note</span>
        </Button>
      </div>

      {/* 2. SEARCH & SORT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Search input */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            <Icon name="search" size={13} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes or #number..."
            className="w-full rounded-control border border-line bg-page pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-crimson"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted shrink-0">Sort:</span>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="rounded-control border border-line bg-page px-2 py-1.5 text-xs text-ink cursor-pointer focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="entry_number">Entry Number (#1, #2...)</option>
          </select>
        </div>
      </div>

      {/* 3. CHRONOLOGICAL NOTE LIST CONTAINER */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 max-h-[520px]">
        {notesResource.loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-l1" />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-l1 border border-dashed border-line bg-page/40 p-8 text-center space-y-2.5 my-auto">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-crimson/10 text-crimson">
              <Icon name="pen" size={20} />
            </div>
            <h4 className="text-sm font-bold text-ink">
              {searchQuery ? 'No matching notebook entries' : 'Notebook Scratchpad Empty'}
            </h4>
            <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
              {searchQuery
                ? `No entries match "${searchQuery}". Clear your search query to see all notes.`
                : 'Click "+ Add Note" to open the authentic Ruled Lab Sheet and log your first experimental observation.'}
            </p>
            {!searchQuery && (
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => {
                  setEditingNote(null);
                  setIsComposerOpen(true);
                }}
                className="cursor-pointer"
              >
                Log Entry #01
              </Button>
            )}
          </div>
        ) : (
          filteredNotes.map((n, idx) => {
            const entryNumStr = String(n.entry_number ?? idx + 1).padStart(2, '0');
            const imgCount = n.evidence?.filter((e) => e.kind === 'image').length || 0;
            const linkCount = n.evidence?.filter((e) => e.kind === 'link').length || 0;

            const dateStr = new Date(n.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = new Date(n.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={n.id}
                onClick={() => handleOpenReader(idx)}
                className="group cursor-pointer rounded-l1 border border-line bg-card p-3.5 shadow-xs hover:border-line-strong hover:shadow-md transition-all space-y-2 relative"
              >
                {/* Top strip */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-crimson/10 px-2 py-0.5 font-mono text-[11px] font-bold text-crimson border border-crimson/20">
                      #{entryNumStr}
                    </span>
                    <h4 className="font-bold text-ink group-hover:text-crimson transition-colors line-clamp-1">
                      {n.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {n.pinned && (
                      <span className="rounded-pill bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        PINNED
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-muted">
                      {dateStr} • {timeStr}
                    </span>
                  </div>
                </div>

                {/* Excerpt Body */}
                <p className="text-xs text-muted leading-relaxed line-clamp-2">
                  {n.body.replace(/[#*>]/g, '').trim()}
                </p>

                {/* Bottom metadata & pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/50 text-[11px]">
                  <div className="flex items-center gap-2 text-muted">
                    <span className="rounded bg-page px-1.5 py-0.5 border border-line text-[10px]">
                      @{n.owner || 'lead_pi'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {imgCount > 0 && (
                      <span className="rounded-pill bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <span>📷</span>
                        <span>{imgCount} {imgCount === 1 ? 'Image' : 'Images'}</span>
                      </span>
                    )}
                    {linkCount > 0 && (
                      <span className="rounded-pill bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-800 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                        <span>🔗</span>
                        <span>{linkCount} {linkCount === 1 ? 'Link' : 'Links'}</span>
                      </span>
                    )}
                    <span className="text-muted group-hover:text-crimson transition-colors text-xs font-semibold pl-1 flex items-center gap-0.5">
                      <span>View</span>
                      <Icon name="arrowRight" size={11} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* COMPOSER POPUP (RULED PAPER SHEET) */}
      {isComposerOpen && (
        <RuledSheetComposerModal
          open={isComposerOpen}
          onClose={() => {
            setIsComposerOpen(false);
            setEditingNote(null);
          }}
          areaId={areaId}
          nextEntryNumber={nextEntryNumber}
          initialNote={editingNote}
          scopedClient={scopedClient}
          onSaved={() => notesResource.reload()}
        />
      )}

      {/* READER POPUP WITH ARROW KEY NAVIGATION */}
      {readerOpen && (
        <RuledSheetReaderModal
          open={readerOpen}
          onClose={() => setReaderOpen(false)}
          notes={filteredNotes}
          currentNoteIndex={selectedNoteIndex}
          onNavigateIndex={(newIdx) => setSelectedNoteIndex(newIdx)}
          onEditNote={handleEditFromReader}
        />
      )}
    </div>
  );
}
