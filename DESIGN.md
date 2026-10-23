# Layerto v1 — System Design & Security

Companion to `SPEC.md`. Diagrams are Mermaid and render on GitHub.

---

## 1. System architecture

```mermaid
flowchart TB
  subgraph Clients
    API[API clients<br/>Bearer API key]
    DASH[Dashboard / Admin<br/>Session cookie]
    WEB[Public site<br/>Landing + docs]
  end

  subgraph CORE[Layerto Core — one Go service]
    AUTH[Auth & sessions]
    KEYS[API keys]
    GW[Gateway]
    RT[Auto router]
    LED[Ledger<br/>append-only chain]
    BILL[Billing<br/>prepaid micro-USD]
  end

  PG[(PostgreSQL)]
  RP[RunPod Serverless<br/>turtle-id · bioclip]

  API -->|/v1| GW
  DASH -->|/api, /admin| AUTH
  WEB -.static.-> DASH
  GW --> KEYS
  GW --> RT
  GW --> BILL
  GW --> LED
  GW -->|runsync| RP
  AUTH --> PG
  KEYS --> PG
  LED --> PG
  BILL --> PG
```

**Deployment (v1):** one VPS or container host runs `core` and Postgres, with static frontends served from a CDN/static host behind HTTPS. RunPod workers are reached only over HTTPS with the RunPod API key, which lives only on the core server.

---

## 2. Vision request flow (`POST /v1/vision/{slug|auto}`)

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant G as Gateway
  participant K as Keys
  participant R as Router
  participant B as Billing
  participant L as Ledger (Postgres)
  participant W as RunPod worker

  C->>G: image + Bearer key
  G->>K: verify key (prefix + sha256, constant-time)
  K-->>G: user active? (else 401/403)
  G->>G: validate image (magic bytes, ≤10MB) else 400/413
  G->>R: resolve model (direct or Auto)
  R-->>G: model (else 404)
  G->>B: free quota or balance ≥ price? (else 402)
  G->>L: append request.received (txn)
  alt ledger commit fails
    G-->>C: 500 — model NOT called (fail closed)
  end
  G->>W: runsync (60s timeout)
  alt success
    W-->>G: predictions
    G->>L: append request.executed + charge (txn)
    G-->>C: 200 normalized response
  else error / timeout
    G->>L: append request.failed (charge 0)
    G-->>C: 502 / 504
  end
```

---

## 3. Account lifecycle flow

```mermaid
flowchart LR
  S[Sign up] --> P[status: pending]
  P -->|admin approves| A[status: active]
  P -->|admin rejects| X[suspended]
  A --> K[Create API key<br/>shown once]
  A --> PL[Playground<br/>50 free calls]
  K --> U[Call /v1]
  A -->|admin credits| BAL[Balance]
  BAL --> U
  A -->|admin suspends| X
  X -.all keys & sessions rejected.-> U
```

---

## 4. Ledger append (inside one DB transaction)

```mermaid
sequenceDiagram
  participant S as Service
  participant H as ledger_head (row lock)
  participant E as events
  participant Bal as balances

  S->>H: SELECT ... FOR UPDATE
  H-->>S: last_seq, last_hash
  S->>S: seq = last_seq+1<br/>hash = sha256(prev_hash + "\n" + canonical_json)
  S->>E: INSERT event
  S->>Bal: update balance / free_used (if money event)
  S->>H: UPDATE last_seq, last_hash
  S->>S: COMMIT
```

---

## 5. Security design

### 5.1 Trust boundaries

```mermaid
flowchart LR
  subgraph Internet[Untrusted: Internet]
    U[Users / API clients]
  end
  subgraph Edge[Boundary 1: HTTPS edge]
    TLS[TLS + rate limit + CORS]
  end
  subgraph App[Boundary 2: Core service]
    CORE[Go core<br/>authn · authz · validation]
  end
  subgraph Data[Boundary 3: Data]
    PG[(Postgres<br/>least-privilege role)]
  end
  subgraph Ext[Boundary 4: External compute]
    RP[RunPod workers]
  end
  U --> TLS --> CORE
  CORE --> PG
  CORE --> RP
