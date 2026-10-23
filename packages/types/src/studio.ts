import type { ActiveAddon, AddonDef, GPUBundle, Track } from './hub';

// Layerto Studio: datasets, training, custom models, marketplace, workspace, plans, sites.

export interface PlanLimits {
  name: string;
  audience: 'everyone' | 'photographer' | 'solo' | 'researcher' | 'enterprise' | string;
  description: string;
  price: number; // micro-USD per 30 days
  projects: number;
  storage_mb: number;
  keep_datasets: boolean;
  sites: number;
  private_models: number;
  team_seats: number;
  features: string[];
}

export interface PlanItem extends PlanLimits {
  id: string;
}

export interface StudioUsage {
  projects: number;
  storage_bytes: number;
  sites: number;
  private_models: number;
  team_members: number;
}

export interface PlanResponse {
  current: string;
  limits: PlanLimits;
  period_end: string | null;
  auto_renew: boolean;
  granted: boolean;
  usage: StudioUsage;
  plans: PlanItem[];
  features: string[];
  addons: ActiveAddon[];
  addon_catalog: Record<string, AddonDef>;
  gpu_bundles: GPUBundle[];
  gpu_hours: number;
  track: Track;
  feature_labels: Record<string, string>;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  notes: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  datasets: number;
  models: number;
  jobs: number;
  best_map?: number | null;
  team_id: string | null;
  team_name: string | null;
  area_id: string | null;
  owner: string;
  role?: 'owner' | 'editor' | 'viewer';
}

export interface ResearcherProfile {
  headline: string;
  bio: string;
  affiliation: string;
  website: string;
  is_public: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  project_id: string | null;
  classes: string[];
  keep: boolean;
  delete_after: string | null;
  purged_at: string | null;
  bytes: number;
  images: number;
  labeled: number;
  boxes: number;
  trained: boolean;
  created_at: string;
  updated_at: string;
  kind: 'training' | 'bundle';
  description: string;
  license: string;
  source_listing_id: string | null;
  owner: string;
}

