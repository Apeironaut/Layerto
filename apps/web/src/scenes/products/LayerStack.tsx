import { motion } from 'framer-motion';
import { cn } from '@layerto/ui';
import { PRODUCTS } from './products';

/** Bottom → top: the vision API, then the agent control layer. */
const LAYER_ORDER = ['vision', 'charon'] as const;
const GAP = 64;

export interface LayerStackProps {
  active: number;
  onSelect: (index: number) => void;
}

/**
 * An isometric stack of slabs, one per product. The product in view lifts
 * out of the stack in crimson; the legend below doubles as navigation.
 */
export function LayerStack({ active, onSelect }: LayerStackProps) {
  const activeId = PRODUCTS[active]?.id;
  return (
    <div className="w-full flex flex-col items-center gap-10">
      <div className="relative w-full max-w-[26rem] aspect-square [perspective:1600px]" aria-hidden="true">
        <div className="absolute inset-0 transform-3d" style={{ transform: 'rotateX(58deg) rotateZ(-42deg)' }}>
          {LAYER_ORDER.map((id, layer) => {
            const on = id === activeId;
            return (
              <motion.div
                key={id}
                className={cn(
                  'absolute inset-[16%] rounded-l1 border transition-colors duration-300',
                  on ? 'bg-crimson dark:bg-crimson-fill border-transparent' : 'bg-card border-line-strong',
                )}
                initial={false}
                animate={{ z: layer * GAP + (on ? 70 : 0), opacity: on ? 1 : 0.85 }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                style={{ boxShadow: on ? '0 40px 80px -20px rgba(163,18,42,0.55)' : '0 20px 40px -20px rgba(0,0,0,0.25)' }}
              >
                <span className={cn('absolute left-5 bottom-4 font-bold text-lg', on ? 'text-white' : 'text-muted')}>
                  {PRODUCTS.find((p) => p.id === id)?.name}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <ol className="w-full max-w-[26rem] space-y-2" aria-label="Products">
        {PRODUCTS.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === active ? 'true' : undefined}
              className={cn(
                'w-full flex items-center gap-4 rounded-l2 border px-4 py-3 text-left cursor-pointer transition-colors',
                i === active ? 'border-crimson-border bg-crimson-tint' : 'border-transparent hover:bg-card',
              )}
            >
              <span className={cn('font-mono text-sm', i === active ? 'text-crimson' : 'text-muted')}>0{i + 1}</span>
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-xs text-muted">{p.status.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
