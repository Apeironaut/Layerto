import type { PublicModelItem } from '@layerto/types';
import { Chip, TiltCard, usd } from '@layerto/ui';

/** One model's live price. */
export function ModelPriceCard({ model, onOpen }: { model: PublicModelItem; onOpen: () => void }) {
  return (
    <TiltCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{model.name}</h3>
          <p className="font-mono text-xs text-muted">{model.slug}</p>
        </div>
        <Chip variant={model.is_open ? 'neutral' : 'brand'}>{model.is_open ? 'Open model' : 'Layerto model'}</Chip>
      </div>
      <p className="text-sm text-ink-secondary line-clamp-3">{model.description}</p>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div>
          <span className="text-3xl font-bold tabular-nums">{usd(model.price_usd)}</span>
          <span className="text-sm text-muted"> / call</span>
        </div>
        <button type="button" onClick={onOpen} className="text-sm font-semibold text-crimson hover:underline underline-offset-2 cursor-pointer">
          Model details
        </button>
      </div>
    </TiltCard>
  );
}
