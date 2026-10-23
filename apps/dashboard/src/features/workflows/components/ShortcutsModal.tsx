import { Modal } from '@layerto/ui';

const SHORTCUTS: [string, string][] = [
  ['A or /', 'Add a step (after the selected one)'],
  ['Drag from a dot', 'Connect steps; let go on empty space to pick a new step'],
  ['Delete / Backspace', 'Remove the selected steps or connections'],
  ['Ctrl/⌘ + D', 'Duplicate the selected step'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z', 'Redo'],
  ['Ctrl/⌘ + S', 'Save'],
  ['Shift + L', 'Tidy the layout'],
  ['F', 'Fit everything on screen'],
  ['Shift + drag', 'Select several steps'],
  ['Right-click', 'More actions for a step or the canvas'],
  ['Esc', 'Close menus'],
];

export function ShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" size="lg">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
            <dt>
              <kbd className="inline-block rounded-control border border-line-strong bg-page px-2 py-0.5 text-xs font-semibold">{k}</kbd>
            </dt>
            <dd className="text-sm text-ink-secondary text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
