-- +goose Up
-- Layerto Hub: account tracks and feature-based plans, add-ons, GPU hour bundles, teams,
-- the community feed, the image-dataset marketplace, the research workspace and portfolio sites.

-- ---- plans with features (replaces the 00007 plan list; ids "free" and "researcher" are kept)
UPDATE platform_settings SET value = '{
  "free":          {"name":"Free","audience":"everyone","price":0,"projects":2,"storage_mb":1024,"keep_datasets":false,"sites":1,"private_models":2,"team_seats":0,
                    "features":["community","marketplace_buy","projects","train"],
                    "description":"Try everything that builds models: annotate, train and call your own API."},
  "photographer":  {"name":"Photographer","audience":"photographer","price":4000000,"projects":0,"storage_mb":51200,"keep_datasets":true,"sites":0,"private_models":0,"team_seats":0,
                    "features":["community","marketplace_buy","sell_images"],
                    "description":"Sell image datasets to researchers and builders. Upload, describe, license and get paid."},
  "solo":          {"name":"Solo","audience":"solo","price":9000000,"projects":20,"storage_mb":20480,"keep_datasets":true,"sites":5,"private_models":20,"team_seats":0,
                    "features":["community","marketplace_buy","projects","train","sites","sell_models","sell_images","gpu_bundles"],
                    "description":"For developers and solopreneurs shipping vision features."},
  "research_free": {"name":"Research Free","audience":"researcher","price":0,"projects":2,"storage_mb":1024,"keep_datasets":true,"sites":1,"private_models":2,"team_seats":0,
                    "features":["community","marketplace_buy","projects","train","research"],
                    "description":"A free research workspace with 1 GB: papers, experiments, findings and notes."},
  "researcher":    {"name":"Researcher Pro","audience":"researcher","price":15000000,"projects":50,"storage_mb":51200,"keep_datasets":true,"sites":10,"private_models":50,"team_seats":5,
                    "features":["community","marketplace_buy","projects","train","sites","sell_models","sell_images","research","teams","portfolio","gpu_bundles"],
                    "description":"Everything in Solo plus the full research workspace, a team of 5 and a portfolio site."},
  "enterprise":    {"name":"Enterprise","audience":"enterprise","price":99000000,"projects":1000,"storage_mb":512000,"keep_datasets":true,"sites":100,"private_models":500,"team_seats":50,
                    "features":["community","marketplace_buy","projects","train","sites","sell_models","sell_images","research","teams","portfolio","gpu_bundles"],
                    "description":"Teams of up to 50, shared projects and research areas, the highest limits."}
}' WHERE key = 'plans';
UPDATE subscriptions SET plan = 'enterprise' WHERE plan = 'lab';

INSERT INTO platform_settings (key, value) VALUES
  ('addons', '{"storage_10gb":{"name":"+10 GB storage","price":1000000,"storage_mb":10240,"requires":""},
               "portfolio":{"name":"Portfolio site (you.layerto.com)","price":2000000,"storage_mb":0,"requires":"research"}}'),
  ('gpu_bundles', '[{"id":"gpu10","name":"10 GPU hours","hours":10,"price":12000000},
                    {"id":"gpu50","name":"50 GPU hours","hours":50,"price":50000000},
                    {"id":"gpu200","name":"200 GPU hours","hours":200,"price":160000000}]'),
  ('bundle_seller_share_bps', '8000'),         -- photographers keep 80% of each dataset sale
  ('assistant_price_per_message', '20000')     -- research assistant (coming soon), micro-USD per message
ON CONFLICT (key) DO NOTHING;

-- ---- per-user settings: chosen track and UI preferences (follow the user across devices)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  track      TEXT NOT NULL DEFAULT '' CHECK (track IN ('', 'photographer', 'solo', 'researcher', 'enterprise', 'student')),
  ui         JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- add-ons (monthly, paid from balance like plans) and GPU hour bundles
CREATE TABLE IF NOT EXISTS subscription_addons (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addon      TEXT NOT NULL,
  quantity   INT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 100),
  period_end TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, addon)
);

CREATE TABLE IF NOT EXISTS gpu_credits (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seconds    BIGINT NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS gpu_seconds_used BIGINT NOT NULL DEFAULT 0;
ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]';

-- ---- teams: shared projects and research areas
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_members (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  status     TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members (user_id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS area_id UUID;

-- true when the user owns the project or is an active editor/owner in its team
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION hub_project_write(p UUID, u UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM projects pr WHERE pr.id = p AND (pr.user_id = u OR (pr.team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members m WHERE m.team_id = pr.team_id AND m.user_id = u AND m.status = 'active' AND m.role IN ('owner', 'editor')))))
$$;
CREATE OR REPLACE FUNCTION hub_project_read(p UUID, u UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM projects pr WHERE pr.id = p AND (pr.user_id = u OR (pr.team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members m WHERE m.team_id = pr.team_id AND m.user_id = u AND m.status = 'active'))))
$$;
-- +goose StatementEnd

