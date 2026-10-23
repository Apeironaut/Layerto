import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { CustomModel, DataLicense, DatasetListing, Purchase } from '@layerto/types';
import { Alert, Avatar, Button, Card, Chip, EmptyState, Icon, Modal, PageHeader, Reveal, Select, Skeleton, Tabs, cn, usd, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { SITE_URL } from '../../config';
import { useHub } from '../../hub/HubContext';
import { AuthImage } from '../studio/components/AuthImage';
import { bytes, pct, shortDate } from '../studio/lib/format';
import { ModelDrawer } from './ModelDrawer';

type MarketTab = 'models' | 'datasets' | 'papers' | 'purchases';

export const LICENSES: Record<DataLicense, { label: string; short: string; tone: string }> = {
  research_only: { label: 'Research only', short: 'Research', tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  commercial: { label: 'Commercial', short: 'Commercial', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  commercial_no_redistribution: { label: 'Commercial, no redistribution', short: 'Commercial*', tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  cc_by: { label: 'CC BY 4.0', short: 'CC BY', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
};

function useDebounced(v: string, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v.trim()), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** The hub's marketplace: community models with metrics, licensed image datasets, published papers and your purchases. */
export function MarketplacePage({ tab, listingId }: { tab: string; listingId?: string }) {
  const { navigate, has } = useHub();
  const active: MarketTab = (['models', 'datasets', 'papers', 'purchases'] as const).includes(tab as MarketTab) ? (tab as MarketTab) : 'models';
  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Models with measured accuracy, image datasets with clear licenses, and research from the community."
        actions={
          (has('sell_images') || has('sell_models')) && (
            <Button variant="secondary" icon="camera" onClick={() => navigate('/sell')}>
              Sell on Layerto
            </Button>
          )
        }
      />
      <Tabs<MarketTab>
        value={active}
        onChange={(t) => navigate(t === 'models' ? '/marketplace' : `/marketplace/${t}`)}
        items={[
          { value: 'models', label: 'Models', icon: 'box' },
          { value: 'datasets', label: 'Image datasets', icon: 'image' },
          { value: 'papers', label: 'Papers', icon: 'file' },
          { value: 'purchases', label: 'My purchases', icon: 'bookmark' },
        ]}
      />
      {active === 'models' && <ModelsTab />}
      {active === 'datasets' && (listingId ? <ListingDetail id={listingId} /> : <DatasetsTab />)}
      {active === 'papers' && <PapersTab />}
      {active === 'purchases' && <PurchasesTab />}
    </>
  );
}

function ModelsTab() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('popular');
  const [cls, setCls] = useState('');
  const query = useDebounced(q);
  const models = useResource(() => api.studioMarketplace(query, sort), `market-models-${query}-${sort}`);
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(window.location.search).get('model'));
  const list = (models.data ?? []).filter((m) => !cls || m.classes.includes(cls));
  const topClasses = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of models.data ?? []) for (const k of m.classes) c.set(k, (c.get(k) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k]) => k);
  }, [models.data]);
  const current = (models.data ?? []).find((m) => m.slug === open) ?? null;
  const [fetched, setFetched] = useState<CustomModel | null>(null);
  useEffect(() => {
    if (open && !current && !models.loading) api.studioModel(open).then(setFetched, () => setOpen(null));
  }, [open, current, models.loading]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-control border border-line bg-card px-3 focus-within:ring-2 focus-within:ring-focus">
          <Icon name="search" size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models or what they detect (e.g. pothole, ripe mango)" className="flex-1 bg-transparent text-sm outline-none" aria-label="Search models" />
        </label>
        <Select
          label=""
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={[
            { value: 'popular', label: 'Most used' },
            { value: 'accuracy', label: 'Highest mAP' },
            { value: 'new', label: 'Newest' },
          ]}
        />
      </div>
      {topClasses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topClasses.map((c) => (
            <button key={c} type="button" onClick={() => setCls(cls === c ? '' : c)} className={cn('rounded-pill border px-2.5 py-1 text-xs cursor-pointer', cls === c ? 'border-crimson bg-crimson-tint text-crimson' : 'border-line text-muted hover:text-ink')}>
              {c}
            </button>
          ))}
        </div>
      )}
      {models.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon="store" title={query || cls ? 'No models match' : 'No community models yet'} description="Train your own and be the first to publish." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m, i) => (
            <Reveal key={m.id} index={i % 9}>
              <ModelCard m={m} onOpen={() => setOpen(m.slug)} />
            </Reveal>
          ))}
        </div>
      )}
      <ModelDrawer model={current ?? fetched} onClose={() => (setOpen(null), setFetched(null))} />
    </>
  );
}

