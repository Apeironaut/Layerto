import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, cn, validateImageFile } from '@layerto/ui';

export interface RunUploaderProps {
  files: File[];
  max: number;
  onChange: (files: File[]) => void;
  onProblem: (message: string) => void;
  disabled?: boolean;
}

/** Drop or pick several images; shows thumbnails that can be removed. */
export function RunUploader({ files, max, onChange, onProblem, disabled }: RunUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const problem = validateImageFile(f);
      if (problem) {
        onProblem(`${f.name}: ${problem}`);
        continue;
      }
      if (next.length >= max) {
        onProblem(`This workflow takes up to ${max} image${max === 1 ? '' : 's'} per run.`);
        break;
      }
      next.push(f);
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || files.length >= max}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          'w-full rounded-l2 border-2 border-dashed px-4 py-7 text-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          over ? 'border-crimson bg-crimson-tint' : 'border-line-strong hover:border-crimson hover:bg-crimson-tint/40',
        )}
      >
        <Icon name="upload" size={24} className="mx-auto text-crimson" />
        <span className="mt-2 block text-sm font-semibold">Drop images or click to choose</span>
        <span className="block text-xs text-muted">
          JPG, PNG or WebP, up to 10 MB each · {files.length}/{max}
        </span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={max > 1} hidden onChange={(e) => {
        add(e.target.files);
        e.target.value = '';
      }} />
      {files.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {files.map((f, i) => (
            <li key={urls[i]} className="group relative aspect-square rounded-control overflow-hidden border border-line bg-page">
              <img src={urls[i]} alt={f.name} className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-ink/70 px-1 text-[10px] font-bold text-white">{i}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.name}`}
                  className="absolute right-1 top-1 grid place-items-center h-6 w-6 rounded-full bg-card/90 text-ink opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-crimson hover:text-white cursor-pointer"
                >
                  <Icon name="close" size={12} strokeWidth={2.5} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
