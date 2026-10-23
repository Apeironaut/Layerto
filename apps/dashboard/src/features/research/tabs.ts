import type { IconName } from '@layerto/ui';

/** Sections of the research workspace, in tab order. */
export const RESEARCH_TABS: { value: string; label: string; icon: IconName; soon?: boolean }[] = [
  { value: 'overview', label: 'Overview', icon: 'overview' },
  { value: 'papers', label: 'Papers', icon: 'file' },
  { value: 'experiments', label: 'Experiments', icon: 'flask' },
  { value: 'findings', label: 'Findings', icon: 'sparkles' },
  { value: 'notes', label: 'Notes', icon: 'pen' },
  { value: 'library', label: 'Reading', icon: 'book' },
  { value: 'tasks', label: 'Deadlines', icon: 'calendar' },
  { value: 'files', label: 'Files', icon: 'folder' },
  { value: 'areas', label: 'Areas', icon: 'compass' },
  { value: 'portfolio', label: 'Portfolio', icon: 'globe' },
  { value: 'assistant', label: 'Chat', icon: 'message', soon: true },
];
