import type {
  AdminEventItem,
  AdminModelItem,
  AdminStatsResponse,
  AdminUserDetailResponse,
  ApiKeyItem,
  BalanceResponse,
  CreatedApiKey,
  CreateRouteParams,
  CreditResponse,
  HealthResponse,
  LedgerVerifyResult,
  PublicModelItem,
  RequestLogItem,
  RouteItem,
  SignupParams,
  SignupResponse,
  UsernameAvailability,
  UpdateModelPriceResponse,
  UsageResponse,
  User,
  UserSummary,
  VisionResponse,
  Workflow,
  WorkflowDefinition,
  WorkflowRunResponse,
  WorkflowRunResult,
  WorkflowSummary,
  WorkflowValidateResponse,
  AdminDataset,
  AdminUserStudio,
  CreateJobParams,
  CustomModel,
  Dataset,
  DatasetImage,
  EndpointUsageResponse,
  AnnotationBox,
  Earnings,
  ModelSite,
  PlanResponse,
  Project,
  PublicProfile,
  PublicProjectPage,
  PublicSite,
  ResearcherProfile,
  SiteInput,
  SitePrediction,
  StudioOverview,
  StudioSettings,
  TrainEstimate,
  StudioInfo,
  TrainingJob,
  UploadResult,
  ActivityItem,
  AssistantStatus,
  CommunityComment,
  CommunityMeta,
  CommunityPost,
  CommunityReport,
  DatasetListing,
  Experiment,
  Finding,
  HubOverview,
  ListingInput,
  NewPost,
  Paper,
  PortfolioSettings,
  PublicPaper,
  PublicPortfolio,
  Purchase,
  Reference,
  ResearchArea,
  ResearchFile,
  ResearchNote,
  ResearchOverview,
  ResearchTask,
  Team,
  UserSettings,
} from '@layerto/types';

