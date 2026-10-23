package studio

import (
	"archive/zip"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/httpx"
)

//go:embed trainer/layerto_trainer.py
var trainerScript []byte

const ltvisionPackageKey = "ltvision/ltvision.zip"
const minLabeled = 10
const tokenTTL = 7 * 24 * time.Hour

// Presets keep hyperparameters simple for most people; "custom" exposes them.
type trainParams struct {
	Size        string `json:"size"`
	Epochs      int    `json:"epochs"`
	Img         int    `json:"img"`
	P2          bool   `json:"p2"`
	Patience    int    `json:"patience"`
	EvalEvery   int    `json:"eval_every"`
	CloseMosaic int    `json:"close_mosaic"`
	// optional: augmentation overrides and a model to fine-tune from
	Augment   *Augment `json:"augment,omitempty"`
	BaseModel string   `json:"base_model,omitempty"`
}

// Augment holds training-time augmentation settings (nil fields keep LTVision's defaults).
type Augment struct {
	Flip       *float64 `json:"flip,omitempty"`      // horizontal flip probability 0-1
	Mosaic     *float64 `json:"mosaic,omitempty"`    // mosaic probability 0-1
	Mixup      *float64 `json:"mixup,omitempty"`     // mixup probability 0-1
	Degrees    *float64 `json:"degrees,omitempty"`   // random rotation, 0-45 degrees
	Scale      *float64 `json:"scale,omitempty"`     // random scale +/- 0-0.9
	Translate  *float64 `json:"translate,omitempty"` // random shift 0-0.5 of the image
	HSV        *float64 `json:"hsv,omitempty"`       // colour jitter strength 0-2 (1 = default)
	Multiscale bool     `json:"multiscale,omitempty"`
}

func (a *Augment) validate() error {
	check := func(v *float64, lo, hi float64, name string) error {
		if v != nil && (math.IsNaN(*v) || *v < lo || *v > hi) {
			return fmt.Errorf("%s must be between %g and %g", name, lo, hi)
		}
		return nil
	}
	for _, c := range []error{check(a.Flip, 0, 1, "flip"), check(a.Mosaic, 0, 1, "mosaic"), check(a.Mixup, 0, 1, "mixup"),
		check(a.Degrees, 0, 45, "rotation"), check(a.Scale, 0, 0.9, "scale"), check(a.Translate, 0, 0.5, "shift"), check(a.HSV, 0, 2, "colour jitter")} {
		if c != nil {
			return c
		}
	}
	return nil
}

var presets = map[string]trainParams{
	"fast":     {Size: "s", Epochs: 60, Img: 640, Patience: 20, EvalEvery: 5, CloseMosaic: 10},
	"balanced": {Size: "m", Epochs: 120, Img: 640, Patience: 30, EvalEvery: 5, CloseMosaic: 10},
	"best":     {Size: "l", Epochs: 200, Img: 800, Patience: 40, EvalEvery: 5, CloseMosaic: 15},
}

// GPU seconds per image per epoch at 640px on an A100-class GPU (rough, for estimates).
var secPerImage = map[string]float64{"n": 0.004, "s": 0.006, "m": 0.011, "l": 0.018, "x": 0.028, "xl": 0.045, "xxl": 0.08}

func resolveParams(preset string, custom *trainParams) (trainParams, error) {
	if preset != "custom" {
		p, ok := presets[preset]
		if !ok {
			return trainParams{}, fmt.Errorf("unknown preset")
		}
		return p, nil
	}
	if custom == nil {
		return trainParams{}, fmt.Errorf("custom preset needs params")
	}
	p := *custom
	if _, ok := secPerImage[p.Size]; !ok {
		return p, fmt.Errorf("size must be one of n, s, m, l, x, xl, xxl")
	}
	if p.Epochs < 5 || p.Epochs > 500 {
		return p, fmt.Errorf("epochs must be 5-500")
	}
	if p.Img < 320 || p.Img > 1280 || p.Img%32 != 0 {
		return p, fmt.Errorf("image size must be 320-1280 and a multiple of 32")
	}
	if p.Patience < 0 || p.Patience > 500 {
		return p, fmt.Errorf("patience must be 0-500")
	}
	if p.EvalEvery <= 0 {
		p.EvalEvery = 5
	}
	if p.CloseMosaic <= 0 || p.CloseMosaic >= p.Epochs {
		p.CloseMosaic = int(math.Min(10, float64(p.Epochs/4)))
	}
	return p, nil
}

func (h *Handler) estimate(ctx context.Context, images int, p trainParams) (gpuHours float64, cost int64) {
	scale := float64(p.Img*p.Img) / (640 * 640)
	if p.P2 {
		scale *= 1.3
	}
	gpuHours = float64(images)*float64(p.Epochs)*secPerImage[p.Size]*scale/3600 + 0.1 // + setup/eval overhead
	price := catalog.IntSetting(ctx, h.pool, "gpu_price_per_hour", 1500000)
	cost = int64(math.Ceil(gpuHours * float64(price)))
	if cost < 100000 {
		cost = 100000 // 0.10 USD minimum
	}
	return math.Round(gpuHours*100) / 100, cost
}

