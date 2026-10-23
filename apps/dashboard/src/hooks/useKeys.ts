import { useResource, isKeyExpired } from '@layerto/ui';
import { api } from '../lib/api';

export const MAX_ACTIVE_KEYS = 10;

/** The account's API keys (active, revoked and expired). */
export function useKeys(now: Date = new Date()) {
  const keys = useResource(() => api.listKeys(), 'keys');
  const active = (keys.data ?? []).filter((k) => !k.revoked_at && !isKeyExpired(k.expires_at, now)).length;
  return { ...keys, active, atLimit: active >= MAX_ACTIVE_KEYS };
}
