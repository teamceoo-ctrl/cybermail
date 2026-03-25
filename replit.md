# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Project: CyberMail

Full-stack dark cyberpunk email campaign platform. 12 pages with complete PostgreSQL backend. Supports email, SMS, and WhatsApp marketing channels via Twilio.

### Pages
- **Dashboard** (`/`) — KPI metrics (contacts, campaigns, delivery rate, reputation score), Quick Action cards (New Campaign / Import Contacts / Scrape Leads / Check SMTP), live activity feed, campaign performance area chart, open/click/bounce rate cards
- **Contacts** (`/contacts`) — Bulk-select, bulk delete, bulk export CSV, status filter, tags column, engagement score bar (opens/clicks), VALIDATE_LIST button (`POST /api/contacts/validate-bulk`), audience segments, pagination
- **Templates** (`/templates`) — Three-mode editor (CODE/SPLIT/PREVIEW), live preview, spam score meter, merge tags, quick-preview eye button (iframe dialog), clone, delete
- **SMTP Profiles** (`/smtp-profiles`) — SMTP relay management, TLS config, port scan, SOCKS5 proxy support, verification, flame icon warmup dialog (`POST /api/warmup`)
- **Campaigns** (`/campaigns`) — Detail panel with stats, pause/resume, A/B subject testing, tag-filter targeting, scheduler (scheduledAt), SMTP round-robin (roundRobinSmtpIds), template preview render iframe, test-send
- **Delivery Logs** (`/delivery-logs`) — Stacked bar chart (hourly volume, last 12h, recharts), auto-refresh toggle (15s interval), status filter, CSV export, full log table
- **Reputation** (`/reputation`) — IP/domain health, SPF/DKIM/DMARC status, reputation alerts, sending metrics bars
- **Lead Scraper** (`/lead-scraper`) — Three-mode (ADVANCED_FINDER / DOMAIN_CRAWLER / TARGETED_HUNT), SSE streaming, MX validation, confidence bars, CSV export, import-to-contacts
- **Inbox Tester** (`/inbox-tester`) — Deliverability scoring (normalised penalty system), 20+ checks (spam phrases, URL shorteners, HTML size, text:image ratio, preheader, legal compliance), Send Test Email via SMTP profile
- **SMS Campaigns** (`/sms`) — Bulk SMS via Twilio; campaign manager with quick-test, launch, stats; 160-char segment counter
- **WhatsApp Campaigns** (`/whatsapp`) — WhatsApp Business via Twilio; campaign manager with media URL support, emoji-friendly, green branding
- **Messaging Profiles** (`/messaging-profiles`) — Twilio credential management for SMS + WhatsApp channels; verify credentials, quick test send, daily limits
- **Drip Sequences** (`/sequences`) — Multi-step drip builder with delay/delay_unit, full enrollment view (`POST /api/sequences/:id/enroll`), auto-processor every 5min
- **Suppression List** (`/suppressions`) — Global hard-stop list with bulk import, applied to all outbound sends
- **API Keys** (`/api-keys`) — Token-based API access with permissions, usage tracking, code examples

### New DB Tables (Phase 2)
- `suppression_list` — blocked emails to exclude from sends
- `sequences` / `sequence_steps` / `sequence_enrollments` — drip campaign engine
- `api_keys` — token auth with permissions JSON
- `warmup_schedules` — SMTP warmup config (rampUpDays, dailySendLimit, startDailyVolume)
- Updated `contacts` — openCount, clickCount, engagementScore (capped 100)
- Updated `campaigns` — tagFilter, abSubjectVariant, abSplitPercent, scheduledAt, roundRobinSmtpIds

### New API Routes (Phase 2)
- `GET/POST/DELETE /api/suppressions` — suppression list CRUD
- `GET/POST/PATCH/DELETE /api/sequences` — drip sequence CRUD + enroll endpoint
- `GET/POST/DELETE /api/api-keys` — API key management
- `GET/POST /api/warmup` — warmup schedule creation
- `GET /track/open/:campaignId/:contactToken` — 1×1 GIF open pixel, scores +5 pts
- `GET /track/click/:campaignId/:contactToken` — click redirect, scores +10 pts
- `POST /api/campaigns/:id/preview-render` — render template with sample vars
- `POST /api/contacts/validate-bulk` — MX validation on all contacts, marks invalid
- Enhanced `POST /api/campaigns/:id/launch` — suppression filter, round-robin SMTP, A/B split
- Cron jobs: campaign scheduler (1min), sequence processor (5min), warmup scheduler (1hr)

### Design
Dark cyberpunk: matte black background (#0a0a0a region), neon green accents (`hsl(130 100% 45%)`), Fira Code monospace font, terminal-style panels with neon glow borders, scanlines overlay.

Custom CSS utilities in `artifacts/cyberpunk-email/src/index.css`:
- `.terminal-panel` — dark card with neon border glow
- `.neon-border` — glowing green border + box-shadow
- `.neon-text` — green text-shadow glow
- `.scanlines` — CRT scanline overlay via `::after`
- `.bg-grid` — subtle green grid background

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port via PORT env)
│   └── cyberpunk-email/    # React + Vite frontend (previewPath: "/")
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

### Database Schema (PostgreSQL via Drizzle)
- `contacts` — email, name, company, status (active/unsubscribed/bounced), tags
- `segments` — contact segments with filter JSON
- `templates` — HTML email templates with merge tags
- `smtp_profiles` — SMTP relay configs (host, port, TLS, auth)
- `campaigns` — email campaigns with scheduling, status (draft/scheduled/sending/sent/paused)
- `delivery_logs` — per-email delivery records (delivered/bounced/complained/pending)
- `reputation_alerts` — IP/domain health alerts with severity (critical/warning/info)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