type jobOut struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	DatasetID    string         `json:"dataset_id"`
	DatasetName  string         `json:"dataset_name"`
	ProjectID    *string        `json:"project_id"`
	Runner       string         `json:"runner"`
	Preset       string         `json:"preset"`
	Params       trainParams    `json:"params"`
	Status       string         `json:"status"`
	Progress     map[string]any `json:"progress"`
	ChargedUSD   string         `json:"charged_usd"`
	ModelSlug    *string        `json:"model_slug"`
	Error        string         `json:"error"`
	CreatedAt    string         `json:"created_at"`
	StartedAt    *string        `json:"started_at"`
	FinishedAt   *string        `json:"finished_at"`
	History      []any          `json:"history"`
	GPUHoursUsed float64        `json:"gpu_hours_used"`
	Owner        string         `json:"owner"`
	UserID       string         `json:"-"`
}

const jobCols = `j.id::text, j.name, j.dataset_id::text, d.name, j.project_id::text, j.runner, j.preset, j.params, j.status, j.progress,
	j.charged, m.slug, j.error, j.created_at, j.started_at, j.finished_at, j.history, j.gpu_seconds_used,
	COALESCE((SELECT username FROM user_profiles WHERE user_id = j.user_id), (SELECT email FROM users WHERE id = j.user_id), ''), j.user_id::text`
const jobFrom = ` FROM training_jobs j JOIN datasets d ON d.id = j.dataset_id LEFT JOIN models m ON m.id = j.model_id`

func scanJob(row interface{ Scan(...any) error }) (jobOut, error) {
	var j jobOut
	var params, prog []byte
	var charged int64
	var c time.Time
	var s, f *time.Time
	var hist []byte
	var gpuSecs int64
	err := row.Scan(&j.ID, &j.Name, &j.DatasetID, &j.DatasetName, &j.ProjectID, &j.Runner, &j.Preset, &params, &j.Status, &prog,
		&charged, &j.ModelSlug, &j.Error, &c, &s, &f, &hist, &gpuSecs, &j.Owner, &j.UserID)
	_ = json.Unmarshal(params, &j.Params)
	_ = json.Unmarshal(hist, &j.History)
	if j.History == nil {
		j.History = []any{}
	}
	j.GPUHoursUsed = float64(gpuSecs) / 3600
	j.Progress = jsonMap(prog)
	j.ChargedUSD = usd(charged)
	j.CreatedAt = ts(c)
	if s != nil {
		v := ts(*s)
		j.StartedAt = &v
	}
	if f != nil {
		v := ts(*f)
		j.FinishedAt = &v
	}
	return j, err
}

// GET /api/studio/training
func (h *Handler) HandleListJobs(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	q := `SELECT ` + jobCols + jobFrom + ` WHERE (j.user_id = $1 OR (j.project_id IS NOT NULL AND hub_project_read(j.project_id, $1)))`
	args := []any{uid}
	if p := r.URL.Query().Get("project_id"); validID(p) {
		args = append(args, p)
		q += ` AND j.project_id = $2`
	}
	rows, err := h.pool.Query(r.Context(), q+` ORDER BY j.created_at DESC LIMIT 200`, args...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []jobOut{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, j)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// GET /api/studio/training/{id}
func (h *Handler) HandleGetJob(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Training job")
		return
	}
	j, err := scanJob(h.pool.QueryRow(r.Context(), `SELECT `+jobCols+jobFrom+` WHERE j.id = $1 AND (j.user_id = $2 OR (j.project_id IS NOT NULL AND hub_project_read(j.project_id, $2)))`, id, uid))
	if isNoRows(err) {
		notFound(w, r, "Training job")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, j)
}

type jobRequest struct {
	DatasetID string       `json:"dataset_id"`
	Name      string       `json:"name"`
	Preset    string       `json:"preset"`
	Params    *trainParams `json:"params"`
	Runner    string       `json:"runner"`
	Augment   *Augment     `json:"augment"`
	BaseModel string       `json:"base_model"`
}

func (h *Handler) checkJobRequest(ctx context.Context, uid string, req jobRequest) (dataset, trainParams, int, int, error) {
	if !validID(req.DatasetID) {
		return dataset{}, trainParams{}, 0, 0, errors.New("dataset not found")
	}
	d, err := h.loadDataset(ctx, uid, req.DatasetID)
	if err != nil {
		return d, trainParams{}, 0, 0, errors.New("dataset not found")
	}
	if d.PurgedAt != nil {
		return d, trainParams{}, 0, 0, errors.New("this dataset's images were deleted")
	}
	if len(d.Classes) == 0 {
		return d, trainParams{}, 0, 0, errors.New("add at least one class to the dataset")
	}
	p, err := resolveParams(req.Preset, req.Params)
	if err != nil {
		return d, p, 0, 0, err
	}
	p.Augment, p.BaseModel = nil, ""
	if req.Augment != nil {
		if err := req.Augment.validate(); err != nil {
			return d, p, 0, 0, err
		}
		p.Augment = req.Augment
	}
	if b := strings.TrimSpace(req.BaseModel); b != "" {
		size, err := h.baseModelSize(ctx, uid, b, req.Runner)
		if err != nil {
			return d, p, 0, 0, err
		}
		p.BaseModel = b
		if size != "" {
			p.Size = size // fine-tuning keeps the base model's architecture
		}
	}
	if d.Labeled < minLabeled {
		return d, p, d.Labeled, 0, fmt.Errorf("label at least %d images first (%d labeled so far)", minLabeled, d.Labeled)
	}
	if d.Boxes == 0 {
		return d, p, d.Labeled, 0, errors.New("draw at least one box")
	}
	_, cost := h.estimate(ctx, d.Labeled, p)
	return d, p, d.Labeled, int(cost), nil
}

// POST /api/studio/training/estimate
func (h *Handler) HandleEstimate(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req jobRequest
	if !decodeJSON(w, r, &req, 8<<10) {
		return
	}
	d, p, labeled, _, err := h.checkJobRequest(r.Context(), uid, req)
	ready := err == nil
	msg := ""
	if err != nil {
		msg = err.Error()
		if d.ID == "" {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", msg)
			return
		}
		if p.Size == "" {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_params", msg)
			return
		}
	}
	hours, cost := h.estimate(r.Context(), max(labeled, d.Labeled), p)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ready": ready, "problem": msg, "labeled_images": d.Labeled, "params": p,
		"gpu_hours": hours, "layerto_cost_usd": usd(cost),
	})
}

