package studio

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/httpx"
)

// The dataset marketplace: photographers (and anyone with "sell_images") list image datasets with a
// license; buyers pay from their balance and copy the images (with any boxes) into their own project
// datasets, ready to annotate, augment and train on Layerto.

var licenseInfo = map[string]string{
	"research_only":                "Research and non-commercial use only. Models trained on it can't be sold or get public websites.",
	"commercial":                   "Commercial use allowed, including models you sell. Don't resell or share the images themselves.",
	"commercial_no_redistribution": "Commercial use of trained models allowed. The images may never be redistributed or published.",
	"cc_by":                        "Creative Commons Attribution 4.0: any use, including redistribution, with credit to the photographer.",
}

const previewCount = 8

type listing struct {
	ID          string   `json:"id"`
	DatasetID   string   `json:"dataset_id,omitempty"`
	Seller      string   `json:"seller"`
	SellerName  string   `json:"seller_name"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	License     string   `json:"license"`
	LicenseText string   `json:"license_text"`
	PriceUSD    string   `json:"price_usd"`
	Status      string   `json:"status"`
	ReviewNote  string   `json:"review_note,omitempty"`
	Sales       int      `json:"sales"`
	Images      int      `json:"images"`
	Labeled     int      `json:"labeled"`
	Boxes       int      `json:"boxes"`
	Bytes       int64    `json:"bytes"`
	Classes     []string `json:"classes"`
	Previews    []string `json:"previews"`
	Purchased   bool     `json:"purchased"`
	Mine        bool     `json:"mine"`
	CreatedAt   string   `json:"created_at"`
	PublishedAt *string  `json:"published_at"`
	EarnedUSD   string   `json:"earned_usd,omitempty"`
}

const listingCols = `l.id::text, l.dataset_id::text, COALESCE(up.username, ''), COALESCE(up.first_name || ' ' || up.last_name, ''), l.title, l.description,
	l.tags, l.license, l.price, l.status, l.review_note, l.sales, d.classes, d.bytes,
	(SELECT count(*) FROM dataset_images i WHERE i.dataset_id = d.id),
	(SELECT count(*) FROM dataset_images i WHERE i.dataset_id = d.id AND i.labeled),
	(SELECT COALESCE(sum(jsonb_array_length(i.boxes)), 0) FROM dataset_images i WHERE i.dataset_id = d.id),
	ARRAY(SELECT i.id::text FROM dataset_images i WHERE i.dataset_id = d.id ORDER BY i.created_at, i.id LIMIT 8),
	EXISTS (SELECT 1 FROM dataset_purchases p WHERE p.listing_id = l.id AND p.buyer_id = $1),
	l.seller_id = $1, l.created_at, l.published_at
	FROM dataset_listings l JOIN datasets d ON d.id = l.dataset_id LEFT JOIN user_profiles up ON up.user_id = l.seller_id`

func scanListing(row interface{ Scan(...any) error }) (listing, error) {
	var l listing
	var tags, classes []byte
	var price int64
	var c time.Time
	var pub *time.Time
	err := row.Scan(&l.ID, &l.DatasetID, &l.Seller, &l.SellerName, &l.Title, &l.Description, &tags, &l.License, &price, &l.Status, &l.ReviewNote,
		&l.Sales, &classes, &l.Bytes, &l.Images, &l.Labeled, &l.Boxes, &l.Previews, &l.Purchased, &l.Mine, &c, &pub)
	l.Tags, l.Classes = jsonStrings(tags), jsonStrings(classes)
	l.PriceUSD = usd(price)
	l.LicenseText = licenseInfo[l.License]
	l.SellerName = strings.TrimSpace(l.SellerName)
	l.CreatedAt = ts(c)
	if pub != nil {
		s := ts(*pub)
		l.PublishedAt = &s
	}
	if l.Previews == nil {
		l.Previews = []string{}
	}
	return l, err
}

type listingInput struct {
	DatasetID   *string   `json:"dataset_id"`
	Title       *string   `json:"title"`
	Description *string   `json:"description"`
	Tags        *[]string `json:"tags"`
	License     *string   `json:"license"`
	PriceUSD    *string   `json:"price_usd"`
}

func (in *listingInput) validate() (price *int64, tags []byte, msg string) {
	if in.Title != nil && (len([]rune(strings.TrimSpace(*in.Title))) < 3 || len([]rune(*in.Title)) > 100) {
		return nil, nil, "Title must be 3-100 characters"
	}
	if in.Description != nil && len([]rune(*in.Description)) > 4000 {
		return nil, nil, "Description is too long (4000 characters max)"
	}
	if in.License != nil {
		if _, ok := licenseInfo[*in.License]; !ok {
			return nil, nil, "Choose a license"
		}
	}
	if in.PriceUSD != nil {
		p, err := billing.ParseAmountUSD(strings.TrimSpace(*in.PriceUSD))
		if err != nil || p < 0 || p > 100_000_000_000 {
			return nil, nil, "Enter a price in USD, for example 25.00 (0 for free)"
		}
		price = &p
	}
	if in.Tags != nil {
		clean := []string{}
		for _, t := range *in.Tags {
			t = strings.ToLower(strings.TrimSpace(t))
			if t != "" && len(t) <= 30 && len(clean) < 12 {
				clean = append(clean, t)
			}
		}
		tags, _ = json.Marshal(clean)
	}
	return price, tags, ""
}

// GET /api/market/datasets?q=&tag=&license=&sort=new|popular|price
func (h *Handler) HandleListListings(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	tag := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("tag")))
	lic := r.URL.Query().Get("license")
	order := "l.published_at DESC"
	switch r.URL.Query().Get("sort") {
	case "popular":
		order = "l.sales DESC, l.published_at DESC"
	case "price":
		order = "l.price ASC, l.published_at DESC"
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+listingCols+`
		WHERE l.status = 'public' AND d.purged_at IS NULL
		  AND ($2 = '' OR l.title ILIKE '%' || $2 || '%' OR l.description ILIKE '%' || $2 || '%' OR d.classes::text ILIKE '%' || $2 || '%')
		  AND ($3 = '' OR l.tags ? $3) AND ($4 = '' OR l.license = $4)
		ORDER BY `+order+` LIMIT 200`, uid, q, tag, lic)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []listing{}
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		if !l.Mine {
			l.DatasetID = ""
		}
		out = append(out, l)
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) loadListing(ctx context.Context, uid, id string) (listing, error) {
	return scanListing(h.pool.QueryRow(ctx, `SELECT `+listingCols+` WHERE l.id = $2 AND (l.status = 'public' OR l.seller_id = $1
		OR EXISTS (SELECT 1 FROM dataset_purchases p WHERE p.listing_id = l.id AND p.buyer_id = $1))`, uid, id))
}

// GET /api/market/datasets/{id}
func (h *Handler) HandleGetListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Dataset")
		return
	}
	l, err := h.loadListing(r.Context(), uid, id)
	if err != nil {
		notFound(w, r, "Dataset")
		return
	}
	if !l.Mine {
		l.DatasetID = ""
	}
	httpx.JSON(w, http.StatusOK, l)
}

// GET /api/market/datasets/{id}/preview/{imageId} -> small JPEG of one of the first preview images
func (h *Handler) HandleListingPreview(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id, imgID := chi.URLParam(r, "id"), chi.URLParam(r, "imageId")
	if !validID(id) || !validID(imgID) {
		notFound(w, r, "Image")
		return
	}
	l, err := h.loadListing(r.Context(), uid, id)
	if err != nil {
		notFound(w, r, "Image")
		return
	}
	allowed := false
	for _, p := range l.Previews {
		allowed = allowed || p == imgID
	}
	var key string
	if !allowed || h.pool.QueryRow(r.Context(), `SELECT storage_key FROM dataset_images WHERE id = $1`, imgID).Scan(&key) != nil {
		notFound(w, r, "Image")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "Image")
		return
	}
	small, err := thumbnail(data, 480)
	if err != nil {
		notFound(w, r, "Image")
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(small)
}

// thumbnail scales an image down so its longest side is at most max pixels (JPEG output).
func thumbnail(data []byte, max int) ([]byte, error) {
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > max || h > max {
		if w >= h {
			h, w = h*max/w, max
		} else {
			w, h = w*max/h, max
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, max1(w), max1(h)))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, b, draw.Src, nil)
	var out bytes.Buffer
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 78}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func max1(v int) int {
	if v < 1 {
		return 1
	}
	return v
}

// ---- selling

// GET /api/market/my-datasets  (seller view: listings with earnings)
func (h *Handler) HandleMyListings(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+listingCols+` WHERE l.seller_id = $1 ORDER BY l.created_at DESC`, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []listing{}
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, l)
	}
	rows.Close()
	for i := range out {
		var earned int64
		_ = h.pool.QueryRow(r.Context(), `SELECT COALESCE(sum((payload->>'amount')::bigint), 0) FROM events WHERE type = 'dataset.sale' AND user_id = $1 AND payload->>'listing_id' = $2`,
			uid, out[i].ID).Scan(&earned)
		out[i].EarnedUSD = usd(earned)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /api/market/my-datasets {"dataset_id","title","description","tags","license","price_usd"}
func (h *Handler) HandleCreateListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "sell_images") {
		return
	}
	var in listingInput
	if !decodeJSON(w, r, &in, 32<<10) {
		return
	}
	if in.DatasetID == nil || in.Title == nil || in.License == nil || in.PriceUSD == nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_listing", "Choose a dataset, a title, a license and a price")
		return
	}
	price, tags, msg := in.validate()
	if msg != "" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_listing", msg)
		return
	}
	if tags == nil {
		tags = []byte("[]")
	}
	var kind string
	var sourced *string
	if !validID(*in.DatasetID) || h.pool.QueryRow(r.Context(), `SELECT kind, source_listing_id::text FROM datasets WHERE id = $1 AND user_id = $2 AND purged_at IS NULL`,
		*in.DatasetID, uid).Scan(&kind, &sourced) != nil {
		notFound(w, r, "Dataset")
		return
	}
	if sourced != nil {
		httpx.WriteError(w, r, http.StatusForbidden, "not_yours", "You can't resell a dataset you bought")
		return
	}
	if kind != "bundle" {
		// keep training data and data for sale apart, so retention rules never delete what's on sale
		if _, err := h.pool.Exec(r.Context(), `UPDATE datasets SET kind = 'bundle', keep = true, delete_after = NULL, project_id = NULL WHERE id = $1`, *in.DatasetID); err != nil {
			internal(w, r, err)
			return
		}
	}
	var id string
	err := h.pool.QueryRow(r.Context(), `INSERT INTO dataset_listings (dataset_id, seller_id, title, description, tags, license, price)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id::text`, *in.DatasetID, uid, strings.TrimSpace(*in.Title), deref(in.Description), tags, *in.License, *price).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "23505") {
			httpx.WriteError(w, r, http.StatusConflict, "already_listed", "That dataset already has a listing")
			return
		}
		internal(w, r, err)
		return
	}
	l, _ := h.loadListing(r.Context(), uid, id)
	httpx.JSON(w, http.StatusCreated, l)
}

// PATCH /api/market/my-datasets/{id}  (a public listing whose terms change goes back to review)
func (h *Handler) HandleUpdateListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var in listingInput
	if !validID(id) || !decodeJSON(w, r, &in, 32<<10) {
		if !validID(id) {
			notFound(w, r, "Listing")
		}
		return
	}
	price, tags, msg := in.validate()
	if msg != "" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_listing", msg)
		return
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE dataset_listings SET title = COALESCE($3, title), description = COALESCE($4, description),
		tags = COALESCE($5, tags), license = COALESCE($6, license), price = COALESCE($7, price),
		status = CASE WHEN status = 'public' AND ($6::text IS NOT NULL AND $6 <> license OR $7::bigint IS NOT NULL AND $7 <> price) THEN 'pending' ELSE status END,
		updated_at = now() WHERE id = $1 AND seller_id = $2 AND status <> 'removed'`,
		id, uid, trimPtr(in.Title), trimPtr(in.Description), nullBytes(tags), in.License, price)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Listing")
		return
	}
	l, _ := h.loadListing(r.Context(), uid, id)
	httpx.JSON(w, http.StatusOK, l)
}

