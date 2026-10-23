# Layerto v1 — System Specification

> Source of truth for building Layerto v1. AI coding agents: read **§17 Rules for AI agents** before writing code.

---

## 1. Overview

**Layerto** is the layer between AI and the real world: it routes, controls and meters every AI request.
**v1 = Layerto Core + Layerto Vision.**

- **Layerto Core:** accounts, API keys, gateway, append-only ledger, prepaid billing.
- **Layerto Vision:** a specialist vision API. Send an image, get an answer from the right specialist model. One API, no training.

### v1 goals
1. A user signs up, is approved by an admin, creates an API key and calls a vision model.
2. Every request is recorded in a tamper-evident, append-only ledger.
3. Usage is billed from the ledger in USD (prepaid).
4. Two models: **Turtle ID** (own, closed) and **BioCLIP** (open), plus an **Auto** route.

### Non-goals (do NOT build in v1)
Marketplace and user model uploads, workflows and chaining, Charon, competitions, annotation, social features, subscriptions and hourly plans, payment gateway integration, multi-region, SSO, microservices, Kubernetes.

---

## 2. Tech stack

| Area | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | Go 1.23+, single service (`services/core`), modular monolith |
| HTTP router | `go-chi/chi` |
| DB | PostgreSQL 16 |
| DB access | `pgx/v5` + `sqlc` |
| Migrations | `goose` |
| Password hashing | argon2id |
| Frontend | React + Vite + TypeScript, TanStack Query, React Router, Tailwind |
| Model hosting | RunPod Serverless (`/runsync`) |
| Local dev | Docker Compose (Postgres) |

---

## 3. Repo structure

```
layerto/
  apps/
    web/          # landing page + docs (public)
    dashboard/    # user app
    admin/        # admin app
  services/
    core/
      cmd/core/main.go
      internal/
        auth/       # signup, login, sessions
        keys/       # API key create/verify/revoke
        gateway/    # /v1 request pipeline
        router/     # Auto model routing
        models/     # model registry + RunPod client
        ledger/     # append-only hash-chained events
        billing/    # balance + usage derived from ledger
        admin/      # admin handlers
        httpx/      # middleware, errors, JSON helpers
      db/
        migrations/
        queries/    # sqlc .sql files
      sqlc.yaml
  packages/
    ui/           # shared React components + theme
    types/        # shared TS types (API request/response)
    api-client/   # typed fetch client for dashboard/admin
  infra/
    docker-compose.yml
  SPEC.md
```

---

## 4. Architecture

```
Client (API key) ──► Core /v1 gateway
                       1. authenticate key
                       2. validate input (image)
                       3. resolve model (direct or Auto router)
                       4. check balance / free quota
                       5. ledger: request.received
                       6. call RunPod worker
                       7. ledger: request.executed | request.failed
                       8. return normalized response

Dashboard / Admin (session cookie) ──► Core /api/* and /admin/*
```

- One Go binary serves everything. Module boundaries are enforced through Go packages and interfaces.
- **Privacy:** images are never stored. Only the image SHA-256 hash, size and MIME type go into the ledger.

---

## 5. Data model

All money is stored as **integer micro-USD** (`1 USD = 1_000_000`). Never use floats for money.

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,           -- random 32 bytes, base64url
  user_id     UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  prefix      TEXT UNIQUE NOT NULL,       -- shown in UI, e.g. "lt_a1b2c3d4"
  key_hash    TEXT NOT NULL,              -- sha256(full key), hex
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,   -- 'turtle-id', 'bioclip'
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  license         TEXT NOT NULL,          -- 'proprietary', 'MIT', ...
  is_open         BOOLEAN NOT NULL,
  runpod_endpoint TEXT NOT NULL,          -- RunPod endpoint ID
  price_per_call  BIGINT NOT NULL,        -- micro-USD, admin-editable
  enabled         BOOLEAN NOT NULL DEFAULT true,
  meta            JSONB NOT NULL DEFAULT '{}',  -- accuracy, classes, training data, developers
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE routes (                     -- Auto router rules
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword   TEXT NOT NULL,                -- lowercase, e.g. 'turtle', 'sea turtle'
  model_id  UUID NOT NULL REFERENCES models(id),
  priority  INT NOT NULL DEFAULT 100
);

