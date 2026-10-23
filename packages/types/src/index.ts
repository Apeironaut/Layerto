export interface Prediction {
  label: string;
  confidence: number;
  bbox?: [number, number, number, number] | null; // [x, y, w, h] per SPEC §8/§10
  extra?: Record<string, unknown>;
}

export interface VisionResponse {
  request_id: string;
  model: string;
  routed: 'direct' | 'auto';
  predictions: Prediction[];
  model_version: string;
  latency_ms: number;
  charge_usd: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
}

export interface HealthResponse {
  status: 'ok' | 'ready' | 'unavailable';
}

export interface User {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role: 'user' | 'admin';
  status: 'pending' | 'active' | 'suspended';
  created_at?: string;
}

export interface SignupParams {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
  reason?: 'invalid' | 'reserved' | 'taken';
}

export interface SignupResponse {
  status: 'pending';
  message: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  expires_at: string | null;
}

export interface CreatedApiKey {
  key: string;
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  expires_at: string | null;
}

export interface BalanceResponse {
  balance_micro_usd: number;
  balance_usd: string;
  free_calls_used: number;
  free_calls_limit: number;
  free_calls_remaining: number;
}

export interface UserSummary {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role: string;
  status: string;
  created_at: string;
}

export interface LedgerVerifyResult {
  ok: boolean;
  checked: number;
  first_bad_seq?: number;
}

export interface ModelUsage {
  model_slug: string;
  requests: number;
  charge_micro_usd: number;
  charge_usd: string;
}

export interface UsageResponse {
  from: string;
  to: string;
  total_requests: number;
  total_charge_micro_usd: number;
  total_charge_usd: string;
  by_model: ModelUsage[];
}

export interface RequestLogItem {
  seq: number;
  request_id: string;
  created_at: string;
  model_slug: string;
  routed: string;
  status: 'pending' | 'executed' | 'failed' | 'abandoned';
  latency_ms: number;
  charge_micro_usd: number;
  charge_usd: string;
}

export interface AdminModelItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  license: string;
  is_open: boolean;
  price_per_call: number;
  price_per_call_usd: string;
  enabled: boolean;
  created_at: string;
}

export interface CreditResponse {
  status: string;
  amount_micro_usd: number;
  amount_usd: string;
  new_balance_micro_usd: number;
  new_balance_usd: string;
  note?: string;
}

export interface UpdateModelPriceResponse {
  slug: string;
  name: string;
  old_price_micro_usd: number;
  new_price_micro_usd: number;
  new_price_usd: string;
  enabled?: boolean;
}

export interface RouteItem {
  id: string;
  keyword: string;
  priority: number;
  model_id: string;
  model_slug: string;
  model_name: string;
  model_enabled: boolean;
}

export interface CreateRouteParams {
  keyword: string;
  model_slug: string;
  priority?: number;
}

/** One released version of a platform model, with the metrics measured for it. */
export interface ModelVersionItem {
  version: string;
  released_at: string;
  status: 'latest' | 'stable' | 'deprecated' | string;
  notes?: string;
  metrics: Record<string, number | string>;
}

/** Optional descriptive metadata on platform models (set by admins in models.meta). */
export interface ModelMeta {
  owner?: string;
  architecture?: string;
  why_use?: string;
  how_to_use?: string;
  datasets?: string[];
  metrics?: Record<string, number | string>;
  versions?: ModelVersionItem[];
  [key: string]: unknown;
}

export interface PublicModelItem {
  slug: string;
  name: string;
  description: string;
  license: string;
  is_open: boolean;
  price_usd: string;
  meta: ModelMeta;
}

export interface EndpointUsageResponse {
  from: string;
  to: string;
  total_requests: number;
  by_endpoint: { endpoint: string; requests: number }[];
}

export interface AdminStatsResponse {
  users: {
    pending: number;
    active: number;
    suspended: number;
  };
  models: {
    enabled: number;
    disabled: number;
  };
  routes: number;
  requests_24h: number;
  revenue_30d_micro_usd: number;
  revenue_30d_usd: string;
}

export interface AdminUserDetailResponse {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role: string;
  status: string;
  created_at: string;
  balance_usd: string;
  free_calls_used: number;
  active_keys: number;
  requests_30d: number;
  spend_30d_usd: string;
  /** Every key of the user (no secrets). */
  keys: AdminKeyItem[];
}

export interface AdminKeyItem {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
}

export interface AdminEventItem {
  seq: number;
  type: string;
  created_at: string;
  user_email: string;
  request_id?: string;
  model_slug?: string;
}

