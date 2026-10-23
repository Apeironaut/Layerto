import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { PlanItem } from '@layerto/types';
import { Alert, Button, Card, Chip, ConfirmModal, Icon, ProgressBar, Skeleton, Switch, cn, useNotify, usd } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { api } from '../lib/api';
import { useHub } from './HubContext';
import { bytes, shortDate } from '../features/studio/lib/format';

const micro = (n: number) => usd(String(n / 1_000_000));

const AUDIENCE: Record<string, { label: string; icon: IconName; blurb: string }> = {
  everyone: { label: 'Everyone', icon: 'compass', blurb: 'Start building' },
  photographer: { label: 'Photographers', icon: 'camera', blurb: 'Sell image datasets' },
  solo: { label: 'Developers & solopreneurs', icon: 'zap', blurb: 'Ship vision features' },
  researcher: { label: 'Researchers', icon: 'flask', blurb: 'Research workspace' },
  enterprise: { label: 'Enterprise', icon: 'team', blurb: 'Teams at scale' },
};

function Meter({ label, used, max, current, total }: { label: string; used: string; max: string; current: number; total: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-mono text-xs text-muted">
          {used} / {max}
        </span>
      </div>
      <ProgressBar label={`${label}: ${used} of ${max}`} current={current} max={Math.max(1, total)} />
    </div>
  );
}