function ModelCard({ m, onOpen }: { m: CustomModel; onOpen: () => void }) {
  const map = m.metrics.map50_95;
  return (
    <button type="button" onClick={onOpen} className="group flex h-full w-full flex-col rounded-l2 border border-line bg-card p-5 text-left shadow-l1 transition-all hover:-translate-y-0.5 hover:border-crimson-border hover:shadow-l2 cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="relative grid size-14 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-line)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-crimson)" strokeWidth="3" strokeDasharray={`${(map ?? 0) * 97.4} 97.4`} strokeLinecap="round" />
          </svg>
          <span className="text-[11px] font-bold tabular-nums">{map != null ? Math.round(map * 100) : '—'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold group-hover:text-crimson">{m.name}</h3>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Avatar name={m.owner} size={14} />@{m.owner}
          </p>
        </div>
        <Chip variant="brand">{usd(m.price_usd)}</Chip>
      </div>
      <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-secondary">{m.description || 'No description'}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {m.classes.slice(0, 5).map((c) => (
          <span key={c} className="rounded-pill bg-page px-2 py-0.5 text-[11px]">
            {c}
          </span>
        ))}
        {m.classes.length > 5 && <span className="text-[11px] text-muted">+{m.classes.length - 5}</span>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-[11px] text-muted">
        <span>
          <strong className="block text-sm text-ink">{pct(m.metrics.map50)}</strong>mAP50
        </span>
        <span>
          <strong className="block text-sm text-ink">{m.metrics.latency_ms != null ? `${Math.round(m.metrics.latency_ms)} ms` : m.size || '—'}</strong>
          {m.metrics.latency_ms != null ? 'latency' : 'size'}
        </span>
        <span>
          <strong className="block text-sm text-ink">{m.calls_30d.toLocaleString()}</strong>calls/30d
        </span>
      </div>
      {m.source === 'imported' && <span className="mt-2 text-[10px] text-muted">Metrics reported by the creator</span>}
    </button>
  );
}

