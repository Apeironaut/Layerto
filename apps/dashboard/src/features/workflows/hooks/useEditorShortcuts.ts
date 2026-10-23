import { useEffect, useRef } from 'react';

export interface EditorShortcutHandlers {
  save: () => void;
  undo: () => void;
  redo: () => void;
  deleteSelection: () => void;
  duplicate: () => void;
  openAddStep: () => void;
  tidy: () => void;
  fitView: () => void;
  showHelp: () => void;
  escape: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Keyboard shortcuts for the workflow editor. Typing in a field never triggers them (except save). */
export function useEditorShortcuts(handlers: EditorShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 's') {
        e.preventDefault();
        h.save();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        h.redo();
      } else if (mod && key === 'd') {
        e.preventDefault();
        h.duplicate();
      } else if (!mod && (key === 'delete' || key === 'backspace')) {
        e.preventDefault();
        h.deleteSelection();
      } else if (!mod && (key === '/' || key === 'a')) {
        e.preventDefault();
        h.openAddStep();
      } else if (!mod && e.shiftKey && key === 'l') {
        e.preventDefault();
        h.tidy();
      } else if (!mod && key === 'f') {
        e.preventDefault();
        h.fitView();
      } else if (!mod && e.key === '?') {
        e.preventDefault();
        h.showHelp();
      } else if (key === 'escape') {
        h.escape();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
