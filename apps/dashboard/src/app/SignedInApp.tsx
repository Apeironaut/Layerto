import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { BalanceResponse, CommunityPost, Track, User } from '@layerto/types';
import { AppShell, Icon, Modal, Skeleton, usd, useResource, useRoute } from '@layerto/ui';
import type { AccountMenuItem } from '@layerto/ui';
import { api } from '../lib/api';
import { SITE_URL } from '../config';
import { buildNav, resolveSection } from './routes';
import { HubContext } from '../hub/HubContext';
import type { Hub } from '../hub/HubContext';
import { Locked } from '../hub/Locked';
import { PlanPanel } from '../hub/PlanPanel';
import { AppearancePanel } from '../hub/AppearancePanel';
import { TrackPicker } from '../hub/TrackPicker';
import { CommandPalette } from '../hub/CommandPalette';
import type { Command } from '../hub/CommandPalette';
import { Composer } from '../features/home/Composer';
import type { ComposerPrefill } from '../features/home/Composer';
import { TRACK_BADGE } from '../features/home/util';
import { HomePage } from '../features/home/HomePage';
import { OverviewPage } from '../pages/OverviewPage';
import { PlaygroundPage } from '../pages/PlaygroundPage';
import { KeysPage } from '../pages/KeysPage';
import { UsagePage } from '../pages/UsagePage';
import { RequestsPage } from '../pages/RequestsPage';
import { WorkflowsPage } from '../features/workflows/pages/WorkflowsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { PROJECT_TABS, ProjectWorkspace } from '../features/projects/ProjectWorkspace';
import type { ProjectTab } from '../features/projects/ProjectWorkspace';
import { DatasetDetailPage } from '../features/studio/pages/DatasetDetailPage';
import { MyModelsPage } from '../features/studio/pages/MyModelsPage';
import { RESEARCH_TABS } from '../features/research/tabs';
import { AccountSettings } from '../features/account/AccountSettings';

const WorkflowEditorPage = lazy(() => import('../features/workflows/pages/WorkflowEditorPage').then((m) => ({ default: m.WorkflowEditorPage })));
const AnnotatorPage = lazy(() => import('../features/studio/pages/AnnotatorPage').then((m) => ({ default: m.AnnotatorPage })));
const SitesPage = lazy(() => import('../features/studio/pages/SitesPage').then((m) => ({ default: m.SitesPage })));
const ResearchPage = lazy(() => import('../features/research/ResearchPage').then((m) => ({ default: m.ResearchPage })));
const MarketplacePage = lazy(() => import('../features/market/MarketplacePage').then((m) => ({ default: m.MarketplacePage })));
const SellPage = lazy(() => import('../features/sell/SellPage').then((m) => ({ default: m.SellPage })));
const TeamsPage = lazy(() => import('../features/teams/TeamsPage').then((m) => ({ default: m.TeamsPage })));

export interface SignedInAppProps {
  user: User;
  balance: BalanceResponse | undefined;
  balanceLoading: boolean;
  reloadBalance: () => void;
  onSignOut: () => void;
  onUserChange: (user: User) => void;
}

const SIDEBAR_KEY = 'layerto_sidebar';
const SKIP_KEY = 'layerto_track_skipped';
const UUID = '[0-9a-f-]{36}';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** Old Studio URLs keep working. */
const REDIRECTS: Record<string, string> = {
  '/datasets': '/projects',
  '/training': '/projects',
  '/my-models': '/models',
  '/sites': '/models/sites',
  '/plan': '/home?plan=1',
  '/settings': '/home?settings=1',
  '/community': '/home',
  '/': '/home',
};

type Overlay = { kind: 'plan'; highlight?: string } | { kind: 'settings' } | { kind: 'appearance' } | null;

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72" />
    </div>
  );
}