// POST /api/market/my-datasets/{id}/submit -> pending review
func (h *Handler) HandleSubmitListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "sell_images") {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Listing")
		return
	}
	l, err := h.loadListing(r.Context(), uid, id)
	if err != nil || !l.Mine {
		notFound(w, r, "Listing")
		return
	}
	if l.Images < 10 {
		httpx.WriteError(w, r, http.StatusBadRequest, "too_few_images", "Add at least 10 images before listing a dataset")
		return
	}
	if len([]rune(strings.TrimSpace(l.Description))) < 30 {
		httpx.WriteError(w, r, http.StatusBadRequest, "description_needed", "Describe the dataset (at least 30 characters): what's in it, where and how it was shot")
		return
	}
	if _, err := h.pool.Exec(r.Context(), `UPDATE dataset_listings SET status = 'pending', review_note = '', updated_at = now()
		WHERE id = $1 AND status IN ('draft','rejected')`, id); err != nil {
		internal(w, r, err)
		return
	}
	l, _ = h.loadListing(r.Context(), uid, id)
	httpx.JSON(w, http.StatusOK, l)
}

// POST /api/market/my-datasets/{id}/unlist -> removed from sale (buyers keep access)
func (h *Handler) HandleUnlistListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.pool.Exec(r.Context(), `UPDATE dataset_listings SET status = CASE WHEN sales > 0 THEN 'removed' ELSE 'draft' END, updated_at = now()
		WHERE id = $1 AND seller_id = $2`, id, uid)
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Listing")
		return
	}
	l, _ := h.loadListing(r.Context(), uid, id)
	httpx.JSON(w, http.StatusOK, l)
}