export class LayertoClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
      headers.set('X-Requested-With', 'XMLHttpRequest');
      if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch {
        errorData = { error: { code: 'unknown_error', message: res.statusText } };
      }
      throw errorData;
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      return (await res.text()) as unknown as T;
    }

    return res.json() as Promise<T>;
  }

  // Health
  async healthz(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/healthz');
  }

  async readyz(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/readyz');
  }

  // Public Catalog (SPEC §8)
  async getModels(): Promise<PublicModelItem[]> {
    return this.request<PublicModelItem[]>('/v1/models');
  }

  // Auth
  async signup(data: SignupParams): Promise<SignupResponse> {
    return this.request<SignupResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** Sign in with an email address or a username. */
  async login(data: { login: string; password: string }): Promise<User> {
    return this.request<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async usernameAvailable(username: string): Promise<UsernameAvailability> {
    return this.request<UsernameAvailability>(`/api/auth/username-available?username=${encodeURIComponent(username)}`);
  }

  async forgotPassword(email: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async updateProfile(data: { first_name: string; last_name: string; username?: string }): Promise<User> {
    return this.request<User>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('/api/me/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  async logout(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async me(): Promise<User> {
    return this.request<User>('/api/me');
  }

  // Keys
  async listKeys(): Promise<ApiKeyItem[]> {
    return this.request<ApiKeyItem[]>('/api/keys');
  }

  async createKey(name: string, expiresAt: string | null = null): Promise<CreatedApiKey> {
    return this.request<CreatedApiKey>('/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name, expires_at: expiresAt }),
    });
  }

  async revokeKey(id: string): Promise<{ status: string; id: string }> {
    return this.request<{ status: string; id: string }>(`/api/keys/${id}`, {
      method: 'DELETE',
    });
  }

  // Balance
  async getBalance(): Promise<BalanceResponse> {
    return this.request<BalanceResponse>('/api/balance');
  }

  // Usage & Requests
  async getUsage(from?: string, to?: string): Promise<UsageResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<UsageResponse>(`/api/usage${qs}`);
  }

  async getRequests(cursor?: number): Promise<RequestLogItem[]> {
    const qs = cursor ? `?cursor=${cursor}` : '';
    return this.request<RequestLogItem[]>(`/api/requests${qs}`);
  }

  async getEndpointUsage(from: string, to: string): Promise<EndpointUsageResponse> {
    return this.request<EndpointUsageResponse>(`/api/usage/endpoints?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  // Playground
  async runPlayground(modelSlug: string, imageFile: File | Blob, prompt?: string): Promise<VisionResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (prompt) {
      formData.append('prompt', prompt);
    }

    return this.request<VisionResponse>(`/api/playground/${modelSlug}`, {
      method: 'POST',
      body: formData,
    });
  }

  // Workflows
  async listWorkflows(): Promise<WorkflowSummary[]> {
    return this.request<WorkflowSummary[]>('/api/workflows');
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/api/workflows/${id}`);
  }

  async createWorkflow(data: {
    name: string;
    description: string;
    definition: WorkflowDefinition;
  }): Promise<Workflow> {
    return this.request<Workflow>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(
    id: string,
    data: {
      name: string;
      description: string;
      definition: WorkflowDefinition;
      version: number;
    }
  ): Promise<Workflow> {
    return this.request<Workflow>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkflow(id: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/api/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  async validateWorkflow(definition: WorkflowDefinition): Promise<WorkflowValidateResponse> {
    return this.request<WorkflowValidateResponse>('/api/workflows/validate', {
      method: 'POST',
      body: JSON.stringify({ definition }),
    });
  }

  /** Runs a saved workflow. JSON results are parsed; CSV comes back as text. */
  async runWorkflow(id: string, files: File[]): Promise<WorkflowRunResult> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('images', file);
    }
    const res = await fetch(`${this.baseUrl}/api/workflows/${id}/run`, {
      method: 'POST',
      body: formData,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
    });
    const raw = await res.text();
    if (!res.ok) {
      try {
        throw JSON.parse(raw);
      } catch (err) {
        if (err instanceof SyntaxError) throw { error: { code: 'unknown_error', message: res.statusText } };
        throw err;
      }
    }
    if ((res.headers.get('Content-Type') ?? '').startsWith('text/csv')) {
      return { format: 'csv', raw };
    }
    return { format: 'json', data: JSON.parse(raw) as WorkflowRunResponse, raw };
  }

  // Admin
  async adminListUsers(status?: string): Promise<UserSummary[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<UserSummary[]>(`/admin/users${query}`);
  }

  async adminApproveUser(id: string): Promise<UserSummary> {
    return this.request<UserSummary>(`/admin/users/${id}/approve`, {
      method: 'POST',
    });
  }

  async adminSuspendUser(id: string): Promise<UserSummary> {
    return this.request<UserSummary>(`/admin/users/${id}/suspend`, {
      method: 'POST',
    });
  }

  async adminCreditUser(id: string, amountUSD: string, note?: string): Promise<CreditResponse> {
    return this.request<CreditResponse>(`/admin/users/${id}/credit`, {
      method: 'POST',
      body: JSON.stringify({ amount_usd: amountUSD, note: note || '' }),
    });
  }

  async adminListModels(): Promise<AdminModelItem[]> {
    return this.request<AdminModelItem[]>('/admin/models');
  }

  async adminUpdateModelPrice(slug: string, priceUSD: string): Promise<UpdateModelPriceResponse> {
    return this.request<UpdateModelPriceResponse>(`/admin/models/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify({ price_usd: priceUSD }),
    });
  }

  async adminUpdateModelStatus(slug: string, enabled: boolean): Promise<UpdateModelPriceResponse> {
    return this.request<UpdateModelPriceResponse>(`/admin/models/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  }

  async adminListRoutes(): Promise<RouteItem[]> {
    return this.request<RouteItem[]>('/admin/routes');
  }

  async adminCreateRoute(params: CreateRouteParams): Promise<RouteItem> {
    return this.request<RouteItem>('/admin/routes', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async adminDeleteRoute(id: string): Promise<{ status: string; id: string }> {
    return this.request<{ status: string; id: string }>(`/admin/routes/${id}`, {
      method: 'DELETE',
    });
  }

  async adminVerifyLedger(): Promise<LedgerVerifyResult> {
    return this.request<LedgerVerifyResult>('/admin/ledger/verify');
  }

  async adminGetStats(): Promise<AdminStatsResponse> {
    return this.request<AdminStatsResponse>('/admin/stats');
  }

  async adminGetUser(id: string): Promise<AdminUserDetailResponse> {
    return this.request<AdminUserDetailResponse>(`/admin/users/${id}`);
  }

  async adminListEvents(params?: { limit?: number; before_seq?: number; type?: string }): Promise<AdminEventItem[]> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.before_seq) qs.set('before_seq', String(params.before_seq));
    if (params?.type) qs.set('type', params.type);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<AdminEventItem[]>(`/admin/events${query}`);
  }

  /** Fetches a binary resource with the session cookie (images, notebooks). */
  async getBlob(path: string): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}${path}`, { credentials: 'include' });
    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch {
        errorData = { error: { code: 'unknown_error', message: res.statusText } };
      }
      throw errorData;
    }
    return res.blob();
  }

  // ---- Studio: plan & workspace
  async studioPlan(): Promise<PlanResponse> {
    return this.request<PlanResponse>('/api/studio/plan');
  }

  async studioBuyPlan(plan: string, autoRenew = true): Promise<PlanResponse> {
    return this.request<PlanResponse>('/api/studio/plan', { method: 'POST', body: JSON.stringify({ plan, auto_renew: autoRenew }) });
  }

  async studioSetAutoRenew(autoRenew: boolean): Promise<PlanResponse> {
    return this.request<PlanResponse>('/api/studio/plan', { method: 'PATCH', body: JSON.stringify({ auto_renew: autoRenew }) });
  }

  async studioProfile(): Promise<ResearcherProfile> {
    return this.request<ResearcherProfile>('/api/studio/profile');
  }

  async studioSaveProfile(p: ResearcherProfile): Promise<ResearcherProfile> {
    return this.request<ResearcherProfile>('/api/studio/profile', { method: 'PUT', body: JSON.stringify(p) });
  }

  async studioProjects(): Promise<Project[]> {
    return this.request<Project[]>('/api/studio/projects');
  }

  async studioProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/studio/projects/${id}`);
  }

  async studioCreateProject(p: { name: string; description?: string; is_public?: boolean; team_id?: string; area_id?: string }): Promise<Project> {
    return this.request<Project>('/api/studio/projects', { method: 'POST', body: JSON.stringify(p) });
  }

  async studioUpdateProject(id: string, p: Partial<Pick<Project, 'name' | 'description' | 'notes' | 'is_public'>> & { team_id?: string; area_id?: string }): Promise<Project> {
    return this.request<Project>(`/api/studio/projects/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async studioDeleteProject(id: string): Promise<unknown> {
    return this.request(`/api/studio/projects/${id}`, { method: 'DELETE' });
  }

  // ---- Studio: datasets
  async studioDatasets(projectId?: string): Promise<Dataset[]> {
    const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return this.request<Dataset[]>(`/api/studio/datasets${qs}`);
  }

  async studioDataset(id: string): Promise<Dataset> {
    return this.request<Dataset>(`/api/studio/datasets/${id}`);
  }

  async studioCreateDataset(p: { name: string; project_id?: string | null; classes: string[]; keep?: boolean }): Promise<Dataset> {
    return this.request<Dataset>('/api/studio/datasets', { method: 'POST', body: JSON.stringify(p) });
  }

  async studioUpdateDataset(id: string, p: { name?: string; project_id?: string; classes?: string[]; keep?: boolean; description?: string }): Promise<Dataset> {
    return this.request<Dataset>(`/api/studio/datasets/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async studioDeleteDataset(id: string): Promise<unknown> {
    return this.request(`/api/studio/datasets/${id}`, { method: 'DELETE' });
  }

  async studioUploadImages(id: string, files: File[]): Promise<UploadResult> {
    const fd = new FormData();
    for (const f of files) fd.append('images', f, f.name);
    return this.request<UploadResult>(`/api/studio/datasets/${id}/images`, { method: 'POST', body: fd });
  }

  async studioImages(id: string, opts: { offset?: number; limit?: number; filter?: 'all' | 'labeled' | 'unlabeled' } = {}): Promise<DatasetImage[]> {
    const qs = new URLSearchParams();
    if (opts.offset) qs.set('offset', String(opts.offset));
    if (opts.limit) qs.set('limit', String(opts.limit));
    if (opts.filter && opts.filter !== 'all') qs.set('filter', opts.filter);
    const q = qs.toString();
    return this.request<DatasetImage[]>(`/api/studio/datasets/${id}/images${q ? `?${q}` : ''}`);
  }

  studioImagePath(datasetId: string, imageId: string): string {
    return `/api/studio/datasets/${datasetId}/images/${imageId}/file`;
  }

  async studioSaveBoxes(datasetId: string, imageId: string, boxes: AnnotationBox[], labeled?: boolean): Promise<{ id: string; boxes: AnnotationBox[]; labeled: boolean }> {
    return this.request(`/api/studio/datasets/${datasetId}/images/${imageId}/boxes`, {
      method: 'PUT',
      body: JSON.stringify(labeled === undefined ? { boxes } : { boxes, labeled }),
    });
  }

  async studioDeleteImage(datasetId: string, imageId: string): Promise<unknown> {
    return this.request(`/api/studio/datasets/${datasetId}/images/${imageId}`, { method: 'DELETE' });
  }

  // ---- Studio: training
  async studioJobs(projectId?: string): Promise<TrainingJob[]> {
    return this.request<TrainingJob[]>(`/api/studio/training${projectId ? `?project_id=${projectId}` : ''}`);
  }

  async studioJob(id: string): Promise<TrainingJob> {
    return this.request<TrainingJob>(`/api/studio/training/${id}`);
  }

  async studioEstimate(p: CreateJobParams): Promise<TrainEstimate> {
    return this.request<TrainEstimate>('/api/studio/training/estimate', { method: 'POST', body: JSON.stringify(p) });
  }

  async studioCreateJob(p: CreateJobParams): Promise<{ job: TrainingJob; notebook_token?: string }> {
    return this.request('/api/studio/training', { method: 'POST', body: JSON.stringify(p) });
  }

  async studioCancelJob(id: string): Promise<TrainingJob> {
    return this.request<TrainingJob>(`/api/studio/training/${id}/cancel`, { method: 'POST' });
  }

  async studioNotebook(id: string): Promise<Blob> {
    return this.getBlob(`/api/studio/training/${id}/notebook`);
  }

  // ---- Studio: models, marketplace, earnings
  async studioModels(projectId?: string): Promise<CustomModel[]> {
    return this.request<CustomModel[]>(`/api/studio/models${projectId ? `?project_id=${projectId}` : ''}`);
  }

  async studioModel(slug: string): Promise<CustomModel> {
    return this.request<CustomModel>(`/api/studio/models/${slug}`);
  }

  async studioUpdateModel(slug: string, p: { name?: string; description?: string; license?: string; price_usd?: string; project_id?: string }): Promise<CustomModel> {
    return this.request<CustomModel>(`/api/studio/models/${slug}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async studioDeleteModel(slug: string): Promise<unknown> {
    return this.request(`/api/studio/models/${slug}`, { method: 'DELETE' });
  }

  async studioPublishModel(slug: string): Promise<CustomModel> {
    return this.request<CustomModel>(`/api/studio/models/${slug}/publish`, { method: 'POST' });
  }

  async studioUnpublishModel(slug: string): Promise<CustomModel> {
    return this.request<CustomModel>(`/api/studio/models/${slug}/unpublish`, { method: 'POST' });
  }

  async studioMarketplace(q = '', sort = ''): Promise<CustomModel[]> {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (sort) qs.set('sort', sort);
    const s = qs.toString();
    return this.request<CustomModel[]>(`/api/studio/marketplace${s ? `?${s}` : ''}`);
  }

  async studioEarnings(): Promise<Earnings> {
    return this.request<Earnings>('/api/studio/earnings');
  }

  // ---- Studio: sites
  async studioSites(): Promise<ModelSite[]> {
    return this.request<ModelSite[]>('/api/studio/sites');
  }

  async studioCreateSite(p: SiteInput): Promise<ModelSite> {
    return this.request<ModelSite>('/api/studio/sites', { method: 'POST', body: JSON.stringify(p) });
  }

  async studioUpdateSite(id: string, p: SiteInput): Promise<ModelSite> {
    return this.request<ModelSite>(`/api/studio/sites/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async studioDeleteSite(id: string): Promise<unknown> {
    return this.request(`/api/studio/sites/${id}`, { method: 'DELETE' });
  }

  // ---- Public pages (no sign-in)
  async studioInfo(): Promise<StudioInfo> {
    return this.request<StudioInfo>('/v1/studio/info');
  }

  async publicProfile(username: string): Promise<PublicProfile> {
    return this.request<PublicProfile>(`/v1/public/profiles/${encodeURIComponent(username)}`);
  }

  async publicProject(username: string, slug: string): Promise<PublicProjectPage> {
    return this.request<PublicProjectPage>(`/v1/public/profiles/${encodeURIComponent(username)}/projects/${encodeURIComponent(slug)}`);
  }

  async publicSite(slug: string): Promise<PublicSite> {
    return this.request<PublicSite>(`/v1/sites/${encodeURIComponent(slug)}`);
  }

  async runSite(slug: string, image: File | Blob): Promise<{ predictions: SitePrediction[]; latency_ms: number }> {
    const fd = new FormData();
    fd.append('image', image);
    return this.request(`/v1/sites/${encodeURIComponent(slug)}/run`, { method: 'POST', body: fd });
  }

  // ---- Admin: studio
  async adminStudioOverview(): Promise<StudioOverview> {
    return this.request<StudioOverview>('/admin/studio/overview');
  }

  async adminStudioModels(status = 'all'): Promise<CustomModel[]> {
    return this.request<CustomModel[]>(`/admin/studio/models?status=${status}`);
  }

  async adminReviewModel(slug: string, decision: 'approve' | 'reject' | 'unpublish', note = ''): Promise<unknown> {
    return this.request(`/admin/studio/models/${slug}/review`, { method: 'POST', body: JSON.stringify({ decision, note }) });
  }

  async adminStudioJobs(status = 'all'): Promise<TrainingJob[]> {
    return this.request<TrainingJob[]>(`/admin/studio/jobs?status=${status}`);
  }

  async adminCancelJob(id: string): Promise<unknown> {
    return this.request(`/admin/studio/jobs/${id}/cancel`, { method: 'POST' });
  }

  async adminUploadLTVision(file: File): Promise<{ ok: boolean; bytes: number }> {
    const fd = new FormData();
    fd.append('package', file, file.name);
    return this.request('/admin/studio/ltvision-package', { method: 'POST', body: fd });
  }

  async adminStudioDatasets(): Promise<AdminDataset[]> {
    return this.request<AdminDataset[]>('/admin/studio/datasets');
  }

  async adminPurgeDataset(id: string): Promise<unknown> {
    return this.request(`/admin/studio/datasets/${id}/purge`, { method: 'POST' });
  }

  async adminStudioSites(): Promise<ModelSite[]> {
    return this.request<ModelSite[]>('/admin/studio/sites');
  }

  async adminDisableSite(id: string, disabled: boolean): Promise<unknown> {
    return this.request(`/admin/studio/sites/${id}/disable`, { method: 'POST', body: JSON.stringify({ disabled }) });
  }

  async adminStudioSettings(): Promise<StudioSettings> {
    return this.request<StudioSettings>('/admin/studio/settings');
  }

  async adminSaveStudioSettings(s: Partial<StudioSettings>): Promise<StudioSettings> {
    return this.request<StudioSettings>('/admin/studio/settings', { method: 'PUT', body: JSON.stringify(s) });
  }

  async adminUserStudio(id: string): Promise<AdminUserStudio> {
    return this.request<AdminUserStudio>(`/admin/studio/users/${id}`);
  }

  async adminSetUserPlan(id: string, plan: string, days = 30): Promise<{ plan: string; period_end: string | null }> {
    return this.request(`/admin/studio/users/${id}/plan`, { method: 'POST', body: JSON.stringify({ plan, days }) });
  }

  // ---- Hub: settings, add-ons, GPU bundles
  async mySettings(): Promise<UserSettings> {
    return this.request<UserSettings>('/api/me/settings');
  }

  async saveMySettings(p: Partial<UserSettings>): Promise<UserSettings> {
    return this.request<UserSettings>('/api/me/settings', { method: 'PUT', body: JSON.stringify(p) });
  }

  async buyAddon(addon: string, quantity = 1): Promise<PlanResponse> {
    return this.request<PlanResponse>('/api/studio/addons', { method: 'POST', body: JSON.stringify({ addon, quantity }) });
  }

  async setAddonRenew(addon: string, autoRenew: boolean): Promise<PlanResponse> {
    return this.request<PlanResponse>(`/api/studio/addons/${addon}`, { method: 'PATCH', body: JSON.stringify({ auto_renew: autoRenew }) });
  }

  async buyGpuBundle(id: string): Promise<PlanResponse> {
    return this.request<PlanResponse>('/api/studio/gpu-bundles', { method: 'POST', body: JSON.stringify({ id }) });
  }

  async activity(filter: { area?: string; team?: string } = {}): Promise<ActivityItem[]> {
    const qs = new URLSearchParams(filter as Record<string, string>).toString();
    return this.request<ActivityItem[]>(`/api/activity${qs ? `?${qs}` : ''}`);
  }

  async importModel(fields: { weights: File; name: string; classes: string[]; size: string; metrics?: Record<string, number>; project_id?: string }): Promise<CustomModel> {
    const fd = new FormData();
    fd.append('weights', fields.weights, fields.weights.name);
    fd.append('name', fields.name);
    fd.append('classes', JSON.stringify(fields.classes));
    fd.append('size', fields.size);
    if (fields.metrics) fd.append('metrics', JSON.stringify(fields.metrics));
    if (fields.project_id) fd.append('project_id', fields.project_id);
    return this.request<CustomModel>('/api/studio/models/import', { method: 'POST', body: fd });
  }

  // ---- Teams
  async teams(): Promise<Team[]> {
    return this.request<Team[]>('/api/teams');
  }

  async team(id: string): Promise<Team> {
    return this.request<Team>(`/api/teams/${id}`);
  }

  async createTeam(p: { name: string; description?: string }): Promise<Team> {
    return this.request<Team>('/api/teams', { method: 'POST', body: JSON.stringify(p) });
  }

  async updateTeam(id: string, p: { name?: string; description?: string }): Promise<Team> {
    return this.request<Team>(`/api/teams/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async deleteTeam(id: string): Promise<unknown> {
    return this.request(`/api/teams/${id}`, { method: 'DELETE' });
  }

  async inviteMember(id: string, username: string, role: 'editor' | 'viewer'): Promise<Team> {
    return this.request<Team>(`/api/teams/${id}/members`, { method: 'POST', body: JSON.stringify({ username, role }) });
  }

  async setMemberRole(id: string, userId: string, role: 'editor' | 'viewer'): Promise<Team> {
    return this.request<Team>(`/api/teams/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
  }

  async removeMember(id: string, userId: string): Promise<unknown> {
    return this.request(`/api/teams/${id}/members/${userId}`, { method: 'DELETE' });
  }

  async acceptInvite(id: string): Promise<Team> {
    return this.request<Team>(`/api/teams/${id}/accept`, { method: 'POST' });
  }

  // ---- Community
  async communityMeta(): Promise<CommunityMeta> {
    return this.request<CommunityMeta>('/api/community/meta');
  }

  async posts(q: { space?: string; sort?: string; q?: string; saved?: boolean; author?: string; offset?: number } = {}): Promise<CommunityPost[]> {
    const qs = new URLSearchParams();
    if (q.space) qs.set('space', q.space);
    if (q.sort) qs.set('sort', q.sort);
    if (q.q) qs.set('q', q.q);
    if (q.saved) qs.set('saved', '1');
    if (q.author) qs.set('author', q.author);
    if (q.offset) qs.set('offset', String(q.offset));
    const s = qs.toString();
    return this.request<CommunityPost[]>(`/api/community/posts${s ? `?${s}` : ''}`);
  }

  async post(id: string): Promise<{ post: CommunityPost; comments: CommunityComment[] }> {
    return this.request(`/api/community/posts/${id}`);
  }

  async createPost(p: NewPost): Promise<CommunityPost> {
    const fd = new FormData();
    fd.append('space', p.space);
    fd.append('title', p.title);
    fd.append('body', p.body);
    if (p.link_kind) {
      fd.append('link_kind', p.link_kind);
      fd.append('link_ref', p.link_ref ?? '');
    }
    if (p.image) fd.append('image', p.image, p.image.name);
    return this.request<CommunityPost>('/api/community/posts', { method: 'POST', body: fd });
  }

  async updatePost(id: string, p: { title?: string; body?: string }): Promise<CommunityPost> {
    return this.request<CommunityPost>(`/api/community/posts/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async deletePost(id: string): Promise<unknown> {
    return this.request(`/api/community/posts/${id}`, { method: 'DELETE' });
  }

  async votePost(id: string, value: -1 | 0 | 1): Promise<CommunityPost> {
    return this.request<CommunityPost>(`/api/community/posts/${id}/vote`, { method: 'POST', body: JSON.stringify({ value }) });
  }

  async savePost(id: string, saved: boolean): Promise<CommunityPost> {
    return this.request<CommunityPost>(`/api/community/posts/${id}/save`, { method: 'POST', body: JSON.stringify({ saved }) });
  }

  async comment(id: string, body: string, parentId?: string): Promise<{ post: CommunityPost; comments: CommunityComment[] }> {
    return this.request(`/api/community/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body, parent_id: parentId ?? '' }) });
  }

  async deleteComment(id: string): Promise<unknown> {
    return this.request(`/api/community/comments/${id}`, { method: 'DELETE' });
  }

  async report(target: { post_id?: string; comment_id?: string }, reason: string): Promise<unknown> {
    return this.request('/api/community/report', { method: 'POST', body: JSON.stringify({ ...target, reason }) });
  }

  postImagePath(id: string): string {
    return `/api/community/posts/${id}/image`;
  }

  // ---- Dataset marketplace
  async listings(q: { q?: string; tag?: string; license?: string; sort?: string } = {}): Promise<DatasetListing[]> {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return this.request<DatasetListing[]>(`/api/market/datasets${qs ? `?${qs}` : ''}`);
  }

  async listing(id: string): Promise<DatasetListing> {
    return this.request<DatasetListing>(`/api/market/datasets/${id}`);
  }

  listingPreviewPath(id: string, imageId: string): string {
    return `/api/market/datasets/${id}/preview/${imageId}`;
  }

  async buyListing(id: string): Promise<{ purchase_id: string; listing: DatasetListing }> {
    return this.request(`/api/market/datasets/${id}/buy`, { method: 'POST', body: JSON.stringify({ accept_license: true }) });
  }

  async purchases(): Promise<Purchase[]> {
    return this.request<Purchase[]>('/api/market/purchases');
  }

  async importPurchase(id: string, projectId: string, name?: string): Promise<{ dataset: Dataset; copied: number }> {
    return this.request(`/api/market/purchases/${id}/import`, { method: 'POST', body: JSON.stringify({ project_id: projectId, name: name ?? '' }) });
  }

  async myListings(): Promise<DatasetListing[]> {
    return this.request<DatasetListing[]>('/api/market/my-datasets');
  }

  async createListing(p: ListingInput): Promise<DatasetListing> {
    return this.request<DatasetListing>('/api/market/my-datasets', { method: 'POST', body: JSON.stringify(p) });
  }

  async updateListing(id: string, p: ListingInput): Promise<DatasetListing> {
    return this.request<DatasetListing>(`/api/market/my-datasets/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async submitListing(id: string): Promise<DatasetListing> {
    return this.request<DatasetListing>(`/api/market/my-datasets/${id}/submit`, { method: 'POST' });
  }

  async unlistListing(id: string): Promise<DatasetListing> {
    return this.request<DatasetListing>(`/api/market/my-datasets/${id}/unlist`, { method: 'POST' });
  }

  async studioDatasetsKind(kind: 'training' | 'bundle'): Promise<Dataset[]> {
    return this.request<Dataset[]>(`/api/studio/datasets?kind=${kind}`);
  }

  async studioCreateBundle(p: { name: string; classes: string[]; description?: string }): Promise<Dataset> {
    return this.request<Dataset>('/api/studio/datasets', { method: 'POST', body: JSON.stringify({ ...p, kind: 'bundle' }) });
  }

  // ---- Research
  async researchOverview(): Promise<ResearchOverview> {
    return this.request<ResearchOverview>('/api/research/overview');
  }

  async areas(): Promise<ResearchArea[]> {
    return this.request<ResearchArea[]>('/api/research/areas');
  }

  async area(id: string): Promise<ResearchArea> {
    return this.request<ResearchArea>(`/api/research/areas/${id}`);
  }

  async createArea(p: Partial<Pick<ResearchArea, 'name' | 'description' | 'color' | 'status' | 'is_public'>> & { team_id?: string }): Promise<ResearchArea> {
    return this.request<ResearchArea>('/api/research/areas', { method: 'POST', body: JSON.stringify(p) });
  }

  async updateArea(id: string, p: Partial<Pick<ResearchArea, 'name' | 'description' | 'color' | 'status' | 'is_public'>> & { team_id?: string }): Promise<ResearchArea> {
    return this.request<ResearchArea>(`/api/research/areas/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
  }

  async deleteArea(id: string): Promise<unknown> {
    return this.request(`/api/research/areas/${id}`, { method: 'DELETE' });
  }

  private researchQS(f: { area?: string; q?: string; project?: string }) {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `?${qs}` : '';
  }

  async researchList<T>(kind: ResearchKind, f: { area?: string; q?: string; project?: string } = {}): Promise<T[]> {
    return this.request<T[]>(`/api/research/${kind}${this.researchQS(f)}`);
  }

  async researchCreate<T>(kind: ResearchKind, body: Record<string, unknown>): Promise<T> {
    return this.request<T>(`/api/research/${kind}`, { method: 'POST', body: JSON.stringify(body) });
  }

  async researchUpdate<T>(kind: ResearchKind, id: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>(`/api/research/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async researchDelete(kind: ResearchKind | 'files', id: string): Promise<unknown> {
    return this.request(`/api/research/${kind}/${id}`, { method: 'DELETE' });
  }

  async papers(f: { area?: string; q?: string } = {}): Promise<Paper[]> {
    return this.researchList<Paper>('papers', f);
  }

  async experiments(f: { area?: string; project?: string } = {}): Promise<Experiment[]> {
    return this.researchList<Experiment>('experiments', f);
  }

  async findings(f: { area?: string } = {}): Promise<Finding[]> {
    return this.researchList<Finding>('findings', f);
  }

  async notes(f: { area?: string } = {}): Promise<ResearchNote[]> {
    return this.researchList<ResearchNote>('notes', f);
  }

  async literature(f: { area?: string; q?: string } = {}): Promise<Reference[]> {
    return this.researchList<Reference>('literature', f);
  }

  async tasks(f: { area?: string } = {}): Promise<ResearchTask[]> {
    return this.researchList<ResearchTask>('tasks', f);
  }

  async uploadPaperPdf(id: string, file: File): Promise<Paper> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.request<Paper>(`/api/research/papers/${id}/pdf`, { method: 'POST', body: fd });
  }

  paperPdfPath(id: string): string {
    return `/api/research/papers/${id}/pdf`;
  }

  async paperBibtex(id: string): Promise<string> {
    const blob = await this.getBlob(`/api/research/papers/${id}/bibtex`);
    return blob.text();
  }

  async publishPaper(id: string, on: boolean): Promise<Paper> {
    return this.request<Paper>(`/api/research/papers/${id}/publish`, { method: 'POST', body: JSON.stringify({ on_layerto: on }) });
  }

  async importBibtex(bibtex: string, areaId?: string): Promise<{ added: number; found: number }> {
    return this.request('/api/research/literature/import', { method: 'POST', body: JSON.stringify({ bibtex, area_id: areaId ?? '' }) });
  }

  async researchFiles(area?: string): Promise<ResearchFile[]> {
    return this.request<ResearchFile[]>(`/api/research/files${area ? `?area=${area}` : ''}`);
  }

  async uploadResearchFile(file: File, areaId?: string): Promise<ResearchFile> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (areaId) fd.append('area_id', areaId);
    return this.request<ResearchFile>('/api/research/files', { method: 'POST', body: fd });
  }

  researchFilePath(id: string): string {
    return `/api/research/files/${id}`;
  }

  async portfolio(): Promise<PortfolioSettings> {
    return this.request<PortfolioSettings>('/api/research/portfolio');
  }

  async savePortfolio(p: Pick<PortfolioSettings, 'subdomain' | 'enabled' | 'theme' | 'sections' | 'about'>): Promise<PortfolioSettings> {
    return this.request<PortfolioSettings>('/api/research/portfolio', { method: 'PUT', body: JSON.stringify(p) });
  }

  async assistant(): Promise<AssistantStatus> {
    return this.request<AssistantStatus>('/api/research/assistant');
  }

  async joinAssistantWaitlist(): Promise<AssistantStatus> {
    return this.request<AssistantStatus>('/api/research/assistant/waitlist', { method: 'POST' });
  }

  // ---- Public (no sign-in)
  async publicPapers(q: { q?: string; author?: string } = {}): Promise<PublicPaper[]> {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return this.request<PublicPaper[]>(`/v1/public/papers${qs ? `?${qs}` : ''}`);
  }

  async publicPaper(id: string): Promise<PublicPaper> {
    return this.request<PublicPaper>(`/v1/public/papers/${id}`);
  }

  publicPaperPdfUrl(id: string): string {
    return `${this.baseUrl}/v1/public/papers/${id}/pdf`;
  }

  async publicPortfolio(subdomain: string): Promise<PublicPortfolio> {
    return this.request<PublicPortfolio>(`/v1/public/portfolio/${encodeURIComponent(subdomain)}`);
  }

  // ---- Admin: hub
  async adminHubOverview(): Promise<HubOverview> {
    return this.request<HubOverview>('/admin/hub/overview');
  }

  async adminListings(status = 'pending'): Promise<DatasetListing[]> {
    return this.request<DatasetListing[]>(`/admin/market/datasets?status=${status}`);
  }

  async adminReviewListing(id: string, decision: 'approve' | 'reject' | 'remove', note = ''): Promise<unknown> {
    return this.request(`/admin/market/datasets/${id}/review`, { method: 'POST', body: JSON.stringify({ decision, note }) });
  }

  adminListingPreviewPath(id: string, imageId: string): string {
    return `/admin/market/datasets/${id}/preview/${imageId}`;
  }

  async adminReports(all = false): Promise<CommunityReport[]> {
    return this.request<CommunityReport[]>(`/admin/community/reports${all ? '?all=1' : ''}`);
  }

  async adminPosts(q = ''): Promise<CommunityPost[]> {
    return this.request<CommunityPost[]>(`/admin/community/posts${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  async adminRemovePost(id: string, removed: boolean): Promise<unknown> {
    return this.request(`/admin/community/posts/${id}/remove`, { method: 'POST', body: JSON.stringify({ removed }) });
  }

  async adminRemoveComment(id: string, removed: boolean): Promise<unknown> {
    return this.request(`/admin/community/comments/${id}/remove`, { method: 'POST', body: JSON.stringify({ removed }) });
  }

  async adminResolveReport(id: string): Promise<unknown> {
    return this.request(`/admin/community/reports/${id}/resolve`, { method: 'POST' });
  }
}

export type ResearchKind = 'papers' | 'experiments' | 'findings' | 'notes' | 'literature' | 'tasks';
