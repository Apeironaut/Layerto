// Layerto Hub: account tracks, feature plans, add-ons, teams, community, dataset marketplace, research.

export type Track = '' | 'photographer' | 'solo' | 'researcher' | 'enterprise' | 'student';

export type Feature =
  | 'community'
  | 'marketplace_buy'
  | 'projects'
  | 'train'
  | 'sites'
  | 'sell_models'
  | 'sell_images'
  | 'research'
  | 'teams'
  | 'portfolio'
  | 'gpu_bundles';

export interface AddonDef {
  name: string;
  price: number; // micro-USD per 30 days
  storage_mb: number;
  requires: string;
}

export interface ActiveAddon {
  id: string;
  quantity: number;
  period_end: string;
  auto_renew: boolean;
}

export interface GPUBundle {
  id: string;
  name: string;
  hours: number;
  price: number;
}

export interface UserSettings {
  track: Track;
  ui: UiPrefs;
}

export interface UiPrefs {
  accent?: string;
  density?: 'comfortable' | 'compact';
  sidebar_collapsed?: boolean;
  reduce_motion?: boolean;
  home?: string;
}

export interface TeamMember {
  user_id: string;
  username: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'invited' | 'active';
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  owner: string;
  my_role: 'owner' | 'editor' | 'viewer';
  my_status: 'invited' | 'active';
  members: TeamMember[];
  seats: number;
  projects: { id: string; name: string }[];
  areas: { id: string; name: string }[];
  created_at: string;
}

export interface ActivityItem {
  id: number;
  actor: string;
  area_id: string | null;
  area_name: string;
  team_id: string | null;
  verb: string;
  object_type: string;
  object_id: string;
  summary: string;
  created_at: string;
}

// ---- community

export type Space = 'general' | 'computer-vision' | 'nlp' | 'datasets' | 'research' | 'showcase' | 'help' | 'jobs' | (string & {});

export interface CommunityPost {
  id: string;
  space: Space;
  title: string;
  body: string;
  link_kind: '' | 'model' | 'listing' | 'paper' | 'url';
  link_ref: string;
  link_title: string;
  has_image: boolean;
  score: number;
  comments: number;
  author: string;
  author_name: string;
  author_track: Track;
  my_vote: -1 | 0 | 1;
  saved: boolean;
  mine: boolean;
  removed: boolean;
  created_at: string;
  updated_at: string;
  edited: boolean;
}

export interface CommunityComment {
  id: string;
  parent_id: string | null;
  body: string;
  author: string;
  author_track: Track;
  mine: boolean;
  removed: boolean;
  created_at: string;
}

export interface CommunityMeta {
  spaces: { id: Space; name: string; description: string; posts: number }[];
  top_contributors: { username: string; track: Track; score: number; posts: number }[];
}

export interface NewPost {
  space: Space;
  title: string;
  body: string;
  link_kind?: CommunityPost['link_kind'];
  link_ref?: string;
  image?: File | null;
}

export interface CommunityReport {
  id: string;
  reason: string;
  resolved: boolean;
  created_at: string;
  reporter: string;
  post_id: string | null;
  comment_id: string | null;
  title: string;
  body: string;
  author: string;
  removed: boolean;
}

// ---- dataset marketplace

export type DataLicense = 'research_only' | 'commercial' | 'commercial_no_redistribution' | 'cc_by';

export interface DatasetListing {
  id: string;
  dataset_id?: string;
  seller: string;
  seller_name: string;
  title: string;
  description: string;
  tags: string[];
  license: DataLicense;
  license_text: string;
  price_usd: string;
  status: 'draft' | 'pending' | 'public' | 'rejected' | 'removed';
  review_note?: string;
  sales: number;
  images: number;
  labeled: number;
  boxes: number;
  bytes: number;
  classes: string[];
  previews: string[];
  purchased: boolean;
  mine: boolean;
  created_at: string;
  published_at: string | null;
  earned_usd?: string;
}

export interface ListingInput {
  dataset_id?: string;
  title?: string;
  description?: string;
  tags?: string[];
  license?: DataLicense;
  price_usd?: string;
}

export interface Purchase {
  id: string;
  listing_id: string;
  title: string;
  seller: string;
  license: DataLicense;
  license_text: string;
  price_usd: string;
  created_at: string;
  images: number;
  dataset_ids: string[];
}

// ---- research

