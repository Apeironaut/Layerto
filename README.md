# Layerto

Layerto is the routing, control, and metering layer for AI requests.
- **Layerto Core:** accounts, API keys, gateway, append-only ledger, prepaid billing.
- **Layerto Vision:** specialist vision API (Turtle ID, BioCLIP, and Auto routing).
- **Layerto Studio:** users upload and annotate images, train LTVision detectors (free in their own Colab/Kaggle
  notebook, or on Layerto GPUs paid from balance), get an API per model, publish to the marketplace and earn a share
  of every call as credit, keep a research workspace with a public profile, and generate a website per model.

## Architecture & Ports

- **Public Site (`apps/web`):** http://localhost:5173
- **User Dashboard (`apps/dashboard`):** http://localhost:5174
- **Admin App (`apps/admin`):** http://localhost:5175
- **Core Backend (`services/core`):** http://localhost:8080
- **PostgreSQL 16 (`infra/docker-compose.yml`):** localhost:5434 (mapped to container port 5432)

## Prerequisites

- **Node.js:** v22+ (tested with v24)
- **pnpm:** 9+ / 10+
- **Go:** 1.23+
- **Docker & Docker Compose**

## Quickstart

1. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```

2. **Install Workspace Dependencies:**
   ```bash
   pnpm install
   ```

3. **Start PostgreSQL:**
   ```bash
   pnpm db:up
   ```

4. **Run Database Migrations:**
   ```bash
   pnpm db:migrate
   ```

5. **Generate SQL Code (sqlc):**
   ```bash
   pnpm sqlc
   ```

6. **Start All Services in Development Mode:**
   ```bash
   pnpm dev
   ```

## Layerto Studio

Dashboard → Studio: **Projects** (workspace + public profile at `/@username`), **Datasets** (upload, annotate),
**Training**, **My models** (test, API, publish, earnings), **Marketplace**, **Model sites** (`/s/<slug>`), **Plan**.
Admin → **Studio**: model review, training runs and the LTVision package upload, dataset storage (delete only),
model sites (disable), and the rules (creator share, GPU price, retention days, plans). Admin → Users → a user →
Studio: give a plan for N days.

Setup:

1. `pnpm db:migrate` (adds migration 00007).
2. In `.env`: `STORAGE_DIR` (where encrypted dataset images and weights live), `DATA_KEY` (64 hex chars:
   `openssl rand -hex 32`; keep it safe, losing it makes stored images unreadable), `PUBLIC_API_URL` (the URL
   notebooks and workers call), `WORKER_TOKEN` (`openssl rand -hex 24`, shared with the GPU workers).
3. Admin → Studio → Training: upload the LTVision zip (must contain `train.py`).
4. GPU workers and the RunPod inference worker: see `services/trainer/README.md`.
5. Web apps: set `VITE_SITE_URL` in the dashboard and admin builds to the public site's URL (profile and site links).

Data rules: images sent for inference are never stored. Dataset images are encrypted (AES-256-GCM); if the user does
not keep the dataset (Researcher/Lab plans), they are deleted `dataset_retention_days` after a successful training,
and untrained datasets after 30 days without use. A janitor runs hourly (retention, plan renewals, stuck GPU jobs).

Not built yet: card payments (plans and training are paid from balance), cash payouts of creator rewards (credit
only), drag-and-drop site editing (sites use three templates with theme settings).

## Layerto Hub

The dashboard is a hub for researchers, photographers, builders, enterprise teams and students. Run migration `00008_hub.sql` (goose) to enable it.

- **Home**: community board (spaces, votes, threaded comments, saves, reports), before Overview.
- **Projects**: each project holds its datasets, labeling, training runs and models (`/projects/:id/{data,train,models,settings}`). Purchased datasets import straight into a project.
- **Research** (`research` feature): areas, papers (board, PDF, BibTeX, publish to `/papers/:id`), experiments (auto-logged from every training run, compare view), findings, notes, reading list (BibTeX import), deadlines, files, portfolio site, research chat (coming soon, waitlist).
- **Marketplace**: models with full COCO metrics, licensed image datasets, papers, purchases. **Sell**: photo collections → listing → admin review → sale.
- **Teams**: owner/editor/viewer roles; projects and research areas can be shared with a team.
- **Plans are feature-gated** (`platform_settings.plans[*].features`): free, photographer, solo, research_free, researcher (Pro), enterprise. Locked sections explain which plans unlock them. Add-ons (`+10 GB`, portfolio site) and GPU hour bundles are edited in Admin → Studio → Settings; moderation and listing review in Admin → Hub.
- **Account**: collapsible sidebar (`[`), account menu under your name (profile, plan, appearance), command menu (Ctrl/Cmd+K), accent colours and density.

Portfolio sites: set `ROOT_DOMAIN` (API) and `VITE_ROOT_DOMAIN` (web) to e.g. `layerto.com`, point a wildcard DNS record `*.layerto.com` at the web app; `<name>.layerto.com` renders that user's portfolio (preview at `/portfolio/<name>`). Set `VITE_SITE_URL` on the web app in production.

## Health Checks

- `GET http://localhost:8080/healthz` — Liveness check. Returns `200 {"status":"ok"}` without querying the database.
- `GET http://localhost:8080/readyz` — Readiness check. Pings the database. Returns `200 {"status":"ready"}` when healthy, or `503 {"status":"unavailable"}` if the database is unreachable.
