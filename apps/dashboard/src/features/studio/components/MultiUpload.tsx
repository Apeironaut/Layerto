import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Icon, cn } from '@layerto/ui';

const OK = ['image/jpeg', 'image/png', 'image/webp'];

/** Drop or browse for many images at once. */
export function MultiUpload({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const files = Array.from(list).filter((f) => OK.includes(f.type));
    if (files.length) onFiles(files);
  };
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Add images: drop them here or press Enter to browse"
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-l2 border-2 border-dashed px-6 py-8 text-center transition-colors',
        over ? 'border-crimson bg-crimson-tint' : 'border-line-strong hover:border-crimson',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <Icon name="upload" size={24} className="text-muted" />
      <p className="text-sm text-ink font-medium">Drop images here, or click to choose</p>
      <p className="text-xs text-muted">JPG, PNG or WebP · up to 200 per batch</p>
      <input
        ref={input}
        type="file"
        accept={OK.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