export interface AnnotationBox {
  c: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DatasetImage {
  id: string;
  file_name: string;
  width: number;
  height: number;
  boxes: AnnotationBox[];
  labeled: boolean;
}

export interface UploadResult {
  added: number;
  results: { file_name: string; error?: string }[];
}

export type TrainPreset = 'fast' | 'balanced' | 'best' | 'custom';
export type TrainRunner = 'layerto' | 'notebook';

export interface Augment {
  flip?: number;
  mosaic?: number;
  mixup?: number;
  degrees?: number;
  scale?: number;
  translate?: number;
  hsv?: number;
  multiscale?: boolean;
}

export interface TrainParams {
  size: string;
  epochs: number;
  img: number;
  p2: boolean;
  patience: number;
  eval_every: number;
  close_mosaic: number;
  augment?: Augment;
  base_model?: string;
}

export interface TrainingJob {
  id: string;
  name: string;
  dataset_id: string;
  dataset_name: string;
  project_id: string | null;
  runner: TrainRunner;
  preset: TrainPreset;
  params: TrainParams;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: { epoch?: number; epochs?: number; map50_95?: number; map50?: number; message?: string; updated_at?: string };
  charged_usd: string;
  model_slug: string | null;
  error: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  owner?: string;
  history: { epoch: number; map50_95?: number; map50?: number; loss?: number }[];
  gpu_hours_used: number;
}

export interface TrainEstimate {
  ready: boolean;
  problem: string;
  labeled_images: number;
  params: TrainParams;
  gpu_hours: number;
  layerto_cost_usd: string;
}

export interface CreateJobParams {
  dataset_id: string;
  name: string;
  preset: TrainPreset;
  params?: TrainParams;
  runner: TrainRunner;
  augment?: Augment;
  base_model?: string;
}

export interface CustomModel {
  id: string;
  slug: string;
  name: string;
  description: string;
  license: string;
  price_usd: string;
  enabled: boolean;
  visibility: 'private' | 'pending' | 'public' | 'rejected';
  review_note: string;
  classes: string[];
  metrics: ModelMetrics;
  project_id: string | null;
  job_id: string | null;
  created_at: string;
  published_at: string | null;
  calls_30d: number;
  earned_usd: string;
  owner: string;
  history: { epoch: number; map50_95?: number; map50?: number; loss?: number }[];
  source: 'trained' | 'imported';
  data_license: string;
  size: string;
}

/** Detection metrics. Trained models: measured by Layerto on the validation split; imported: self-reported. */
export interface ModelMetrics {
  map50_95?: number;
  map50?: number;
  map75?: number;
  map_small?: number;
  map_medium?: number;
  map_large?: number;
  ar1?: number;
  ar10?: number;
  ar100?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  size?: string;
  epochs?: number;
  img?: number;
  best_epoch?: number;
  params_m?: number;
  latency_ms?: number;
  model_mb?: number;
  train_images?: number;
  val_images?: number;
  per_class_ap?: Record<string, number>;
  self_reported?: boolean;
}

export interface Earnings {
  total_usd: string;
  this_month_usd: string;
  paid_calls: number;
  share_percent: number;
  payout: string;
  datasets_total_usd: string;
  datasets_this_month_usd: string;
  dataset_sales: number;
  dataset_share_percent: number;
}

export interface SiteTheme {
  primary?: string;
  accent?: string;
  background?: string;
  mode?: 'light' | 'dark';
  font?: 'sans' | 'serif' | 'mono';
}

export type SiteTemplate = 'demo' | 'product' | 'research';

export interface ModelSite {
  id: string;
  slug: string;
  model_slug: string;
  model_name: string;
  title: string;
  tagline: string;
  description: string;
  template: SiteTemplate;
  theme: SiteTheme;
  cta_label: string;
  cta_url: string;
  monthly_cap_usd: string;
  spent_this_month_usd: string;
  published: boolean;
  disabled_by_admin: boolean;
  created_at: string;
  updated_at: string;
  owner?: string;
}

export interface SiteInput {
  slug?: string;
  model_slug?: string;
  title?: string;
  tagline?: string;
  description?: string;
  template?: SiteTemplate;
  theme?: SiteTheme;
  cta_label?: string;
  cta_url?: string;
  monthly_cap_usd?: string;
  published?: boolean;
}

export interface PublicSite {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  template: SiteTemplate;
  theme: SiteTheme;
  cta_label: string;
  cta_url: string;
  model_name: string;
  classes: string[];
  metrics: { map50_95?: number; map50?: number };
  owner: string;
  available: boolean;
}

export interface SitePrediction {
  label: string;
  confidence: number;
  bbox: [number, number, number, number] | null;
}

export interface PublicModelSummary {
  slug: string;
  name: string;
  description: string;
  metrics: { map50_95?: number; map50?: number };
  classes: string[];
  public_api: boolean;
  price_usd: string;
}

export interface PublicProfile {
  username: string;
  first_name: string;
  last_name: string;
  headline: string;
  bio: string;
  affiliation: string;
  website: string;
  projects: Project[];
  models: PublicModelSummary[];
}

export interface PublicProjectPage {
  owner: { username: string; first_name: string; last_name: string };
  project: Project;
  models: PublicModelSummary[];
  datasets: { name: string; images: number; labeled: number; classes: string[] }[];
}

export interface StudioOverview {
  datasets: number;
  images: number;
  storage_bytes: number;
  datasets_pending_delete: number;
  jobs_queued: number;
  jobs_running: number;
  jobs_succeeded_30d: number;
  custom_models: number;
  models_pending_review: number;
  public_models: number;
  sites: number;
  paid_plans: number;
  creator_rewards_30d_usd: string;
  training_revenue_30d_usd: string;
  plan_revenue_30d_usd: string;
  ltvision_package_ready: boolean;
}

export interface AdminDataset extends Dataset {
  owner: string;
}

export interface StudioSettings {
  creator_reward_bps: number;
  gpu_price_per_hour: number;
  dataset_retention_days: number;
  ltvision_endpoint: string;
  plans: Record<string, PlanLimits>;
  addons?: Record<string, AddonDef>;
  gpu_bundles?: GPUBundle[];
  bundle_seller_share_bps?: number;
  assistant_price_per_message?: number;
}

export interface AdminUserStudio {
  plan: string;
  period_end: string | null;
  granted: boolean;
  usage: StudioUsage;
  limits: PlanLimits;
  earned_usd: string;
}

export interface StudioInfo {
  plans: PlanItem[];
  creator_share_percent: number;
  seller_share_percent?: number;
  gpu_price_per_hour_usd: string;
  dataset_retention_days: number;
}
