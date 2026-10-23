import { Button, Card, Icon, usd } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { useHub } from './HubContext';

const COPY: Record<string, { icon: IconName; title: string; body: string }> = {
  research: {
    icon: 'flask',
    title: 'The research workspace',
    body: 'Keep papers, experiments, findings, notes, a reading list and deadlines in one place, auto-log every training run, work with a team and publish a portfolio site.',
  },
  projects: { icon: 'folder', title: 'Projects', body: 'Store datasets, annotate images, train detectors and manage the models they produce, all in one project.' },
  train: { icon: 'cpu', title: 'Models and training', body: 'Train LTVision detectors on your own data and get an API for each model.' },
  sell_images: { icon: 'camera', title: 'Sell image datasets', body: 'Upload photo collections, set a license and a price, and earn when researchers and builders buy them.' },
  teams: { icon: 'team', title: 'Teams', body: 'Share projects and research areas with collaborators, with editor and viewer roles and a shared activity log.' },
  portfolio: { icon: 'globe', title: 'Portfolio site', body: 'A personal research site at you.layerto.com with your papers, projects and models.' },
};

/** Shown instead of a section the user's plan doesn't include, with the plans that do. */
export function Locked({ feature }: { feature: string }) {
  const { plan, openPlan } = useHub();
  const copy = COPY[feature] ?? { icon: 'lock' as IconName, title: 'Not in your plan', body: '' };
  const options = (plan?.plans ?? []).filter((p) => p.features.includes(feature)).sort((a, b) => a.price - b.price);
  const current = plan?.limits;
  const photographer = current?.audience === 'photographer';
  return (
    <div className="max-w-3xl mx-auto py-10">
      <Card className="relative overflow-hidden text-center px-6 py-12">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[38rem] rounded-full bg-crimson/10 blur-3xl" />
        <div className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-crimson-tint text-crimson">
          <Icon name={copy.icon} size={30} />
        </div>
        <h1 className="relative mt-5 text-2xl font-bold">{copy.title}</h1>
        <p className="relative mx-auto mt-2 max-w-xl text-muted">{copy.body}</p>
        <p className="relative mt-4 text-sm text-ink-secondary">
          {photographer && (feature === 'projects' || feature === 'train')
            ? 'Your Photographer plan is made for selling image datasets, so model building is turned off. Switch plans any time if you also want to train.'
            : `It isn't included in your ${current?.name ?? 'current'} plan.`}
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          {options.slice(0, 3).map((p) => (
            <span key={p.id} className="rounded-pill border border-line bg-page px-3 py-1.5 text-sm">
              <strong>{p.name}</strong> <span className="text-muted">{p.price > 0 ? `${usd(String(p.price / 1e6))}/30 days` : 'free'}</span>
            </span>
          ))}
        </div>
        <Button className="relative mt-6" icon="crown" onClick={() => openPlan(feature)}>
          See plans
        </Button>
      </Card>
    </div>
  );
}
