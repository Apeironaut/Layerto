import { useCallback, useMemo, useState } from 'react';
import { Button, Icon, Skeleton, Tabs, cn, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { AREA_COLORS, ResearchContext } from './shared';
import type { ResearchCtx } from './shared';
import { ResearchOverview } from './Overview';
import { AreasView } from './Areas';
import { PapersView } from './Papers';
import { ExperimentsView } from './Experiments';
import { FindingsView } from './Findings';
import { NotesView } from './Notes';
import { LibraryView } from './Library';
import { TasksView } from './Tasks';
import { FilesView } from './Files';
import { PortfolioView } from './Portfolio';
import { AssistantView } from './Assistant';
import { RESEARCH_TABS } from './tabs';



const AREA_KEY = 'layerto_research_area';

/** The research workspace: everything a researcher tracks, scoped by research area. */
export function ResearchPage({ tab }: { tab: string }) {
  const { navigate } = useHub();
  const areas = useResource(() => api.areas(), 'research-areas');
  const [area, setAreaState] = useState<string>(() => {
    try {
      return localStorage.getItem(AREA_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const list = areas.data ?? [];
  const current = area && list.some((a) => a.id === area) ? area : '';
  const setArea = useCallback((id: string) => {
    setAreaState(id);
    try {
      localStorage.setItem(AREA_KEY, id);
    } catch {
      /* private mode */
    }
  }, []);

  const ctx = useMemo<ResearchCtx>(
    () => ({
      areas: list,
      area: current,
      setArea,
      reloadAreas: areas.reload,
      areaName: (id) => list.find((a) => a.id === id)?.name ?? '',
      areaColor: (id) => {
        const a = list.find((x) => x.id === id);
        if (a?.color) return a.color;
        const i = list.findIndex((x) => x.id === id);
        return i >= 0 ? AREA_COLORS[i % AREA_COLORS.length] : 'var(--color-line-strong)';
      },
      canWrite: (areaId) => {
        const id = areaId ?? current;
        if (!id) return true;
        const a = list.find((x) => x.id === id);
        return !a || a.role !== 'viewer';
      },
      go: (t) => navigate(t === 'overview' ? '/research' : `/research/${t}`),
    }),
    [list, current, setArea, areas.reload, navigate],
  );

  const active = RESEARCH_TABS.some((t) => t.value === tab) ? tab : 'overview';
  const selected = list.find((a) => a.id === current);

  return (
    <ResearchContext.Provider value={ctx}>
      <div className="relative overflow-hidden rounded-l3 border border-line bg-card px-5 py-5 shadow-l1 sm:px-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl opacity-25" style={{ background: selected?.color || 'var(--color-crimson)' }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <Icon name="flask" size={14} /> Research workspace
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{selected ? selected.name : 'All research'}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {selected?.description || 'Papers, experiments, findings and reading in one place. Every training run is logged as an experiment automatically.'}
            </p>
          </div>
          <Button variant="secondary" size="sm" icon="compass" onClick={() => ctx.go('areas')}>
            Manage areas
          </Button>
        </div>
        <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1">
          {areas.loading ? (
            <Skeleton className="h-8 w-72" />
          ) : (
            <>
              <AreaChip active={!current} onClick={() => setArea('')} color="var(--color-ink)">
                All areas
              </AreaChip>
              {list
                .filter((a) => a.status !== 'archived')
                .map((a, i) => (
                  <AreaChip key={a.id} active={current === a.id} onClick={() => setArea(a.id)} color={a.color || AREA_COLORS[i % AREA_COLORS.length]}>
                    {a.name}
                    {a.team_name && <Icon name="team" size={12} className="opacity-60" />}
                  </AreaChip>
                ))}
              <button type="button" onClick={() => ctx.go('areas')} className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:text-crimson hover:border-crimson cursor-pointer">
                <Icon name="plus" size={12} /> New area
              </button>
            </>
          )}
        </div>
      </div>
      <Tabs
        value={active}
        onChange={(t) => ctx.go(t)}
        items={RESEARCH_TABS.map((t) => ({ value: t.value, label: t.soon ? `${t.label} (soon)` : t.label, icon: t.icon }))}
      />
      {active === 'overview' && <ResearchOverview />}
      {active === 'areas' && <AreasView />}
      {active === 'papers' && <PapersView />}
      {active === 'experiments' && <ExperimentsView />}
      {active === 'findings' && <FindingsView />}
      {active === 'notes' && <NotesView />}
      {active === 'library' && <LibraryView />}
      {active === 'tasks' && <TasksView />}
      {active === 'files' && <FilesView />}
      {active === 'portfolio' && <PortfolioView />}
      {active === 'assistant' && <AssistantView />}
    </ResearchContext.Provider>
  );
}

function AreaChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
        active ? 'border-ink bg-ink text-page shadow-l1' : 'border-line bg-page text-ink-secondary hover:border-line-strong',
      )}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
      {children}
    </button>
  );
}