// ---- buying

// POST /api/market/datasets/{id}/buy {"accept_license": true}
func (h *Handler) HandleBuyListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "marketplace_buy") {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		AcceptLicense bool `json:"accept_license"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 256) {
		if !validID(id) {
			notFound(w, r, "Dataset")
		}
		return
	}
	if !in.AcceptLicense {
		httpx.WriteError(w, r, http.StatusBadRequest, "license_not_accepted", "Accept the dataset's license to buy it")
		return
	}
	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var seller, license, title string
	var price int64
	if err := tx.QueryRow(ctx, `SELECT seller_id::text, license, price, title FROM dataset_listings WHERE id = $1 AND status = 'public' FOR UPDATE`, id).
		Scan(&seller, &license, &price, &title); err != nil {
		notFound(w, r, "Dataset")
		return
	}
	if seller == uid {
		httpx.WriteError(w, r, http.StatusBadRequest, "own_listing", "That's your own dataset")
		return
	}
	var purchaseID string
	err = tx.QueryRow(ctx, `INSERT INTO dataset_purchases (listing_id, buyer_id, price, license) VALUES ($1,$2,$3,$4)
		ON CONFLICT (listing_id, buyer_id) DO NOTHING RETURNING id::text`, id, uid, price, license).Scan(&purchaseID)
	if isNoRows(err) {
		httpx.WriteError(w, r, http.StatusConflict, "already_bought", "You already own this dataset. Add it to a project from Purchases.")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	if price > 0 {
		// lock order: buyer first, then seller (each Adjust locks the balance row)
		if _, err := billing.AdjustTx(ctx, tx, uid, -price, "dataset.purchased", map[string]any{"listing_id": id, "purchase_id": purchaseID}); err != nil {
			if errors.Is(err, billing.ErrInsufficientBalance) {
				httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Your balance is too low for this dataset. Add credit first.")
				return
			}
			internal(w, r, err)
			return
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE dataset_listings SET sales = sales + 1 WHERE id = $1`, id); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}
	// the seller's share is credited in its own transaction (one balance lock per transaction)
	if price > 0 {
		share := price * catalog.IntSetting(ctx, h.pool, "bundle_seller_share_bps", 8000) / 10000
		if share > 0 {
			if _, err := billing.Adjust(context.WithoutCancel(ctx), h.pool, seller, share, "dataset.sale",
				map[string]any{"listing_id": id, "purchase_id": purchaseID, "amount": share}); err != nil {
				logf("seller credit for purchase %s failed: %v", purchaseID, err)
			}
		}
	}
	l, _ := h.loadListing(ctx, uid, id)
	l.DatasetID = ""
	httpx.JSON(w, http.StatusOK, map[string]any{"purchase_id": purchaseID, "listing": l})
}

