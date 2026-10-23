export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'layerto_theme';

/** The saved theme choice (light by default). */
export function readThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

/** Saves the choice and applies it to <html data-theme>. */
export function applyThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // storage unavailable: the choice still applies for this page view
  }
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export const ACCENTS = ['crimson', 'ocean', 'forest', 'violet', 'amber', 'graphite'] as const;
export type Accent = (typeof ACCENTS)[number];
export type Density = 'comfortable' | 'compact';

/** The saved accent colour (crimson by default). */
export function readAccent(): Accent {
  try {
    const v = localStorage.getItem('layerto_accent') as Accent | null;
    return v && (ACCENTS as readonly string[]).includes(v) ? v : 'crimson';
  } catch {
    return 'crimson';
  }
}

export function applyAccent(accent: Accent) {
  try {
    localStorage.setItem('layerto_accent', accent);
  } catch {
    // storage unavailable: applies for this page view
  }
  if (accent === 'crimson') document.documentElement.removeAttribute('data-accent');
  else document.documentElement.setAttribute('data-accent', accent);
}

export function readDensity(): Density {
  try {
    return localStorage.getItem('layerto_density') === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

export function applyDensity(density: Density) {
  try {
    localStorage.setItem('layerto_density', density);
  } catch {
    // storage unavailable
  }
  if (density === 'compact') document.documentElement.setAttribute('data-density', 'compact');
  else document.documentElement.removeAttribute('data-density');
}
