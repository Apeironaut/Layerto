# Layerto UI & Design System Checklist (Milestone M6)

This document verifies the implementation of the "Layers" design system and UI polish across `packages/ui`, `apps/web`, `apps/dashboard`, and `apps/admin`.

---

## 1. Design Concept & Layer Elevation

The visual language reflects the Layerto logo (physical stacked layers). Elevation carries semantic meaning throughout the interface:

- [x] **L0 (Page Background)**: Canvas ground level (`#F2F3F5` light / `#0F1013` dark).
- [x] **L1 (Content Cards)**: Primary content surfaces (`#FFFFFF` light / `#18191E` dark) with `shadow-l1`, `border-line`, and `rounded-l1` (20px).
- [x] **L2 (Active / Focused Cards)**: Raised level for selected items and active states (`#FFFFFF` light / `#21222A` dark) with `shadow-l2`, `border-line-strong`, and `rounded-l2` (16px).
- [x] **L3 (Overlays & Modals)**: Highest elevation for dialogs, modals, and toasts with `shadow-l3`, backdrop blur, and `rounded-l3` (24px).
- [x] **Controls & Radii Hierarchy**:
  - Cards L1: 20px (`rounded-l1`)
  - Cards L2: 16px (`rounded-l2`)
  - Overlays L3: 24px (`rounded-l3`)
  - Controls (Inputs & Buttons): 12px (`rounded-control`)
  - Chips / Badges: Pill (`rounded-pill`, 999px)

---

## 2. Tokens & Tailwind CSS Architecture

- [x] **Tailwind CSS Version**: Tailwind CSS v4 via `@tailwindcss/vite` across all applications.
- [x] **Token Mapping**: All tokens declared as CSS variables in `packages/ui/src/theme.css` and mapped via `@theme`:
  - Colors: `page`, `card`, `raised`, `ink`, `ink-secondary`, `muted`, `line`, `line-strong`, `crimson`, `crimson-hover`, `crimson-fill`, `crimson-tint`, `crimson-border`, `focus`.
  - Shadows: `l1`, `l2`, `l3`.
  - Radii: `l1`, `l2`, `l3`, `control`, `pill`.
