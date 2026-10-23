import type { IconName } from '../Icon';

/** One destination in an app's navigation. `path` is the URL path, e.g. "/keys". */
export interface NavItem {
  path: string;
  label: string;
  /** Short label for the mobile bottom bar. */
  shortLabel?: string;
  icon: IconName;
  /** Optional count badge (e.g. active keys). */
  count?: number;
  /** Sidebar section heading shown above the first item of each group. */
  group?: string;
  /** Not included in the user's plan: shown with a lock (the page explains how to unlock it). */
  locked?: boolean;
  /** Short text badge, e.g. "New". */
  badge?: string;
  /** Hidden from the mobile bottom bar (still in the account menu / sidebar). */
  hideOnMobile?: boolean;
}

/** An entry in the account menu that opens from the user's name. */
export interface AccountMenuItem {
  label: string;
  icon: import('../Icon').IconName;
  onSelect: () => void;
  danger?: boolean;
  hint?: string;
}
