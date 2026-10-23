import { PUBLIC_API_URL } from '../../config';

/** The four steps from sign-up to a result, in plain words. */
export interface Step {
  n: number;
  title: string;
  body: string;
  points: string[];
  code: string;
}

export const STEPS: Step[] = [
  {
    n: 1,
    title: 'Create an account',
    body: 'Sign up in the dashboard with your email. During early access, a person on our team approves each account before it can make calls.',
    points: ['You see your status in the dashboard', 'Once approved, your first 50 calls are free'],
    code: `Account status
  pending  → waiting for approval
  active   → ready, 50 free calls`,
  },
  {
    n: 2,
    title: 'Create an API key',
    body: 'In the dashboard, open API keys and create one. The key is shown once, so copy it somewhere safe. Treat it like a password.',
    points: ['Send it with every request in the Authorization header', 'Revoke a key at any time; it stops working at once'],
    code: `Authorization: Bearer lt_a1b2c3d4_…`,
  },
  {
    n: 3,
    title: 'Send an image',
    body: 'Post the image to the API. You can name the model you want, or use auto and add a short prompt describing what is in the photo; Layerto picks the model for you.',
    points: ['Direct: /v1/vision/{model}', 'Auto: /v1/vision/auto with a prompt', 'JPG, PNG or WebP, up to 10 MB'],
    code: `curl -X POST ${PUBLIC_API_URL}/v1/vision/auto \\
  -H "Authorization: Bearer $LAYERTO_KEY" \\
  -F image=@photo.jpg \\
  -F prompt="sea turtle"`,
  },
  {
    n: 4,
    title: 'Use the result',
    body: 'You get JSON back. Each prediction says what was found, how sure the model is, and where it is in the image.',
    points: [
      'label: what the model found',
      'confidence: 0 to 1, higher means more certain',
      'bbox: [x, y, width, height] in pixels from the top-left corner',
    ],
    code: `{
  "request_id": "req_8f2k…",
  "model": "turtle-id",
  "predictions": [{
    "label": "Chelonia mydas",
    "confidence": 0.98,
    "bbox": [100, 80, 250, 180]
  }],
  "latency_ms": 184,
  "charge_usd": "0.001500"
}`,
  },
];

/** What Layerto does with each call, in order. */
export const LIFECYCLE = [
  { title: 'Key checked', body: 'The API key must be valid and belong to an active account.' },
  { title: 'Price reserved', body: 'The call price is held from your free calls or your balance, so your balance can never go below zero.' },
  { title: 'Model chosen', body: 'The model you named, or the one Auto picked from your prompt.' },
  { title: 'Model runs', body: 'The image is held in memory only while the model works on it.' },
  { title: 'Image discarded', body: 'The image is never written to disk. Only a fingerprint (hash), its size and type are kept.' },
  { title: 'Charged or refunded', body: 'Success: the reserved amount is charged. Failure or timeout: it is returned. Either way the call is recorded in the ledger.' },
];
