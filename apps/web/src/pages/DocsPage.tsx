import { Card, CopyButton, PageHeader, Reveal, Table, THead, Th, Tr, Td } from '@layerto/ui';
import { CodeSamples } from '../components/docs/CodeSamples';
import { ResponseSchema } from '../components/docs/ResponseSchema';
import { ErrorCodesTable } from '../components/docs/ErrorCodesTable';
import { useSeo } from '../hooks/useSeo';
import { DASHBOARD_URL, PUBLIC_API_URL } from '../config';

const STEPS = [
  { title: 'Create an account', body: 'Sign up in the dashboard.' },
  { title: 'Get approved', body: 'The Layerto team approves new accounts during early access.' },
  { title: 'Create a key', body: 'Keys start with lt_ and are shown once.' },
  { title: 'Send an image', body: 'Use any of the examples below.' },
];

const LIMITS = [
  ['Image formats', 'JPG, PNG, WebP'],
  ['Image size', 'Up to 10 MB and 8000 × 8000 px'],
  ['Prompt length', 'Up to 1000 characters'],
  ['Rate limit', '60 requests per minute per key'],
  ['Free calls', '50 per account'],
  ['Billing', 'Prepaid; a failed call is refunded'],
];

const OUTPUT_OPTIONS = [
  ['fields', 'string[]', '["label", "confidence", "bbox", "step"]', 'Any of label, confidence, bbox, step, model, model_version, parent, latency_ms, request_id, charge_usd. Returned in that order.'],
  ['rename', 'object', '{}', 'New names for returned fields, e.g. {"label": "species"}. Letters, numbers and _ (max 32).'],
  ['min_confidence', 'number', '0', 'Drops results below this confidence (0–1).'],
  ['labels_include', 'string[]', '[]', 'Keep only these labels (case-insensitive). Empty keeps all.'],
  ['labels_exclude', 'string[]', '[]', 'Drop these labels.'],
  ['top_k', 'number | null', 'null', 'Keep the K most confident results per image and step (1–100).'],
  ['sort', 'string', '"confidence_desc"', '"confidence_desc", "label_asc" or "step".'],
  ['confidence_format', 'string', '"decimal"', '"decimal" (0.92) or "percent" (92).'],
  ['decimals', 'number', '4', 'Rounding for confidence (0–6).'],
  ['bbox_format', 'string', '"xywh"', '"xywh", "xyxy", "center_xywh" or "normalized_xywh" (0–1). Boxes are always in original-image coordinates.'],
  ['layout', 'string', '"by_image"', '"by_image", "by_step" (grouped under each step name) or "flat" (one list with image_index).'],
  ['include_summary', 'boolean', 'true', 'Label counts, model calls, failed calls and total charge.'],
  ['include_errors', 'boolean', 'true', 'Per-image list of steps that failed (failed calls are not charged).'],
  ['include_image_info', 'boolean', 'true', 'Width and height of each image.'],
  ['include_empty', 'boolean', 'true', 'Keep images that have no results.'],
  ['format', 'string', '"json"', '"json" or "csv" (one row per result; boxes as four columns).'],
];

const STEP_TYPES = [
  ['input', 'Single image or a batch of up to 20. Connects to model steps.'],
  ['model', 'Runs one model on the image, or on a crop inside a For each loop. Each call is billed.'],
  ['condition', 'Looks at the previous model’s results and continues on its yes or no output: has_label, count_at_least or no_predictions.'],
  ['for_each', 'Crops every detected object (up to max_items, with optional padding) and runs the next model on each crop. Results carry their parent object.'],
  ['output', 'Collects results from every model step connected to it and shapes the response.'],
];

export function DocsPage() {
  useSeo(
    'Docs — Layerto',
    'Quickstart, request examples in curl, Python and JavaScript, the response format and every error code for the Layerto Vision API.',
  );

  const workflowCurl = `curl -X POST "${PUBLIC_API_URL}/v1/workflows/YOUR_WORKFLOW_ID/run" \\
  -H "Authorization: Bearer lt_your_api_key_here" \\
  -F "images=@photo1.jpg" \\
  -F "images=@photo2.png"`;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <PageHeader title="Documentation" description="Everything you need to make your first Layerto Vision call." />

      <Reveal index={0}>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-l1 border border-line bg-card p-5">
              <span className="text-3xl font-bold text-crimson tabular-nums">{i + 1}</span>
              <h2 className="mt-2 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          Start in the{' '}
          <a href={DASHBOARD_URL} className="text-crimson font-semibold">
            dashboard
          </a>
          . Send the key as <code>Authorization: Bearer lt_…</code>.
        </p>
      </Reveal>

      <Reveal index={1}>
        <CodeSamples />
      </Reveal>
      <Reveal index={2}>
        <ResponseSchema />
      </Reveal>

      <Reveal index={3}>
        <Card title="Workflows" subtitle="Chain models with conditions and loops, and choose exactly what comes back. Build them visually in the dashboard.">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold">
                  Run a workflow <code className="ml-1 text-xs text-muted">POST /v1/workflows/{'{id}'}/run</code>
                </h3>
                <CopyButton text={workflowCurl} />
              </div>
              <p className="text-sm text-muted mb-2">
                Send images in repeated <code>images</code> multipart fields (up to workflow max_images, max 20 images, each ≤ 10 MB).
              </p>
              <pre className="p-4 rounded-control bg-page border border-line font-mono text-xs text-ink overflow-x-auto" tabIndex={0}>
                {workflowCurl}
              </pre>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Steps</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STEP_TYPES.map(([type, desc]) => (
                  <div key={type} className="rounded-control border border-line p-3">
                    <dt className="font-mono text-xs font-semibold text-crimson">{type}</dt>
                    <dd className="mt-1 text-sm text-ink-secondary">{desc}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm text-muted">
                A workflow can make at most 100 model calls per image and 400 per run. Before a run starts, your balance must cover the calls that will
                certainly happen; later calls each reserve their own price.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Output options</h3>
              <Table label="Workflow output options">
                <THead>
                  <Th>Option</Th>
                  <Th>Type</Th>
                  <Th>Default</Th>
                  <Th>Description</Th>
                </THead>
                <tbody>
                  {OUTPUT_OPTIONS.map(([opt, type, defVal, desc]) => (
                    <Tr key={opt}>
                      <Td className="font-mono text-xs font-semibold text-crimson whitespace-nowrap">{opt}</Td>
                      <Td className="font-mono text-xs text-muted whitespace-nowrap">{type}</Td>
                      <Td className="font-mono text-xs text-ink-secondary whitespace-nowrap">{defVal}</Td>
                      <Td className="text-ink-secondary text-sm">{desc}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal index={4}>
        <Card title="Limits and billing">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {LIMITS.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </Reveal>
      <Reveal index={5}>
        <ErrorCodesTable />
      </Reveal>
    </div>
  );
}
