import { useEffect, useState } from 'react';
import type { PublicModelItem } from '@layerto/types';
import { loadModels } from '../lib/models';

export type ModelsState =
  | { status: 'loading'; models: [] }
  | { status: 'ready'; models: PublicModelItem[] }
  | { status: 'error'; models: [] };

/** The live model catalogue from GET /v1/models. */
export function useModels(): ModelsState {
  const [state, setState] = useState<ModelsState>({ status: 'loading', models: [] });
  useEffect(() => {
    let alive = true;
    loadModels().then(
      (models) => alive && setState({ status: 'ready', models }),
      () => alive && setState({ status: 'error', models: [] }),
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