export type ResearchDiscipline = 'zoology' | 'ecology' | 'cv_ai' | 'biomedical' | 'interdisciplinary';
export type WorkspaceViewMode = 'domain' | 'tech' | 'unified';

export interface ResearchMetricCol {
  key: string;
  label: string;
  unit: string;
}

export interface ResearchArea {
  id: string;
  owner_id: string;
  owner: string;
  team_id: string | null;
  team_name: string;
  name: string;
  description: string;
  color: string;
  status: 'active' | 'paused' | 'archived';
  is_public: boolean;
  discipline: ResearchDiscipline;
  hypothesis: string;
  reproducibility_lock: boolean;
  creator_id: string;
  storage_bytes_used: number;
  storage_quota_bytes: number;
  gpu_seconds_used: number;
  gpu_credits_budget: number;
  gpu_credits_used: number;
  custom_metrics: ResearchMetricCol[];
  isolation_level: string;
  role: 'owner' | 'editor' | 'viewer';
  papers: number;
  experiments: number;
  findings: number;
  notes: number;
  open_tasks: number;
  specimens: number;
  created_at: string;
  updated_at: string;
}

export interface SpecimenItem extends Owned {
  updated_at?: string;
  title: string;
  taxonomy_species: string;
  common_name: string;
  media_url: string;
  media_type: 'photo' | 'video' | 'audio';
  gps_lat: number | null;
  gps_lng: number | null;
  habitat: string;
  morphometrics: Record<string, any>;
  observation_date: string;
  notes: string;
}

export interface LeakageSample {
  sample_a: string;
  sample_b: string;
  split_a: string;
  split_b: string;
  similarity_score: number;
  issue: string;
}

export interface DatasetSplitSnapshot extends Owned {
  version_tag: string;
  description: string;
  total_samples: number;
  train_count: number;
  val_count: number;
  test_count: number;
  class_distribution: Record<string, number>;
  leakage_detected: boolean;
  leakage_details: LeakageSample[];
}

export interface AblationRun extends Owned {
  run_name: string;
  architecture: string;
  is_baseline: boolean;
  hyperparameters: Record<string, any>;
  metrics: Record<string, any>;
  status: 'planned' | 'running' | 'completed' | 'failed';
  notes: string;
}

export interface ArenaItem {
  id: string;
  owner_id: string;
  area_id: string;
  specimen_id: string | null;
  image_url: string;
  sample_name: string;
  ground_truth: Record<string, any>;
  model_a_prediction: Record<string, any>;
  model_b_prediction: Record<string, any>;
  failure_category: 'agreement' | 'false_positive' | 'disagreement' | 'boundary_uncertainty';
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
}

export interface CollaborationContract {
  id: string;
  owner_id: string;
  area_id: string;
  collaborator_email: string;
  collaborator_name: string;
  team_name: string;
  collaboration_model: 'voluntary_credit' | 'royalty_split' | 'paid_bounty';
  credit_roles: string[];
  royalty_percentage: number;
  bounty_amount_cents: number;
  bounty_status: 'pending' | 'escrow_funded' | 'completed' | 'paid';
  data_sandbox_permission: 'compute_only' | 'download_permitted';
  role?: 'owner' | 'editor' | 'viewer';
  status: 'active' | 'pending' | 'completed';
  created_at: string;
}

export interface DomainInsight {
  id: string;
  owner_id: string;
  area_id: string;
  title: string;
  insight_type: 'model_accuracy' | 'population_trend' | 'morphometric_distribution' | 'detection_summary';
  content: string;
  chart_data: Record<string, any>;
  pinned: boolean;
  created_at: string;
}

export interface RoyaltySplitRule {
  party: string;
  share_pct: number;
}

export interface ResearchPublication extends Owned {
  updated_at?: string;
  title: string;
  doi: string;
  abstract: string;
  pdf_url: string;
  pricing_model: 'open_access' | 'tiered' | 'commercial';
  paper_price_cents: number;
  dataset_price_cents: number;
  model_price_cents: number;
  royalty_split_rules: RoyaltySplitRule[];
  downloads_count: number;
  gross_revenue_cents: number;
  is_published: boolean;
  badges: string[];
}

interface Owned {
  id: string;
  owner_id: string;
  owner: string;
  area_id: string | null;
  created_at: string;
}

export type PaperStatus = 'idea' | 'drafting' | 'submitted' | 'under_review' | 'accepted' | 'published';

