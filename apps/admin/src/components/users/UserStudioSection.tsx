import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import { Button, Chip, Input, Select, Skeleton, useNotify, useResource, usd } from '@layerto/ui';
import { api } from '../../lib/api';

/** Studio plan, usage and earnings for one user, with a plan override. */
export function UserStudioSection({ userId }: { userId: string }) {
  const notify = useNotify();
  const info = useResource(() => api.adminUserStudio(userId), `admin-user-studio-${userId}`);
  const [plan, setPlan] = useState('researcher');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try {
      await api.adminSetUserPlan(userId, plan, Number(days) || 30);
      notify(plan === 'free' ? 'Moved to Free' : `Gave ${plan} for ${days} days`, 'success');
      await info.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't change the plan."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const d = info.data;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Studio</h3>
      {!d ? (
        <Skeleton className="h-24" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-control bg-page border border-line">
              <span className="text-xs text-muted block mb-1">Plan</span>
              <span className="flex items-center gap-2">
                <strong className="text-ink">{d.limits.name}</strong>
                {d.granted && <Chip variant="brand">given</Chip>}
              </span>
              {d.period_end && d.plan !== 'free' && <span className="text-xs text-muted">until {new Date(d.period_end).toLocaleDateString()}</span>}
            </div>
            <div className="p-3 rounded-control bg-page border border-line">
              <span className="text-xs text-muted block mb-1">Creator earnings</span>
              <span className="font-mono font-bold text-ink">{usd(d.earned_usd)}</span>
            </div>
            <div className="p-3 rounded-control bg-page border border-line col-span-2 text-xs text-ink-secondary">
              {d.usage.projects}/{d.limits.projects} projects · {(d.usage.storage_bytes / 1024 / 1024).toFixed(1)}/{d.limits.storage_mb} MB · {d.usage.sites}/{d.limits.sites} sites ·{' '}
              {d.usage.private_models}/{d.limits.private_models} models
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-36">
              <Select label="Set plan" value={plan} onChange={(e) => setPlan(e.target.value)} options={[{ value: 'free', label: 'Free' }, { value: 'researcher', label: 'Researcher' }, { value: 'lab', label: 'Lab' }]} />
            </div>
            {plan !== 'free' && (
              <div className="w-24">
                <Input label="Days" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
            )}
            <Button size="sm" variant="secondary" loading={busy} onClick={apply}>Apply</Button>
          </div>
          <p className="text-xs text-muted">Given plans are free for the user and don't auto-renew.</p>
        </>
      )}
    </section>
  );
}
