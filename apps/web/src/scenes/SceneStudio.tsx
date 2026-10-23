import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { StudioInfo } from '@layerto/types';
import { Icon, useMotionMode, usd } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { LayertoClient } from '@layerto/api-client';
import { API_URL, DASHBOARD_URL, PUBLIC_API_URL } from '../config';

const client = new LayertoClient(API_URL);

function useStudioInfo(): StudioInfo | null {
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
  return info;
}

/* ---- small illustrative visuals (no data, just shapes) ---- */

function AnnotateVisual({ animate }: { animate: boolean }) {
  const boxes = [
    { x: 34, y: 58, w: 70, h: 62, c: '#E11D48' },
    { x: 128, y: 40, w: 54, h: 50, c: '#2563EB' },
    { x: 150, y: 104, w: 66, h: 44, c: '#E11D48' },
  ];
  return (
    <svg viewBox="0 0 250 170" className="w-full h-auto" aria-hidden="true">
      <rect x="0" y="0" width="250" height="170" rx="10" className="fill-page" />
      <path d="M0 130 Q60 95 120 128 T250 118 V170 H0Z" className="fill-line" />
      <circle cx="205" cy="34" r="14" className="fill-line-strong" />
      {boxes.map((b, i) => (
        <motion.rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="3"
          fill={b.c}
          fillOpacity="0.12"
          stroke={b.c}
          strokeWidth="2.5"
          initial={animate ? { pathLength: 0, opacity: 0 } : false}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 + i * 0.35, duration: 0.6 }}
        />
      ))}
    </svg>
  );
}

