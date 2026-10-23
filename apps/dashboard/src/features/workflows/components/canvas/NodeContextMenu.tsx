import { useEffect, useRef } from 'react';
import { Icon, cn } from '@layerto/ui';
import type { IconName } from '@layerto/ui';

export interface MenuItem {
  label: string;
  icon: IconName;
  shortcut?: string;
  danger?: boolean;
  onSelect: () => void;
}

export interface NodeContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

/** Right-click menu for a step or the empty canvas. */
export function NodeContextMenu({ x, y, items, onClose }: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className="absolute z-30 min-w-52 rounded-l2 border border-line-strong bg-card shadow-l3 p-1" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-sm text-left cursor-pointer',
            item.danger ? 'text-crimson hover:bg-crimson-tint' : 'hover:bg-page focus:bg-page outline-none',
          )}
        >
          <Icon name={item.icon} size={16} />
          <span className="flex-1">{item.label}</span>
          {item.shortcut && <kbd className="text-[10px] text-muted">{item.shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}