// POST /api/studio/training
func (h *Handler) HandleCreateJob(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req jobRequest
	if !decodeJSON(w, r, &req, 8<<10) {
		return
	}
	ctx := r.Context()
	if !h.requireFeature(w, r, uid, "train") {
		return
	}
	if req.Runner != "layerto" && req.Runner != "notebook" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_runner", "runner must be layerto or notebook")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 80 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Model name must be 1-80 characters")
		return
	}
	d, p, _, cost, err := h.checkJobRequest(ctx, uid, req)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "not_ready", err.Error())
		return
	}
	plan, err := h.userPlan(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	u, err := h.usage(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	if u.PrivateModels >= plan.Plan.PrivateModels {
		quotaError(w, r, "model")
		return
	}
	var active int
	_ = h.pool.QueryRow(ctx, `SELECT count(*) FROM training_jobs WHERE user_id = $1 AND status IN ('queued','running')`, uid).Scan(&active)
	if active >= 3 {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "too_many_jobs", "You already have 3 trainings queued or running.")
		return
	}
	pj, _ := json.Marshal(p)
	token, hash := newToken()
	charge := int64(0)
	var gpuSecs int64
	if req.Runner == "layerto" {
		charge = int64(cost)
		hours, _ := h.estimate(ctx, d.Labeled, p)
		gpuSecs = int64(hours*3600 + 0.5)
		if gpuSecs < 60 {
			gpuSecs = 60
		}
	}
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	// prepaid GPU hours are used first; the balance is only charged when there aren't enough
	usedSecs := int64(0)
	if gpuSecs > 0 {
		tag, err := tx.Exec(ctx, `UPDATE gpu_credits SET seconds = seconds - $2, updated_at = now() WHERE user_id = $1 AND seconds >= $2`, uid, gpuSecs)
		if err != nil {
			internal(w, r, err)
			return
		}
		if tag.RowsAffected() == 1 {
			usedSecs, charge = gpuSecs, 0
		}
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO training_jobs (user_id, dataset_id, project_id, name, runner, preset, params, token_hash, token_expires, charged, gpu_seconds_used)
		VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id::text`,
		uid, d.ID, d.ProjectID, req.Name, req.Runner, req.Preset, pj, hash, time.Now().Add(tokenTTL), charge, usedSecs).Scan(&id); err != nil {
		internal(w, r, err)
		return
	}
	if err := h.startExperimentTx(ctx, tx, uid, id, d.ProjectID, req.Name, p); err != nil {
		internal(w, r, err)
		return
	}
	if charge > 0 {
		if _, err := billing.AdjustTx(ctx, tx, uid, -charge, "training.charged", map[string]any{"job_id": id, "gpu": "layerto"}); err != nil {
			if errors.Is(err, billing.ErrInsufficientBalance) {
				httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance",
					fmt.Sprintf("Training on Layerto GPUs costs about %s. Add credit, or train free in your own Colab/Kaggle notebook.", usd(charge)))
				return
			}
			internal(w, r, err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}
	j, _ := scanJob(h.pool.QueryRow(ctx, `SELECT `+jobCols+jobFrom+` WHERE j.id = $1`, id))
	resp := map[string]any{"job": j}
	if req.Runner == "notebook" {
		resp["notebook_token"] = token // shown once; the notebook can also be downloaded later (new token)
	}
	httpx.JSON(w, http.StatusCreated, resp)
}

// POST /api/studio/training/{id}/cancel
func (h *Handler) HandleCancelJob(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Training job")
		return
	}
	if err := h.finishJob(r.Context(), id, uid, "cancelled", "Cancelled by you"); err != nil {
		if errors.Is(err, errJobDone) {
			httpx.WriteError(w, r, http.StatusConflict, "job_finished", "This training has already finished.")
			return
		}
		notFound(w, r, "Training job")
		return
	}
	h.HandleGetJob(w, r)
}

var errJobDone = errors.New("job already finished")

// finishJob marks a job failed/cancelled and refunds a Layerto GPU charge. uid "" = any owner.
func (h *Handler) finishJob(ctx context.Context, id, uid, status, msg string) error {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var owner, cur string
	var charged, gpuUsed int64
	q := `SELECT user_id::text, status, charged, gpu_seconds_used FROM training_jobs WHERE id = $1`
	args := []any{id}
	if uid != "" {
		q += ` AND user_id = $2`
		args = append(args, uid)
	}
	if err := tx.QueryRow(ctx, q+` FOR UPDATE`, args...).Scan(&owner, &cur, &charged, &gpuUsed); err != nil {
		return err
	}
	if cur != "queued" && cur != "running" {
		return errJobDone
	}
	if _, err := tx.Exec(ctx, `UPDATE training_jobs SET status = $2, error = $3, finished_at = now(), token_hash = NULL WHERE id = $1`, id, status, msg); err != nil {
		return err
	}
	if charged > 0 {
		if _, err := billing.AdjustTx(ctx, tx, owner, charged, "training.refunded", map[string]any{"job_id": id, "reason": status}); err != nil {
			return err
		}
	}
	if gpuUsed > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO gpu_credits (user_id, seconds) VALUES ($1, $2)
			ON CONFLICT (user_id) DO UPDATE SET seconds = gpu_credits.seconds + $2, updated_at = now()`, owner, gpuUsed); err != nil {
			return err
		}
	}
	expStatus := "failed"
	if status == "cancelled" {
		expStatus = "cancelled"
	}
	if _, err := tx.Exec(ctx, `UPDATE experiments SET status = $2, conclusion = CASE WHEN conclusion = '' THEN $3 ELSE conclusion END, updated_at = now() WHERE job_id = $1`,
		id, expStatus, msg); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GET /api/studio/training/{id}/notebook  (rotates the job token; .ipynb download)