function TrainVisual({ animate }: { animate: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-left">
      {[
        { t: 'Your Colab or Kaggle', d: 'Free GPU, your notebook', i: 'download' as IconName },
        { t: 'Layerto GPUs', d: 'One click, paid from balance', i: 'cpu' as IconName },
      ].map((r) => (
        <div key={r.t} className="rounded-l2 border border-line bg-page p-3">
          <Icon name={r.i} size={18} className="text-crimson" />
          <p className="mt-2 text-sm font-semibold text-ink">{r.t}</p>
          <p className="text-xs text-muted">{r.d}</p>
          <div className="mt-3 h-1.5 rounded-pill bg-line overflow-hidden">
            <motion.div
              className="h-full bg-crimson"
              initial={animate ? { width: '0%' } : false}
              whileInView={{ width: '100%' }}
              viewport={{ once: true }}
              transition={{ duration: 2.2, ease: 'easeInOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ApiVisual() {
  return (
    <pre className="rounded-l2 bg-[#15161A] text-[#ECEDEF] p-4 text-xs font-mono overflow-x-auto text-left" tabIndex={0}>
      <span className="text-[#F04D65]">POST</span> {PUBLIC_API_URL.replace(/^https?:\/\//, '')}/v1/vision/<span className="text-[#F5B841]">your-model</span>
      {'\n'}Authorization: Bearer lt_…{'\n\n'}
      {'{ "predictions": [ { "label": "ripe", "confidence": 0.93, "bbox": [ … ] } ] }'}
    </pre>
  );
}

function EarnVisual({ share }: { share: number | null }) {
  return (
    <div className="rounded-l2 border border-line bg-page p-4 text-left">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">your-model</span>
        <span className="rounded-pill bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs">Published</span>
      </div>
      <p className="mt-3 text-xs text-muted">Every paid call made by someone else:</p>
      <div className="mt-2 flex h-3 rounded-pill overflow-hidden">
        <div className="bg-crimson" style={{ width: `${share ?? 25}%` }} />
        <div className="flex-1 bg-line-strong" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{share !== null ? `${share}% to you, as credit` : 'Your share, as credit'}</span>
        <span>Layerto</span>
      </div>
    </div>
  );
}

const STEPS = [
  { n: '01', icon: 'pen' as IconName, title: 'Annotate', body: 'Upload your images and draw boxes in the browser. Keyboard shortcuts, autosave, nothing to install.' },
  { n: '02', icon: 'cpu' as IconName, title: 'Train', body: 'Pick a preset (Fast, Balanced, Best) or set every hyperparameter. Train free in your own notebook or on our GPUs.' },
  { n: '03', icon: 'key' as IconName, title: 'Get an API', body: 'The trained LTVision model gets its own endpoint right away, with the same keys, billing and ledger as every Layerto model.' },
  { n: '04', icon: 'coins' as IconName, title: 'Publish and earn', body: 'Put it on the marketplace. When others call it, a share of every paid call is added to your balance.' },
];

const SECTION = 'w-[94vw] max-w-7xl mx-auto';

/** Layerto Studio: annotate → train → API → earn, the researcher workspace, model sites and plans. */
export function SceneStudio() {
  const mode = useMotionMode();
  const info = useStudioInfo();
  const animate = !mode.reduced;
  const visuals = [
    <AnnotateVisual key="a" animate={animate} />,
    <TrainVisual key="t" animate={animate} />,
    <ApiVisual key="p" />,
    <EarnVisual key="e" share={info?.creator_share_percent ?? null} />,
  ];

  return (
    <section id="studio" aria-labelledby="studio-title" className="w-full bg-card py-[12vh]">
      <div className={`${SECTION} text-center`}>
        <p className="text-sm font-semibold text-crimson">Layerto Studio</p>
        <h2 id="studio-title" className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">
          Your data. Your model. Your API.
        </h2>
        <p className="mt-4 text-muted text-base sm:text-lg max-w-[60ch] mx-auto">
          Need a detector nobody sells? Label your own images, train an LTVision model on them, and call it like any other
          Layerto model. If it's useful to others, publish it and earn from every call.
        </p>
      </div>

      <ol className={`${SECTION} mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4`}>
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            className="rounded-l1 border border-line bg-page p-5 flex flex-col gap-4"
            initial={animate ? { opacity: 0, y: 24 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted">{s.n}</span>
              <span className="grid size-9 place-items-center rounded-control bg-crimson-tint text-crimson">
                <Icon name={s.icon} size={18} />
              </span>
              <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
            </div>
            <p className="text-sm text-ink-secondary">{s.body}</p>
            <div className="mt-auto rounded-l2 bg-card p-3 border border-line">{visuals[i]}</div>
          </motion.li>
        ))}
      </ol>

      <div className={`${SECTION} mt-6 grid gap-5 lg:grid-cols-3`}>
        <Feature icon="folder" title="A workspace for researchers">
          Group datasets, training runs and models into projects, keep notes and compare results. Turn on your public
          profile to share a portfolio of your work at <span className="font-mono text-ink">/@you</span>.
        </Feature>
        <Feature icon="globe" title="A website for your model">
          Pick a template (demo, product or research page), set your colours, and get a page with a live demo at{' '}
          <span className="font-mono text-ink">/s/your-model</span>. Visitors' runs go through our servers, so your API key is
          never in the page, and a monthly cap keeps spending in check.
        </Feature>
        <Feature icon="shield" title="Your images stay yours">
          Images sent to the API are never stored. Training images are encrypted and, unless you choose to keep them, deleted{' '}
          {info ? `${info.dataset_retention_days} day${info.dataset_retention_days === 1 ? '' : 's'}` : 'a few days'} after training.
          You can delete them yourself any time.
        </Feature>
      </div>

      <StudioPlans info={info} />
    </section>
  );
}

function Feature({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="rounded-l1 border border-line bg-page p-6">
      <span className="grid size-10 place-items-center rounded-control bg-crimson-tint text-crimson">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="mt-4 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-secondary leading-relaxed">{children}</p>
    </div>
  );
}

const PLAN_POINTS: Record<string, string[]> = {
  free: ['Annotate, train and publish', 'Public profile and projects', 'Datasets auto-delete after training'],
  researcher: ['Keep datasets as long as you like', 'A bigger portfolio: more projects and models', 'More storage and model sites'],
  lab: ['Everything in Researcher', 'Room for a whole lab', 'The highest limits'],
};

function StudioPlans({ info }: { info: StudioInfo | null }) {
  return (
    <div id="studio-plans" className={`${SECTION} mt-16`}>
      <div className="text-center">
        <h3 className="text-2xl sm:text-4xl font-bold tracking-tight">Studio plans</h3>
        <p className="mt-3 text-muted max-w-[60ch] mx-auto">
          Paid from your Layerto balance every 30 days. API calls are always pay per call.
          {info && <> Training on Layerto GPUs costs {usd(info.gpu_price_per_hour_usd)} per GPU hour, shown before you start and refunded if a run fails.</>}
        </p>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {(info?.plans ?? []).map((p) => (
          <div key={p.id} className={`rounded-l1 border bg-page p-6 flex flex-col ${p.id === 'researcher' ? 'border-crimson shadow-l2' : 'border-line'}`}>
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-ink">{p.name}</h4>
              {p.id === 'researcher' && <span className="rounded-pill bg-crimson-tint text-crimson px-2.5 py-0.5 text-xs font-medium">For researchers</span>}
            </div>
            <p className="mt-3 text-4xl font-bold text-ink">
              {p.price > 0 ? usd(String(p.price / 1_000_000)) : '$0'}
              <span className="text-sm font-normal text-muted"> / 30 days</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink-secondary flex-1">
              {(PLAN_POINTS[p.id] ?? []).map((x) => (
                <li key={x} className="flex gap-2">
                  <Icon name="check" size={16} className="text-crimson shrink-0 mt-0.5" />
                  {x}
                </li>
              ))}
              <li className="flex gap-2 text-muted">
                <Icon name="layers" size={16} className="shrink-0 mt-0.5" />
                {p.projects} projects · {p.storage_mb >= 1024 ? `${Math.round(p.storage_mb / 1024)} GB` : `${p.storage_mb} MB`} · {p.sites} {p.sites === 1 ? 'site' : 'sites'}
              </li>
            </ul>
            <a
              href={`${DASHBOARD_URL}/plan`}
              className={`mt-6 no-underline inline-flex justify-center px-5 py-2.5 rounded-control font-semibold transition-colors ${
                p.id === 'researcher'
                  ? 'bg-crimson dark:bg-crimson-fill text-white hover:bg-crimson-hover'
                  : 'border border-line-strong text-ink hover:border-crimson hover:text-crimson'
              }`}
            >
              {p.price > 0 ? `Choose ${p.name}` : 'Start free'}
            </a>
          </div>
        ))}
        {!info && [0, 1, 2].map((i) => <div key={i} className="h-80 rounded-l1 border border-line bg-page animate-pulse" />)}
      </div>
    </div>
  );
}
