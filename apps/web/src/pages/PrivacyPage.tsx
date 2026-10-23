import { Alert, Card, PageHeader } from '@layerto/ui';
import { useSeo } from '../hooks/useSeo';

const STORED = [
  ['Account', 'Your email address and display name.'],
  ['Password', 'Only an argon2id hash. We never store the password itself.'],
  ['Sessions', 'Only a SHA-256 hash of each session token.'],
  ['API keys', 'Only a SHA-256 hash of each key, plus a short prefix so you can recognise it.'],
  ['Rate limiting', 'IP addresses, held in memory for a few minutes. Never written to disk or the database.'],
  ['Request ledger', 'Image SHA-256 hash, size and type; model; route; latency; charge; and prompt length. Never the image or the prompt text.'],
  ['Studio datasets', 'Images you upload for training and the boxes you draw, encrypted at rest (AES-256-GCM). Deleted a set number of days after a successful training run unless you turn on “Keep dataset”; datasets never trained are deleted after 30 days without use. You can delete them any time.'],
  ['Studio models', 'Trained model weights and their accuracy figures, stored privately until you delete the model.'],
  ['Profiles and sites', 'Only what you choose to publish: profile text, public projects and model website content.'],
  ['Datasets for sale', 'Photo collections you list on the marketplace, stored like Studio datasets. Buyers see up to 8 small previews before buying; after buying they get a copy in their own project, under the license you chose.'],
  ['Research workspace', 'Papers (and their PDFs), experiments, findings, notes, references, tasks and files you add. Private to you and the teams you share an area with, unless you publish a paper or a portfolio site.'],
  ['Community', 'Posts, comments, votes and images you post. Visible to signed-in users; you can delete your own, and moderators remove content that breaks the rules.'],
  ['Teams', 'Who is in each team and their role, and an activity log of changes to shared projects and research areas.'],
  ['Server logs', 'Request ID, method, path, status and duration. No keys, cookies or request bodies.'],
];

export function PrivacyPage() {
  useSeo('Privacy — Layerto', 'What Layerto stores, what it never stores, and how the usage ledger works.');
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      {/* TODO(owner): legal review before public launch. */}
      <Alert tone="info">Draft, not yet legally reviewed.</Alert>
      <PageHeader title="Privacy" description="What we store, what we never store, and why." />
      <Card title="API images and prompts are never stored">
        <p className="text-ink-secondary">
          Images sent to a model (through the API, the playground or a model website) are held in memory only while
          the model runs, then discarded. Prompt text is used for routing and is not kept. The only images we keep are
          the ones you upload to a Studio dataset to train your own model; see below.
        </p>
      </Card>
      <Card title="What we do store">
        <dl className="divide-y divide-line">
          {STORED.map(([k, v]) => (
            <div key={k} className="py-3 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-1">
              <dt className="font-semibold">{k}</dt>
              <dd className="text-ink-secondary">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="The usage ledger">
        <p className="text-ink-secondary">
          Every request is recorded as an append-only event. Each event includes a hash of the one before it, so any
          later change to the history can be detected.
        </p>
      </Card>
    </div>
  );
}
