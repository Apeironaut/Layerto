import type { Track } from '@layerto/types';
import type { IconName } from '@layerto/ui';

/** "just now", "5m", "3h", "2d", or a date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const TRACK_BADGE: Record<string, { label: string; cls: string }> = {
  researcher: { label: 'Researcher', cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  photographer: { label: 'Photographer', cls: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30' },
  solo: { label: 'Builder', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  enterprise: { label: 'Enterprise', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  student: { label: 'Student', cls: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30' },
};

export function trackBadge(t: Track | string) {
  return TRACK_BADGE[t];
}

export const SPACE_ICON: Record<string, IconName> = {
  // General & Community
  general: 'message',
  research: 'flask',
  showcase: 'sparkles',
  help: 'info',
  jobs: 'team',

  // Computer Science & AI
  'computer-vision': 'eye',
  nlp: 'book',
  datasets: 'database',
  'ml-infra': 'cpu',
  'reinforcement-learning': 'target',
  robotics: 'settings',
  'speech-audio': 'play',
  'cybersecurity-ai': 'shield',

  // Zoology & Wildlife
  wildlife: 'camera',
  'marine-biology': 'compass',
  bioacoustics: 'play',
  entomology: 'layers',
  'animal-behavior': 'eye',
  ornithology: 'compass',

  // Botany & Plant Science
  'plant-pathology': 'flask',
  'flora-taxonomy': 'book',
  'crop-vision': 'layers',
  'forestry-canopy': 'compass',
  'soil-sensing': 'database',
  horticulture: 'settings',

  // Medicine & Healthcare
  'medical-imaging': 'eye',
  'genomics-ai': 'database',
  histology: 'flask',
  biosignals: 'play',
  pharmacology: 'sparkles',

  // Physics, Earth & Space
  astronomy: 'sparkles',
  'remote-sensing': 'compass',
  'climate-ai': 'layers',
  geophysics: 'settings',

  // Management & Governance
  'ai-governance': 'shield',
  'lab-ops': 'settings',
  'project-strategy': 'target',
  'data-licensing': 'book',
};