// GET /api/market/purchases
func (h *Handler) HandlePurchases(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	rows, err := h.pool.Query(r.Context(), `SELECT p.id::text, p.listing_id::text, l.title, COALESCE(up.username, ''), p.license, p.price, p.created_at,
		(SELECT count(*) FROM dataset_images i WHERE i.dataset_id = l.dataset_id),
		ARRAY(SELECT d.id::text FROM datasets d WHERE d.source_listing_id = l.id AND d.user_id = $1 AND d.purged_at IS NULL)
		FROM dataset_purchases p JOIN dataset_listings l ON l.id = p.listing_id LEFT JOIN user_profiles up ON up.user_id = l.seller_id
		WHERE p.buyer_id = $1 ORDER BY p.created_at DESC`, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, lid, title, seller, lic string
		var price int64
		var c time.Time
		var n int
		var copies []string
		if rows.Scan(&id, &lid, &title, &seller, &lic, &price, &c, &n, &copies) == nil {
			if copies == nil {
				copies = []string{}
			}
			out = append(out, map[string]any{"id": id, "listing_id": lid, "title": title, "seller": seller, "license": lic,
				"license_text": licenseInfo[lic], "price_usd": usd(price), "created_at": ts(c), "images": n, "dataset_ids": copies})
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /api/market/purchases/{id}/import {"project_id","name"} -> a new dataset in the buyer's project
func (h *Handler) HandleImportPurchase(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "train") {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		ProjectID string `json:"project_id"`
		Name      string `json:"name"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 1<<10) {
		if !validID(id) {
			notFound(w, r, "Purchase")
		}
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 20*time.Minute)
	defer cancel()
	var listingID, srcDataset, title, license string
	var classes []byte
	var srcBytes int64
	if err := h.pool.QueryRow(ctx, `SELECT l.id::text, l.dataset_id::text, l.title, p.license, d.classes, d.bytes
		FROM dataset_purchases p JOIN dataset_listings l ON l.id = p.listing_id JOIN datasets d ON d.id = l.dataset_id
		WHERE p.id = $1 AND p.buyer_id = $2 AND d.purged_at IS NULL`, id, uid).Scan(&listingID, &srcDataset, &title, &license, &classes, &srcBytes); err != nil {
		notFound(w, r, "Purchase")
		return
	}
	var pid *string
	if in.ProjectID != "" {
		pid = &in.ProjectID
	}
	if !h.ownsProject(ctx, uid, pid) {
		notFound(w, r, "Project")
		return
	}
	if !h.checkStorage(ctx, uid, srcBytes) {
		storageFull(w, r)
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = title
	}
	name = truncate(name, 80)
	plan, _ := h.userPlan(ctx, uid)
	keep := plan.Plan.KeepDatasets
	var del any
	if !keep {
		del = time.Now().Add(idleDays * 24 * time.Hour)
	}
	var dsID string
	if err := h.pool.QueryRow(ctx, `INSERT INTO datasets (user_id, project_id, name, classes, keep, delete_after, kind, description, license, source_listing_id)
		VALUES ($1, $2::uuid, $3, $4, $5, $6, 'training', $7, $8, $9) RETURNING id::text`,
		uid, pid, name, classes, keep, del, "Bought on the Layerto marketplace: "+title, license, listingID).Scan(&dsID); err != nil {
		internal(w, r, err)
		return
	}
	rows, err := h.pool.Query(ctx, `SELECT id::text, file_name, storage_key, mime, width, height, bytes, boxes, labeled FROM dataset_images WHERE dataset_id = $1`, srcDataset)
	if err != nil {
		internal(w, r, err)
		return
	}
	type img struct {
		id, name, key, mime string
		w, h                int
		n                   int64
		boxes               []byte
		labeled             bool
	}
	var imgs []img
	for rows.Next() {
		var im img
		if rows.Scan(&im.id, &im.name, &im.key, &im.mime, &im.w, &im.h, &im.n, &im.boxes, &im.labeled) == nil {
			imgs = append(imgs, im)
		}
	}
	rows.Close()
	var total int64
	copied := 0
	for _, im := range imgs {
		data, err := h.store.Get(im.key)
		if err != nil {
			continue
		}
		var newID string
		if err := h.pool.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&newID); err != nil {
			continue
		}
		key := "datasets/" + dsID + "/" + newID
		if err := h.store.Put(key, data); err != nil {
			continue
		}
		if _, err := h.pool.Exec(ctx, `INSERT INTO dataset_images (id, dataset_id, file_name, storage_key, mime, width, height, bytes, boxes, labeled)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, newID, dsID, im.name, key, im.mime, im.w, im.h, im.n, im.boxes, im.labeled); err != nil {
			_ = h.store.Delete(key)
			continue
		}
		total += im.n
		copied++
	}
	_, _ = h.pool.Exec(ctx, `UPDATE datasets SET bytes = $2 WHERE id = $1`, dsID, total)
	d, err := h.loadDataset(ctx, uid, dsID)
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"dataset": d, "copied": copied, "message": fmt.Sprintf("Copied %d images", copied)})
}

