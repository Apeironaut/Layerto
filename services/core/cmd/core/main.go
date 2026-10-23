package main

import (
	"bufio"
	"context"
	"crypto/subtle"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/term"

	"layerto/services/core/internal/admin"
	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/balance"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/mail"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/router"
	"layerto/services/core/internal/storage"
	"layerto/services/core/internal/studio"
	"layerto/services/core/internal/usage"
	"layerto/services/core/internal/workflows"
)

type server struct {
	db              *pgxpool.Pool
	adminToken      string
	gwHandler       *gateway.Handler
	modelClient     models.Client
	authHandler     *auth.Handler
	adminHandler    *admin.Handler
	keysHandler     *keys.Handler
	balanceHandler  *balance.Handler
	usageHandler    *usage.Handler
	wfHandler       *workflows.Handler
	studio          *studio.Handler
	router          router.Router
	reconciler      *billing.Reconciler
	userRateLimiter *auth.UserRateLimiter
}

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "create-admin":
			runCreateAdmin(os.Args[2:])
			return
		case "create-key":
			runCreateKey(os.Args[2:])
			return
		}
	}

	runServer()
}

func getDBPool(ctx context.Context) (*pgxpool.Pool, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://layerto_app:layerto_app_pass@localhost:5434/layerto?sslmode=disable"
	}

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("invalid DATABASE_URL: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create db pool: %w", err)
	}

	return pool, nil
}

// Requirement 1: Only --password-stdin or interactive prompt (no echo). No --password.
func runCreateAdmin(args []string) {
	fs := flag.NewFlagSet("create-admin", flag.ExitOnError)
	email := fs.String("email", "", "Admin email address")
	passwordStdin := fs.Bool("password-stdin", false, "Read password from stdin")
	resetPassword := fs.Bool("reset-password", false, "Reset password for an existing admin user")
	username := fs.String("username", "", "Optional admin username (3-30 lowercase letters, numbers, . or _)")
	firstName := fs.String("first-name", "Admin", "Admin first name")
	lastName := fs.String("last-name", "User", "Admin last name")
	_ = fs.Parse(args)

	if *email == "" {
		log.Fatal("error: --email is required")
	}

	var password string
	if *passwordStdin {
		scanner := bufio.NewScanner(os.Stdin)
		if scanner.Scan() {
			password = strings.TrimSpace(scanner.Text())
		}
	} else {
		fmt.Fprint(os.Stderr, "Enter admin password (8+ characters with a letter, a number and a symbol): ")
		passBytes, err := term.ReadPassword(int(syscall.Stdin))
		fmt.Fprintln(os.Stderr)
		if err != nil {
			log.Fatalf("failed to read password: %v", err)
		}
		password = strings.TrimSpace(string(passBytes))
	}

	cleanUsername := auth.NormalizeUsername(*username)
	if cleanUsername != "" {
		if err := auth.ValidateUsername(cleanUsername); err != nil && !errors.Is(err, auth.ErrUsernameReserved) {
			log.Fatalf("error: %v", err)
		}
	}
	if err := auth.ValidatePasswordPolicy(password, cleanUsername, *email); err != nil {
		log.Fatalf("error: %s", auth.PasswordPolicyMessage(err))
	}

	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := getDBPool(ctx)
	if err != nil {
		log.Fatalf("database error: %v", err)
	}
	defer pool.Close()

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("begin transaction error: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanEmail := strings.ToLower(strings.TrimSpace(*email))
	queries := db.New(tx)

	existingUser, err := queries.GetUserByEmail(ctx, cleanEmail)
	if err == nil {
		if !*resetPassword {
			log.Fatalf("error: user %s already exists; use --reset-password to update password", cleanEmail)
		}
		if existingUser.Role != "admin" {
			log.Fatalf("error: user %s is not an admin; cannot reset password or promote user via create-admin", cleanEmail)
		}
		_, err = tx.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE id = $2", passwordHash, existingUser.ID)
		if err != nil {
			log.Fatalf("update admin user error: %v", err)
		}
		if err := tx.Commit(ctx); err != nil {
			log.Fatalf("commit transaction error: %v", err)
		}
		fmt.Printf("Admin user password reset successfully:\nID:    %s\nEmail: %s\nRole:  admin\n", fmtUUID(existingUser.ID), cleanEmail)
		return
	}

	if *resetPassword {
		log.Fatalf("error: cannot reset password because admin user %s does not exist", cleanEmail)
	}

	first, last := auth.NormalizeName(*firstName), auth.NormalizeName(*lastName)
	if auth.ValidateName(first) != nil || auth.ValidateName(last) != nil {
		log.Fatal("error: first and last name must be 1-50 letters")
	}
	user, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        cleanEmail,
		PasswordHash: passwordHash,
		Name:         pgtype.Text{String: first + " " + last, Valid: true},
		Role:         "admin",
		Status:       "active",
	})
	if err != nil {
		log.Fatalf("create admin user error: %v", err)
	}
	if cleanUsername != "" {
		if _, err := queries.CreateUserProfile(ctx, db.CreateUserProfileParams{UserID: userUUID, FirstName: first, LastName: last, Username: cleanUsername}); err != nil {
			log.Fatalf("create admin profile error (username taken?): %v", err)
		}
	}

	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  0,
		FreeUsed: 0,
	})

	// Record ledger events for user creation & approval in single tx
	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		UserID: &userID,
		Type:   "user.signed_up",
		Payload: map[string]any{
			"email": user.Email,
			"role":  "admin",
		},
	})
	if err != nil {
		log.Fatalf("append user.signed_up error: %v", err)
	}

	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		UserID: &userID,
		Type:   "user.approved",
		Payload: map[string]any{
			"by_admin_id": "cli",
		},
	})
	if err != nil {
		log.Fatalf("append user.approved error: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("commit transaction error: %v", err)
	}

	fmt.Printf("Admin user created successfully:\nID:    %s\nEmail: %s\nRole:  %s\n", userID, user.Email, user.Role)
}

