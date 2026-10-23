import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { DataLicense, Dataset, DatasetListing } from '@layerto/types';
import { Alert, Button, Card, Chip, EmptyState, Icon, Input, Modal, PageHeader, ProgressBar, Reveal, Select, Skeleton, cn, usd, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { useHub } from '../../hub/HubContext';
import { bytes, parseClasses, shortDate } from '../studio/lib/format';
import { LICENSES, ListingCard } from '../market/MarketplacePage';
import { TagInput, TextArea } from '../research/shared';

const STATUS: Record<DatasetListing['status'], { label: string; variant: 'neutral' | 'pending' | 'active' | 'danger' | 'muted' }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  pending: { label: 'In review', variant: 'pending' },
  public: { label: 'On sale', variant: 'active' },
  rejected: { label: 'Changes needed', variant: 'danger' },
  removed: { label: 'Unlisted', variant: 'muted' },
};

/** Seller studio: upload photo collections, label them, set a license and price, and track sales. */
export function SellPage() {
  const { navigate, has, plan, openPlan, user } = useHub();
  const notify = useNotify();
  const bundles = useResource(() => (has('sell_images') ? api.studioDatasetsKind('bundle') : Promise.resolve([] as Dataset[])), `bundles-${has('sell_images')}`);
  const listings = useResource(() => (has('sell_images') ? api.myListings() : Promise.resolve([] as DatasetListing[])), `my-listings-${has('sell_images')}`);
  const earnings = useResource(() => api.studioEarnings(), 'studio-earnings');
  const info = useResource(() => api.studioInfo(), 'studio-info');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ listing?: DatasetListing; dataset?: Dataset } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!has('sell_images')) {
    return (
      <>
        <PageHeader title="Sell on Layerto" description="Earn from your photos and your models." />
        <Card className="text-center">
          <EmptyState
            icon="camera"
            title="Selling datasets needs a seller plan"
            description="Photographers can list labeled photo collections for researchers and builders to buy. Pick the Photographer plan, or a plan that includes selling."
            action={
              <Button icon="crown" onClick={() => openPlan('sell_images')}>
                See plans
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const listed = new Map((listings.data ?? []).map((l) => [l.dataset_id, l]));
  const sales = (listings.data ?? []).reduce((s, l) => s + l.sales, 0);
  const onSale = (listings.data ?? []).filter((l) => l.status === 'public').length;

  const act = async (l: DatasetListing, what: 'submit' | 'unlist') => {
    setBusy(l.id);
    try {
      if (what === 'submit') await api.submitListing(l.id);
      else await api.unlistListing(l.id);
      notify(what === 'submit' ? 'Sent for review. Usually reviewed within a day.' : 'Listing removed from sale', 'success');
      void listings.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't update the listing."), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title={plan?.limits.audience === 'photographer' ? `Welcome, ${user.first_name || user.username || 'photographer'}` : 'Sell on Layerto'}
        description="Upload a photo collection, label what's in it, choose a license and a price. Researchers and companies buy it to train their models."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            New collection
          </Button>
        }
      />
      <Reveal index={0}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { k: 'Dataset earnings', v: earnings.data ? usd(earnings.data.datasets_total_usd) : '—', icon: 'dollar' as const },
            { k: 'Sales', v: sales, icon: 'trophy' as const },
            { k: 'On sale', v: onSale, icon: 'store' as const },
            { k: 'Collections', v: bundles.data?.length ?? '—', icon: 'image' as const },
          ].map((s) => (
            <div key={s.k} className="rounded-l2 border border-line bg-card p-4 shadow-l1">
              <div className="flex items-center justify-between text-xs text-muted">
                {s.k}
                <Icon name={s.icon} size={15} />
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums">{s.v}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal index={1}>
        <Card title="How selling works" subtitle="Four steps, from upload to payout">
          <ol className="grid gap-3 md:grid-cols-4">
            {[
              { i: 'upload' as const, t: 'Upload', d: 'Add at least 10 photos to a collection. Originals stay private; buyers see 8 small previews.' },
              { i: 'target' as const, t: 'Label', d: 'Draw boxes around what matters. Labeled sets sell for more and train better.' },
              { i: 'shield' as const, t: 'License & price', d: 'Pick research-only, commercial or CC BY and set your price.' },
              { i: 'dollar' as const, t: 'Get paid', d: `You keep ${info.data?.seller_share_percent != null ? `${info.data.seller_share_percent}%` : 'most'} of every sale, credited to your balance.` },
            ].map((s, n) => (
              <li key={s.t} className="relative rounded-control bg-page p-4">
                <span className="absolute right-3 top-3 text-2xl font-black text-line">{n + 1}</span>
                <Icon name={s.i} size={20} className="text-crimson" />
                <div className="mt-2 font-semibold">{s.t}</div>
                <p className="mt-1 text-xs text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card title="Your collections" padded={false}>
          {bundles.loading ? (
            <Skeleton className="m-5 h-24" />
          ) : (bundles.data ?? []).length === 0 ? (
            <EmptyState icon="camera" title="No collections yet" description="Start with a set of photos you own the rights to." action={<Button icon="plus" onClick={() => setCreating(true)}>New collection</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {(bundles.data ?? []).map((d) => {
                const l = listed.get(d.id);
                const ready = d.images >= 10 && (l?.description?.length ?? d.description.length) >= 30;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="text-left font-semibold hover:text-crimson cursor-pointer" onClick={() => navigate(`/datasets/${d.id}`)}>
                          {l?.title || d.name}
                        </button>
                        {l ? <Chip variant={STATUS[l.status].variant}>{STATUS[l.status].label}</Chip> : <Chip variant="muted">Not listed</Chip>}
                        {l && <span className={cn('rounded-pill px-2 py-0.5 text-[11px] font-semibold', LICENSES[l.license].tone)}>{LICENSES[l.license].short}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                        <span>{d.images} images</span>
                        <span>
                          {d.labeled}/{d.images} labeled
                        </span>
                        <span>{bytes(d.bytes)}</span>
                        {l && <span>{Number(l.price_usd) === 0 ? 'Free' : usd(l.price_usd)}</span>}
                        {l && (
                          <span>
                            {l.sales} sales · {usd(l.earned_usd ?? '0')} earned
                          </span>
                        )}
                      </div>
                      <div className="mt-2 max-w-xs">
                        <ProgressBar current={Math.min(d.images, 10)} max={10} label={`${d.name}: ${d.images} of 10 images`} />
                      </div>
                      {l?.status === 'rejected' && l.review_note && <p className="mt-2 text-xs text-crimson">Reviewer: {l.review_note}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" icon="upload" onClick={() => navigate(`/datasets/${d.id}`)}>
                        Photos
                      </Button>
                      <Button size="sm" variant="secondary" icon="target" onClick={() => navigate(`/datasets/${d.id}/annotate`)}>
                        Label
                      </Button>
                      <Button size="sm" variant="secondary" icon="pen" onClick={() => setEditing({ listing: l, dataset: d })}>
                        {l ? 'Edit listing' : 'Create listing'}
                      </Button>
                      {l && (l.status === 'draft' || l.status === 'rejected' || l.status === 'removed') && (
                        <Button size="sm" icon="check" loading={busy === l.id} disabled={!ready} title={ready ? '' : 'Needs 10+ images and a 30+ character description'} onClick={() => void act(l, 'submit')}>
                          Submit for review
                        </Button>
                      )}
                      {l && (l.status === 'public' || l.status === 'pending') && (
                        <Button size="sm" variant="ghost" loading={busy === l.id} onClick={() => void act(l, 'unlist')}>
                          Unlist
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Reveal>

      {(listings.data ?? []).some((l) => l.status === 'public') && (
        <Reveal index={3}>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">How buyers see your listings</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(listings.data ?? [])
                .filter((l) => l.status === 'public')
                .map((l) => (
                  <ListingCard key={l.id} l={l} onOpen={() => navigate(`/marketplace/datasets/${l.id}`)} />
                ))}
            </div>
          </div>
        </Reveal>
      )}

      {has('sell_models') && (
        <Alert tone="info">
          You can also sell API access to models you train.{' '}
          <button type="button" className="font-semibold text-crimson cursor-pointer" onClick={() => navigate('/models')}>
            Publish a model
          </button>
        </Alert>
      )}

      <CreateCollectionModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(d) => {
          setCreating(false);
          void bundles.reload();
          navigate(`/datasets/${d.id}`);
        }}
      />
      <ListingModal
        state={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void listings.reload();
        }}
      />
    </>
  );
}

function CreateCollectionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (d: Dataset) => void }) {
  const notify = useNotify();
  const [name, setName] = useState('');
  const [classes, setClasses] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const d = await api.studioCreateBundle({ name: name.trim(), classes: parseClasses(classes), description: description.trim() });
      setName('');
      setClasses('');
      setDescription('');
      onCreated(d);
    } catch (err) {
      notify(errorMessage(err, "Couldn't create the collection."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="New photo collection" size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Colombo street signs, daytime" required autoFocus />
        <TextArea label="What's in it" value={description} onChange={setDescription} rows={3} maxLength={4000} placeholder="Where and how the photos were taken, camera, lighting, what objects appear…" />
        <Input label="Labels (optional)" value={classes} onChange={(e) => setClasses(e.target.value)} placeholder="stop sign, speed limit, crossing" />
        <p className="text-xs text-muted">Only upload photos you took or have the rights to sell. You can add labels later.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            Create and upload photos
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ListingModal({ state, onClose, onSaved }: { state: { listing?: DatasetListing; dataset?: Dataset } | null; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [license, setLicense] = useState<DataLicense>('commercial');
  const [price, setPrice] = useState('25');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!state) return;
    const l = state.listing;
    setTitle(l?.title ?? state.dataset?.name ?? '');
    setDescription(l?.description ?? state.dataset?.description ?? '');
    setTags(l?.tags ?? state.dataset?.classes.slice(0, 5) ?? []);
    setLicense(l?.license ?? 'commercial');
    setPrice(l?.price_usd ?? '25');
  }, [state]);
  const live = state?.listing?.status === 'public';
  const save = async () => {
    setBusy(true);
    try {
      const body = { title: title.trim(), description: description.trim(), tags, license, price_usd: price };
      if (state?.listing) await api.updateListing(state.listing.id, body);
      else await api.createListing({ ...body, dataset_id: state?.dataset?.id });
      notify('Listing saved', 'success');
      onSaved();
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the listing."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={state !== null} onClose={onClose} title={state?.listing ? 'Edit listing' : 'Create listing'} size="xl">
      <div className="space-y-4">
        <Input label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <TextArea label="Description" value={description} onChange={setDescription} rows={5} maxLength={4000} hint={`${description.length}/30 characters minimum. Say where, when and how the photos were taken.`} />
        <TagInput label="Tags" value={tags} onChange={setTags} placeholder="streets, signs, daytime" />
        <div>
          <span className="mb-1.5 block text-sm font-medium">License</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(LICENSES) as DataLicense[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setLicense(k)}
                className={cn('rounded-control border p-3 text-left transition-colors cursor-pointer', license === k ? 'border-crimson bg-crimson-tint/40' : 'border-line hover:border-line-strong')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn('size-3 rounded-full border-2', license === k ? 'border-crimson bg-crimson' : 'border-line-strong')} />
                  {LICENSES[k].label}
                </div>
                <p className="mt-1 text-xs text-muted">{LICENSE_HELP[k]}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Price (USD)" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Select
            label="Quick price"
            value=""
            onChange={(e) => e.target.value && setPrice(e.target.value)}
            options={[{ value: '', label: 'Pick a typical price…' }, { value: '0', label: 'Free (build a following)' }, { value: '15', label: '$15 small set' }, { value: '49', label: '$49 labeled set' }, { value: '199', label: '$199 large labeled set' }]}
          />
        </div>
        {live && <Alert tone="info">Changing the license or price sends the listing back for a quick review; it stays off sale until approved.</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!title.trim()} onClick={save}>
            Save listing
          </Button>
        </div>
        {state?.listing && <p className="text-right text-[11px] text-muted">Created {shortDate(state.listing.created_at)}</p>}
      </div>
    </Modal>
  );
}

const LICENSE_HELP: Record<DataLicense, string> = {
  research_only: 'Universities and labs only. Lower price, wide reach. Models trained on it cannot be sold.',
  commercial: 'Buyers may sell models trained on it. Images can’t be resold.',
  commercial_no_redistribution: 'Commercial models allowed; images can never be shared or published.',
  cc_by: 'Anyone can reuse the images with credit to you.',
};