// ---- admin review

// GET /admin/market/datasets?status=pending
func (h *Handler) HandleAdminListings(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	rows, err := h.pool.Query(r.Context(), `SELECT `+listingCols+` WHERE ($2 = '' OR $2 = 'all' OR l.status = $2)
		ORDER BY (l.status = 'pending') DESC, l.updated_at DESC LIMIT 500`, "00000000-0000-0000-0000-000000000000", status)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []listing{}
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, l)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /admin/market/datasets/{id}/review {"decision": "approve|reject|remove", "note"}
func (h *Handler) HandleAdminReviewListing(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 4<<10) {
		if !validID(id) {
			notFound(w, r, "Listing")
		}
		return
	}
	var status string
	switch in.Decision {
	case "approve":
		status = "public"
	case "reject":
		status = "rejected"
	case "remove":
		status = "removed"
	default:
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_decision", "Decision must be approve, reject or remove")
		return
	}
	if status != "public" && strings.TrimSpace(in.Note) == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, "note_required", "Tell the seller why (it is shown to them)")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE dataset_listings SET status = $2, review_note = $3,
		published_at = CASE WHEN $2 = 'public' THEN COALESCE(published_at, now()) ELSE published_at END, updated_at = now() WHERE id = $1`,
		id, status, strings.TrimSpace(in.Note))
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Listing")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "status": status})
}

// GET /admin/market/datasets/{id}/preview/{imageId}  (admins review the actual images of listings)
func (h *Handler) HandleAdminListingPreview(w http.ResponseWriter, r *http.Request) {
	id, imgID := chi.URLParam(r, "id"), chi.URLParam(r, "imageId")
	var key string
	if !validID(id) || !validID(imgID) || h.pool.QueryRow(r.Context(), `SELECT i.storage_key FROM dataset_images i JOIN dataset_listings l ON l.dataset_id = i.dataset_id
		WHERE l.id = $1 AND i.id = $2`, id, imgID).Scan(&key) != nil {
		notFound(w, r, "Image")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "Image")
		return
	}
	small, err := thumbnail(data, 480)
	if err != nil {
		notFound(w, r, "Image")
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	_, _ = w.Write(small)
}