func runCreateKey(args []string) {
	fs := flag.NewFlagSet("create-key", flag.ExitOnError)
	userID := fs.String("user", "", "User UUID")
	name := fs.String("name", "default", "Key name")
	_ = fs.Parse(args)

	if *userID == "" {
		log.Fatal("error: --user is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := getDBPool(ctx)
	if err != nil {
		log.Fatalf("database error: %v", err)
	}
	defer pool.Close()

	fullKey, keyRow, err := keys.Create(ctx, pool, *userID, *name, nil)
	if err != nil {
		log.Fatalf("create key error: %v", err)
	}

	fmt.Printf("API key created successfully (save this key, it is shown only once):\nKey:    %s\nPrefix: %s\nID:     %x-%x-%x-%x-%x\n",
		fullKey, keyRow.Prefix,
		keyRow.ID.Bytes[0:4], keyRow.ID.Bytes[4:6], keyRow.ID.Bytes[6:8], keyRow.ID.Bytes[8:10], keyRow.ID.Bytes[10:16])
}

func runServer() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	corsOriginsStr := os.Getenv("CORS_ORIGINS")
	if corsOriginsStr == "" {
		corsOriginsStr = "http://localhost:5173,http://localhost:5174,http://localhost:5175"
	}
	corsOrigins := strings.Split(corsOriginsStr, ",")

	adminToken := os.Getenv("ADMIN_TOKEN")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := getDBPool(ctx)
	if err != nil {
		log.Printf("warning: failed to initialize database pool: %v", err)
	}

	if pool != nil {
		var currentRole string
		if err := pool.QueryRow(ctx, "SELECT current_user;").Scan(&currentRole); err == nil {
			log.Printf("connected to database as role: %s", currentRole)
		} else {
			log.Printf("warning: database ping failed on startup: %v", err)
		}
	}

	loginLimiter := auth.NewLoginRateLimiter()
	userLimiter := auth.NewUserRateLimiter(60, time.Minute)

	memRouter := router.NewMemoryRouter(pool)
	if pool != nil {
		reloadCtx, reloadCancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := memRouter.Reload(reloadCtx); err != nil {
			log.Printf("warning: initial router reload failed: %v", err)
		}
		reloadCancel()
	}

	modelClient := models.NewClient(os.Getenv("RUNPOD_API_KEY"))
	gwHandler := gateway.NewHandler(pool, modelClient, memRouter)
	authHandler := auth.NewHandler(pool, loginLimiter)
	authHandler.ConfigureAccount(auth.AccountOptions{
		Mailer:       mail.FromEnv(),
		DashboardURL: os.Getenv("DASHBOARD_URL"),
	})
	adminHandler := admin.NewHandler(pool, memRouter)
	keysHandler := keys.NewHandler(pool)
	balanceHandler := balance.NewHandler(pool)
	usageHandler := usage.NewHandler(pool)
	wfHandler := workflows.NewHandler(pool, gwHandler, userLimiter)

	store, err := storage.FromEnv()
	if err != nil {
		log.Fatalf("storage: %v", err)
	}
	studioHandler := studio.NewHandler(pool, store, gwHandler, studio.Options{
		PublicAPIURL: os.Getenv("PUBLIC_API_URL"),
		WorkerToken:  os.Getenv("WORKER_TOKEN"),
	})
	janitorCtx, stopJanitor := context.WithCancel(context.Background())
	defer stopJanitor()
	if pool != nil {
		studioHandler.StartJanitor(janitorCtx)
	}

	var reconciler *billing.Reconciler
	if pool != nil {
		reconciler = billing.NewReconciler(pool)
		reconciler.Start(context.Background())
	}

	s := &server{
		db:              pool,
		adminToken:      adminToken,
		gwHandler:       gwHandler,
		modelClient:     modelClient,
		authHandler:     authHandler,
		adminHandler:    adminHandler,
		keysHandler:     keysHandler,
		balanceHandler:  balanceHandler,
		usageHandler:    usageHandler,
		wfHandler:       wfHandler,
		studio:          studioHandler,
		router:          memRouter,
		reconciler:      reconciler,
		userRateLimiter: userLimiter,
	}

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Use(middleware.RealIP)
	r.Use(httpx.SanitizedLogger)
	r.Use(middleware.Recoverer)
	r.Use(auth.PublicSubdomainCORS(os.Getenv("ROOT_DOMAIN")))
	r.Use(auth.CORS(corsOrigins))

	// Liveness & readiness
	r.Get("/healthz", s.handleHealthz)
	r.Get("/readyz", s.handleReadyz)

	// Public models catalog (unauthenticated, SPEC §8)
	r.Get("/v1/models", s.gwHandler.HandleListPublicModels)

	// Public vision API (API key authenticated)
	r.Post("/v1/vision/auto", s.gwHandler.HandleVisionAuto)
	r.Post("/v1/vision/{model_slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "model_slug")
		s.gwHandler.HandleVisionDirect(w, r, slug)
	})

	// Public workflows API (API key authenticated)
	r.Post("/v1/workflows/{id}/run", s.wfHandler.HandleRunAPI)

	// Studio: trainer protocol (job token / worker token), public profiles and model sites
	st := s.studio
	r.Get("/v1/train/trainer.py", st.HandleTrainerScript)
	r.With(longRequest(30*time.Minute)).Get("/v1/train/code", st.HandleTrainCode)
	r.Get("/v1/train/jobs/{id}/spec", st.HandleJobSpec)
	r.With(longRequest(2*time.Hour)).Get("/v1/train/jobs/{id}/dataset.zip", st.HandleJobDataset)
	r.Post("/v1/train/jobs/{id}/progress", st.HandleJobProgress)
	r.Post("/v1/train/jobs/{id}/fail", st.HandleJobFail)
	r.With(longRequest(30*time.Minute)).Post("/v1/train/jobs/{id}/weights", st.HandleJobWeights)
	r.Post("/v1/train/next", st.HandleClaimJob)
	r.With(longRequest(10*time.Minute)).Get("/v1/internal/weights/{key}", st.HandleWorkerWeights)
	r.Get("/v1/public/profiles/{username}", st.HandlePublicProfile)
	r.Get("/v1/public/profiles/{username}/projects/{slug}", st.HandlePublicProject)
	r.Get("/v1/studio/info", st.HandlePublicInfo)
	r.With(longRequest(10*time.Minute)).Get("/v1/train/jobs/{id}/init.pt", st.HandleJobInitWeights)
	r.Get("/v1/public/papers", st.HandlePublicPapers)
	r.Get("/v1/public/papers/{id}", st.HandlePublicPaper)
	r.Get("/v1/public/papers/{id}/pdf", st.HandlePublicPaperPDF)
	r.Get("/v1/public/portfolio/{subdomain}", st.HandlePublicPortfolio)
	r.Get("/v1/sites/{slug}", st.HandlePublicSite)
	r.Post("/v1/sites/{slug}/run", st.HandleSiteRun)

	// /api namespace
	r.Route("/api", func(api chi.Router) {
		api.Use(auth.CSRF(corsOrigins))

		// Auth endpoints (public)
		api.Post("/auth/signup", s.authHandler.HandleSignup)
		api.Post("/auth/login", s.authHandler.HandleLogin)
		api.Get("/auth/username-available", s.authHandler.HandleUsernameAvailable)
		api.Post("/auth/forgot-password", s.authHandler.HandleForgotPassword)
		api.Post("/auth/reset-password", s.authHandler.HandleResetPassword)

		// Session-authenticated endpoints
		api.Group(func(authed chi.Router) {
			authed.Use(auth.AuthenticateSession(s.db))

			authed.Post("/auth/logout", s.authHandler.HandleLogout)
			authed.Get("/me", s.authHandler.HandleMe)
			authed.Patch("/me", s.authHandler.HandleUpdateProfile)
			authed.Post("/me/password", s.authHandler.HandleChangePassword)

			// Active users only (pending users can only hit /api/me to see their pending status)
			activeGroup := func(active chi.Router) {
				active.Use(auth.RequireActive)
				active.Use(auth.RequireRole("user"))

				// Keys API
				active.Get("/keys", s.keysHandler.HandleListKeys)
				active.Post("/keys", s.keysHandler.HandleCreateKey)
				active.Delete("/keys/{id}", s.keysHandler.HandleRevokeKey)

				// Balance API
				active.Get("/balance", s.balanceHandler.HandleGetBalance)

				// Usage & Requests API (Requirement 7)
				active.Get("/usage", s.usageHandler.HandleGetUsage)
				active.Get("/requests", s.usageHandler.HandleGetRequests)
				active.Get("/usage/endpoints", s.usageHandler.HandleGetEndpointUsage)

				// Workflows API
				active.Get("/workflows", s.wfHandler.HandleList)
				active.Post("/workflows", s.wfHandler.HandleCreate)
				active.Get("/workflows/{id}", s.wfHandler.HandleGet)
				active.Put("/workflows/{id}", s.wfHandler.HandleUpdate)
				active.Delete("/workflows/{id}", s.wfHandler.HandleDelete)
				active.Post("/workflows/validate", s.wfHandler.HandleValidate)
				active.Post("/workflows/{id}/run", s.wfHandler.HandleRunDashboard)

				// Studio
				active.Get("/studio/plan", st.HandleGetPlan)
				active.Post("/studio/plan", st.HandleBuyPlan)
				active.Patch("/studio/plan", st.HandleSetAutoRenew)
				active.Get("/studio/profile", st.HandleGetProfile)
				active.Put("/studio/profile", st.HandlePutProfile)
				active.Get("/studio/projects", st.HandleListProjects)
				active.Post("/studio/projects", st.HandleCreateProject)
				active.Get("/studio/projects/{id}", st.HandleGetProject)
				active.Patch("/studio/projects/{id}", st.HandleUpdateProject)
				active.Delete("/studio/projects/{id}", st.HandleDeleteProject)
				active.Get("/studio/datasets", st.HandleListDatasets)
				active.Post("/studio/datasets", st.HandleCreateDataset)
				active.Get("/studio/datasets/{id}", st.HandleGetDataset)
				active.Patch("/studio/datasets/{id}", st.HandleUpdateDataset)
				active.Delete("/studio/datasets/{id}", st.HandleDeleteDataset)
				active.With(longRequest(30*time.Minute)).Post("/studio/datasets/{id}/images", st.HandleUploadImages)
				active.Get("/studio/datasets/{id}/images", st.HandleListImages)
				active.Get("/studio/datasets/{id}/images/{imageId}/file", st.HandleImageFile)
				active.Put("/studio/datasets/{id}/images/{imageId}/boxes", st.HandleSaveBoxes)
				active.Delete("/studio/datasets/{id}/images/{imageId}", st.HandleDeleteImage)
				active.Get("/studio/training", st.HandleListJobs)
				active.Post("/studio/training", st.HandleCreateJob)
				active.Post("/studio/training/estimate", st.HandleEstimate)
				active.Get("/studio/training/{id}", st.HandleGetJob)
				active.Post("/studio/training/{id}/cancel", st.HandleCancelJob)
				active.Get("/studio/training/{id}/notebook", st.HandleNotebook)
				active.Get("/studio/models", st.HandleListMyModels)
				active.Get("/studio/models/{slug}", st.HandleGetMyModel)
				active.Patch("/studio/models/{slug}", st.HandleUpdateMyModel)
				active.Delete("/studio/models/{slug}", st.HandleDeleteMyModel)
				active.Post("/studio/models/{slug}/publish", st.HandlePublish)
				active.Post("/studio/models/{slug}/unpublish", st.HandleUnpublish)
				active.Get("/studio/marketplace", st.HandleMarketplace)
				active.Get("/studio/earnings", st.HandleEarnings)
				active.Get("/studio/sites", st.HandleListSites)
				active.Post("/studio/sites", st.HandleCreateSite)
				active.Patch("/studio/sites/{id}", st.HandleUpdateSite)
				active.Delete("/studio/sites/{id}", st.HandleDeleteSite)
				active.With(longRequest(30*time.Minute)).Post("/studio/models/import", st.HandleImportModel)
				active.Post("/studio/addons", st.HandleBuyAddon)
				active.Patch("/studio/addons/{addon}", st.HandleAddonRenew)
				active.Post("/studio/gpu-bundles", st.HandleBuyGPUBundle)
				active.Get("/me/settings", st.HandleGetSettings)
				active.Put("/me/settings", st.HandlePutSettings)
				active.Get("/activity", st.HandleActivity)

				// Teams
				active.Get("/teams", st.HandleListTeams)
				active.Post("/teams", st.HandleCreateTeam)
				active.Get("/teams/{id}", st.HandleGetTeam)
				active.Patch("/teams/{id}", st.HandleUpdateTeam)
				active.Delete("/teams/{id}", st.HandleDeleteTeam)
				active.Post("/teams/{id}/members", st.HandleInviteMember)
				active.Patch("/teams/{id}/members/{userId}", st.HandleSetMemberRole)
				active.Delete("/teams/{id}/members/{userId}", st.HandleRemoveMember)
				active.Post("/teams/{id}/accept", st.HandleAcceptInvite)

				// Community
				active.Get("/community/meta", st.HandleCommunityMeta)
				active.Get("/community/posts", st.HandleListPosts)
				active.Post("/community/posts", st.HandleCreatePost)
				active.Get("/community/posts/{id}", st.HandleGetPost)
				active.Patch("/community/posts/{id}", st.HandleUpdatePost)
				active.Delete("/community/posts/{id}", st.HandleDeletePost)
				active.Get("/community/posts/{id}/image", st.HandlePostImage)
				active.Post("/community/posts/{id}/vote", st.HandleVotePost)
				active.Post("/community/posts/{id}/save", st.HandleSavePost)
				active.Post("/community/posts/{id}/comments", st.HandleCreateComment)
				active.Delete("/community/comments/{id}", st.HandleDeleteComment)
				active.Post("/community/report", st.HandleReport)

				// Dataset marketplace
				active.Get("/market/datasets", st.HandleListListings)
				active.Get("/market/datasets/{id}", st.HandleGetListing)
				active.Get("/market/datasets/{id}/preview/{imageId}", st.HandleListingPreview)
				active.Post("/market/datasets/{id}/buy", st.HandleBuyListing)
				active.Get("/market/purchases", st.HandlePurchases)
				active.With(longRequest(30*time.Minute)).Post("/market/purchases/{id}/import", st.HandleImportPurchase)
				active.Get("/market/my-datasets", st.HandleMyListings)
				active.Post("/market/my-datasets", st.HandleCreateListing)
				active.Patch("/market/my-datasets/{id}", st.HandleUpdateListing)
				active.Post("/market/my-datasets/{id}/submit", st.HandleSubmitListing)
				active.Post("/market/my-datasets/{id}/unlist", st.HandleUnlistListing)

				// Research workspace
				active.Get("/research/overview", st.HandleResearchOverview)
				active.Get("/research/areas", st.HandleListAreas)
				active.Post("/research/areas", st.HandleCreateArea)
				active.Get("/research/areas/{id}", st.HandleGetArea)
				active.Patch("/research/areas/{id}", st.HandleUpdateArea)
				active.Delete("/research/areas/{id}", st.HandleDeleteArea)
				for path, e := range st.ResearchEntities() {
					active.Get("/research/"+path, st.ResearchList(e))
					active.Post("/research/"+path, st.ResearchCreate(e))
					active.Get("/research/"+path+"/{id}", st.ResearchGet(e))
					active.Patch("/research/"+path+"/{id}", st.ResearchUpdate(e))
					active.Delete("/research/"+path+"/{id}", st.ResearchDelete(e))
				}
				active.With(longRequest(10*time.Minute)).Post("/research/papers/{id}/pdf", st.HandleUploadPaperPDF)
				active.Get("/research/papers/{id}/pdf", st.HandlePaperPDF)
				active.Get("/research/papers/{id}/bibtex", st.HandlePaperBibtex)
				active.Post("/research/papers/{id}/publish", st.HandlePublishPaper)
				active.Post("/research/literature/import", st.HandleImportBibtex)
				active.Get("/research/files", st.HandleListFiles)
				active.With(longRequest(10*time.Minute)).Post("/research/files", st.HandleUploadFile)
				active.Get("/research/files/{id}", st.HandleDownloadFile)
				active.Delete("/research/files/{id}", st.ResearchDelete(st.FilesEntity()))
				active.Get("/research/portfolio", st.HandleGetPortfolio)
				active.Put("/research/portfolio", st.HandlePutPortfolio)
				active.Get("/research/assistant", st.HandleAssistantStatus)
				active.Post("/research/assistant/waitlist", st.HandleAssistantWaitlist)

				// Playground API (supports direct model slug or "auto")
				active.Post("/playground/{model_slug}", func(w http.ResponseWriter, r *http.Request) {
					slug := chi.URLParam(r, "model_slug")
					s.gwHandler.HandlePlayground(w, r, slug, s.userRateLimiter)
				})
			}
			authed.Group(activeGroup)
		})
	})

	// /admin namespace (session + role=admin guarded, with optional ADMIN_TOKEN override for dev)
	r.Route("/admin", func(adm chi.Router) {
		adm.Use(auth.CSRF(corsOrigins))

		adm.Group(func(adminAuthed chi.Router) {
			adminAuthed.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Check optional ADMIN_TOKEN header first
					if s.adminToken != "" && s.adminToken != "change-me" {
						authHeader := r.Header.Get("Authorization")
						adminHeader := r.Header.Get("X-Admin-Token")
						token := strings.TrimPrefix(authHeader, "Bearer ")
						if token == "" {
							token = adminHeader
						}
						if token != "" && subtle.ConstantTimeCompare([]byte(token), []byte(s.adminToken)) == 1 {
							next.ServeHTTP(w, r)
							return
						}
					}

					// Otherwise authenticate via session + role=admin
					auth.AuthenticateSession(s.db)(auth.RequireRole("admin")(next)).ServeHTTP(w, r)
				})
			})

			adminAuthed.Get("/stats", s.adminHandler.HandleGetStats)
			adminAuthed.Get("/users", s.adminHandler.HandleListUsers)
			adminAuthed.Get("/users/{id}", s.adminHandler.HandleGetUser)
			adminAuthed.Post("/users/{id}/approve", s.adminHandler.HandleApproveUser)
			adminAuthed.Post("/users/{id}/suspend", s.adminHandler.HandleSuspendUser)
			adminAuthed.Post("/users/{id}/credit", s.adminHandler.HandleCreditUser)
			adminAuthed.Get("/events", s.adminHandler.HandleListEvents)
			adminAuthed.Get("/models", s.adminHandler.HandleListModels)
			adminAuthed.Patch("/models/{slug}", s.adminHandler.HandleUpdateModelPrice)
			adminAuthed.Get("/routes", s.adminHandler.HandleListRoutes)
			adminAuthed.Post("/routes", s.adminHandler.HandleCreateRoute)
			adminAuthed.Delete("/routes/{id}", s.adminHandler.HandleDeleteRoute)
			adminAuthed.Get("/ledger/verify", s.adminHandler.HandleLedgerVerify)

			// Studio administration
			adminAuthed.Get("/studio/overview", st.HandleAdminOverview)
			adminAuthed.Get("/studio/models", st.HandleAdminModels)
			adminAuthed.Post("/studio/models/{slug}/review", st.HandleAdminReview)
			adminAuthed.Get("/studio/jobs", st.HandleAdminJobs)
			adminAuthed.Post("/studio/jobs/{id}/cancel", st.HandleAdminCancelJob)
			adminAuthed.With(longRequest(10*time.Minute)).Post("/studio/ltvision-package", st.HandleAdminUploadPackage)
			adminAuthed.Get("/studio/datasets", st.HandleAdminDatasets)
			adminAuthed.Post("/studio/datasets/{id}/purge", st.HandleAdminPurgeDataset)
			adminAuthed.Get("/studio/sites", st.HandleAdminSites)
			adminAuthed.Post("/studio/sites/{id}/disable", st.HandleAdminDisableSite)
			adminAuthed.Get("/studio/settings", st.HandleAdminGetSettings)
			adminAuthed.Put("/studio/settings", st.HandleAdminPutSettings)
			adminAuthed.Get("/studio/users/{id}", st.HandleAdminUserStudio)
			adminAuthed.Post("/studio/users/{id}/plan", st.HandleAdminSetPlan)
			adminAuthed.Get("/market/datasets", st.HandleAdminListings)
			adminAuthed.Post("/market/datasets/{id}/review", st.HandleAdminReviewListing)
			adminAuthed.Get("/market/datasets/{id}/preview/{imageId}", st.HandleAdminListingPreview)
			adminAuthed.Get("/community/reports", st.HandleAdminReports)
			adminAuthed.Get("/community/posts", st.HandleAdminPosts)
			adminAuthed.Post("/community/posts/{id}/remove", st.HandleAdminRemovePost)
			adminAuthed.Post("/community/comments/{id}/remove", st.HandleAdminRemoveComment)
			adminAuthed.Post("/community/reports/{id}/resolve", st.HandleAdminResolveReport)
			adminAuthed.Get("/hub/overview", st.HandleAdminHubOverview)
		})
	})

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  65 * time.Second,
		WriteTimeout: 65 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Layerto core service listening on :%s", port)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-stop
	log.Println("shutting down Layerto core service...")

	if reconciler != nil {
		reconciler.Stop()
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("error during server shutdown: %v", err)
	}

	if pool != nil {
		pool.Close()
	}

	log.Println("Layerto core service stopped")
}

func (s *server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func (s *server) handleReadyz(w http.ResponseWriter, r *http.Request) {
	reqID := httpx.GetRequestID(r.Context())

	if s.db == nil {
		log.Printf("[readyz] [request_id=%s] database pool is nil", reqID)
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{
			"status": "unavailable",
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := s.db.Ping(ctx); err != nil {
		log.Printf("[readyz] [request_id=%s] database ping error: %v", reqID, err)
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{
			"status": "unavailable",
		})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"status": "ready",
	})
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

// longRequest extends the read/write deadlines for big uploads and downloads (datasets,
// weights); the server-wide timeouts stay short for everything else.
func longRequest(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rc := http.NewResponseController(w)
			_ = rc.SetReadDeadline(time.Now().Add(d))
			_ = rc.SetWriteDeadline(time.Now().Add(d))
			next.ServeHTTP(w, r)
		})
	}
}
