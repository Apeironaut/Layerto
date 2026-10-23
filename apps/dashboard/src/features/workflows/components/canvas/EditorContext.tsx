import { createContext, useContext } from 'react';
import type { PublicModelItem } from '@layerto/types';

export interface AddMenuRequest {
  from: { nodeId: string; handle?: string | null };
  /** Screen position to open at; defaults to beside the source step. */
  clientX?: number;
  clientY?: number;
}

export interface EditorActions {
  openAddMenu: (req: AddMenuRequest) => void;
  removeEdge: (id: string) => void;
  modelBySlug: Map<string, PublicModelItem>;
  running: boolean;
}

export const EditorContext = createContext<EditorActions | null>(null);

/** Access editor actions from custom nodes and edges. */
export function useEditorActions(): EditorActions {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorActions must be used inside the workflow editor');
  return ctx;
}
