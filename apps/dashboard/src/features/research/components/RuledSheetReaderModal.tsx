import { useEffect, useState } from 'react';
import { Button, Icon, Modal } from '@layerto/ui';
import type { NoteEvidenceItem, ResearchNote } from '@layerto/types';

interface RuledSheetReaderModalProps {
  open: boolean;
  onClose: () => void;
  notes: ResearchNote[];
  currentNoteIndex: number;
  onNavigateIndex: (newIndex: number) => void;
  onEditNote: (note: ResearchNote) => void;
}

export function RuledSheetReaderModal({
  open,
  onClose,
  notes,
  currentNoteIndex,
  onNavigateIndex,
  onEditNote,
}: RuledSheetReaderModalProps) {
  const note = notes[currentNoteIndex];
  const [lightboxImage, setLightboxImage] = useState<NoteEvidenceItem | null>(null);

  // Keyboard navigation for arrow keys and escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If lightbox is open, Escape closes lightbox first
      if (lightboxImage && e.key === 'Escape') {
        setLightboxImage(null);
        e.preventDefault();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentNoteIndex > 0) {
          onNavigateIndex(currentNoteIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentNoteIndex < notes.length - 1) {
          onNavigateIndex(currentNoteIndex + 1);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentNoteIndex, notes.length, lightboxImage, onNavigateIndex, onClose]);

  if (!note) return null;

  const entryNumFormatted = String(note.entry_number ?? currentNoteIndex + 1).padStart(2, '0');
  const dateFormatted = new Date(note.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeFormatted = new Date(note.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const images = note.evidence?.filter((e) => e.kind === 'image') || [];
  const links = note.evidence?.filter((e) => e.kind === 'link') || [];

  const hasPrevious = currentNoteIndex > 0;
  const hasNext = currentNoteIndex < notes.length - 1;

  // Body renderer strictly aligned to 32px notebook line rhythm
  const renderFormattedBody = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="text-[14px] text-ink font-sans leading-[32px] py-0 select-text">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-[15px] text-indigo-600 dark:text-indigo-400 leading-[32px] m-0 p-0">
                {trimmed.slice(4)}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="font-bold text-base text-crimson leading-[32px] m-0 p-0">
                {trimmed.slice(3)}
              </h3>
            );
          }
          if (trimmed.startsWith('> [!NOTE]')) {
            return (
              <div key={idx} className="leading-[32px] font-semibold text-xs text-blue-600 dark:text-blue-400 m-0 p-0">
                💡 NOTE: {trimmed.replace('> [!NOTE]', '').trim() || 'Key Observation'}
              </div>
            );
          }
          if (trimmed.startsWith('> ')) {
            return (
              <blockquote key={idx} className="border-l-2 border-crimson pl-2 italic text-ink/85 leading-[32px] m-0 p-0">
                {trimmed.slice(2)}
              </blockquote>
            );
          }
          if (/^\d+\.\s/.test(trimmed)) {
            return (
              <div key={idx} className="pl-2 font-medium leading-[32px] m-0 p-0">
                {trimmed}
              </div>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="pl-3 flex items-center gap-2 leading-[32px] m-0 p-0">
                <span className="size-1.5 rounded-full bg-crimson shrink-0" />
                <span>{trimmed.slice(2)}</span>
              </div>
            );
          }
          if (trimmed === '') {
            return <div key={idx} className="h-[32px] leading-[32px]" />;
          }
          return (
            <p key={idx} className="m-0 p-0 leading-[32px] break-words">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Lab Notebook Sheet — Entry #${entryNumFormatted}`}
        size="xl"
      >
        <div className="space-y-5">
          {/* Top Navigation & Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="arrowLeft"
                disabled={!hasPrevious}
                onClick={() => onNavigateIndex(currentNoteIndex - 1)}
                className="cursor-pointer text-xs"
              >
                Previous Note
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="arrowRight"
                disabled={!hasNext}
                onClick={() => onNavigateIndex(currentNoteIndex + 1)}
                className="cursor-pointer text-xs"
              >
                Next Note
              </Button>
              <span className="text-xs font-mono text-muted pl-2">
                Entry {currentNoteIndex + 1} of {notes.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon="pen"
                onClick={() => onEditNote(note)}
                className="cursor-pointer text-xs"
              >
                Edit Note
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
                className="cursor-pointer text-xs"
              >
                Close
              </Button>
            </div>
          </div>

          {/* AUTHENTIC RULED PAPER SHEET VIEWER */}
          <div className="relative rounded-l1 border border-line overflow-hidden shadow-inner bg-card">
            {/* Header Information Strip */}
            <div className="flex flex-wrap items-center justify-between border-b-2 border-line/80 bg-page/60 px-5 py-2.5 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="rounded bg-crimson/10 px-2.5 py-0.5 font-bold text-crimson border border-crimson/20">
                  ENTRY #{entryNumFormatted}
                </span>
                {note.pinned && (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    PINNED
                  </span>
                )}
                <span className="text-muted">Author: @{note.owner || 'lead_pi'}</span>
              </div>
              <div className="flex items-center gap-3 text-muted">
                <span>Recorded: <strong className="text-ink font-semibold">{dateFormatted}</strong></span>
                <span>•</span>
                <span>Time: <strong className="text-ink font-semibold">{timeFormatted}</strong></span>
              </div>
            </div>

            {/* Note Title Header Box */}
            <div className="px-5 pl-[64px] py-3 border-b border-line/60 bg-page/20">
              <h2 className="text-lg font-extrabold text-ink tracking-tight m-0">
                {note.title}
              </h2>
            </div>

            {/* Formatted Ruled Note Body - Words fit precisely on 32px ruled lines with -8px baseline */}
            <div
              className="relative px-5 pl-[64px] py-0 min-h-[300px]"
              style={{
                backgroundColor: 'var(--color-card, #ffffff)',
                backgroundImage: `
                  linear-gradient(to right, transparent 48px, rgba(239, 68, 68, 0.45) 48px, rgba(239, 68, 68, 0.45) 50px, transparent 50px),
                  linear-gradient(to bottom, transparent 31px, rgba(99, 102, 241, 0.22) 31px, rgba(99, 102, 241, 0.22) 32px)
                `,
                backgroundSize: '100% 100%, 100% 32px',
                backgroundRepeat: 'no-repeat, repeat-y',
                backgroundPosition: '0 0, 0 -8px',
              }}
            >
              {renderFormattedBody(note.body)}
            </div>
          </div>

          {/* EVIDENCE & ATTACHMENTS SECTION */}
          {(images.length > 0 || links.length > 0) && (
            <div className="rounded-control border border-line bg-page/40 p-4 space-y-4">
              <div className="flex items-center gap-2 border-b border-line/60 pb-2">
                <Icon name="folder" size={14} className="text-teal-500" />
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Attached Research Evidence & Citations ({images.length + links.length})
                </h4>
              </div>

              {/* Image Evidence Gallery */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted block">Evidence Scans & Photographs:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {images.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setLightboxImage(img)}
                        className="group cursor-pointer rounded-control border border-line bg-card overflow-hidden shadow-xs hover:border-line-strong hover:shadow-md transition-all flex flex-col"
                      >
                        <div className="relative aspect-4/3 overflow-hidden bg-black/60">
                          <img
                            src={img.url}
                            alt={img.title || 'Evidence scan'}
                            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span className="rounded bg-black/70 px-2 py-1 text-[11px] font-semibold text-white flex items-center gap-1 backdrop-blur-sm">
                              <Icon name="search" size={12} />
                              <span>Enlarge</span>
                            </span>
                          </div>
                        </div>
                        <div className="p-2.5 space-y-1">
                          <div className="text-xs font-bold text-ink line-clamp-1 group-hover:text-crimson transition-colors">
                            {img.title || `Evidence Image #${i + 1}`}
                          </div>
                          {img.caption && (
                            <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                              {img.caption}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations & Literature Links */}
              {links.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-semibold text-muted block">Literature & Protocol Citations:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {links.map((lnk, i) => (
                      <a
                        key={i}
                        href={lnk.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-control border border-line bg-card p-2.5 text-xs flex items-center justify-between hover:border-blue-500 hover:text-blue-600 transition-all shadow-xs group"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="text-blue-500 font-bold shrink-0">🔗</span>
                          <span className="font-semibold text-ink group-hover:text-blue-600 truncate">
                            {lnk.title || lnk.url}
                          </span>
                        </div>
                        <Icon name="arrowRight" size={13} className="text-muted group-hover:text-blue-600 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Helper Footer */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-line text-xs font-mono text-muted">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-page border border-line text-[10px] font-mono">←</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-page border border-line text-[10px] font-mono">→</kbd>
              <span>Press Left or Right arrow keys to flip between sequential notes</span>
            </span>
            <span className="text-[11px]">
              Press <kbd className="px-1 py-0.5 rounded bg-page border border-line text-[10px] font-mono">ESC</kbd> to exit
            </span>
          </div>
        </div>
      </Modal>

      {/* LIGHTBOX POPUP FOR EVIDENCE SCANS */}
      {lightboxImage && (
        <Modal
          open={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          title={lightboxImage.title || 'Evidence High-Resolution Inspection'}
          size="xl"
        >
          <div className="space-y-3">
            <div className="relative aspect-video max-h-[70vh] overflow-hidden rounded-control bg-black flex items-center justify-center">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            {lightboxImage.caption && (
              <div className="rounded-control bg-page p-3 text-xs text-ink leading-relaxed border border-line">
                <span className="font-semibold text-muted block mb-0.5">Observation Annotation:</span>
                <p>{lightboxImage.caption}</p>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setLightboxImage(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