func (h *Handler) HandleNotebook(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Training job")
		return
	}
	var name, runner, status string
	if err := h.pool.QueryRow(r.Context(), `SELECT name, runner, status FROM training_jobs WHERE id = $1 AND user_id = $2`, id, uid).Scan(&name, &runner, &status); err != nil {
		notFound(w, r, "Training job")
		return
	}
	if runner != "notebook" || (status != "queued" && status != "running") {
		httpx.WriteError(w, r, http.StatusConflict, "no_notebook", "A notebook is only available for queued notebook trainings.")
		return
	}
	token, hash := newToken()
	if _, err := h.pool.Exec(r.Context(), `UPDATE training_jobs SET token_hash = $2, token_expires = $3 WHERE id = $1`, id, hash, time.Now().Add(tokenTTL)); err != nil {
		internal(w, r, err)
		return
	}
	nb := buildNotebook(h.opt.PublicAPIURL, id, token, name)
	w.Header().Set("Content-Type", "application/x-ipynb+json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="layerto-train-%s.ipynb"`, slugify(name, 40)))
	_, _ = w.Write(nb)
}

func buildNotebook(api, jobID, token, name string) []byte {
	md := func(s string) map[string]any {
		return map[string]any{"cell_type": "markdown", "metadata": map[string]any{}, "source": s}
	}
	code := func(s string) map[string]any {
		return map[string]any{"cell_type": "code", "metadata": map[string]any{}, "execution_count": nil, "outputs": []any{}, "source": s}
	}
	cells := []any{
		md("# Train \"" + name + "\" on Layerto\n\n" +
			"**Runtime → Change runtime type → GPU**, then **Runtime → Run all**.\n\n" +
			"This notebook downloads your dataset from Layerto, trains an LTVision model on this GPU, and uploads the " +
			"trained model back to your Layerto account, where it gets an API. Your images are only used for this training.\n\n" +
			"The access key below works only for this one training and expires in 7 days. Don't share this notebook."),
		code("!nvidia-smi --query-gpu=name,memory.total --format=csv"),
		code(fmt.Sprintf("API = %q\nJOB = %q\nTOKEN = %q", api, jobID, token)),
		code("!pip -q install pycocotools scipy opencv-python-headless\n" +
			"import urllib.request\n" +
			"urllib.request.urlretrieve(API + '/v1/train/trainer.py', 'layerto_trainer.py')\n" +
			"print('ready')"),
		code("!python layerto_trainer.py job --api {API} --job {JOB} --token {TOKEN}"),
		md("When the last cell prints **Done**, open **Layerto → Models**: your model and its API are ready."),
	}
	nb := map[string]any{
		"cells": cells, "nbformat": 4, "nbformat_minor": 0,
		"metadata": map[string]any{"accelerator": "GPU", "kernelspec": map[string]any{"display_name": "Python 3", "name": "python3"},
			"language_info": map[string]any{"name": "python"}, "colab": map[string]any{"provenance": []any{}}},
	}
	b, _ := json.MarshalIndent(nb, "", " ")
	return b
}

