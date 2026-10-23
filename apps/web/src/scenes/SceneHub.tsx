import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PlanItem, StudioInfo } from '@layerto/types';
import { Icon, cn, usd, useMotionMode } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { LayertoClient } from '@layerto/api-client';
import { API_URL, DASHBOARD_URL } from '../config';

const client = new LayertoClient(API_URL);

type Persona = 'researcher' | 'photographer' | 'solo' | 'enterprise' | 'student';

const PERSONAS: { id: Persona; label: string; icon: IconName; headline: string; points: string[]; plans: string[] }[] = [
  {
    id: 'researcher',
    label: 'Researchers',
    icon: 'flask',
    headline: 'A research workspace that keeps itself up to date',
    points: [
      'Papers from idea to camera-ready, with PDF, BibTeX and a public page',
      'Every training run logged as an experiment with mAP, recall and curves',
      'Findings with evidence, a reading list, deadlines and a lab notebook',
      'Separate research areas, shared with your team',
      'A portfolio site at you.layerto.com',
    ],
    plans: ['research_free', 'researcher'],
  },
  {
    id: 'photographer',
    label: 'Photographers',
    icon: 'camera',
    headline: 'Turn your photo archive into training data people pay for',
    points: ['Upload collections and label what’s in them', 'Choose a license: research, commercial or CC BY', 'Buyers only see small previews until they pay', 'Keep most of every sale, credited to your balance'],
    plans: ['photographer'],
  },
  {
    id: 'solo',
    label: 'Builders',
    icon: 'zap',
    headline: 'Ship vision features without an ML team',
    points: ['Call specialist models with one API key', 'Train a detector on your own photos in a project', 'Buy licensed datasets and fine-tune community models', 'Publish your model and earn when others call it'],
    plans: ['free', 'solo'],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    icon: 'team',
    headline: 'Shared projects and research across your whole team',
    points: ['Teams with owner, editor and viewer roles', 'Projects and research areas shared with an activity log', 'Highest limits for storage, models and sites', 'Prepaid GPU hour bundles'],
    plans: ['enterprise'],
  },
  {
    id: 'student',
    label: 'Students',
    icon: 'book',
    headline: 'Learn computer vision by doing it',
    points: ['Try models in the playground with your own images', 'Label a small dataset and train your first detector free', 'Read what each metric means, in plain words', 'Ask questions in the community'],
    plans: ['free', 'research_free'],
  },
];

const PILLARS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'home', title: 'Community', body: 'One board for researchers, photographers, builders and companies. Share results, ask for help, find collaborators.' },
  { icon: 'folder', title: 'Projects', body: 'Datasets, labeling, training and models together, one project per piece of work.' },
  { icon: 'flask', title: 'Research', body: 'Papers, experiments, findings and notes, with training runs logged automatically.' },
  { icon: 'store', title: 'Marketplace', body: 'Models with measured accuracy and image datasets with clear licenses.' },
];

/** The hub: who Layerto is for, what each gets, and the plans for each. */
export function SceneHub() {
  const animate = !useMotionMode().reduced;
  const [persona, setPersona] = useState<Persona>('researcher');
  const [info, setInfo] = useState<StudioInfo | null>(null);
  useEffect(() => {
    let alive = true;
    client.studioInfo().then(
      (i) => alive && setInfo(i),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  const p = PERSONAS.find((x) => x.id === persona)!;
  const plans = (info?.plans ?? []).filter((x: PlanItem) => p.plans.includes(x.id));

  return (
    <section id="hub" className="relative w-full overflow-hidden px-4 py-24 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-crimson/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-crimson">The Layerto hub</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-center text-3xl font-bold tracking-tight sm:text-5xl">Everyone who works with images, in one place</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted">Researchers publish, photographers sell data, builders ship models, companies work as teams, and students learn. Each gets a workspace made for them.</p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((x, i) => (
            <motion.div
              key={x.title}
              initial={animate ? { opacity: 0, y: 16 } : false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-l2 border border-line bg-card p-5 shadow-l1"
            >
              <span className="grid size-10 place-items-center rounded-control bg-crimson-tint text-crimson">
                <Icon name={x.icon} size={20} />
              </span>
              <h3 className="mt-3 font-semibold">{x.title}</h3>
              <p className="mt-1 text-sm text-muted">{x.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Who it's for">
          {PERSONAS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={persona === x.id}
              onClick={() => setPersona(x.id)}
              className={cn('inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm font-medium transition-all cursor-pointer', persona === x.id ? 'border-ink bg-ink text-page shadow-l2' : 'border-line bg-card text-ink-secondary hover:border-line-strong')}
            >
              <Icon name={x.icon} size={15} /> {x.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={persona}
            initial={animate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={animate ? { opacity: 0, y: -10 } : undefined}
            transition={{ duration: 0.2 }}
            className="mt-8 grid gap-6 rounded-l3 border border-line bg-card p-6 shadow-l2 sm:p-10 lg:grid-cols-[1.3fr_1fr]"
          >
            <div>
              <h3 className="text-2xl font-bold tracking-tight">{p.headline}</h3>
              <ul className="mt-5 space-y-3">
                {p.points.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-crimson text-white">
                      <Icon name="check" size={12} />
                    </span>
                    <span className="text-ink-secondary">{t}</span>
                  </li>
                ))}
              </ul>
              <a href={`${DASHBOARD_URL}/`} className="mt-7 inline-flex items-center gap-2 rounded-control bg-crimson px-5 py-3 text-sm font-semibold text-white shadow-l2 hover:bg-crimson-fill">
                Start free <Icon name="arrowRight" size={16} />
              </a>
            </div>
            <div className="space-y-3">
              {plans.length === 0 && <div className="h-40 animate-pulse rounded-l2 bg-page" />}
              {plans.map((pl) => (
                <div key={pl.id} className="rounded-l2 border border-line bg-page p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{pl.name}</span>
                    <span className="text-2xl font-bold">
                      {pl.price ? usd(String(pl.price / 1e6)) : 'Free'}
                      {pl.price ? <span className="text-xs font-normal text-muted"> / 30 days</span> : null}
                    </span>
                  </div>
                  {pl.description && <p className="mt-1 text-sm text-muted">{pl.description}</p>}
                  <p className="mt-3 text-xs text-muted">
                    {pl.storage_mb >= 1024 ? `${Math.round(pl.storage_mb / 1024)} GB` : `${pl.storage_mb} MB`} storage
                    {pl.projects > 0 && ` · ${pl.projects} projects`}
                    {pl.team_seats > 0 && ` · team of ${pl.team_seats}`}
                  </p>
                </div>
              ))}
              {persona === 'photographer' && info?.seller_share_percent != null && <p className="text-center text-xs text-muted">Sellers keep {info.seller_share_percent}% of each sale.</p>}
              {persona === 'researcher' && <p className="text-center text-xs text-muted">Extra storage and a portfolio site are small monthly add-ons.</p>}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