export interface Paper extends Owned {
  updated_at: string;
  title: string;
  authors: string[];
  venue: string;
  year: number | null;
  status: PaperStatus;
  doi: string;
  arxiv: string;
  url: string;
  abstract: string;
  keywords: string[];
  model_slugs: string[];
  on_layerto: boolean;
  published_at: string | null;
  pdf_bytes: number;
}

export interface MetricPointH {
  epoch: number;
  map50_95?: number;
  map50?: number;
  loss?: number;
}

export interface Experiment extends Owned {
  updated_at: string;
  name: string;
  hypothesis: string;
  status: 'planned' | 'running' | 'done' | 'failed' | 'cancelled';
  params: Record<string, unknown>;
  metrics: Record<string, unknown>;
  history: MetricPointH[];
  conclusion: string;
  tags: string[];
  job_id: string | null;
  project_id: string | null;
}

export interface Finding extends Owned {
  updated_at: string;
  title: string;
  body: string;
  evidence: { type: 'experiment' | 'paper' | 'url'; ref: string; label?: string }[];
  confidence: 'low' | 'medium' | 'high';
  status: 'open' | 'confirmed' | 'refuted';
}

export interface ResearchNote extends Owned {
  updated_at: string;
  title: string;
  body: string;
  pinned: boolean;
  auto: boolean;
}

export interface Reference extends Owned {
  updated_at: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string;
  url: string;
  doi: string;
  bibtex: string;
  status: 'to_read' | 'reading' | 'read';
  rating: number;
  notes: string;
}

export interface ResearchTask extends Owned {
  title: string;
  kind: 'task' | 'deadline' | 'milestone';
  due_date: string | null;
  done: boolean;
}

export interface ResearchFile {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  area_id: string | null;
  owner: string;
  created_at: string;
}

export interface ResearchOverview {
  areas: number;
  papers: number;
  papers_published: number;
  papers_in_review: number;
  experiments: number;
  experiments_running: number;
  findings: number;
  notes: number;
  to_read: number;
  open_tasks: number;
  upcoming: ResearchTask[];
  recent_experiments: Experiment[];
  storage_bytes: number;
  storage_limit_bytes: number;
  storage_allocated_bytes: number;
  storage_unallocated_bytes: number;
  gpu_credits: number;
  gpu_credits_limit: number;
  gpu_credits_allocated: number;
  gpu_credits_used: number;
  gpu_hours?: number;
  plan: string;
}

export interface AreaAllocationInput {
  area_id: string;
  storage_quota_bytes: number;
  gpu_credits_budget: number;
}

export interface PortfolioSettings {
  subdomain: string;
  enabled: boolean;
  theme: { primary?: string; accent?: string; background?: string; mode?: 'light' | 'dark'; font?: 'sans' | 'serif' | 'mono' };
  sections: string[];
  about: string;
  addon_active: boolean;
  addon_price_usd: string;
  saved: boolean;
}

export interface PublicPaper {
  id: string;
  title: string;
  authors: string[];
  venue: string;
  year: number | null;
  status: PaperStatus;
  doi: string;
  arxiv: string;
  url: string;
  abstract: string;
  keywords: string[];
  has_pdf?: boolean;
  model_slugs: string[];
  owner: string;
  owner_name: string;
  published_at?: string;
  bibtex: string;
}

export interface PublicPortfolio {
  subdomain: string;
  username: string;
  name: string;
  about: string;
  headline: string;
  bio: string;
  affiliation: string;
  website: string;
  theme: PortfolioSettings['theme'];
  sections: string[];
  papers: PublicPaper[];
  projects: { id: string; name: string; slug: string; description: string; datasets: number; models: number; best_map?: number | null }[];
  models: { slug: string; name: string; description: string; metrics: Record<string, unknown>; classes: string[]; public_api: boolean; price_usd: string }[];
  findings: { title: string; body: string; confidence: string; area: string; updated_at: string }[];
  datasets: { id: string; title: string; license: DataLicense; price_usd: string; images: number }[];
}

export interface AssistantStatus {
  available: boolean;
  waitlisted: boolean;
  price_per_message_usd: string;
}

export interface HubOverview {
  posts: number;
  posts_7d: number;
  open_reports: number;
  listings_pending: number;
  listings_public: number;
  purchases: number;
  sales_30d_usd: string;
  research_areas: number;
  papers_published: number;
  teams: number;
  team_members: number;
  portfolios: number;
  assistant_waitlist: number;
  tracks: Record<string, number>;
  plans: Record<string, number>;
}
