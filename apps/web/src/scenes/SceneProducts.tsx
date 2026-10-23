import { useCallback, useState } from 'react';
import { useMotionMode } from '@layerto/ui';
import type { ModelsState } from '../hooks/useModels';
import { DASHBOARD_URL } from '../config';
import { PRODUCTS } from './products/products';
import { LayerStack } from './products/LayerStack';
import { ProductPanel } from './products/ProductPanel';
import { VisionVisual } from './products/VisionVisual';
import { CharonVisual } from './products/CharonVisual';

const VISUALS = { vision: <VisionVisual />, charon: <CharonVisual /> };

const PRIMARY =
  'no-underline inline-flex items-center px-5 py-2.5 rounded-control bg-crimson dark:bg-crimson-fill text-white font-semibold hover:bg-crimson-hover dark:hover:bg-crimson active:scale-[0.98] transition-colors cursor-pointer';
const SECONDARY =
  'inline-flex items-center px-5 py-2.5 rounded-control border border-line-strong text-ink font-semibold hover:bg-crimson-tint hover:border-crimson-border active:scale-[0.98] transition-colors cursor-pointer';

/**
 * Products (Layerto Vision, Charon): a sticky 3D layer stack on the left (desktop) and one full-height panel
 * per product on the right. The product in view lifts out of the stack.
 */
export function SceneProducts({ onNavigate, models }: { onNavigate: (path: string) => void; models: ModelsState }) {
  const mode = useMotionMode();
  const [active, setActive] = useState(0);
  const onActive = useCallback((i: number) => setActive(i), []);
  const showStack = !mode.mobile;

  const select = (i: number) =>
    document.getElementById(`product-${PRODUCTS[i].id}`)?.scrollIntoView({ behavior: mode.reduced ? 'auto' : 'smooth', block: 'center' });

  const liveCount = models.status === 'ready' ? models.models.length : null;

  return (
    <section id="products" aria-labelledby="products-title" className="w-full bg-page pt-[12vh] pb-[6vh]">
      <div className="text-center px-4">
        <h2 id="products-title" className="text-3xl sm:text-5xl font-bold tracking-tight">
          Two products, one layer
        </h2>
        <p className="mt-3 text-muted text-base sm:text-lg max-w-[56ch] mx-auto">
          Layerto Vision lets your software see. Charon keeps your AI agents in check. Both are built on the same
          Layerto core: accounts, API keys, access checks and a tamper-evident ledger.
        </p>
      </div>

      <div className={`w-[96vw] mx-auto ${showStack ? 'grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-[3vw]' : ''}`}>
        {showStack && (
          <aside className="sticky top-0 h-[100svh] flex items-center" aria-label="Product layers">
            <LayerStack active={active} onSelect={select} />
          </aside>
        )}
        <div>
          {PRODUCTS.map((p, i) => (
            <ProductPanel
              key={p.id}
              product={p}
              index={i}
              onActive={onActive}
              visual={VISUALS[p.id]}
              fact={p.id === 'vision' && liveCount !== null ? `${liveCount} ${liveCount === 1 ? 'model' : 'models'} available right now.` : undefined}
              actions={
                p.id === 'vision' ? (
                  <>
                    <a href={DASHBOARD_URL} className={PRIMARY}>
                      Try it free
                    </a>
                    <button type="button" onClick={() => onNavigate('/docs')} className={SECONDARY}>
                      Read the docs
                    </button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