// ===== trainer protocol (notebook or Layerto GPU worker), authorised by the job token =====

// GET /v1/train/trainer.py (public: no secrets in it)
func (h *Handler) HandleTrainerScript(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/x-python; charset=utf-8")
	_, _ = w.Write(trainerScript)
}

type jobAuth struct {
	ID, UserID, DatasetID, Name, Status, Runner string
	Params                                      trainParams
	ProjectID                                   *string
}

func (h *Handler) authJob(w http.ResponseWriter, r *http.Request, jobID string) (*jobAuth, bool) {
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !strings.HasPrefix(tok, "ltj_") || (jobID != "" && !validID(jobID)) {
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_job_token", "Missing or invalid training token")
		return nil, false
	}
	q := `SELECT id::text, user_id::text, dataset_id::text, name, status, runner, params, project_id::text FROM training_jobs
		WHERE token_hash = $1 AND token_expires > now() AND status IN ('queued','running')`
	args := []any{hashToken(tok)}
	if jobID != "" {
		q += ` AND id = $2`
		args = append(args, jobID)
	}
	var j jobAuth
	var params []byte
	if err := h.pool.QueryRow(r.Context(), q, args...).Scan(&j.ID, &j.UserID, &j.DatasetID, &j.Name, &j.Status, &j.Runner, &params, &j.ProjectID); err != nil {
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_job_token", "This training token is invalid, expired, or the training has finished")
		return nil, false
	}
	_ = json.Unmarshal(params, &j.Params)
	return &j, true
}

// GET /v1/train/code (the LTVision package uploaded by the admin)
func (h *Handler) HandleTrainCode(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.authJob(w, r, ""); !ok {
		return
	}
	p, err := h.store.PlainPath(ltvisionPackageKey)
	if err != nil {
		httpx.WriteError(w, r, http.StatusServiceUnavailable, "trainer_unavailable", "Training code isn't installed on this Layerto server yet (admin: Training → upload LTVision package).")
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	http.ServeFile(w, r, p)
}

// GET /v1/train/jobs/{id}/spec
func (h *Handler) HandleJobSpec(w http.ResponseWriter, r *http.Request) {
	j, ok := h.authJob(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var classes []byte
	var images int
	if err := h.pool.QueryRow(r.Context(), `SELECT d.classes, (SELECT count(*) FROM dataset_images i WHERE i.dataset_id = d.id AND i.labeled)
		FROM datasets d WHERE d.id = $1`, j.DatasetID).Scan(&classes, &images); err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"job_id": j.ID, "name": j.Name, "classes": jsonStrings(classes), "images": images,
		"size": j.Params.Size, "epochs": j.Params.Epochs, "img": j.Params.Img, "p2": j.Params.P2,
		"patience": j.Params.Patience, "eval_every": j.Params.EvalEvery, "close_mosaic": j.Params.CloseMosaic,
		"augment": j.Params.Augment, "has_init": j.Params.BaseModel != "",
	})
}

// baseModelSize checks the user may fine-tune from this model and returns its architecture size.
// Your own models work with any runner; published models only on Layerto GPUs, so their weights never
// leave Layerto's machines.
func (h *Handler) baseModelSize(ctx context.Context, uid, slug, runner string) (string, error) {
	var owner, vis string
	var metrics []byte
	err := h.pool.QueryRow(ctx, `SELECT o.owner_id::text, o.visibility, o.metrics FROM model_ownership o JOIN models m ON m.id = o.model_id
		WHERE m.slug = $1 AND m.enabled`, slug).Scan(&owner, &vis, &metrics)
	if err != nil {
		return "", errors.New("base model not found (use one of your models or a published LTVision model)")
	}
	if owner != uid {
		if vis != "public" {
			return "", errors.New("base model not found (use one of your models or a published LTVision model)")
		}
		if runner != "layerto" {
			return "", errors.New("fine-tuning someone else's published model runs on Layerto GPUs only, so their weights stay private")
		}
	}
	size, _ := jsonMap(metrics)["size"].(string)
	return size, nil
}