// ---------------------------------------------------------------- workflows (definition v2)

export type WorkflowField =
  | 'label'
  | 'confidence'
  | 'bbox'
  | 'step'
  | 'model'
  | 'model_version'
  | 'parent'
  | 'latency_ms'
  | 'request_id'
  | 'charge_usd';

export type BBoxFormat = 'xywh' | 'xyxy' | 'normalized_xywh' | 'center_xywh';
export type WorkflowLayout = 'by_image' | 'by_step' | 'flat';
export type WorkflowSort = 'confidence_desc' | 'label_asc' | 'step';
export type WorkflowOutputFormat = 'json' | 'csv';
export type ConditionRule = 'has_label' | 'count_at_least' | 'no_predictions';
export type WorkflowNodeType = 'input' | 'model' | 'condition' | 'for_each' | 'output';

export interface WorkflowInputConfig {
  mode: 'single' | 'batch';
  max_images: number;
}

export interface WorkflowModelConfig {
  model_slug: string;
  min_confidence: number;
  label: string;
}

export interface WorkflowConditionConfig {
  rule: ConditionRule;
  labels: string[];
  min_confidence: number;
  count: number;
}

export interface WorkflowForEachConfig {
  labels: string[];
  min_confidence: number;
  max_items: number;
  padding_pct: number;
}

export interface OutputConfig {
  fields: WorkflowField[];
  rename: Partial<Record<WorkflowField, string>>;
  min_confidence: number;
  labels_include: string[];
  labels_exclude: string[];
  top_k: number | null;
  sort: WorkflowSort;
  confidence_format: 'decimal' | 'percent';
  decimals: number;
  bbox_format: BBoxFormat;
  layout: WorkflowLayout;
  include_summary: boolean;
  include_errors: boolean;
  include_image_info: boolean;
  include_empty: boolean;
  format: WorkflowOutputFormat;
}

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

interface NodeBase<T extends WorkflowNodeType, C> {
  id: string;
  type: T;
  position: WorkflowNodePosition;
  config: C;
}

export type WorkflowInputNode = NodeBase<'input', WorkflowInputConfig>;
export type WorkflowModelNode = NodeBase<'model', WorkflowModelConfig>;
export type WorkflowConditionNode = NodeBase<'condition', WorkflowConditionConfig>;
export type WorkflowForEachNode = NodeBase<'for_each', WorkflowForEachConfig>;
export type WorkflowOutputNode = NodeBase<'output', OutputConfig>;

export type WorkflowNode =
  | WorkflowInputNode
  | WorkflowModelNode
  | WorkflowConditionNode
  | WorkflowForEachNode
  | WorkflowOutputNode;

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  /** "yes" | "no" when the source is a condition step. */
  source_handle?: 'yes' | 'no';
}

export interface WorkflowDefinition {
  version: 2;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNodeCounts {
  input: number;
  model: number;
  condition: number;
  for_each: number;
  output: number;
  total: number;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  node_counts: WorkflowNodeCounts;
  models: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  /** Saved definitions may still be version 1; the editor upgrades them on load. */
  definition: WorkflowDefinition | { version: 1; nodes: unknown[]; edges: unknown[] };
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowValidationError {
  node_id: string;
  edge_id?: string;
  field: string;
  message: string;
}

export interface WorkflowValidateResponse {
  valid: boolean;
  errors: WorkflowValidationError[];
  calls_per_image?: { min: number; max: number };
}

export interface WorkflowRunError {
  image_index?: number;
  step: string;
  model: string;
  code: string;
  message: string;
}

export type WorkflowResultRow = Record<string, unknown>;

export interface WorkflowRunImage {
  index: number;
  width?: number;
  height?: number;
  results?: WorkflowResultRow[];
  steps?: Record<string, WorkflowResultRow[]>;
  errors?: WorkflowRunError[];
}

export interface WorkflowRunSummary {
  images: number;
  predictions: number;
  model_calls: number;
  failed_calls: number;
  label_counts: Record<string, number>;
  total_charge_usd: string;
}

export interface WorkflowRunResponse {
  workflow_id: string;
  run_id: string;
  images?: WorkflowRunImage[];
  results?: WorkflowResultRow[];
  errors?: WorkflowRunError[];
  summary?: WorkflowRunSummary;
  total_charge_usd: string;
}

/** A run's result: parsed JSON, or raw CSV text. */
export type WorkflowRunResult =
  | { format: 'json'; data: WorkflowRunResponse; raw: string }
  | { format: 'csv'; raw: string };
export * from './studio';
export * from './hub';
