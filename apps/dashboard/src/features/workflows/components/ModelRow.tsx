import type { PublicModelItem } from '@layerto/types';
import { Icon, cn, usd } from '@layerto/ui';

export interface ModelRowProps {
  model: PublicModelItem;
  active?: boolean;
  favorite: boolean;
  onPick: () => void;
  onToggleFavorite: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

/** One model in a picker list: name, slug, price and a favourite star. */
export function ModelRow({ model, active, favorite, onPick, onToggleFavorite, draggable, onDragStart }: ModelRowProps) {
  return (
    <div
      role="option"
      aria-selected={active}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onPick}
      className={cn(
        'group flex items-center gap-3 px-2.5 py-2 rounded-control cursor-pointer select-none transition-colors',
        active ? 'bg-crimson-tint' : 'hover:bg-page',
        draggable && 'active:cursor-grabbing',
      )}
    >
      <span className="grid place-items-center h-8 w-8 shrink-0 rounded-control bg-crimson/10 text-crimson">
        <Icon name="cpu" size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{model.name}</span>
        <span className="block text-xs text-muted truncate">
          <span className="font-mono">{model.slug}</span> · {usd(model.price_usd)}
        </span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        aria-label={favorite ? `Remove ${model.name} from favourites` : `Add ${model.name} to favourites`}
        aria-pressed={favorite}
        className={cn(
          'p-1.5 rounded-control transition-colors cursor-pointer',
          favorite ? 'text-amber-500' : 'text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-amber-500',
        )}
      >
        <Icon name="star" size={16} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