// GET /v1/train/jobs/{id}/init.pt  (job token) -> weights of the base model to fine-tune from
func (h *Handler) HandleJobInitWeights(w http.ResponseWriter, r *http.Request) {
	j, ok := h.authJob(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if j.Params.BaseModel == "" {
		notFound(w, r, "Base model")
		return
	}
	if _, err := h.baseModelSize(r.Context(), j.UserID, j.Params.BaseModel, j.Runner); err != nil {
		notFound(w, r, "Base model")
		return
	}
	var key string
	if err := h.pool.QueryRow(r.Context(), `SELECT o.weights_key FROM model_ownership o JOIN models m ON m.id = o.model_id WHERE m.slug = $1`,
		j.Params.BaseModel).Scan(&key); err != nil {
		notFound(w, r, "Base model")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "Base model")
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(data)
}

// GET /v1/train/jobs/{id}/dataset.zip  -> train/ + valid/ in COCO JSON format (streamed)
func (h *Handler) HandleJobDataset(w http.ResponseWriter, r *http.Request) {
	j, ok := h.authJob(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	ctx := r.Context()
	var classesRaw []byte
	if err := h.pool.QueryRow(ctx, `SELECT classes FROM datasets WHERE id = $1 AND purged_at IS NULL`, j.DatasetID).Scan(&classesRaw); err != nil {
		httpx.WriteError(w, r, http.StatusGone, "dataset_deleted", "The dataset for this training was deleted")
		return
	}
	classes := jsonStrings(classesRaw)
	rows, err := h.pool.Query(ctx, `SELECT id::text, storage_key, mime, width, height, boxes FROM dataset_images
		WHERE dataset_id = $1 AND labeled ORDER BY created_at, id`, j.DatasetID)
	if err != nil {
		internal(w, r, err)
		return
	}
	type img struct {
		id, key, ext string
		w, h         int
		boxes        []box
	}
	var all []img
	for rows.Next() {
		var im img
		var mime string
		var bx []byte
		if rows.Scan(&im.id, &im.key, &mime, &im.w, &im.h, &bx) == nil {
			_ = json.Unmarshal(bx, &im.boxes)
			im.ext = ".jpg"
			if strings.HasSuffix(mime, "png") {
				im.ext = ".png"
			} else if strings.HasSuffix(mime, "webp") {
				im.ext = ".webp"
			}
			all = append(all, im)
		}
	}
	rows.Close()
	// deterministic ~10% validation split (at least 1 image; tiny sets validate on a copy)
	var train, valid []img
	for _, im := range all {
		hsh := fnv.New32a()
		_, _ = hsh.Write([]byte(im.id))
		if hsh.Sum32()%10 == 0 {
			valid = append(valid, im)
		} else {
			train = append(train, im)
		}
	}
	if len(valid) == 0 && len(train) > 0 {
		valid = append(valid, train[len(train)-1])
		if len(train) > 1 {
			train = train[:len(train)-1]
		}
	}
	coco := func(list []img) []byte {
		cats := make([]map[string]any, len(classes))
		for i, c := range classes {
			cats[i] = map[string]any{"id": i + 1, "name": c, "supercategory": "object"}
		}
		images := make([]map[string]any, 0, len(list))
		anns := []map[string]any{}
		aid := 1
		for n, im := range list {
			images = append(images, map[string]any{"id": n + 1, "file_name": im.id + im.ext, "width": im.w, "height": im.h})
			for _, b := range im.boxes {
				anns = append(anns, map[string]any{"id": aid, "image_id": n + 1, "category_id": b.C + 1,
					"bbox": []float64{b.X, b.Y, b.W, b.H}, "area": b.W * b.H, "iscrowd": 0})
				aid++
			}
		}
		out, _ := json.Marshal(map[string]any{"images": images, "annotations": anns, "categories": cats})
		return out
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="dataset.zip"`)
	zw := zip.NewWriter(w)
	write := func(name string, data []byte) error {
		f, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			return err
		}
		_, err = f.Write(data)
		return err
	}
	for split, list := range map[string][]img{"train": train, "valid": valid} {
		if err := write(split+"/_annotations.coco.json", coco(list)); err != nil {
			return
		}
		for _, im := range list {
			data, err := h.store.Get(im.key)
			if err != nil {
				logf("export %s: %v", im.id, err)
				continue
			}
			if err := write(split+"/"+im.id+im.ext, data); err != nil {
				return
			}
		}
	}
	_ = zw.Close()
}

// POST /v1/train/jobs/{id}/progress {"status":"running","epoch":3,"epochs":100,"map50_95":0.2,"map50":0.4,"message":""}
func (h *Handler) HandleJobProgress(w http.ResponseWriter, r *http.Request) {
	j, ok := h.authJob(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var in map[string]any
	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid body")
		return
	}
	prog := map[string]any{}
	for _, k := range []string{"epoch", "epochs", "map50_95", "map50", "loss"} {
		if v, ok := in[k].(float64); ok && !math.IsNaN(v) && !math.IsInf(v, 0) {
			prog[k] = v
		}
	}
	if m, ok := in["message"].(string); ok && len(m) <= 200 {
		prog["message"] = m
	}
	prog["updated_at"] = ts(time.Now())
	pj, _ := json.Marshal(prog)
	// one history point per evaluated epoch (the learning curve shown on models and experiments)
	var point []byte
	if ep, ok := prog["epoch"]; ok {
		pt := map[string]any{"epoch": ep}
		for _, k := range []string{"map50_95", "map50", "loss"} {
			if v, ok := prog[k]; ok {
				pt[k] = v
			}
		}
		if len(pt) > 1 {
			point, _ = json.Marshal([]any{pt})
		}
	}
	if _, err := h.pool.Exec(r.Context(), `UPDATE training_jobs SET status = 'running', progress = progress || $2,
		history = CASE WHEN $3::jsonb IS NULL OR jsonb_array_length(history) >= 2000 THEN history ELSE history || $3::jsonb END,
		started_at = COALESCE(started_at, now()) WHERE id = $1`, j.ID, pj, nullBytes(point)); err != nil {
		internal(w, r, err)
		return
	}
	_, _ = h.pool.Exec(r.Context(), `UPDATE experiments e SET status = 'running', history = j.history, updated_at = now()
		FROM training_jobs j WHERE j.id = $1 AND e.job_id = j.id`, j.ID)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /v1/train/jobs/{id}/fail {"error": "..."}
func (h *Handler) HandleJobFail(w http.ResponseWriter, r *http.Request) {
	j, ok := h.authJob(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var in struct {
		Error string `json:"error"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
	_ = json.NewDecoder(r.Body).Decode(&in)
	msg := strings.TrimSpace(in.Error)
	if len(msg) > 500 {
		msg = msg[:500]
	}
	if msg == "" {
		msg = "Training failed"
	}
	if err := h.finishJob(r.Context(), j.ID, "", "failed", msg); err != nil && !errors.Is(err, errJobDone) {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

var numericMetrics = []string{"map50_95", "map50", "map75", "map_small", "map_medium", "map_large", "ar1", "ar10", "ar100",
	"precision", "recall", "f1", "best_epoch", "epochs", "img", "params_m", "latency_ms", "model_mb", "train_images", "val_images"}

// cleanMetrics keeps known numeric metrics, the model size and up to 500 per-class APs.
func cleanMetrics(raw map[string]any) map[string]any {
	metrics := map[string]any{}
	for _, k := range numericMetrics {
		if v, ok := raw[k].(float64); ok && !math.IsNaN(v) && !math.IsInf(v, 0) {
			metrics[k] = v
		}
	}
	if s, ok := raw["size"].(string); ok && len(s) <= 4 {
		metrics["size"] = s
	}
	if pc, ok := raw["per_class_ap"].(map[string]any); ok {
		out := map[string]float64{}
		for name, v := range pc {
			if f, ok := v.(float64); ok && !math.IsNaN(f) && len(name) <= 80 && len(out) < 500 {
				out[name] = f
			}
		}
		if len(out) > 0 {
			metrics["per_class_ap"] = out
		}
	}
	return metrics
}

// POST /v1/train/jobs/{id}/weights  multipart: weights (best.pt), metrics (JSON)
func (h *Handler) HandleJobWeights(w http.ResponseWriter, r *http.Request) {
	j, ok := h.authJob(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 2*time.Minute)
	defer cancel()
	r.Body = http.MaxBytesReader(w, r.Body, 1100<<20)
	mr, err := r.MultipartReader()
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Send multipart/form-data with weights and metrics")
		return
	}
	var weights []byte
	metrics := map[string]any{}
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "upload_failed", "Upload interrupted or larger than 1 GB")
			return
		}
		switch part.FormName() {
		case "weights":
			weights, err = io.ReadAll(io.LimitReader(part, 1024<<20+1))
			if err != nil || len(weights) > 1024<<20 {
				httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, "weights_too_large", "Weights must be under 1 GB")
				return
			}
		case "metrics":
			b, _ := io.ReadAll(io.LimitReader(part, 64<<10))
			raw := map[string]any{}
			_ = json.Unmarshal(b, &raw)
			metrics = cleanMetrics(raw)
		}
		_ = part.Close()
	}
	if len(weights) < 1024 {
		httpx.WriteError(w, r, http.StatusBadRequest, "missing_weights", "No weights file received")
		return
	}
	var username string
	_ = h.pool.QueryRow(ctx, `SELECT username FROM user_profiles WHERE user_id = $1`, j.UserID).Scan(&username)
	if username == "" {
		username = "u"
	}
	var classes []byte
	var keep bool
	var dataLicense string
	if err := h.pool.QueryRow(ctx, `SELECT classes, keep, license FROM datasets WHERE id = $1`, j.DatasetID).Scan(&classes, &keep, &dataLicense); err != nil {
		internal(w, r, err)
		return
	}
	var endpoint string
	if err := catalog.Setting(ctx, h.pool, "ltvision_endpoint", &endpoint); err != nil || endpoint == "" {
		endpoint = "ltvision-ep"
	}
	var modelID string
	if err := h.pool.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&modelID); err != nil {
		internal(w, r, err)
		return
	}
	key := "weights/" + modelID + ".pt"
	if err := h.store.Put(key, weights); err != nil {
		internal(w, r, err)
		return
	}
	slug := fmt.Sprintf("%s-%s-%s", slugify(username, 30), slugify(j.Name, 40), modelID[:4])
	mj, _ := json.Marshal(metrics)
	desc := "" // the owner writes it before publishing
	retention := catalog.IntSetting(ctx, h.pool, "dataset_retention_days", 3)

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM training_jobs WHERE id = $1 FOR UPDATE`, j.ID).Scan(&status); err != nil || (status != "queued" && status != "running") {
		_ = h.store.Delete(key)
		httpx.WriteError(w, r, http.StatusConflict, "job_finished", "This training was cancelled or already finished")
		return
	}
	if _, err := tx.Exec(ctx, `INSERT INTO models (id, slug, name, description, license, is_open, runpod_endpoint, price_per_call, enabled, meta)
		VALUES ($1,$2,$3,$4,'owner',false,$5,2000,true,'{"kind":"custom"}')`, modelID, slug, j.Name, desc, endpoint); err != nil {
		_ = h.store.Delete(key)
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(ctx, `INSERT INTO model_ownership (model_id, owner_id, project_id, job_id, weights_key, classes, metrics, data_license, history)
		VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8,(SELECT history FROM training_jobs WHERE id = $4))`, modelID, j.UserID, j.ProjectID, j.ID, key, classes, mj, dataLicense); err != nil {
		_ = h.store.Delete(key)
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE training_jobs SET status = 'succeeded', model_id = $2, finished_at = now(), token_hash = NULL,
		started_at = COALESCE(started_at, now()), progress = progress || $3 WHERE id = $1`, j.ID, modelID, mj); err != nil {
		internal(w, r, err)
		return
	}
	if !keep {
		if _, err := tx.Exec(ctx, `UPDATE datasets SET delete_after = now() + make_interval(days => $2) WHERE id = $1`, j.DatasetID, retention); err != nil {
			internal(w, r, err)
			return
		}
	}
	if err := h.completeExperimentTx(ctx, tx, j.ID, slug, metrics); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		_ = h.store.Delete(key)
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"model_slug": slug, "model_id": modelID})
}

