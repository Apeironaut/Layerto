import { useRef, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { ResearchFile } from '@layerto/types';
import { Button, Card, ConfirmModal, EmptyState, Icon, Skeleton, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { bytes } from '../studio/lib/format';
import { timeAgo } from '../home/util';
import { AreaTag, useResearch } from './shared';

function iconFor(f: ResearchFile): 'image' | 'file' | 'chart' | 'box' | 'list' {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['csv', 'tsv', 'xlsx', 'json', 'parquet'].includes(ext)) return 'chart';
  if (['pt', 'pth', 'onnx', 'zip', 'tar', 'gz'].includes(ext)) return 'box';
  if (['py', 'ipynb', 'txt', 'md', 'yaml', 'yml', 'tex', 'bib'].includes(ext)) return 'list';
  return 'file';
}

/** Supplementary files (results tables, notebooks, figures, checkpoints) counted against research storage. */
export function FilesView() {
  const { area, canWrite } = useResearch();
  const notify = useNotify();
  const files = useResource(() => api.researchFiles(area || undefined), `research-files-${area}`);
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [deleting, setDeleting] = useState<ResearchFile | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (list: File[]) => {
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        await api.uploadResearchFile(file, area || undefined);
      } catch (err) {
        notify(errorMessage(err, `Couldn't upload ${file.name}.`), 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    void files.reload();
  };
  const download = async (f: ResearchFile) => {
    try {
      const blob = await api.getBlob(api.researchFilePath(f.id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      notify(errorMessage(err, "Couldn't download."), 'error');
    }
  };
  const remove = async () => {
    if (!deleting) return;
    try {
      await api.researchDelete('files', deleting.id);
      void files.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete."), 'error');
    } finally {
      setDeleting(null);
    }
  };
  const total = (files.data ?? []).reduce((s, f) => s + f.bytes, 0);

  return (
    <div className="space-y-4">
      {canWrite() && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(Array.from(e.dataTransfer.files));
          }}
          className={cn('flex flex-col items-center justify-center gap-2 rounded-l2 border-2 border-dashed px-6 py-8 text-center transition-colors', over ? 'border-crimson bg-crimson-tint/40' : 'border-line bg-card')}
        >
          <Icon name="upload" size={24} className="text-muted" />
          <p className="text-sm">
            Drop files here or{' '}
            <button type="button" className="font-semibold text-crimson cursor-pointer" onClick={() => input.current?.click()}>
              browse
            </button>
          </p>
          <p className="text-xs text-muted">Results tables, notebooks, figures, LaTeX sources, checkpoints. Up to 100 MB each; counts toward research storage.</p>
          {uploading > 0 && <p className="text-xs font-medium text-crimson">Uploading {uploading}…</p>}
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void upload(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
      )}
      {files.loading ? (
        <Skeleton className="h-40" />
      ) : (files.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="folder" title="No files yet" description="Keep the material behind your papers next to them." />
        </Card>
      ) : (
        <Card padded={false} title={undefined}>
          <div className="flex justify-between border-b border-line px-5 py-2.5 text-xs text-muted">
            <span>{files.data?.length} files</span>
            <span>{bytes(total)}</span>
          </div>
          <ul className="divide-y divide-line">
            {(files.data ?? []).map((f) => (
              <li key={f.id} className="group flex items-center gap-3 px-5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-page text-muted">
                  <Icon name={iconFor(f)} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => void download(f)} className="block max-w-full truncate text-left text-sm font-medium hover:text-crimson cursor-pointer">
                    {f.name}
                  </button>
                  <div className="text-[11px] text-muted">
                    {bytes(f.bytes)} · @{f.owner} · {timeAgo(f.created_at)}
                  </div>
                </div>
                <AreaTag id={f.area_id} />
                <Button size="sm" variant="ghost" icon="download" aria-label="Download" onClick={() => void download(f)} />
                {canWrite(f.area_id) && <Button size="sm" variant="ghost" icon="trash" aria-label="Delete" onClick={() => setDeleting(f)} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ConfirmModal isOpen={deleting !== null} title={`Delete ${deleting?.name ?? ''}?`} description="The file is removed from research storage." confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  );
}