```

Rule: nothing crosses a boundary without being authenticated, validated and logged.

### 5.2 Threat model (v1)

| # | Threat | Where | Control |
|---|---|---|---|
| T1 | Stolen / leaked API key | Client | Keys hashed (sha256), shown once, revocable, prefix visible for identification; per-key rate limit; `last_used_at` shown in dashboard |
| T2 | Brute-force login | `/api/auth/login` | argon2id; 5 failed attempts per IP+email per 15 min → 429; generic error message |
| T3 | Session hijack / CSRF | Dashboard | HttpOnly + Secure + SameSite=Lax cookie; `Origin` check + `X-Requested-With` on mutations; session rotation on login; logout deletes the server-side session |
| T4 | Malicious image upload | `/v1`, playground | Magic-byte MIME check, 10 MB cap, decoded-dimension cap (e.g. 8000×8000) to stop decompression bombs; images never written to disk/DB |
| T5 | Free-tier abuse (many accounts) | Signup | Admin approval gate; free quota is per account; one key namespace per user |
| T6 | Billing fraud / race (double-spend) | Billing | Balance check + charge inside the ledger transaction with a row lock; integer micro-USD only |
| T7 | Ledger tampering | Postgres | Append-only trigger blocks UPDATE/DELETE; app DB role has INSERT/SELECT only on `events`; hash chain + `/admin/ledger/verify`; daily export of `last_hash` to an external location (signed checkpoint, v1.1) |
| T8 | Privilege escalation to admin | `/admin/*` | Role check middleware on every admin route; admins created only via the CLI; admin actions are ledger events |
| T9 | SQL injection | All | sqlc-generated parameterized queries only; no string-built SQL |
| T10 | Secret leakage | Repo / logs | All secrets in env; `.env` in `.gitignore`; never log keys, cookies, image bytes or password hashes; redact `Authorization` header in logs |
| T11 | RunPod key misuse | Core server | Key only on the server; never sent to browsers; rotate on suspicion; separate endpoints per model |
| T12 | Worker returns malicious/oversized output | Gateway | Schema-validate worker JSON, cap response size, strip unknown fields before returning |
| T13 | DoS / cost exhaustion | `/v1` | Per-key token bucket (60/min), global concurrency limit to RunPod, 60 s timeout, request body limit |
| T14 | Account enumeration | Signup / login | Same response for unknown email and wrong password |
| T15 | Data privacy | Whole system | Store only image hash/size/MIME; no prompts with PII required; publish a short privacy page stating images are not stored |

### 5.3 Security controls by layer

**Edge**
- HTTPS everywhere (HSTS); HTTP redirects to HTTPS.
- CORS: `/api` and `/admin` allow only the dashboard/admin origins; `/v1` allows any origin but requires a key.
- Request body limit: 12 MB.
- Security headers on the frontends: CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`.

**Application**
- Middleware order: request ID → recover → body limit → rate limit → auth → role check → handler.
- Every handler validates input before any side effect.
- Errors use the standard JSON envelope, with no stack traces in responses.
- Constant-time comparisons for key hashes.

**Data**
- Two DB roles: `layerto_migrator` (DDL, used only by goose) and `layerto_app` (DML, with no UPDATE/DELETE on `events`).
- Postgres is not exposed publicly (localhost or private network only).
- Daily encrypted backups, plus a monthly restore test.

**Operations**
- Structured JSON logs with `request_id`; secrets are redacted.
- Alerts: ledger verify failure, 5xx spike, RunPod error rate, admin login.
- Dependency scanning: `govulncheck` for Go, `pnpm audit` for JS, run in CI.
- Key rotation procedure documented for: RunPod key, DB passwords, session secret.

### 5.4 Security tests (must exist before launch)

- Ledger: chain verifies; a manual UPDATE attempt is rejected by the trigger; a tampered row is detected by verify.
- Keys: revoked key → 401; suspended user's key → 403; wrong secret with a valid prefix → 401.
- Billing: concurrent calls can't overspend; a failed call isn't charged; free quota stops at 50.
- Upload: a non-image file renamed `.jpg` → 400; oversized → 413; huge dimensions → 400.
- Auth: login rate limit triggers; a CSRF request without `Origin` is rejected.
- Admin: a user-role session hitting `/admin/*` → 403.

### 5.5 Deferred to v1.1+

- Signed ledger checkpoints stored outside the DB (for example, published daily).
- Email verification and 2FA for admin.
- Per-key scopes (restrict a key to specific models).
- WAF / bot protection on signup.
- Formal privacy policy and terms of service.
