import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { Chip, useMotionMode } from '@layerto/ui';
import type { Product } from './products';

export interface ProductPanelProps {
  product: Product;
  index: number;
  visual: ReactNode;
  /** Extra line under the tagline, e.g. a live model count. */
  fact?: ReactNode;
  actions?: ReactNode;
  onActive: (index: number) => void;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-crimson">{title}</h4>
      <p className="mt-2 text-ink-secondary leading-relaxed">{children}</p>
    </div>
  );
}

/** One product as a full-height card: what it is, who it's for, what you get. */
export function ProductPanel({ product, index, visual, fact, actions, onActive }: ProductPanelProps) {
  const mode = useMotionMode();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const y = useTransform(scrollYProgress, [0, 1], [90, 0]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [Math.min(mode.maxRotate, 14), 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  return (
    <section
      ref={ref}
      id={`product-${product.id}`}
      aria-labelledby={`product-${product.id}-title`}
      className="min-h-[100svh] flex items-center py-[6vh] [perspective:1400px]"
    >
      <motion.article
        className="w-full rounded-l1 border border-line bg-card shadow-l2 p-6 sm:p-10 transition-colors hover:border-crimson-border"
        style={mode.reduced ? undefined : { y, rotateX, opacity }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-muted">0{index + 1}</span>
          <Chip variant={product.status.variant}>{product.status.label}</Chip>
        </div>
        <h3 id={`product-${product.id}-title`} className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">
          {product.name}
        </h3>
        <p className="mt-2 text-lg sm:text-xl text-ink-secondary">{product.tagline}</p>
        {fact && <p className="mt-2 text-sm text-muted">{fact}</p>}

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <Block title="What it does">{product.what}</Block>
            <Block title="Who it's for">{product.who}</Block>
            <ul className="space-y-2">
              {product.points.map((pt) => (
                <li key={pt} className="flex gap-3 text-sm text-ink-secondary">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" />
                  {pt}
                </li>
              ))}
            </ul>
            {actions && <div className="flex flex-wrap gap-3 pt-2">{actions}</div>}
          </div>
          {visual}
        </div>
      </motion.article>
    </section>
  );
}
