import { cn } from '../lib/cn';

/** Native pixel size of the logo PNG (never upscaled beyond this). */
export const LOGO_NATIVE_PX = 256;

export interface LayertoLogoProps {
  size?: number;
  className?: string;
  /** Leave empty when the word "Layerto" is shown next to the logo. */
  alt?: string;
  src?: string;
}

export function LayertoLogo({ size = 32, className, alt = '', src = '/brand/layerto-symbol.png' }: LayertoLogoProps) {
  const px = Math.max(1, Math.min(LOGO_NATIVE_PX, Math.round(size)));
  return (
    <img
      src={src}
      width={px}
      height={px}
      alt={alt}
      draggable={false}
      decoding="async"
      className={cn('block shrink-0 select-none', className)}
    />
  );
}