-- ---- datasets: training datasets vs. dataset bundles for sale; purchased copies remember their source
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'training' CHECK (kind IN ('training', 'bundle'));
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000);
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS source_listing_id UUID;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS license TEXT NOT NULL DEFAULT '';

-- ---- models: imported weights and license limits inherited from purchased data
ALTER TABLE model_ownership ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'trained' CHECK (source IN ('trained', 'imported'));
ALTER TABLE model_ownership ADD COLUMN IF NOT EXISTS data_license TEXT NOT NULL DEFAULT '';
ALTER TABLE model_ownership ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]';

-- ---- image dataset marketplace
CREATE TABLE IF NOT EXISTS dataset_listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id   UUID NOT NULL UNIQUE REFERENCES datasets(id) ON DELETE CASCADE,
  seller_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description  TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  tags         JSONB NOT NULL DEFAULT '[]',
  license      TEXT NOT NULL CHECK (license IN ('research_only', 'commercial', 'commercial_no_redistribution', 'cc_by')),
  price        BIGINT NOT NULL CHECK (price >= 0),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'public', 'rejected', 'removed')),
  review_note  TEXT NOT NULL DEFAULT '',
  sales        INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS dataset_listings_status_idx ON dataset_listings (status, published_at DESC);
CREATE TABLE IF NOT EXISTS dataset_purchases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES dataset_listings(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price       BIGINT NOT NULL,
  license     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);

-- ---- community feed
CREATE TABLE IF NOT EXISTS community_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space      TEXT NOT NULL CHECK (char_length(space) BETWEEN 1 AND 64),
  title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body       TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  link_kind  TEXT NOT NULL DEFAULT '' CHECK (link_kind IN ('', 'model', 'listing', 'paper', 'url')),
  link_ref   TEXT NOT NULL DEFAULT '' CHECK (char_length(link_ref) <= 300),
  image_key  TEXT NOT NULL DEFAULT '',
  score      INT NOT NULL DEFAULT 0,
  comments   INT NOT NULL DEFAULT 0,
  removed    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_posts_new_idx ON community_posts (created_at DESC) WHERE NOT removed;
CREATE TABLE IF NOT EXISTS community_votes (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value   SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS community_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  removed    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_comments_post_idx ON community_comments (post_id, created_at);
CREATE TABLE IF NOT EXISTS community_saves (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS community_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  resolved    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- research workspace
CREATE TABLE IF NOT EXISTS research_areas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES teams(id) ON DELETE SET NULL,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  color       TEXT NOT NULL DEFAULT '#A3122A' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  is_public   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_areas_owner_idx ON research_areas (owner_id);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION hub_area_write(a UUID, u UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM research_areas ra WHERE ra.id = a AND (ra.owner_id = u OR (ra.team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members m WHERE m.team_id = ra.team_id AND m.user_id = u AND m.status = 'active' AND m.role IN ('owner', 'editor')))))
$$;
CREATE OR REPLACE FUNCTION hub_area_read(a UUID, u UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM research_areas ra WHERE ra.id = a AND (ra.owner_id = u OR (ra.team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members m WHERE m.team_id = ra.team_id AND m.user_id = u AND m.status = 'active'))))
$$;
-- +goose StatementEnd

