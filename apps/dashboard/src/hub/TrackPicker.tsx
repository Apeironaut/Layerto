import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import type { Track } from '@layerto/types';
import { Button, Icon, Modal, cn, useNotify } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { api } from '../lib/api';
import { useHub } from './HubContext';

const TRACKS: { id: Exclude<Track, ''>; title: string; icon: IconName; desc: string; plan: string }[] = [
  { id: 'researcher', title: 'Researcher', icon: 'flask', desc: 'Papers, experiments, datasets and a portfolio, with free 1 GB research storage.', plan: 'research_free' },
  { id: 'solo', title: 'Developer or solopreneur', icon: 'zap', desc: 'Call vision APIs, train detectors on your data and ship features.', plan: 'free' },
  { id: 'photographer', title: 'Photographer', icon: 'camera', desc: 'Sell your image collections as training datasets.', plan: '' },
  { id: 'enterprise', title: 'Enterprise team', icon: 'team', desc: 'Shared projects and research with teams and the highest limits.', plan: '' },
  { id: 'student', title: 'Student', icon: 'book', desc: 'Learn computer vision with the playground, free plan and the community.', plan: 'free' },
];

/** First-run question that tailors navigation, suggestions and plans. Can be changed later in Settings. */
export function TrackPicker({ open, onDone }: { open: boolean; onDone: (track: Track) => void }) {
  const notify = useNotify();
  const { plan, has } = useHub();
  const [pick, setPick] = useState<Exclude<Track, ''> | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await api.saveMySettings({ track: pick });
      const t = TRACKS.find((x) => x.id === pick)!;
      // switch only free accounts without research to the free research plan; never downgrade a paid plan
      if (t.plan === 'research_free' && !has('research') && (plan?.limits.price ?? 0) === 0) await api.studioBuyPlan('research_free', true).catch(() => undefined);
      onDone(pick);
    } catch (err) {
      notify(errorMessage(err, "Couldn't save."), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen={open} onClose={() => onDone('')} title="What brings you to Layerto?" description="We'll tailor your workspace. You can change this any time." size="lg">
      <div className="grid gap-3 sm:grid-cols-2">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPick(t.id)}
            aria-pressed={pick === t.id}
            className={cn(
              'flex gap-3 rounded-l2 border p-4 text-left cursor-pointer transition-all hover:-translate-y-0.5',
              pick === t.id ? 'border-crimson bg-crimson-tint shadow-l1' : 'border-line hover:border-line-strong',
              t.id === 'student' && 'sm:col-span-2',
            )}
          >
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-control', pick === t.id ? 'bg-crimson text-white' : 'bg-page text-crimson')}>
              <Icon name={t.icon} size={20} />
            </span>
            <span>
              <span className="block font-semibold">{t.title}</span>
              <span className="block text-xs text-muted mt-0.5">{t.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onDone('')}>
          Skip
        </Button>
        <Button disabled={!pick} loading={busy} onClick={save}>
          Continue
        </Button>
      </div>
    </Modal>
  );
}
