import React, { useState } from 'react';
import { Button, Icon, Modal } from '@layerto/ui';
import type { LayertoClient } from '@layerto/api-client';
import type { NoteEvidenceItem, ResearchNote } from '@layerto/types';

interface RuledSheetComposerModalProps {
  open: boolean;
  onClose: () => void;
  areaId: string;
  nextEntryNumber: number;
  initialNote?: ResearchNote | null;
  scopedClient: LayertoClient;
  onSaved: () => void;
}

export function RuledSheetComposerModal({
  open,
  onClose,
  areaId,
  nextEntryNumber,
  initialNote,
  scopedClient,
  onSaved,
}: RuledSheetComposerModalProps) {
  const [title, setTitle] = useState(initialNote?.title || '');
  const [body, setBody] = useState(initialNote?.body || '');
  const [pinned, setPinned] = useState(initialNote?.pinned || false);
  const [evidenceList, setEvidenceList] = useState<NoteEvidenceItem[]>(initialNote?.evidence || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attachment input builders
  const [showImageAttach, setShowImageAttach] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageTitle, setNewImageTitle] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');

  const [showLinkAttach, setShowLinkAttach] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');

  const entryNumFormatted = String(
    initialNote?.entry_number ?? nextEntryNumber,
  ).padStart(2, '0');

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('ruled-composer-textarea') as HTMLTextAreaElement | null;
    if (!textarea) {
      setBody((prev) => `${prev}\n${prefix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    const replacement = `${prefix}${selectedText || 'Text'}${suffix}`;

    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText ? selectedText.length : 4));
    }, 50);
  };

  const handleAddImageEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim()) return;

    setEvidenceList((prev) => [
      ...prev,
      {
        kind: 'image',
        url: newImageUrl.trim(),
        title: newImageTitle.trim() || 'Evidence Photograph / Scan',
        caption: newImageCaption.trim() || undefined,
      },
    ]);

    setNewImageUrl('');
    setNewImageTitle('');
    setNewImageCaption('');
    setShowImageAttach(false);
  };

  const handleAddLinkEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkUrl.trim()) return;

    setEvidenceList((prev) => [
      ...prev,
      {
        kind: 'link',
        url: newLinkUrl.trim(),
        title: newLinkTitle.trim() || newLinkUrl.trim(),
      },
    ]);

    setNewLinkUrl('');
    setNewLinkTitle('');
    setShowLinkAttach(false);
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Please provide both an entry title and body observations.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (initialNote) {
        // Edit existing note
        await scopedClient.researchUpdate('notes', initialNote.id, {
          title: title.trim(),
          body: body.trim(),
          pinned,
          evidence: evidenceList,
        });
      } else {
        // Create new note
        await scopedClient.researchCreate('notes', {
          area_id: areaId,
          entry_number: nextEntryNumber,
          title: title.trim(),
          body: body.trim(),
          pinned,
          evidence: evidenceList,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save lab note', err);
      setError(err?.message || 'Failed to persist lab note to vault database.');
    } finally {
      setSaving(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeFormatted = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Lab Sheet Composer — Entry #${entryNumFormatted}`}
      size="xl"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="rounded-control bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Toolbar Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase font-bold text-muted mr-1.5">Style:</span>
            <button
              type="button"
              onClick={() => insertFormatting('### ')}
              className="px-2 py-1 rounded hover:bg-page text-xs font-bold text-ink border border-transparent hover:border-line transition-all cursor-pointer"
              title="Heading (###)"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('1. ')}
              className="px-2 py-1 rounded hover:bg-page text-xs font-bold text-ink border border-transparent hover:border-line transition-all cursor-pointer"
              title="Numbered List (1. )"
            >
              1. 2. 3.
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('- ')}
              className="px-2 py-1 rounded hover:bg-page text-xs font-bold text-ink border border-transparent hover:border-line transition-all cursor-pointer"
              title="Bullet List (- )"
            >
              • List
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('> [!NOTE]\n> ')}
              className="px-2 py-1 rounded hover:bg-page text-xs font-bold text-ink border border-transparent hover:border-line transition-all cursor-pointer"
              title="Callout Box (> [!NOTE])"
            >
              Callout
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('```\n', '\n```')}
              className="px-2 py-1 rounded hover:bg-page text-xs font-mono font-bold text-ink border border-transparent hover:border-line transition-all cursor-pointer"
              title="Code Block (```)"
            >
              &lt;/&gt;
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImageAttach(!showImageAttach)}
              className={`px-2.5 py-1 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showImageAttach
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-page hover:bg-card border-line text-ink'
              }`}
            >
              <Icon name="camera" size={13} />
              <span>Attach Image</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLinkAttach(!showLinkAttach)}
              className={`px-2.5 py-1 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showLinkAttach
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300'
                  : 'bg-page hover:bg-card border-line text-ink'
              }`}
            >
              <Icon name="link" size={13} />
              <span>Attach Citation</span>
            </button>

            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded border-line text-crimson focus:ring-crimson cursor-pointer"
              />
              <span>Pin Note</span>
            </label>
          </div>
        </div>

        {/* Pop-down builder: Image Evidence */}
        {showImageAttach && (
          <div className="rounded-control border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-xs animate-in fade-in">
            <span className="font-bold text-ink block">Attach Evidence Photo or Diagnostic Scan</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="url"
                required
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Image URL (https://...)"
                className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink sm:col-span-2"
              />
              <input
                type="text"
                value={newImageTitle}
                onChange={(e) => setNewImageTitle(e.target.value)}
                placeholder="Title (e.g. Axial T2 Scan)"
                className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newImageCaption}
                onChange={(e) => setNewImageCaption(e.target.value)}
                placeholder="Optional observation caption / clinical notes..."
                className="flex-1 rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
              />
              <Button type="button" size="sm" variant="primary" onClick={handleAddImageEvidence}>
                Add Image
              </Button>
            </div>
          </div>
        )}

        {/* Pop-down builder: Link Citation */}
        {showLinkAttach && (
          <div className="rounded-control border border-blue-500/30 bg-blue-500/5 p-3 space-y-2 text-xs animate-in fade-in">
            <span className="font-bold text-ink block">Attach Literature Link, DOI, or Protocol</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                required
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="Citation URL (https://pubmed.ncbi... or doi.org/...)"
                className="flex-1 min-w-[200px] rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
              />
              <input
                type="text"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                placeholder="Reference Title (e.g. Nature 2026)"
                className="w-48 rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
              />
              <Button type="button" size="sm" variant="primary" onClick={handleAddLinkEvidence}>
                Add Link
              </Button>
            </div>
          </div>
        )}

        {/* Existing Attached Evidence Pills */}
        {evidenceList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-muted">Attached Evidence ({evidenceList.length}):</span>
            {evidenceList.map((ev, i) => (
              <span
                key={i}
                className="rounded-pill bg-page px-2 py-0.5 text-xs border border-line text-ink flex items-center gap-1.5 font-mono shadow-xs"
              >
                <span>{ev.kind === 'image' ? '📷' : '🔗'}</span>
                <span className="max-w-[160px] truncate">{ev.title || ev.url}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveEvidence(i)}
                  className="text-muted hover:text-crimson ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* AUTHENTIC RULED PAPER SHEET CONTAINER */}
        <div className="relative rounded-l1 border border-line overflow-hidden shadow-inner bg-card">
          {/* Sheet Header Information Line */}
          <div className="flex flex-wrap items-center justify-between border-b-2 border-line/80 bg-page/60 px-5 py-2.5 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="rounded bg-crimson/10 px-2 py-0.5 font-bold text-crimson border border-crimson/20">
                ENTRY #{entryNumFormatted}
              </span>
              <span className="text-muted">|</span>
              <span className="text-muted">Lab Sheet No. {entryNumFormatted}</span>
            </div>
            <div className="flex items-center gap-3 text-muted">
              <span>Date: <strong className="text-ink font-semibold">{todayFormatted}</strong></span>
              <span>•</span>
              <span>Time: <strong className="text-ink font-semibold">{timeFormatted}</strong></span>
            </div>
          </div>

          {/* Title Line on Ruled Sheet */}
          <div className="px-5 pl-[64px] py-2.5 border-b border-line/60 bg-page/20">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Observation Entry Title / Subject..."
              className="w-full bg-transparent font-bold text-base text-ink focus:outline-none placeholder:text-muted/60"
            />
          </div>

          {/* Body Lines with precise 32px line rhythm and local scrolling attachment */}
          <div className="relative">
            <textarea
              id="ruled-composer-textarea"
              required
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Record detailed experimental observations, quantitative parameters, findings, and hypotheses..."
              className="w-full bg-transparent text-[14px] text-ink font-sans focus:outline-none resize-none pl-[64px] pr-5 py-0 placeholder:text-muted/50"
              style={{
                lineHeight: '32px',
                fontSize: '14px',
                backgroundImage: `
                  linear-gradient(to right, transparent 48px, rgba(239, 68, 68, 0.45) 48px, rgba(239, 68, 68, 0.45) 50px, transparent 50px),
                  linear-gradient(to bottom, transparent 31px, rgba(99, 102, 241, 0.22) 31px, rgba(99, 102, 241, 0.22) 32px)
                `,
                backgroundSize: '100% 100%, 100% 32px',
                backgroundRepeat: 'no-repeat, repeat-y',
                backgroundPosition: '0 0, 0 -8px',
                backgroundAttachment: 'local',
              }}
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <span className="text-[11px] text-muted font-mono">
            Strictly isolated to Area ID: {areaId.slice(0, 8)}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} icon="check" className="cursor-pointer">
              Save to Lab Notebook
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