CREATE TABLE IF NOT EXISTS papers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id      UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  authors      JSONB NOT NULL DEFAULT '[]',
  venue        TEXT NOT NULL DEFAULT '' CHECK (char_length(venue) <= 200),
  year         INT CHECK (year BETWEEN 1900 AND 2200),
  status       TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN ('idea', 'drafting', 'submitted', 'under_review', 'accepted', 'published')),
  doi          TEXT NOT NULL DEFAULT '' CHECK (char_length(doi) <= 200),
  arxiv        TEXT NOT NULL DEFAULT '' CHECK (char_length(arxiv) <= 50),
  url          TEXT NOT NULL DEFAULT '' CHECK (char_length(url) <= 500),
  abstract     TEXT NOT NULL DEFAULT '' CHECK (char_length(abstract) <= 10000),
  keywords     JSONB NOT NULL DEFAULT '[]',
  pdf_key      TEXT NOT NULL DEFAULT '',
  pdf_bytes    BIGINT NOT NULL DEFAULT 0,
  on_layerto   BOOLEAN NOT NULL DEFAULT false,   -- published on Layerto (public page, citable)
  published_at TIMESTAMPTZ,
  model_slugs  JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS papers_owner_idx ON papers (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS experiments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id    UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  job_id     UUID UNIQUE REFERENCES training_jobs(id) ON DELETE SET NULL,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  hypothesis TEXT NOT NULL DEFAULT '' CHECK (char_length(hypothesis) <= 4000),
  status     TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'done', 'failed', 'cancelled')),
  params     JSONB NOT NULL DEFAULT '{}',
  metrics    JSONB NOT NULL DEFAULT '{}',
  history    JSONB NOT NULL DEFAULT '[]',
  conclusion TEXT NOT NULL DEFAULT '' CHECK (char_length(conclusion) <= 10000),
  tags       JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS experiments_owner_idx ON experiments (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS findings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id    UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body       TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 10000),
  evidence   JSONB NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'refuted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id    UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body       TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 50000),
  pinned     BOOLEAN NOT NULL DEFAULT false,
  auto       BOOLEAN NOT NULL DEFAULT false,      -- written by Layerto (e.g. a training summary)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS literature (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id    UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 400),
  authors    TEXT NOT NULL DEFAULT '' CHECK (char_length(authors) <= 1000),
  year       INT,
  venue      TEXT NOT NULL DEFAULT '' CHECK (char_length(venue) <= 300),
  url        TEXT NOT NULL DEFAULT '' CHECK (char_length(url) <= 500),
  doi        TEXT NOT NULL DEFAULT '' CHECK (char_length(doi) <= 200),
  bibtex     TEXT NOT NULL DEFAULT '' CHECK (char_length(bibtex) <= 10000),
  status     TEXT NOT NULL DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'read')),
  rating     INT NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  notes      TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 20000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id    UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  kind       TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'deadline', 'milestone')),
  due_date   DATE,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id     UUID REFERENCES research_areas(id) ON DELETE SET NULL,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  mime        TEXT NOT NULL,
  bytes       BIGINT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- what happened in an area or team (the shared "repo" log)
CREATE TABLE IF NOT EXISTS hub_activity (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  area_id     UUID REFERENCES research_areas(id) ON DELETE CASCADE,
  verb        TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id   TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_activity_area_idx ON hub_activity (area_id, id DESC);
CREATE INDEX IF NOT EXISTS hub_activity_team_idx ON hub_activity (team_id, id DESC);
CREATE INDEX IF NOT EXISTS hub_activity_actor_idx ON hub_activity (actor_id, id DESC);

-- portfolio sites at <subdomain>.layerto.com (needs the portfolio add-on)
CREATE TABLE IF NOT EXISTS portfolios (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subdomain  TEXT NOT NULL UNIQUE CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  enabled    BOOLEAN NOT NULL DEFAULT false,
  theme      JSONB NOT NULL DEFAULT '{}',
  sections   JSONB NOT NULL DEFAULT '["about","papers","projects","models","findings"]',
  about      TEXT NOT NULL DEFAULT '' CHECK (char_length(about) <= 5000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_waitlist (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_settings, subscription_addons, gpu_credits, teams, team_members,
  dataset_listings, dataset_purchases, community_posts, community_votes, community_comments, community_saves,
  community_reports, research_areas, papers, experiments, findings, research_notes, literature, research_tasks,
  research_files, hub_activity, portfolios, assistant_waitlist TO layerto_app;
GRANT USAGE, SELECT ON SEQUENCE hub_activity_id_seq TO layerto_app;

-- +goose Down
DROP TABLE IF EXISTS assistant_waitlist, portfolios, hub_activity, research_files, research_tasks, literature,
  research_notes, findings, experiments, papers, community_reports, community_saves, community_comments,
  community_votes, community_posts, dataset_purchases, dataset_listings, gpu_credits, subscription_addons, user_settings;
DROP FUNCTION IF EXISTS hub_area_write, hub_area_read;
DROP TABLE IF EXISTS research_areas;
ALTER TABLE projects DROP COLUMN IF EXISTS team_id, DROP COLUMN IF EXISTS area_id;
DROP FUNCTION IF EXISTS hub_project_write, hub_project_read;
DROP TABLE IF EXISTS team_members, teams;
ALTER TABLE model_ownership DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS data_license, DROP COLUMN IF EXISTS history;
ALTER TABLE datasets DROP COLUMN IF EXISTS kind, DROP COLUMN IF EXISTS description, DROP COLUMN IF EXISTS source_listing_id, DROP COLUMN IF EXISTS license;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS gpu_seconds_used, DROP COLUMN IF EXISTS history;