-- Append-only. No UPDATE or DELETE, ever (enforced by trigger + DB role).
CREATE TABLE events (
  seq         BIGINT PRIMARY KEY,         -- assigned by ledger, gapless
  request_id  UUID,                       -- correlates events of one request
  user_id     UUID,
  api_key_id  UUID,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  prev_hash   TEXT NOT NULL,              -- hex; genesis = 64 zeros
  hash        TEXT NOT NULL,              -- hex
  created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX events_user_idx ON events(user_id, seq);
CREATE INDEX events_request_idx ON events(request_id);

CREATE TABLE ledger_head (                -- single row, used to serialize appends
  id        INT PRIMARY KEY CHECK (id = 1),
  last_seq  BIGINT NOT NULL,
  last_hash TEXT NOT NULL
);

-- Read model, updated in the same transaction as the event append.
CREATE TABLE balances (
  user_id        UUID PRIMARY KEY REFERENCES users(id),
  balance        BIGINT NOT NULL DEFAULT 0,   -- micro-USD
  free_used      INT NOT NULL DEFAULT 0       -- free playground calls used
);
```

Add a trigger on `events` that raises an exception on any `UPDATE` or `DELETE`.

---

## 6. Ledger

### Event types (v1)
| Type | Payload (key fields) |
|---|---|
| `user.signed_up` | email |
| `user.approved` / `user.suspended` | by_admin_id |
| `key.created` / `key.revoked` | key_id, prefix |
| `balance.credited` | amount, by_admin_id, note |
| `request.received` | model_slug, route (`direct`/`auto`), image_sha256, image_bytes, mime, free (bool) |
| `request.executed` | model_slug, latency_ms, charge (micro-USD), model_version |
| `request.failed` | model_slug, error_code, latency_ms, charge = 0 |
| `model.price_changed` | model_slug, old, new, by_admin_id |

### Hashing
```
hash = sha256_hex( prev_hash + "\n" + canonical_json({seq, request_id, user_id, api_key_id, type, payload, created_at}) )
```
- `canonical_json` uses sorted keys, no whitespace, UTC RFC3339Nano timestamps.
- Genesis `prev_hash` = `"0" * 64`.

### Append algorithm (one DB transaction)
1. `SELECT last_seq, last_hash FROM ledger_head WHERE id=1 FOR UPDATE`
2. Build the event with `seq = last_seq + 1` and `prev_hash = last_hash`, then compute `hash`.
3. `INSERT INTO events ...`
4. Update `balances` if the event affects money or the free quota.
5. `UPDATE ledger_head SET last_seq, last_hash`
6. Commit.

### Rules
- Events are never modified. A correction is a new event.
- `request.received` must be committed **before** calling the model. If the commit fails, do not call the model (fail closed).
- `GET /admin/ledger/verify` recomputes the chain and returns `{ok, checked, first_bad_seq?}`.

---

## 7. API keys

- Format: `lt_<8 char prefix>_<32 byte random, base64url>`
- Store `sha256(full_key)` only. Show the full key **once** at creation.
- Auth header: `Authorization: Bearer <key>`
- Lookup: parse the prefix, fetch the row, compare hashes in constant time, reject if revoked or if the user isn't `active`.
- Max 10 active keys per user.

---

## 8. Public API (`/v1`)

### `POST /v1/vision/{model_slug}`  — direct model
### `POST /v1/vision/auto`          — Auto routing

Request (either form):
- `multipart/form-data`: `image` (file), optional `prompt` (string), optional `params` (JSON string)
- `application/json`: `{ "image_base64": "...", "prompt": "...", "params": {} }`

Limits: jpg/png/webp, at most 10 MB.

Response `200`:
```json
{
  "request_id": "uuid",
  "model": "turtle-id",
  "routed": "direct",              // or "auto"
  "predictions": [
    { "label": "Chelonia mydas", "confidence": 0.97, "bbox": [x, y, w, h], "extra": {} }
  ],
  "model_version": "2026.10.1",
  "latency_ms": 812,
  "charge_usd": "0.002000"
}
```

### `GET /v1/models`
Lists enabled models: slug, name, description, license, is_open, price_usd, meta.

### Errors (all endpoints)
```json
{ "error": { "code": "insufficient_balance", "message": "...", "request_id": "uuid" } }
```
| HTTP | code |
|---|---|
| 400 | `invalid_image`, `invalid_request` |
| 401 | `invalid_api_key` |
| 402 | `insufficient_balance` |
| 403 | `account_not_active` |
| 404 | `model_not_found` |
| 413 | `image_too_large` |
| 429 | `rate_limited` |
| 502 | `model_error` |
| 504 | `model_timeout` |
| 500 | `internal_error` |

Rate limit: 60 requests/min per key (in-memory token bucket for v1).

---

## 9. Auto router

1. Lowercase `prompt`. Find `routes` whose keyword appears in it; pick the lowest `priority`.
2. If no prompt or no match, fall back to **bioclip**.
3. Return `"routed": "auto"` and the chosen `model` in the response.

(Classifier-based routing comes later. Keep the router behind a `Router` interface.)

---

## 10. Model worker contract (RunPod)

Core calls `POST https://api.runpod.ai/v2/{endpoint}/runsync` with a 60 s timeout.

Input:
```json
{ "input": { "image_base64": "...", "prompt": "optional", "params": {} } }
```
Worker output (every worker must return this shape):
```json
{ "predictions": [ { "label": "...", "confidence": 0.0, "bbox": null, "extra": {} } ], "model_version": "..." }
```
- **turtle-id:** detection and species (7 classes); `extra` may include `individual_id` for green turtles.
- **bioclip:** zero-shot taxon classification; `prompt` may hold candidate labels.

Workers live in a separate repo/folder (`workers/turtle-id`, `workers/bioclip`) and are deployed to RunPod independently.

---

## 11. Billing

- **Prepaid only.** An admin credits balances manually (`balance.credited`). There is no payment gateway in v1.
- Before calling a model, the gateway checks whether the user has free quota left (`free_used < FREE_CALLS`, default 50). If so, the call is free. Otherwise it requires `balance >= price_per_call`, or returns 402.
- **On `request.executed`:** charge `price_per_call`, or increment `free_used` for a free call.
- **On `request.failed`:** no charge, and free quota is not consumed.
- Usage views are derived from `events`.

---

## 12. Dashboard & admin APIs (session cookie)

Cookie: `lt_session`, HttpOnly, Secure, SameSite=Lax, 14-day expiry. CSRF: require an `X-Requested-With` header on mutating requests and check `Origin`.

**Auth:** `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`

**User:**
- `GET/POST /api/keys`, `DELETE /api/keys/{id}` (revoke)
- `GET /api/usage?from&to`: totals plus per-model breakdown
- `GET /api/requests?cursor`: recent requests (from events)
- `GET /api/balance`: balance and free quota left
- `POST /api/playground/{model_slug|auto}`: same pipeline as `/v1` using the session (no key), counts toward free quota

**Admin (role = admin):**
- `GET /admin/users?status=`, `POST /admin/users/{id}/approve`, `POST /admin/users/{id}/suspend`
- `POST /admin/users/{id}/credit` `{amount_usd, note}`
- `GET/POST/PATCH /admin/models` (price changes emit `model.price_changed`)
- `GET/POST/DELETE /admin/routes`
- `GET /admin/ledger/verify`, `GET /admin/events?cursor&type&user_id`

The first admin is created through a CLI command: `core create-admin --email`.

---

## 13. Frontend

**Theme:** dark red and black by default, with a light mode toggle. Use the Layerto logo (red and black stacked layers). Shared in `packages/ui`.

### apps/web (public)
- `/`: landing page. Hero one-liner, turtle demo (specialist vs general model), how it works, pricing, CTA to sign up.
- `/docs`: quickstart (curl, Python, JS), endpoints, errors, model pages.
- `/models/{slug}`: accuracy, license, developers, training data, price.

### apps/dashboard
- Signup and login; "pending approval" screen for pending users
- Overview: balance, free calls left, requests this month
- API keys: create (show once), list by prefix, revoke
- Playground: upload an image, choose a model or Auto, view predictions with bboxes drawn
- Usage: chart and per-model table
- Requests: recent list with status, model, latency and charge

### apps/admin
- Users (approve, suspend, credit balance), Models (edit price, enable), Routes, Events viewer, Ledger verify button

---

## 14. Security checklist

- argon2id for passwords; minimum length 10.
- API keys are hashed; the full key is shown once.
- Strict MIME sniffing on uploads (check magic bytes, not just the header).
- Images are never written to disk or the DB.
- Run the DB with an app role that has `INSERT, SELECT` on `events` only.
- Every request gets a `request_id`, which is returned in the `X-Request-Id` header.
- No secrets in the repo; all config comes from env.
- CORS: allow only the dashboard/admin origins for `/api` and `/admin`. `/v1` is open (key-authenticated).

---

## 15. Config (env)

```
DATABASE_URL=postgres://...
PORT=8080
RUNPOD_API_KEY=...
FREE_CALLS=50
SESSION_TTL_HOURS=336
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
RATE_LIMIT_PER_MIN=60
```

---

## 16. Milestones

Each milestone ends with something demoable. Do not start the next one until the acceptance criteria pass.

**M0: Scaffold**
pnpm monorepo, Turborepo, Docker Compose Postgres, Go service boots, goose migrations run, sqlc generates.
*Done when:* `pnpm dev` starts all apps; `GET /healthz` returns 200.

**M1: Ledger + keys + gateway (curl only)**
All tables, ledger append and verify, `create-admin` CLI, an admin endpoint to create a key, `POST /v1/vision/{slug}` calling a RunPod worker.
*Done when:* curl with a key returns a real turtle prediction, and `/admin/ledger/verify` returns ok.

**M2: Accounts + dashboard**
Signup, login, approval flow, key management UI, balance and free quota, playground.
*Done when:* a new user signs up, gets approved, creates a key and runs the playground.

**M3: Billing + usage**
Prepaid checks, charges, 402 handling, usage and request views, admin credit.
*Done when:* balance decreases per call, failed calls aren't charged, and the usage page matches the events.

**M4: BioCLIP + Auto**
Second worker, routes table, Auto endpoint, admin routes UI.
*Done when:* `/v1/vision/auto` with prompt "sea turtle" goes to turtle-id, and with no prompt goes to bioclip.

**M5: Public site + docs**
Landing page, docs, model pages.
*Done when:* an outside person can go from the landing page to a first successful API call using only the docs.

---

## 17. Rules for AI agents

1. **Stay in scope.** Build only what this spec describes. If something seems missing, add a `// TODO(spec):` note and ask; don't invent features.
2. **Work milestone by milestone.** Finish and verify one before touching the next.
3. **Never** add UPDATE or DELETE paths on `events`. Corrections are new events.
4. **Money** is integer micro-USD everywhere. No floats.
5. **Fail closed:** if `request.received` can't be committed, the model is not called.
6. **Make small, iterative changes.** Edit existing code; don't rewrite whole files or modules unless asked.
7. **Use pnpm** for all JS commands (`pnpm add`, `pnpm dev`). Never npm or yarn.
8. **Tests:** ledger hashing and verification, key verification, billing rules and router matching must have Go unit tests.
9. **No new dependencies** beyond §2 without asking.
10. Keep the Go code in one service; use packages for boundaries.

---

## 18. Open decisions (defaults used until changed)

| Decision | v1 default |
|---|---|
| Charge failed runs? | No |
| Free calls per account | 50 |
| Prices | Admin-set per model (e.g. turtle-id $0.002, bioclip $0.001) |
| Payment gateway | None; manual admin credit |
| Email verification | Not in v1 (admin approval covers it) |
