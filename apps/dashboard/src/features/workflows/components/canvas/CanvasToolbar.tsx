import { Icon } from '@layerto/ui';
import type { IconName } from '@layerto/ui';

export interface CanvasToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTidy: () => void;
  onFit: () => void;
  onAdd: () => void;
  onHelp: () => void;
}

function ToolButton({ icon, label, shortcut, onClick, disabled }: { icon: IconName; label: string; shortcut: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${shortcut})`}
      aria-label={label}
      className="grid place-items-center h-9 w-9 rounded-control text-ink-secondary hover:bg-crimson-tint hover:text-crimson disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition-colors"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/** Floating tools at the bottom of the canvas. */
export function CanvasToolbar({ canUndo, canRedo, onUndo, onRedo, onTidy, onFit, onAdd, onHelp }: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-l2 border border-line bg-card/95 backdrop-blur p-1 shadow-l2">
      <button
        type="button"
        onClick={onAdd}
        title="Add a step (A)"
        className="inline-flex items-center gap-1.5 h-9 px-3 whitespace-nowrap rounded-control bg-crimson text-white text-sm font-semibold hover:bg-crimson-hover cursor-pointer dark:bg-crimson-fill"
      >
        <Icon name="plus" size={16} /> Add step
      </button>
      <span className="w-px h-6 bg-line mx-1" aria-hidden="true" />
      <ToolButton icon="undo" label="Undo" shortcut="Ctrl+Z" onClick={onUndo} disabled={!canUndo} />
      <ToolButton icon="redo" label="Redo" shortcut="Ctrl+Shift+Z" onClick={onRedo} disabled={!canRedo} />
      <span className="w-px h-6 bg-line mx-1" aria-hidden="true" />
      <ToolButton icon="wand" label="Tidy layout" shortcut="Shift+L" onClick={onTidy} />
      <ToolButton icon="maximize" label="Fit to screen" shortcut="F" onClick={onFit} />
      <ToolButton icon="keyboard" label="Keyboard shortcuts" shortcut="?" onClick={onHelp} />
    </div>
  );
}