function DatasetsTab() {
  const { navigate } = useHub();
  const [q, setQ] = useState('');
  const [license, setLicense] = useState('');
  const [sort, setSort] = useState('');
  const query = useDebounced(q);
  const listings = useResource(() => api.listings({ q: query, license, sort }), `listings-${query}-${license}-${sort}`);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-control border border-line bg-card px-3 focus-within:ring-2 focus-within:ring-focus">
          <Icon name="search" size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search datasets: drones, tea leaves, street signs…" className="flex-1 bg-transparent text-sm outline-none" aria-label="Search datasets" />
        </label>
        <Select label="" value={license} onChange={(e) => setLicense(e.target.value)} options={[{ value: '', label: 'Any license' }, ...Object.entries(LICENSES).map(([value, l]) => ({ value, label: l.label }))]} />
        <Select
          label=""
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={[
            { value: '', label: 'Newest' },
            { value: 'popular', label: 'Best selling' },
            { value: 'price', label: 'Lowest price' },
          ]}
        />
      </div>
      {listings.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (listings.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="camera" title="No datasets match" description="Photographers list labeled image collections here. Check back soon, or sell your own." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(listings.data ?? []).map((l, i) => (
            <Reveal key={l.id} index={i % 9}>
              <ListingCard l={l} onOpen={() => navigate(`/marketplace/datasets/${l.id}`)} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}

export function ListingCard({ l, onOpen }: { l: DatasetListing; onOpen: () => void }) {
  const lic = LICENSES[l.license];
  return (
    <button type="button" onClick={onOpen} className="group flex h-full w-full flex-col overflow-hidden rounded-l2 border border-line bg-card text-left shadow-l1 transition-all hover:-translate-y-0.5 hover:shadow-l2 cursor-pointer">
      <div className="grid aspect-[16/9] grid-cols-3 grid-rows-2 gap-0.5 bg-page">
        {l.previews.slice(0, 5).map((p, i) => (
          <div key={p} className={cn('overflow-hidden', i === 0 && 'col-span-2 row-span-2')}>
            <AuthImage path={api.listingPreviewPath(l.id, p)} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
        ))}
        {l.previews.length === 0 && (
          <div className="col-span-3 row-span-2 grid place-items-center text-muted">
            <Icon name="image" size={28} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug group-hover:text-crimson">{l.title}</h3>
          <span className="shrink-0 text-lg font-bold">{Number(l.price_usd) === 0 ? 'Free' : usd(l.price_usd)}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">by @{l.seller}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={cn('rounded-pill px-2 py-0.5 font-semibold', lic.tone)}>{lic.short}</span>
          <span className="text-muted">{l.images.toLocaleString()} images</span>
          <span className="text-muted">· {l.boxes.toLocaleString()} boxes</span>
          {l.purchased && <Chip variant="active">Owned</Chip>}
        </div>
        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          {l.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[11px] text-muted">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function ListingDetail({ id }: { id: string }) {
  const { navigate, has, reloadBalance, openPlan, openComposer } = useHub();
  const notify = useNotify();
  const listing = useResource(() => api.listing(id), `listing-${id}`);
  const [big, setBig] = useState(0);
  const [buying, setBuying] = useState(false);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const l = listing.data;
  if (listing.error) {
    return (
      <Card>
        <EmptyState icon="image" title="Dataset not found" action={<Button onClick={() => navigate('/marketplace/datasets')}>All datasets</Button>} />
      </Card>
    );
  }
  if (!l) return <Skeleton className="h-96" />;
  const lic = LICENSES[l.license];
  const buy = async () => {
    setBusy(true);
    try {
      await api.buyListing(l.id);
      reloadBalance();
      await listing.reload();
      setBuying(false);
      notify('Purchased. Import it into a project to start training.', 'success');
      setImportOpen(true);
    } catch (err) {
      notify(errorMessage(err, "Couldn't complete the purchase."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <button type="button" className="inline-flex items-center gap-1 text-sm text-muted hover:text-crimson cursor-pointer" onClick={() => navigate('/marketplace/datasets')}>
        <Icon name="arrowLeft" size={14} /> All datasets
      </button>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-l2 border border-line bg-page">
            {l.previews[big] ? <AuthImage key={l.previews[big]} path={api.listingPreviewPath(l.id, l.previews[big])} alt={`${l.title} preview`} className="aspect-[4/3] w-full object-contain" /> : <div className="grid aspect-[4/3] place-items-center text-muted">No previews</div>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {l.previews.map((p, i) => (
              <button key={p} type="button" onClick={() => setBig(i)} className={cn('size-20 shrink-0 overflow-hidden rounded-control border-2 cursor-pointer', i === big ? 'border-crimson' : 'border-transparent opacity-70 hover:opacity-100')}>
                <AuthImage path={api.listingPreviewPath(l.id, p)} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
          <Card title="About this dataset">
            <p className="whitespace-pre-line text-sm text-ink-secondary">{l.description}</p>
            {l.classes.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Labeled classes</div>
                <div className="flex flex-wrap gap-1.5">
                  {l.classes.map((c) => (
                    <span key={c} className="rounded-pill bg-page px-2.5 py-0.5 text-xs">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <h1 className="text-xl font-bold leading-snug">{l.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Avatar name={l.seller} size={18} /> @{l.seller}
              {l.published_at && ` · ${shortDate(l.published_at)}`}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Images', l.images.toLocaleString()],
                ['Labeled', l.labeled.toLocaleString()],
                ['Boxes', l.boxes.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="rounded-control bg-page py-2">
                  <div className="font-bold">{v}</div>
                  <div className="text-[10px] text-muted">{k}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">
              {bytes(l.bytes)} · {l.sales} {l.sales === 1 ? 'sale' : 'sales'}
            </p>
            <div className={cn('mt-4 rounded-control p-3 text-sm', lic.tone)}>
              <div className="font-semibold">{lic.label}</div>
              <p className="mt-0.5 text-xs opacity-90">{l.license_text}</p>
            </div>
            <div className="mt-4 text-3xl font-bold">{Number(l.price_usd) === 0 ? 'Free' : usd(l.price_usd)}</div>
            {l.mine ? (
              <Alert tone="info" className="mt-3">
                This is your listing.{' '}
                <button type="button" className="font-semibold text-crimson cursor-pointer" onClick={() => navigate('/sell')}>
                  Manage it
                </button>
              </Alert>
            ) : l.purchased ? (
              <div className="mt-3 space-y-2">
                <Alert tone="success">You own this dataset.</Alert>
                {has('projects') && (
                  <Button className="w-full" icon="folder" onClick={() => setImportOpen(true)}>
                    Import into a project
                  </Button>
                )}
              </div>
            ) : has('marketplace_buy') ? (
              <Button className="mt-3 w-full" icon="dollar" onClick={() => setBuying(true)}>
                {Number(l.price_usd) === 0 ? 'Get it free' : 'Buy dataset'}
              </Button>
            ) : (
              <Button className="mt-3 w-full" icon="lock" onClick={() => openPlan('marketplace_buy')}>
                Upgrade to buy datasets
              </Button>
            )}
            <button type="button" className="mt-3 inline-flex w-full items-center justify-center gap-1 text-xs text-muted hover:text-crimson cursor-pointer" onClick={() => openComposer({ space: 'datasets', title: l.title, link_kind: 'listing', link_ref: l.id })}>
              <Icon name="share" size={12} /> Share with the community
            </button>
          </Card>
        </div>
      </div>
      <Modal isOpen={buying} onClose={() => setBuying(false)} title="Confirm purchase">
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{l.title}</strong> for <strong>{Number(l.price_usd) === 0 ? 'free' : usd(l.price_usd)}</strong>, paid from your balance.
          </p>
          <div className={cn('rounded-control p-3 text-sm', lic.tone)}>
            <div className="font-semibold">{lic.label}</div>
            <p className="mt-0.5 text-xs">{l.license_text}</p>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-crimson)]" />
            I accept this license. Models trained on this data carry it, and research-only data can't be used in models I sell.
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBuying(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!accept} onClick={buy}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
      <ImportModal open={importOpen} purchaseListingId={l.id} onClose={() => setImportOpen(false)} />
    </div>
  );
}

/** Copy a purchased dataset into one of your projects. */
export function ImportModal({ open, purchaseListingId, purchase, onClose, onDone }: { open: boolean; purchaseListingId?: string; purchase?: Purchase; onClose: () => void; onDone?: () => void }) {
  const { navigate } = useHub();
  const notify = useNotify();
  const projects = useResource(() => (open ? api.studioProjects() : Promise.resolve([])), open ? 'studio-projects' : null);
  const purchases = useResource(() => (open && !purchase ? api.purchases() : Promise.resolve([])), open && !purchase ? 'market-purchases' : null);
  const p = purchase ?? (purchases.data ?? []).find((x) => x.listing_id === purchaseListingId);
  const [pid, setPid] = useState('');
  const [busy, setBusy] = useState(false);
  const writable = (projects.data ?? []).filter((x) => x.role !== 'viewer');
  useEffect(() => {
    if (!pid && writable[0]) setPid(writable[0].id);
  }, [writable, pid]);
  const go = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const r = await api.importPurchase(p.id, pid);
      notify(`Copied ${r.copied} images into “${r.dataset.name}”`, 'success');
      onDone?.();
      onClose();
      navigate(`/datasets/${r.dataset.id}`);
    } catch (err) {
      notify(errorMessage(err, "Couldn't import."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Import into a project" description="A copy of the images and labels is added as a dataset in the project, ready to train. You can import into several projects.">
      {writable.length === 0 && !projects.loading ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Create a project first.</p>
          <Button onClick={() => navigate('/projects')}>Go to projects</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Select label="Project" value={pid} onChange={(e) => setPid(e.target.value)} options={writable.map((x) => ({ value: x.id, label: x.name }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Later
            </Button>
            <Button loading={busy} disabled={!pid || !p} onClick={go}>
              Import
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PapersTab() {
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const papers = useResource(() => api.publicPapers({ q: query }), `public-papers-${query}`);
  return (
    <>
      <label className="flex h-10 items-center gap-2 rounded-control border border-line bg-card px-3 focus-within:ring-2 focus-within:ring-focus">
        <Icon name="search" size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, abstracts, keywords" className="flex-1 bg-transparent text-sm outline-none" aria-label="Search papers" />
      </label>
      {papers.loading ? (
        <Skeleton className="h-60" />
      ) : (papers.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="file" title="No papers yet" description="Researchers publish papers here with their PDF, BibTeX and the models behind them." />
        </Card>
      ) : (
        <div className="space-y-3">
          {(papers.data ?? []).map((p, i) => (
            <Reveal key={p.id} index={i % 8}>
              <a href={`${SITE_URL}/papers/${p.id}`} target="_blank" rel="noreferrer" className="group block rounded-l2 border border-line bg-card p-5 shadow-l1 transition-all hover:border-crimson-border hover:shadow-l2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {p.venue && <span className="rounded bg-page px-1.5 py-0.5 font-semibold text-ink-secondary">{p.venue} {p.year}</span>}
                  <span>@{p.owner}</span>
                  {p.has_pdf && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="file" size={12} /> PDF
                    </span>
                  )}
                  {p.model_slugs.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="box" size={12} /> {p.model_slugs.length} model{p.model_slugs.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-lg font-semibold leading-snug group-hover:text-crimson">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.authors.join(', ')}</p>
                <p className="mt-2 line-clamp-3 text-sm text-ink-secondary">{p.abstract}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.keywords.slice(0, 6).map((k) => (
                    <span key={k} className="rounded-pill bg-page px-2 py-0.5 text-[11px]">
                      {k}
                    </span>
                  ))}
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}

function PurchasesTab() {
  const { navigate, has } = useHub();
  const purchases = useResource(() => api.purchases(), 'market-purchases');
  const [importing, setImporting] = useState<Purchase | null>(null);
  if (purchases.loading) return <Skeleton className="h-48" />;
  if ((purchases.data ?? []).length === 0) {
    return (
      <Card>
        <EmptyState icon="bookmark" title="No purchases yet" description="Datasets you buy appear here, ready to import into any of your projects." action={<Button onClick={() => navigate('/marketplace/datasets')}>Browse datasets</Button>} />
      </Card>
    );
  }
  return (
    <>
      <Card padded={false}>
        <ul className="divide-y divide-line">
          {(purchases.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="grid size-10 place-items-center rounded-control bg-page text-muted">
                <Icon name="image" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => navigate(`/marketplace/datasets/${p.listing_id}`)} className="text-left font-medium hover:text-crimson cursor-pointer">
                  {p.title}
                </button>
                <div className="text-xs text-muted">
                  @{p.seller} · {p.images} images · {LICENSES[p.license]?.label} · {usd(p.price_usd)} · {shortDate(p.created_at)}
                </div>
                <div className="text-[11px] text-muted">{p.dataset_ids.length ? `Imported into ${p.dataset_ids.length} dataset${p.dataset_ids.length > 1 ? 's' : ''}` : 'Not imported yet'}</div>
              </div>
              {has('projects') && (
                <Button size="sm" icon="folder" onClick={() => setImporting(p)}>
                  Import into project
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <ImportModal open={importing !== null} purchase={importing ?? undefined} onClose={() => setImporting(null)} onDone={() => void purchases.reload()} />
    </>
  );
}
