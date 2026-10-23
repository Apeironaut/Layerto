import { createContext, useContext } from 'react';
import type { PlanResponse, Track, User } from '@layerto/types';

export interface Hub {
  user: User;
  plan: PlanResponse | undefined;
  features: string[];
  track: Track;
  has: (feature: string) => boolean;
  reloadPlan: () => Promise<void>;
  reloadBalance: () => void;
  navigate: (to: string) => void;
  openPlan: (highlight?: string) => void;
  openSettings: () => void;
  openAppearance: () => void;
  openComposer: (prefill?: { space?: string; title?: string; body?: string; link_kind?: string; link_ref?: string }) => void;
}

export const HubContext = createContext<Hub | null>(null);

/** Plan features, the user's track and app-wide actions (open plan, compose a post…). */
export function useHub(): Hub {
  const h = useContext(HubContext);
  if (!h) throw new Error('useHub outside HubContext');
  return h;
}
