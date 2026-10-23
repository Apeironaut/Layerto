import { useEffect, useState } from 'react';
import { cn } from '@layerto/ui';
import { api } from '../../../lib/api';

/** Loads a private image with the session cookie and shows it once it arrives. */
export function AuthImage({ path, alt, className, onLoad }: { path: string; alt: string; className?: string; onLoad?: (img: HTMLImageElement) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    setUrl(null);
    setFailed(false);
    api
      .getBlob(path)
      .then((b) => {
        if (!alive) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [path]);
  if (failed) return <div className={cn('flex items-center justify-center bg-page text-xs text-muted', className)}>Unavailable</div>;
  if (!url) return <div className={cn('animate-pulse bg-line/60', className)} />;
  return <img src={url} alt={alt} className={className} draggable={false} onLoad={(e) => onLoad?.(e.currentTarget)} />;
}