/** Plans by audience, add-ons (storage, portfolio site) and prepaid GPU hours. Shown in a modal from the account menu. */
export function PlanPanel({ highlight }: { highlight?: string }) {
  const { plan, reloadPlan, reloadBalance, track } = useHub();
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PlanItem | null>(null);
  const [extraGB, setExtraGB] = useState(1);
  if (!plan) return <Skeleton className="h-96" />;
  const d = plan;

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      notify(ok, 'success');
      reloadBalance();
      await reloadPlan();
    } catch (err) {
      notify(errorMessage(err, 'Something went wrong.'), 'error');
    } finally {
      setBusy(null);
    }
  };
  const buy = (p: PlanItem) => act(p.id, () => api.studioBuyPlan(p.id, true), p.price > 0 ? `You're on ${p.name}. ${micro(p.price)} was taken from your balance.` : `Switched to ${p.name}`);

  const myAudience = track === 'student' ? 'everyone' : track || 'everyone';
  const groups = Object.keys(AUDIENCE)
    .map((a) => ({ a, plans: d.plans.filter((p) => p.audience === a) }))
    .filter((g) => g.plans.length)
    .sort((x, y) => (x.a === myAudience ? -1 : y.a === myAudience ? 1 : 0));
  const labels = d.feature_labels ?? {};
  const storageAddon = d.addon_catalog?.storage_10gb;
  const portfolioAddon = d.addon_catalog?.portfolio;
  const active = (id: string) => d.addons?.find((a) => a.id === id);
  const paid = d.limits.price > 0 && !d.granted;

  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Icon name="crown" size={18} /> {d.limits.name}
            {d.granted && <Chip variant="brand">given by Layerto</Chip>}
          </span>
        }
        subtitle={d.limits.price === 0 ? 'Free' : d.granted ? `Until ${shortDate(d.period_end)}` : d.auto_renew ? `Renews ${shortDate(d.period_end)}` : `Ends ${shortDate(d.period_end)}`}
        actions={paid && <Switch checked={d.auto_renew} onChange={(v) => act('renew', () => api.studioSetAutoRenew(v), v ? 'Auto-renew on' : 'Auto-renew off')} label="Auto-renew" />}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Meter label="Projects" used={String(d.usage.projects)} max={String(d.limits.projects)} current={d.usage.projects} total={d.limits.projects} />
          <Meter
            label="Storage"
            used={bytes(d.usage.storage_bytes)}
            max={bytes(d.limits.storage_mb * 1024 * 1024)}
            current={d.usage.storage_bytes}
            total={d.limits.storage_mb * 1024 * 1024}
          />
          <Meter label="Models" used={String(d.usage.private_models)} max={String(d.limits.private_models)} current={d.usage.private_models} total={d.limits.private_models} />
          <Meter label="Model sites" used={String(d.usage.sites)} max={String(d.limits.sites)} current={d.usage.sites} total={d.limits.sites} />
          <Meter label="Team seats" used={String(d.usage.team_members)} max={String(d.limits.team_seats)} current={d.usage.team_members} total={d.limits.team_seats} />
          <div className="rounded-control border border-line bg-page p-3 flex items-center gap-3">
            <Icon name="cpu" size={20} className="text-crimson" />
            <div>
              <div className="text-xs text-muted">Prepaid GPU hours</div>
              <div className="font-mono font-bold">{d.gpu_hours.toFixed(2)} h</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {d.features.map((f) => (
            <Chip key={f} variant="neutral">
              {labels[f] ?? f}
            </Chip>
          ))}
        </div>
      </Card>

      {groups.map(({ a, plans }) => (
        <section key={a} className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon name={AUDIENCE[a].icon} size={18} className="text-crimson" />
            <h3 className="font-semibold">{AUDIENCE[a].label}</h3>
            {a === myAudience && <Chip variant="brand">For you</Chip>}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => {
              const current = p.id === d.current;
              const fits = highlight ? p.features.includes(highlight) : false;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'relative flex flex-col rounded-l2 border bg-card p-5 shadow-l1 transition-all hover:-translate-y-0.5 hover:shadow-l2',
                    current ? 'border-crimson ring-1 ring-crimson' : fits ? 'border-crimson-border' : 'border-line',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-semibold">{p.name}</h4>
                      <p className="text-xs text-muted">{p.description}</p>
                    </div>
                    {current ? <Chip variant="brand">Current</Chip> : fits ? <Chip variant="active">Unlocks it</Chip> : null}
                  </div>
                  <p className="mt-3 text-3xl font-bold">
                    {p.price > 0 ? micro(p.price) : '$0'}
                    <span className="text-sm font-normal text-muted"> / 30 days</span>
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-secondary flex-1">
                    {p.features
                      .filter((f) => f !== 'community' && f !== 'marketplace_buy')
                      .map((f) => (
                        <li key={f} className="flex gap-2">
                          <Icon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                          {labels[f] ?? f}
                        </li>
                      ))}
                    <li className="flex gap-2 text-muted">
                      <Icon name="database" size={15} className="mt-0.5 shrink-0" />
                      {bytes(p.storage_mb * 1024 * 1024)} · {p.projects} projects{p.team_seats ? ` · ${p.team_seats} seats` : ''}
                    </li>
                  </ul>
                  <Button
                    className="mt-4 w-full"
                    variant={current ? 'secondary' : 'primary'}
                    disabled={current || busy !== null}
                    loading={busy === p.id}
                    onClick={() => (paid ? setConfirming(p) : buy(p))}
                  >
                    {current ? 'Your plan' : p.price > 0 ? `Switch for ${micro(p.price)}` : 'Switch for free'}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Add-ons" subtitle="Monthly, paid from your balance. Turn off renewal any time.">
          <div className="space-y-4">
            {storageAddon && (
              <div className="rounded-control border border-line p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{storageAddon.name}</p>
                    <p className="text-xs text-muted">{micro(storageAddon.price)} per 10 GB per 30 days</p>
                  </div>
                  {active('storage_10gb') && <Chip variant="active">{active('storage_10gb')!.quantity * 10} GB active</Chip>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Extra storage"
                    className="rounded-control border border-line-strong bg-card px-3 py-2 text-sm"
                    value={extraGB}
                    onChange={(e) => setExtraGB(Number(e.target.value))}
                  >
                    {[1, 2, 5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n * 10} GB total extra
                      </option>
                    ))}
                  </select>
                  <Button size="sm" loading={busy === 'storage'} onClick={() => act('storage', () => api.buyAddon('storage_10gb', extraGB), 'Storage added')}>
                    Add
                  </Button>
                  {active('storage_10gb') && (
                    <Switch
                      checked={active('storage_10gb')!.auto_renew}
                      onChange={(v) => act('r-storage', () => api.setAddonRenew('storage_10gb', v), 'Saved')}
                      label="Renew"
                    />
                  )}
                </div>
              </div>
            )}
            {portfolioAddon && (
              <div className="rounded-control border border-line p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{portfolioAddon.name}</p>
                  <p className="text-xs text-muted">
                    {micro(portfolioAddon.price)} per 30 days{portfolioAddon.requires ? ` · needs ${labels[portfolioAddon.requires] ?? portfolioAddon.requires}` : ''}
                  </p>
                </div>
                {active('portfolio') ? (
                  <div className="flex items-center gap-3">
                    <Chip variant="active">Active until {shortDate(active('portfolio')!.period_end)}</Chip>
                    <Switch checked={active('portfolio')!.auto_renew} onChange={(v) => act('r-pf', () => api.setAddonRenew('portfolio', v), 'Saved')} label="Renew" />
                  </div>
                ) : (
                  <Button size="sm" loading={busy === 'portfolio'} onClick={() => act('portfolio', () => api.buyAddon('portfolio'), 'Portfolio site add-on is on')}>
                    Turn on
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
        <Card title="GPU hours" subtitle="Prepaid training time at a discount. Used before your balance; returned if a run fails or is cancelled.">
          <div className="grid gap-3 sm:grid-cols-3">
            {(d.gpu_bundles ?? []).map((b) => (
              <div key={b.id} className="rounded-control border border-line p-4 text-center space-y-2">
                <p className="text-2xl font-bold">{b.hours} h</p>
                <p className="text-xs text-muted">{micro(b.price)} · {micro(b.price / b.hours)}/h</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={!d.features.includes('gpu_bundles')}
                  loading={busy === b.id}
                  onClick={() => act(b.id, () => api.buyGpuBundle(b.id), `${b.hours} GPU hours added`)}
                >
                  Buy
                </Button>
              </div>
            ))}
          </div>
          {!d.features.includes('gpu_bundles') && <Alert className="mt-3">GPU bundles come with Solo, Researcher Pro and Enterprise.</Alert>}
        </Card>
      </section>

      <ConfirmModal
        isOpen={confirming !== null}
        title={`Switch to ${confirming?.name ?? ''} now?`}
        description={`${confirming?.name} starts today${confirming && confirming.price > 0 ? ` and ${micro(confirming.price)} is taken from your balance` : ''}. The rest of your current ${d.limits.name} period is not refunded.`}
        confirmLabel="Switch now"
        onConfirm={() => {
          const p = confirming;
          setConfirming(null);
          if (p) void buy(p);
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
