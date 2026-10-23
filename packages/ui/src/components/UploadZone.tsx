import { useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Returns an error message, or null if the file can be sent to the API. */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'This image is over 10 MB. Use a smaller one.';
  return null;
}

export interface UploadZoneProps {
  onFile: (file: File) => void;
  onInvalid?: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Drop, paste or browse for one image. Invalid files are reported via onInvalid. */
export function UploadZone({ onFile, onInvalid, disabled = false, className }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = (file: File | undefined) => {
    if (!file || disabled) return;
    const problem = validateImageFile(file);
    if (problem) onInvalid?.(problem);
    else onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label="Upload an image: drop, paste or press Enter to browse"
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
      onPaste={(e: ClipboardEvent) => take(e.clipboardData.files?.[0])}
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-8 text-center rounded-l1 border-2 border-dashed select-none',
        'transition-[border-color,background-color,transform] duration-200',
        'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
        dragOver ? 'border-crimson bg-crimson-tint/50 scale-[1.01]' : 'border-line-strong hover:border-crimson hover:bg-crimson-tint/25',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="h-12 w-12 rounded-full bg-crimson-tint text-crimson flex items-center justify-center">
        <Icon name="upload" size={22} />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">
          Drop an image, paste it, or <span className="text-crimson underline underline-offset-2">browse</span>
        </p>
        <p className="text-xs text-muted mt-1">JPG, PNG or WebP, up to 10 MB</p>
      </div>
    </div>
  );
}
