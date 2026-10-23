import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { AddonDef, GPUBundle, PlanLimits, StudioSettings } from '@layerto/types';
import { Button, Card, Icon, Input, Reveal, Select, Skeleton, Switch, cn, useNotify, useResource } from '@layerto/ui';
import { api } from '../../lib/api';

export const FEATURES: { id: string; label: string }[] = [
  { id: 'community', label: 'Community' },
  { id: 'marketplace_buy', label: 'Buy on marketplace' },
  { id: 'projects', label: 'Projects & datasets' },
  { id: 'train', label: 'Training & models' },
  { id: 'sites', label: 'Model sites' },
  { id: 'sell_models', label: 'Sell models' },
  { id: 'sell_images', label: 'Sell image datasets' },
  { id: 'research', label: 'Research workspace' },
  { id: 'teams', label: 'Teams' },
  { id: 'portfolio', label: 'Portfolio site' },
  { id: 'gpu_bundles', label: 'GPU hour bundles' },
];

const AUDIENCES = ['everyone', 'photographer', 'solo', 'researcher', 'enterprise'];
const money = (micro: number) => micro / 1_000_000;
const micro = (usd: string) => Math.round(Number(usd) * 1_000_000);

/** Platform rules, plans (limits + features), add-ons, GPU bundles and marketplace shares. */
export function PlatformSettings() {
  const notify = useNotify();
  const settings = useResource(() => api.adminStudioSettings(), 'admin-studio-settings');
  const [s, setS] = useState<StudioSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  useEffect(() => {
    if (settings.data) setS(settings.data);
  }, [settings.data]);
  if (!s) return <Skeleton className="h-64" />;

  const setPlan = (id: string, patch: Partial<PlanLimits>) => setS({ ...s, plans: { ...s.plans, [id]: { ...s.plans[id], ...patch } } });
  const addons = s.addons ?? {};
  const bundles = s.gpu_bundles ?? [];
  const setAddon = (id: string, patch: Partial<AddonDef>) => setS({ ...s, addons: { ...addons, [id]: { ...addons[id], ...patch } } });
  const setBundle = (i: number, patch: Partial<GPUBundle>) => setS({ ...s, gpu_bundles: bundles.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const save = async () => {
    setBusy(true);
    try {
      setS(await api.adminSaveStudioSettings(s));
      notify('Settings saved', 'success');
    } catch (err) {
      notify(errorMessage(err, "Couldn't save settings."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const order = Object.keys(s.plans).sort((a, b) => (a === 'free' ? -1 : b === 'free' ? 1 : s.plans[a].price - s.plans[b].price));

  return (
    <Reveal index={0}>
      <div className="space-y-4">
        <Card title="Rules">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Input
              label="Model creator share of each call (%)"
              type="number"
              min={0}
              max={90}
              step="0.5"
              value={s.creator_reward_bps / 100}
              onChange={(e) => setS({ ...s, creator_reward_bps: Math.round(Number(e.target.value) * 100) })}
              helperText="Credited when someone else calls a published model."
            />
            <Input
              label="Dataset seller share (%)"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={(s.bundle_seller_share_bps ?? 8000) / 100}
              onChange={(e) => setS({ ...s, bundle_seller_share_bps: Math.round(Number(e.target.value) * 100) })}
              helperText="What photographers keep from each dataset sale."
            />
            <Input
              label="Layerto GPU price (USD per hour)"
              type="number"
              min={0}
              step="0.01"
              value={money(s.gpu_price_per_hour)}
              onChange={(e) => setS({ ...s, gpu_price_per_hour: micro(e.target.value) })}
              helperText="Used for training estimates and charges."
            />
            <Input
              label="Delete datasets after training (days)"
              type="number"
              min={1}
              max={90}
              value={s.dataset_retention_days}
              onChange={(e) => setS({ ...s, dataset_retention_days: Number(e.target.value) })}
              helperText="For datasets the user did not keep."
            />
            <Input label="LTVision inference endpoint" value={s.ltvision_endpoint} onChange={(e) => setS({ ...s, ltvision_endpoint: e.target.value })} helperText="RunPod endpoint for custom models." />
            <Input
              label="Research chat price per message (USD)"
              type="number"
              min={0}
              step="0.001"
              value={money(s.assistant_price_per_message ?? 0)}
              onChange={(e) => setS({ ...s, assistant_price_per_message: micro(e.target.value) })}
              helperText="Shown on the waitlist page (feature not live yet)."
            />
          </div>
        </Card>

        <Card title="Plans" subtitle="Prices are per 30 days, paid from balance. Features decide which sections each plan opens.">
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {order.map((id) => {
              const p = s.plans[id];
              return (
                <div key={id} className="space-y-3 rounded-l2 border border-line p-4">
                  <div className="flex items-center justify-between">
                    <code className="rounded bg-page px-1.5 py-0.5 text-xs">{id}</code>
                    {id !== 'free' && (
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-crimson cursor-pointer"
                        onClick={() => {
                          const rest = { ...s.plans };
                          delete rest[id];
                          setS({ ...s, plans: rest });
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Name" value={p.name} onChange={(e) => setPlan(id, { name: e.target.value })} />
                    <Select label="Audience" value={p.audience || 'everyone'} onChange={(e) => setPlan(id, { audience: e.target.value })} options={AUDIENCES.map((a) => ({ value: a, label: a }))} />
                  </div>
                  <Input label="Description" value={p.description ?? ''} onChange={(e) => setPlan(id, { description: e.target.value })} />
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Price (USD)" type="number" min={0} step="0.01" disabled={id === 'free'} value={money(p.price)} onChange={(e) => setPlan(id, { price: micro(e.target.value) })} />
                    <Input label="Projects" type="number" min={0} value={p.projects} onChange={(e) => setPlan(id, { projects: Number(e.target.value) })} />
                    <Input label="Storage MB" type="number" min={0} value={p.storage_mb} onChange={(e) => setPlan(id, { storage_mb: Number(e.target.value) })} />
                    <Input label="Sites" type="number" min={0} value={p.sites} onChange={(e) => setPlan(id, { sites: Number(e.target.value) })} />
                    <Input label="Models" type="number" min={0} value={p.private_models} onChange={(e) => setPlan(id, { private_models: Number(e.target.value) })} />
                    <Input label="Team seats" type="number" min={0} value={p.team_seats ?? 0} onChange={(e) => setPlan(id, { team_seats: Number(e.target.value) })} />
                  </div>
                  <Switch checked={p.keep_datasets} onChange={(v) => setPlan(id, { keep_datasets: v })} label="Can keep datasets" />
                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-ink-secondary">Features</div>
                    <div className="flex flex-wrap gap-1.5">
                      {FEATURES.map((f) => {
                        const on = (p.features ?? []).includes(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setPlan(id, { features: on ? p.features.filter((x) => x !== f.id) : [...(p.features ?? []), f.id] })}
                            className={cn('rounded-pill border px-2.5 py-1 text-[11px] cursor-pointer', on ? 'border-crimson bg-crimson-tint text-crimson' : 'border-line text-muted hover:text-ink')}
                          >
                            {on && <Icon name="check" size={10} className="mr-1 inline" />}
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Input label="New plan id" value={newPlan} onChange={(e) => setNewPlan(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="student" />
            <Button
              variant="secondary"
              icon="plus"
              disabled={!newPlan || !!s.plans[newPlan]}
              onClick={() => {
                setS({
                  ...s,
                  plans: {
                    ...s.plans,
                    [newPlan]: { name: newPlan, audience: 'everyone', description: '', price: 0, projects: 2, storage_mb: 1024, keep_datasets: false, sites: 0, private_models: 2, team_seats: 0, features: ['community', 'marketplace_buy'] },
                  },
                });
                setNewPlan('');
              }}
            >
              Add plan
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Add-ons" subtitle="Monthly extras bought on top of a plan.">
            <div className="space-y-3">
              {Object.entries(addons).map(([id, a]) => (
                <div key={id} className="grid grid-cols-2 gap-3 rounded-control border border-line p-3 sm:grid-cols-4">
                  <div className="col-span-2 sm:col-span-4">
                    <code className="rounded bg-page px-1.5 py-0.5 text-xs">{id}</code>
                  </div>
                  <Input label="Name" value={a.name} onChange={(e) => setAddon(id, { name: e.target.value })} />
                  <Input label="Price (USD)" type="number" min={0} step="0.01" value={money(a.price)} onChange={(e) => setAddon(id, { price: micro(e.target.value) })} />
                  <Input label="Storage MB" type="number" min={0} value={a.storage_mb} onChange={(e) => setAddon(id, { storage_mb: Number(e.target.value) })} />
                  <Select label="Requires" value={a.requires} onChange={(e) => setAddon(id, { requires: e.target.value })} options={[{ value: '', label: 'Nothing' }, ...FEATURES.map((f) => ({ value: f.id, label: f.label }))]} />
                </div>
              ))}
            </div>
          </Card>
          <Card title="GPU hour bundles" subtitle="Prepaid training time, used before the balance.">
            <div className="space-y-3">
              {bundles.map((b, i) => (
                <div key={i} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1.5fr_1fr_1fr_auto]">
                  <Input label="Id" value={b.id} onChange={(e) => setBundle(i, { id: e.target.value.replace(/[^a-z0-9_]/g, '') })} />
                  <Input label="Name" value={b.name} onChange={(e) => setBundle(i, { name: e.target.value })} />
                  <Input label="Hours" type="number" min={1} value={b.hours} onChange={(e) => setBundle(i, { hours: Number(e.target.value) })} />
                  <Input label="Price (USD)" type="number" min={0} step="0.01" value={money(b.price)} onChange={(e) => setBundle(i, { price: micro(e.target.value) })} />
                  <Button variant="ghost" icon="trash" aria-label="Remove bundle" onClick={() => setS({ ...s, gpu_bundles: bundles.filter((_, j) => j !== i) })} />
                </div>
              ))}
              <Button size="sm" variant="secondary" icon="plus" onClick={() => setS({ ...s, gpu_bundles: [...bundles, { id: `gpu${bundles.length + 1}`, name: 'New bundle', hours: 10, price: 10_000_000 }] })}>
                Add bundle
              </Button>
            </div>
          </Card>
        </div>
        <div className="sticky bottom-4 flex justify-end">
          <Button loading={busy} icon="check" onClick={save}>
            Save settings
          </Button>
        </div>
      </div>
    </Reveal>
  );
}
