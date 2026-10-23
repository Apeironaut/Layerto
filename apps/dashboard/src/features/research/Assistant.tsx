import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import { Button, Card, Chip, Icon, Skeleton, usd, useNotify, useResource } from '@layerto/ui';
import type { IconName } from '@layerto/ui';
import { api } from '../../lib/api';

const ABILITIES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'flask', title: 'Reads your workspace', body: 'Answers from your experiments, findings, notes and papers, with links to each source.' },
  { icon: 'globe', title: 'Searches the web', body: 'Finds related work on arXiv and the open web and adds references to your reading list.' },
  { icon: 'chart', title: 'Analyses runs', body: 'Explains why a run under-performed and suggests the next ablation to try.' },
  { icon: 'pen', title: 'Drafts with you', body: 'Related-work paragraphs, rebuttal notes and summaries, in your words.' },
];

const SAMPLE = [
  { me: true, text: 'Why is run “mosaic-v3” worse on small objects than the baseline?' },
  {
    me: false,
    text: 'mosaic-v3 was trained at a smaller image size than the baseline, so small objects shrink further and its mAP small drops while mAP large stays close. The two runs in this area at the larger size do not show the drop. Next: the larger size with mosaic on.',
  },
];

/** Research chat: agents that answer questions over your workspace and the web. Coming soon, with a waitlist. */
export function AssistantView() {
  const notify = useNotify();
  const status = useResource(() => api.assistant(), 'assistant');
  const [busy, setBusy] = useState(false);
  const join = async () => {
    setBusy(true);
    try {
      await api.joinAssistantWaitlist();
      await status.reload();
      notify("You're on the list. We'll email you when it opens.", 'success');
    } catch (err) {
      notify(errorMessage(err, "Couldn't join the waitlist."), 'error');
    } finally {
      setBusy(false);
    }
  };
  const s = status.data;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full bg-crimson/10 blur-3xl" />
        <div className="relative">
          <Chip variant="brand">Coming soon</Chip>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Research chat</h2>
          <p className="mt-2 max-w-xl text-muted">
            Ask questions about your research. Agents look through your profile and workspace, search the web, and answer with sources. Each message is paid from your
            balance{s ? `, about ${usd(s.price_per_message_usd)} per message` : ''}.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {ABILITIES.map((a) => (
              <div key={a.title} className="rounded-l2 border border-line bg-page/70 p-4">
                <Icon name={a.icon} size={18} className="text-crimson" />
                <div className="mt-2 font-semibold">{a.title}</div>
                <p className="mt-1 text-sm text-muted">{a.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            {!s ? (
              <Skeleton className="h-10 w-48" />
            ) : s.waitlisted ? (
              <div className="inline-flex items-center gap-2 rounded-pill bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <Icon name="check" size={15} /> You're on the waitlist
              </div>
            ) : (
              <Button icon="sparkles" loading={busy} onClick={join}>
                Join the waitlist
              </Button>
            )}
          </div>
        </div>
      </Card>
      <div className="relative overflow-hidden rounded-l2 border border-line bg-card shadow-l1">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
          <Icon name="message" size={16} /> Preview
          <span className="ml-auto text-[11px] font-normal text-muted">Illustration</span>
        </div>
        <div className="space-y-3 p-4 opacity-80">
          {SAMPLE.map((m, i) => (
            <div key={i} className={m.me ? 'ml-10 rounded-l2 rounded-br-sm bg-crimson px-3 py-2 text-sm text-white' : 'mr-6 rounded-l2 rounded-bl-sm bg-page px-3 py-2 text-sm'}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="border-t border-line p-3">
          <div className="flex h-10 items-center rounded-control border border-line bg-page px-3 text-sm text-muted">
            <Icon name="lock" size={14} className="mr-2" /> Available soon
          </div>
        </div>
      </div>
    </div>
  );
}