/** The signed-in hub: plan-aware navigation, account pop-ups, command palette and every section. */
export function SignedInApp({ user, balance, balanceLoading, reloadBalance, onSignOut, onUserChange }: SignedInAppProps) {
  const [path, navigate] = useRoute();
  const plan = useResource(() => api.studioPlan(), 'studio-plan');
  const settings = useResource(() => api.mySettings(), 'my-settings');
  const teams = useResource(() => api.teams(), 'teams-nav');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [composer, setComposer] = useState<ComposerPrefill | null>(null);
  const [palette, setPalette] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackOverride, setTrackOverride] = useState<Track | null>(null);

  // legacy paths and ?plan=1 / ?settings=1 deep links
  useEffect(() => {
    const target = REDIRECTS[path];
    if (target) {
      window.history.replaceState({}, '', target.split('?')[0]);
      window.dispatchEvent(new Event('layerto:navigate'));
      if (target.includes('plan=1')) setOverlay({ kind: 'plan' });
      if (target.includes('settings=1')) setOverlay({ kind: 'settings' });
    }
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('plan')) setOverlay({ kind: 'plan', highlight: qs.get('plan') ?? undefined });
  }, [path]);

  const track: Track = trackOverride ?? settings.data?.track ?? plan.data?.track ?? '';
  useEffect(() => {
    if (!settings.data || settings.data.track) return;
    let skipped = false;
    try {
      skipped = sessionStorage.getItem(SKIP_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (!skipped) setTrackOpen(true);
  }, [settings.data]);

  const features = useMemo(() => plan.data?.features ?? plan.data?.limits.features ?? [], [plan.data]);
  const has = useCallback((f: string) => features.includes(f), [features]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'open');
      } catch {
        /* ignore */
      }
      void api.saveMySettings({ ui: { ...(settings.data?.ui ?? {}), sidebar_collapsed: next } }).catch(() => undefined);
      return next;
    });
  }, [settings.data]);

  // keyboard: Ctrl/Cmd+K palette, [ toggles sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (!typing && e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  const hub = useMemo<Hub>(
    () => ({
      user,
      plan: plan.data,
      features,
      track,
      has,
      reloadPlan: plan.reload,
      reloadBalance,
      navigate,
      openPlan: (highlight) => setOverlay({ kind: 'plan', highlight }),
      openSettings: () => setOverlay({ kind: 'settings' }),
      openAppearance: () => setOverlay({ kind: 'appearance' }),
      openComposer: (prefill) => setComposer(prefill ?? {}),
    }),
    [user, plan.data, plan.reload, features, track, has, reloadBalance, navigate],
  );

  const invites = (teams.data ?? []).filter((t) => t.my_status === 'invited').length;
  const nav = useMemo(() => buildNav(features, track, { invites }), [features, track, invites]);
  const section = resolveSection(path);

  // ---- routing
  const wfMatch = path.match(/^\/workflows\/(new(?:\/([a-z-]+))?|[0-9a-f-]{36})\/?$/);
  const annotate = path.match(new RegExp(`^/datasets/(${UUID})/annotate/?$`));
  const datasetMatch = path.match(new RegExp(`^/datasets/(${UUID})/?$`));
  const projectMatch = path.match(new RegExp(`^/projects/(${UUID})(?:/([a-z]+))?/?$`));
  const researchAreaMatch = path.match(new RegExp(`^/research/area/(${UUID})(?:/([a-z0-9_-]+))?/?$`));
  const researchMatch = path.match(/^\/research(?:\/([a-z0-9_-]+))?\/?$/);
  const marketMatch = path.match(new RegExp(`^/marketplace(?:/([a-z]+))?(?:/(${UUID}))?/?$`));
  const teamMatch = path.match(new RegExp(`^/teams/(${UUID})/?$`));
  const fullBleed = wfMatch !== null || annotate !== null;
  const isResearch = path.startsWith('/research');
  const gate = (feature: string, el: ReactElement) => (plan.data && !has(feature) ? <Locked feature={feature} /> : el);

  let page: ReactElement;
  if (annotate) {
    page = gate('projects', <AnnotatorPage key={path} id={annotate[1]} navigate={navigate} />);
  } else if (datasetMatch) {
    page = <DatasetDetailPage key={path} id={datasetMatch[1]} navigate={navigate} />;
  } else if (projectMatch) {
    const tab = (PROJECT_TABS as string[]).includes(projectMatch[2] ?? '') ? (projectMatch[2] as ProjectTab) : 'overview';
    page = gate('projects', <ProjectWorkspace key={projectMatch[1]} id={projectMatch[1]} tab={tab} />);
  } else if (wfMatch) {
    const editorId = !wfMatch[1].startsWith('new') ? wfMatch[1] : undefined;
    page = <WorkflowEditorPage key={path} workflowId={editorId} templateId={wfMatch[2]} navigate={navigate} onCharged={reloadBalance} />;
  } else if (researchAreaMatch) {
    page = gate('research', <ResearchPage areaId={researchAreaMatch[1]} tab={researchAreaMatch[2]} />);
  } else if (researchMatch) {
    page = gate('research', <ResearchPage tab={researchMatch[1]} />);
  } else if (marketMatch) {
    page = <MarketplacePage tab={marketMatch[1] ?? 'models'} listingId={marketMatch[2]} />;
  } else if (teamMatch) {
    page = <TeamsPage id={teamMatch[1]} />;
  } else {
    switch (section) {
      case '/overview':
        page = <OverviewPage user={user} balance={balance} balanceLoading={balanceLoading} navigate={navigate} />;
        break;
      case '/playground':
        page = <PlaygroundPage onCharged={reloadBalance} />;
        break;
      case '/workflows':
        page = <WorkflowsPage navigate={navigate} />;
        break;
      case '/keys':
        page = <KeysPage />;
        break;
      case '/usage':
        page = <UsagePage balance={balance} />;
        break;
      case '/requests':
        page = <RequestsPage navigate={navigate} />;
        break;
      case '/projects':
        page = gate('projects', <ProjectsPage />);
        break;
      case '/models':
        page = gate('train', path.startsWith('/models/sites') ? <SitesPage user={user} onCharged={reloadBalance} /> : <MyModelsPage navigate={navigate} onCharged={reloadBalance} />);
        break;
      case '/sell':
        page = <SellPage />;
        break;
      case '/teams':
        page = <TeamsPage />;
        break;
      default:
        page = <HomePage />;
    }
  }

  // ---- account menu
  const badge = TRACK_BADGE[track];
  const accountMenu: AccountMenuItem[] = [
    { label: 'Profile & settings', icon: 'user', onSelect: () => setOverlay({ kind: 'settings' }) },
    { label: 'Plan & billing', icon: 'crown', hint: plan.data?.limits.name, onSelect: () => setOverlay({ kind: 'plan' }) },
    { label: 'Appearance', icon: 'palette', onSelect: () => setOverlay({ kind: 'appearance' }) },
    { label: 'Usage & balance', icon: 'chart', hint: balance ? usd(balance.balance_usd) : undefined, onSelect: () => navigate('/usage') },
    ...(user.username ? [{ label: 'View public profile', icon: 'external' as const, onSelect: () => window.open(`${SITE_URL}/@${user.username}`, '_blank', 'noopener') }] : []),
    { label: 'Command menu', icon: 'search', hint: 'Ctrl K', onSelect: () => setPalette(true) },
  ];
  const accountHeader = (
    <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1">
      {badge && <span className={`rounded-pill border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>}
      {plan.data && <span className="rounded-pill bg-crimson-tint px-2 py-0.5 text-[10px] font-semibold text-crimson">{plan.data.limits.name}</span>}
      {plan.data && plan.data.gpu_hours > 0 && <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] text-muted">{plan.data.gpu_hours.toFixed(1)} GPU h</span>}
    </div>
  );

  // ---- command palette
  const commands: Command[] = useMemo(() => {
    const go: Command[] = nav.map((n) => ({ id: `go-${n.path}`, label: n.label, hint: n.locked ? 'Not in your plan' : undefined, icon: n.icon, group: 'Go to', run: () => navigate(n.path) }));
    const research: Command[] = has('research')
      ? RESEARCH_TABS.filter((t) => t.value !== 'overview').map((t) => ({ id: `r-${t.value}`, label: `Research: ${t.label}`, icon: t.icon, group: 'Research', run: () => navigate(`/research/${t.value}`) }))
      : [];
    const actions: Command[] = [
      { id: 'post', label: 'New community post', icon: 'pen', group: 'Create', run: () => setComposer({}) },
      ...(has('projects') ? [{ id: 'proj', label: 'New project', icon: 'folder' as const, group: 'Create', run: () => navigate('/projects') }] : []),
      ...(has('research') ? [{ id: 'paper', label: 'New paper', icon: 'file' as const, group: 'Create', run: () => navigate('/research/papers?new=1') }] : []),
      ...(has('research') ? [{ id: 'note', label: 'New research note', icon: 'pen' as const, group: 'Create', run: () => navigate('/research/notes?new=1') }] : []),
      ...(has('sell_images') ? [{ id: 'sell', label: 'Sell a photo collection', icon: 'camera' as const, group: 'Create', run: () => navigate('/sell') }] : []),
      { id: 'key', label: 'Create API key', icon: 'key', group: 'Create', run: () => navigate('/keys') },
      { id: 'plan', label: 'Plans & add-ons', icon: 'crown', group: 'Account', run: () => setOverlay({ kind: 'plan' }) },
      { id: 'settings', label: 'Profile & settings', icon: 'settings', group: 'Account', run: () => setOverlay({ kind: 'settings' }) },
      { id: 'appearance', label: 'Appearance & theme', icon: 'palette', group: 'Account', run: () => setOverlay({ kind: 'appearance' }) },
      { id: 'sidebar', label: collapsed ? 'Expand sidebar' : 'Collapse sidebar', hint: '[', icon: 'sidebar', group: 'Account', run: toggleCollapsed },
      { id: 'datasets', label: 'Browse image datasets', icon: 'image', group: 'Marketplace', run: () => navigate('/marketplace/datasets') },
      { id: 'papers', label: 'Browse papers', icon: 'book', group: 'Marketplace', run: () => navigate('/marketplace/papers') },
    ];
    return [...go, ...actions, ...research];
  }, [nav, has, navigate, collapsed, toggleCollapsed]);

  const onPosted = (p: CommunityPost) => {
    setComposer(null);
    window.dispatchEvent(new CustomEvent('layerto:posted', { detail: p }));
    if (!path.startsWith('/home')) navigate(`/home/post/${p.id}`);
  };

  return (
    <HubContext.Provider value={hub}>
      <AppShell
        product="Hub"
        nav={nav}
        activePath={section}
        onNavigate={navigate}
        userEmail={user.email}
        userName={[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || undefined}
        userDetail={balance ? `${usd(balance.balance_usd)} · ${plan.data?.limits.name ?? ''}` : plan.data?.limits.name}
        onSignOut={onSignOut}
        accountMenu={accountMenu}
        accountHeader={accountHeader}
        collapsed={collapsed && !fullBleed}
        onToggleCollapsed={toggleCollapsed}
        toolbar={
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="inline-flex items-center gap-2 rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-muted hover:text-ink cursor-pointer"
            aria-label="Open command menu"
          >
            <Icon name="search" size={14} />
            {!collapsed && <span className="hidden lg:inline">Search</span>}
            <kbd className="hidden rounded border border-line px-1 text-[10px] lg:inline">⌘K</kbd>
          </button>
        }
        fullBleed={fullBleed}
        compactNav={fullBleed}
        mainClassName={isResearch ? 'pl-2 pr-4 sm:pr-6 lg:pr-8 py-4 sm:py-6 pb-28 md:pb-8' : undefined}
        contentClassName={isResearch ? 'space-y-6 w-full max-w-full' : undefined}
      >
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </AppShell>

      <Modal isOpen={overlay?.kind === 'plan'} onClose={() => setOverlay(null)} title="Plan & billing" size="xl">
        {overlay?.kind === 'plan' && <PlanPanel highlight={overlay.highlight} />}
      </Modal>
      <Modal isOpen={overlay?.kind === 'settings'} onClose={() => setOverlay(null)} title="Profile & settings" size="xl">
        {overlay?.kind === 'settings' && (
          <AccountSettings
            user={user}
            onUserChange={onUserChange}
            onChangeTrack={() => {
              setOverlay(null);
              setTrackOpen(true);
            }}
          />
        )}
      </Modal>
      <Modal isOpen={overlay?.kind === 'appearance'} onClose={() => setOverlay(null)} title="Appearance" size="lg">
        {overlay?.kind === 'appearance' && <AppearancePanel />}
      </Modal>
      <Composer open={composer !== null} prefill={composer ?? undefined} onClose={() => setComposer(null)} onPosted={onPosted} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />
      <TrackPicker
        open={trackOpen}
        onDone={(t) => {
          setTrackOpen(false);
          if (t) {
            setTrackOverride(t);
            void settings.reload();
            void plan.reload();
          } else {
            try {
              sessionStorage.setItem(SKIP_KEY, '1');
            } catch {
              /* ignore */
            }
          }
        }}
      />
    </HubContext.Provider>
  );
}