// POST /v1/train/next (Layerto GPU worker, X-Worker-Token) -> claims the oldest queued job
func (h *Handler) HandleClaimJob(w http.ResponseWriter, r *http.Request) {
	if !h.workerAuthed(w, r) {
		return
	}
	token, hash := newToken()
	var id string
	err := h.pool.QueryRow(r.Context(), `UPDATE training_jobs SET status = 'running', started_at = now(), token_hash = $1, token_expires = now() + interval '3 days'
		WHERE id = (SELECT id FROM training_jobs WHERE status = 'queued' AND runner = 'layerto' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
		RETURNING id::text`, hash).Scan(&id)
	if isNoRows(err) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"job_id": id, "token": token})
}

func (h *Handler) workerAuthed(w http.ResponseWriter, r *http.Request) bool {
	got := r.Header.Get("X-Worker-Token")
	if h.opt.WorkerToken == "" || len(got) != len(h.opt.WorkerToken) || hashToken(got) != hashToken(h.opt.WorkerToken) {
		httpx.WriteError(w, r, http.StatusUnauthorized, "invalid_worker_token", "Invalid worker token")
		return false
	}
	return true
}

// GET /v1/internal/weights/{modelId} (inference worker, X-Worker-Token)
func (h *Handler) HandleWorkerWeights(w http.ResponseWriter, r *http.Request) {
	if !h.workerAuthed(w, r) {
		return
	}
	key := chi.URLParam(r, "key")
	if !strings.HasPrefix(key, "weights/") {
		key = "weights/" + key
	}
	var exists bool
	_ = h.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM model_ownership WHERE weights_key = $1)`, key).Scan(&exists)
	if !exists {
		notFound(w, r, "Weights")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "Weights")
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(data)
}

// failStale fails Layerto GPU jobs that have stopped reporting (worker crashed).
func (h *Handler) failStale(ctx context.Context) {
	rows, err := h.pool.Query(ctx, `SELECT id::text FROM training_jobs WHERE status = 'running' AND runner = 'layerto'
		AND COALESCE((progress->>'updated_at')::timestamptz, started_at) < now() - interval '6 hours'`)
	if err != nil {
		return
	}
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	for _, id := range ids {
		_ = h.finishJob(ctx, id, "", "failed", "The training worker stopped responding. You were refunded.")
	}
}