- [x] **Dark Mode Variant**: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`
- [x] **Shared Source Scanning**: Applications import `theme.css` and configure `@source "../../../packages/ui/src";`.
- [x] **No Hand-Written CSS**: Utility classes used in TSX components; `@apply` only in theme base styles.
- [x] **Approved Dependencies**: Only `clsx` and `tailwind-merge` used for class merging (`cn`).

---

## 3. Theme Initialization & Anti-Flash

- [x] **Non-Inline Script**: Placed in `public/theme-init.js` in `apps/web`, `apps/dashboard`, and `apps/admin`.
- [x] **Strict CSP Compliance**: Loaded via blocking `<script src="/theme-init.js"></script>` in `<head>` before CSS stylesheets.
- [x] **Defensive Storage**: Wrapped in `try/catch` to safely handle disabled localStorage or privacy modes.
- [x] **Zero Flash of Wrong Theme**: DOM `data-theme` attribute set synchronously before first render.
- [x] **Theme Toggle**: Tri-state (light / dark / system) with persistent storage and system media query sync.

---

## 4. Typography & Fonts

- [x] **Self-Hosted via Fontsource**:
  - `@fontsource/bricolage-grotesque` (700, 800 - display headings)
  - `@fontsource/public-sans` (400, 500, 600 - body text and UI controls)
  - `@fontsource/jetbrains-mono` (400, 500 - code, coordinates, API keys, JSON)
- [x] **Zero CDN Downloads**: No external font stylesheets or runtime network requests; packaged locally into production bundles.

---

## 5. Interaction Matrix & States

- [x] **Hover Lift & Pointer**: Interactive cards lift subtly (`hover:-translate-y-0.5 hover:shadow-l2`) with `cursor-pointer`.
- [x] **Non-Interactive Cards**: Static display cards retain default arrow cursor (`cursor-default`) and no lift.
- [x] **Active Feedback**: Press feedback via `active:scale-[0.98]`.
- [x] **Accessibility & Motion Preference**: `motion-reduce:transform-none` and `[@media(hover:none)]:transform-none` to protect touch and reduced-motion users.
- [x] **Disabled Elements**: `disabled:opacity-50 disabled:cursor-not-allowed` with hover effects suppressed.
- [x] **Focus Indicators**: Visible two-pixel focus ring on interactive elements (`focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2`).

---

## 6. Playground & Specialized Components

- [x] **SVG Stroke Draw-in Animation**: Staggered ~400ms box stroke animations using cubic-bezier timing and CSS keyframes.
- [x] **Confidence Threshold Slider**: Real-time slider filtering canvas bounding boxes and detection list.
- [x] **Bidirectional Highlighting**: Hovering over a detection row highlights the bounding box on the image; hovering over a canvas box highlights the corresponding list row.
- [x] **Drag & Drop Upload Zone**: Multi-mode zone supporting drag/drop, paste, and browse, with file size validation (< 10 MB) and MIME checking.
- [x] **L3 API Key Reveal Modal**: Displays generated plaintext key once only; requires copy confirmation or acknowledgement checkbox before closing.
- [x] **Balance Animation & Quotas**: `AnimatedNumber` component for balance updates, `ProgressBar` with accessible ARIA labeling for quota tracking.
- [x] **Accessible Usage Chart**: SVG bar chart with tooltips, keyboard focusability, and one-click toggle to an accessible `<table>` fallback.
- [x] **Shape + Color Status Chips**: Chips combine geometric glyphs (● circle for executed/active, ◔ clock for pending, ▲ warning for suspended, ■ square for abandoned) with color for unambiguous accessibility.

---

## 7. Verification Results

### Automated Screenshots (`pnpm ui:shots`)
All 48 screenshot combinations generated into `docs/screenshots/`:
- **Web App**:
  - `web-home-light-1440.png`, `web-home-dark-1440.png`, `web-home-light-390.png`, `web-home-dark-390.png`
  - `web-docs-light-1440.png`, `web-docs-dark-1440.png`, `web-docs-light-390.png`, `web-docs-dark-390.png`
  - `web-privacy-light-1440.png`, `web-privacy-dark-1440.png`, `web-privacy-light-390.png`, `web-privacy-dark-390.png`
- **Dashboard App**:
  - `dashboard-overview-light-1440.png`, `dashboard-overview-dark-1440.png`, `dashboard-overview-light-390.png`, `dashboard-overview-dark-390.png`
  - `dashboard-usage-light-1440.png`, `dashboard-usage-dark-1440.png`, `dashboard-usage-light-390.png`, `dashboard-usage-dark-390.png`
  - `dashboard-requests-light-1440.png`, `dashboard-requests-dark-1440.png`, `dashboard-requests-light-390.png`, `dashboard-requests-dark-390.png`
  - `dashboard-keys-light-1440.png`, `dashboard-keys-dark-1440.png`, `dashboard-keys-light-390.png`, `dashboard-keys-dark-390.png`
  - `dashboard-playground-light-1440.png`, `dashboard-playground-dark-1440.png`, `dashboard-playground-light-390.png`, `dashboard-playground-dark-390.png`
- **Admin App**:
  - `admin-users-light-1440.png`, `admin-users-dark-1440.png`, `admin-users-light-390.png`, `admin-users-dark-390.png`
  - `admin-models-light-1440.png`, `admin-models-dark-1440.png`, `admin-models-light-390.png`, `admin-models-dark-390.png`
  - `admin-routes-light-1440.png`, `admin-routes-dark-1440.png`, `admin-routes-light-390.png`, `admin-routes-dark-390.png`
  - `admin-ledger-light-1440.png`, `admin-ledger-dark-1440.png`, `admin-ledger-light-390.png`, `admin-ledger-dark-390.png`

### Accessibility Audit (`pnpm ui:a11y`)
Automated Playwright + `@axe-core/playwright` suite auditing:
- Web Home (Light + Dark): **0 violations**
- Web Docs (Light + Dark): **0 violations**
- Web Privacy (Light + Dark): **0 violations**
- Dashboard Overview (Light + Dark): **0 violations**
- Dashboard Usage (Light + Dark): **0 violations**
- Dashboard Requests Log (Light + Dark): **0 violations**
- Dashboard API Keys (Light + Dark): **0 violations**
- Dashboard Playground (Light + Dark): **0 violations**
- Admin Users (Light + Dark): **0 violations**
- Admin Models (Light + Dark): **0 violations**
- Admin Routes (Light + Dark): **0 violations**
- Admin Ledger (Light + Dark): **0 violations**
- **Result**: Zero serious or critical violations across the board.
