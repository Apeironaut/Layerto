import { Button, Card, Chip, CopyButton, PageHeader, Skeleton, usd } from '@layerto/ui';
import type { ModelsState } from '../hooks/useModels';
import { useSeo } from '../hooks/useSeo';
import { PUBLIC_API_URL } from '../config';

const NOT_PUBLISHED = 'Not published yet';

/** A metadata field, or "Not published yet" — values are never invented. */
function metaValue(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = meta[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return NOT_PUBLISHED;
}

export function ModelPage({ slug, models, navigate }: { slug: string; models: ModelsState; navigate: (to: string) => void }) {
  const model = models.models.find((m) => m.slug === slug);
  useSeo(
    model ? `${model.name} — Layerto` : 'Model — Layerto',
    model?.description ?? 'Specialist vision model on Layerto.',
  );

  if (models.status === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-l1" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Model not found</h1>
        <p className="mt-2 text-muted">
          {models.status === 'error' ? "The model list can't be loaded right now." : `There's no enabled model called "${slug}".`}
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => navigate('/#pricing')}>
          See all models
        </Button>
      </div>
    );
  }

  const facts = [
    ['Price per call', usd(model.price_usd)],
    ['License', model.license],
    ['Accuracy', metaValue(model.meta, 'accuracy')],
    ['Classes', metaValue(model.meta, 'classes')],
    ['Training data', metaValue(model.meta, 'training_data')],
    ['Developers', metaValue(model.meta, 'developer', 'developers')],
  ];
  const curl = `curl -X POST "${PUBLIC_API_URL}/v1/vision/${model.slug}" \\\n  -H "Authorization: Bearer lt_your_api_key_here" \\\n  -F "image=@photo.jpg"`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      <PageHeader
        title={model.name}
        description={model.description}
        actions={<Chip variant={model.is_open ? 'neutral' : 'brand'}>{model.is_open ? 'Open model' : 'Layerto model'}</Chip>}
      />
      <Card>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-muted">{k}</dt>
              <dd className={v === NOT_PUBLISHED ? 'text-muted' : 'font-semibold'}>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Call this model" actions={<CopyButton text={curl} />}>
        <pre className="p-4 rounded-control bg-page border border-line font-mono text-xs overflow-x-auto" tabIndex={0}>
          {curl}
        </pre>
      </Card>
    </div>
  );
}
