# FairGig Project Context (Code-Truth Deep Analysis)

Last updated: 2026-04-18
Scope: Entire workspace architecture and implementation status
Audience: Developers, reviewers, judges, and onboarding contributors

---

## 1) Product Mission

FairGig is a role-based platform for documenting and analyzing gig-economy fairness issues.

Core intended personas:
- Worker: logs shifts, tracks payout health, and exports income evidence.
- Verifier: reviews screenshot evidence and marks verification status.
- Advocate: analyzes systemic patterns and grievance intelligence.
- Community: posts and browses grievance content.

The system combines:
- a Next.js 16 web app,
- an in-app Hono API under `/api`,
- a PostgreSQL + Prisma data layer,
- an anomaly microservice (FastAPI, statistics-first),
- an ML grievance clustering microservice (FastAPI, unsupervised NLP).

---

## 2) Tech Stack and Runtime

### 2.1 Web Platform

- Framework: Next.js 16.2.4 (App Router)
- UI: React 19.2.4 + TypeScript
- Styling/UI primitives: Tailwind CSS 4 + extensive `src/components/ui/*` library
- API layer: Hono mounted from `src/app/api/[[...route]]/route.ts`
- Auth: Better Auth (`better-auth`, JWT cookie strategy)
- Client data fetching: TanStack React Query
- DB access: Prisma 7 + PostgreSQL adapter (`@prisma/adapter-pg`)

### 2.2 Python Services

- Anomaly service (`anomaly-service/`):
  - FastAPI
  - NumPy + SciPy + python-dateutil
  - Deterministic statistical detectors + optional OpenRouter enrichment
- ML service (`ml-service/`):
  - FastAPI
  - scikit-learn + NumPy + SciPy
  - TF-IDF + TruncatedSVD + KMeans + silhouette-based k selection

---

## 3) Entry Points and Bootstrapping

### 3.1 Next.js and Layout

- Root layout: `src/app/layout.tsx`
- Root page: `src/app/page.tsx`
  - Current behavior: prints authenticated/unauthenticated based on server-side `currentUser()`.

### 3.2 Auth Endpoints

- Better Auth Next handler route: `src/app/api/auth/[...all]/route.ts`
- Auth server config: `src/lib/auth.ts`
- Auth client hooks: `src/lib/auth-client.ts`
- Current auth UI:
  - `src/app/auth/sign-in/page.tsx`
  - `src/app/auth/sign-up/page.tsx`

### 3.3 API Mounting (Hono)

Main API hub: `src/app/api/[[...route]]/route.ts`

Mounted route groups:
- `/api/sample`
- `/api/shifts`
- `/api/screenshots`
- `/api/grievances`
- `/api/analytics`
- `/api/certificates`
- `/api/anomaly`

Handled methods:
- GET, POST, PUT, PATCH, DELETE

### 3.4 Route Protection and Proxy

- Proxy middleware: `src/proxy.ts`
- Route definitions: `src/routes.ts`

Behavior:
- API routes bypass auth redirect logic.
- Public routes: `/`, `/sample`, `/chat`
- Auth routes: `/auth/sign-in`, `/auth/sign-up`, etc.
- Non-public/non-auth routes require session.

Note: `protectedRoutes` list is defined in `src/routes.ts` but `src/proxy.ts` currently applies protection by public/auth checks, not by explicitly consuming that list.

---

## 4) Database and Data Layer

### 4.1 Prisma Setup

- Schema: `prisma/schema.prisma`
- Generated client output: `src/generated/prisma`
- Runtime DB wrapper: `src/lib/db.ts`

### 4.2 Core Domain Models

Primary models in schema:
- User, Session, Account, Verification, RefreshToken, Jwks
- Platform, ShiftLog, Screenshot
- AnomalyFlag
- Grievance, GrievanceTag, GrievanceEscalation
- DailyPlatformStat, VulnerabilityFlag
- IncomeCertificate

Notable enums:
- Role: WORKER, VERIFIER, ADVOCATE
- WorkerCategory, VerificationStatus, ScreenshotStatus
- GrievanceStatus, GrievanceCategory, CertificateStatus

### 4.3 Auth Mapping Detail

Better Auth user field mapping (`src/lib/auth.ts`):
- name -> `fullName`
- emailVerified -> `isActive`
- role -> `role`

---

## 5) API Surface by Controller (Implementation Reality)

## 5.1 `/api/sample` (base demo)

File: `src/app/api/[[...route]]/controllers/(base)/sample.ts`

Implemented:
- GET `/api/sample?name=`
- POST `/api/sample`
- DELETE `/api/sample/:id`

Purpose: simple scaffold/demo endpoints.

## 5.2 `/api/analytics` (largest implemented module)

File: `src/app/api/[[...route]]/controllers/analytics/index.ts`

Middleware in this module:
- analytics auth middleware
- worker route guard middleware
- advocate route guard middleware
- worker target resolver (`:workerId` and `me` support)

Implemented worker analytics endpoints:
- GET `/api/analytics/worker/:workerId/earnings-trend`
- GET `/api/analytics/worker/:workerId/hourly-rate-river`
- GET `/api/analytics/worker/:workerId/commission-rate-tracker`
- GET `/api/analytics/worker/:workerId/platform-earnings-breakdown`
- GET `/api/analytics/worker/:workerId/earnings-distribution-dot-plot`
- GET `/api/analytics/worker/:workerId/verification-status-donut`

Implemented advocate analytics endpoints:
- GET `/api/analytics/advocate/commission-rate-heatmap`
- GET `/api/analytics/advocate/income-distribution-histogram`
- GET `/api/analytics/advocate/grievance-bump-chart`
- GET `/api/analytics/advocate/vulnerability-flag-timeline`
- GET `/api/analytics/advocate/platform-comparison-radar`
- GET `/api/analytics/advocate/city-zone-treemap`
- GET `/api/analytics/advocate/complaint-cluster-stream`

Implemented intelligence endpoints:
- GET `/api/analytics/insights/platform-exploitation-score`
- GET `/api/analytics/insights/income-volatility-index`
- GET `/api/analytics/insights/early-warning`
- GET `/api/analytics/insights/worker-risk-scores`
- GET `/api/analytics/insights/zone-intelligence`
- GET `/api/analytics/insights/complaint-intelligence`
- GET `/api/analytics/insights/cohort-analysis`
- GET `/api/analytics/insights/real-hourly-wage`

Observations:
- This controller is highly implemented and SQL-heavy.
- Uses raw SQL via `db.$queryRaw` plus Prisma group/find queries.
- Chart payload contracts are already frontend-oriented.

## 5.3 `/api/anomaly` (implemented bridge)

Files:
- `src/app/api/[[...route]]/controllers/anomaly/index.ts`
- `src/app/api/[[...route]]/controllers/anomaly/handlers.ts`

Implemented:
- POST `/api/anomaly/analyze`
- POST `/api/anomaly/batch`
- GET `/api/anomaly/city-median`

Current behavior:
- Maps local shift history into anomaly-service request shape.
- Calls anomaly-service via `ANOMALY_SERVICE_URL` (defaults to localhost:8001 `/analyze`).
- On analyze response, persists anomaly flags to DB with same-day dedupe by `flagType` per worker.
- Persistence failures are logged and do not fail API response.
- Batch endpoint sends workers to anomaly-service `/analyze/batch?enrich=false`.

## 5.4 `/api/shifts` (partially scaffolded)

Files:
- `controllers/shifts/index.ts`
- `controllers/shifts/handlers.ts`

Implemented:
- GET `/api/shifts` (returns latest 100 with platform)

Scaffolded placeholders:
- POST `/api/shifts`
- POST `/api/shifts/import`

## 5.5 `/api/grievances` (partially scaffolded)

Files:
- `controllers/grievances/index.ts`
- `controllers/grievances/handlers.ts`

Implemented:
- GET `/api/grievances` (returns latest 100)

Scaffolded placeholders:
- POST `/api/grievances`

## 5.6 `/api/screenshots` (partially scaffolded)

Files:
- `controllers/screenshots/index.ts`
- `controllers/screenshots/handlers.ts`

Implemented:
- GET `/api/screenshots` (optional status filter)

Scaffolded placeholders:
- PATCH `/api/screenshots/:id/verify`

## 5.7 `/api/certificates` (partially scaffolded)

Files:
- `controllers/certificates/index.ts`
- `controllers/certificates/handlers.ts`

Implemented:
- GET `/api/certificates/:id`

Scaffolded placeholders:
- POST `/api/certificates`

---

## 6) Frontend Surface (Actual State)

### 6.1 Implemented Analytics Pages

High implementation maturity:
- `src/app/worker/analytics/page.tsx`
- `src/app/advocate/analytics/page.tsx`

Both are client-driven React Query dashboards with rich Recharts visualizations.

### 6.2 Operational Dashboards

Implemented navigation shell pages:
- `src/app/worker/dashboard/page.tsx`
- `src/app/advocate/dashboard/page.tsx`

These currently act as command-center launch pages linking into analytics and workflows.

### 6.3 Mostly Scaffolded Role Pages

Current placeholders:
- `src/app/verifier/queue/page.tsx`
- `src/app/worker/log-shift/page.tsx`
- `src/app/worker/certificate/page.tsx`
- `src/app/worker/profile/page.tsx`
- `src/app/advocate/grievances/page.tsx`
- `src/app/community/board/page.tsx`

Additional `_components` and `_api` modules in these features are widely scaffold placeholders.

---

## 7) Microservices Deep Context

## 7.1 Anomaly Service (`anomaly-service/`)

Entry point: `anomaly-service/main.py`

Endpoints:
- GET `/health`
- POST `/analyze`
- POST `/analyze/batch`

Detector pipeline (statistics-first):
1. deduction spike
2. income cliff
3. below minimum wage
4. commission creep

Technical notes:
- Uses robust stats (MAD, modified Z-score, Theil-Sen).
- Risk level derived from max severity rank.
- LLM enrichment is optional and non-authoritative.
- Enrichment model path: OpenRouter with `anthropic/claude-3-haiku`.
- If enrichment fails, baseline deterministic explanations are returned.

## 7.2 ML Service (`ml-service/`)

Entry point: `ml-service/main.py`

Endpoints:
- GET `/health`
- POST `/cluster`
- POST `/trends`

Pipeline:
- TF-IDF vectorization
- TruncatedSVD + normalization
- KMeans clustering
- silhouette-based k choice

Cross-service design:
- Accepts optional `anomaly_contexts` in request.
- Can produce anomaly-cluster overlap messaging.

Important current integration status:
- Web app does not currently call ML service directly from Hono routes.
- ML service is available, but bridge wiring is not implemented in `src/app/api/[[...route]]/controllers/*`.

---

## 8) Data and Flow Narrative (Current)

### 8.1 Flow That Is Fully Active Today

1. User loads analytics pages (worker/advocate).
2. Frontend calls Hono analytics endpoints.
3. Analytics controller computes query-window metrics from Postgres (raw SQL + Prisma).
4. Charts render directly from API contracts.

### 8.2 Flow Partially Active

1. User/API calls `/api/anomaly/analyze`.
2. Hono maps recent shifts -> anomaly-service payload.
3. anomaly-service runs detectors and returns anomalies.
4. Hono deduplicates and persists anomaly flags.
5. Response returns regardless of persistence failure.

### 8.3 Planned but Not Yet Wired in Web Layer

- Hono -> ML `/cluster` and `/trends` invocation for grievance intelligence orchestration.

---

## 9) Seed and Demo Data

Seed script: `prisma/seed.ts`
Command: `pnpm seed`

What it seeds:
- 3 platforms
- demo users by role
- worker shifts with baseline then elevated deductions
- grievances
- daily platform stats reflecting anomaly period

Purpose:
- make analytics dashboards and anomaly demonstration deterministic for demos.

---

## 10) Environment Variables (Consolidated)

Core web app:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `NEXT_PUBLIC_API_URL` (optional, defaults to localhost:3000)

Social auth (optional but configured in server):
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Anomaly bridge:
- `ANOMALY_SERVICE_URL` (defaults toward localhost:8001/analyze behavior)

Anomaly enrichment:
- `OPEN_ROUTER_API_KEY` (optional)

Analytics dev override:
- `ANALYTICS_ALLOW_WORKER_ADVOCATE_VIEW` (in non-production, default allows worker read on advocate analytics)

---

## 11) Build and Run Commands

Node/web:
- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm seed`

Prisma:
- `pnpm generate`
- `pnpm dlx prisma migrate dev`

Anomaly service:
- `pip install -r anomaly-service/requirements.txt`
- `cd anomaly-service && uvicorn main:app --reload --port 8001`

ML service:
- `pip install -r ml-service/requirements.txt`
- `cd ml-service && uvicorn main:app --reload --port 8002`

---

## 12) Risks, Gaps, and Inconsistencies (From Code Audit)

1) README merge conflict artifacts present
- `README.md` contains unresolved conflict markers (`=======`, `>>>>>>> ...`).
- This is documentation hygiene debt and can confuse onboarding.

2) Large implementation asymmetry
- Analytics is production-heavy.
- Shift/grievance/screenshot/certificate mutation paths are largely scaffolded.
- Several role pages are placeholders.

3) ML service integration gap
- ML service exists with clear APIs, but no active Hono bridge endpoint currently orchestrates it.

4) Route definition mismatch risk
- `protectedRoutes` list is maintained in `src/routes.ts` but not directly enforced as an explicit allowlist in `src/proxy.ts`.

5) Root metadata still boilerplate
- `src/app/layout.tsx` metadata remains default "Create Next App" and should be updated for product readiness.

---

## 13) Maturity Snapshot

Implemented strongly:
- Hono API skeleton and routing
- Analytics engine and frontend dashboards
- Prisma schema and DB access layer
- Better Auth baseline integration
- Anomaly-service bridge and persistence loop
- Seed pipeline for reproducible demos

Partially implemented / scaffolded:
- Shift create/import
- Grievance create
- Screenshot verification patch
- Certificate creation
- Verifier queue feature UX
- Community board UX
- Worker operational forms (log shift, certificate workflow, profile)
- Web-layer ML service orchestration

---

## 14) Recommended Next Workstream Priority

1. Convert scaffolded mutation handlers (`shifts`, `grievances`, `screenshots`, `certificates`) into fully functional contracts.
2. Build verifier queue end-to-end (list, review action, status transitions).
3. Add Hono bridge endpoints for ML service (`/cluster`, `/trends`) and wire advocate grievances page to them.
4. Resolve README conflict artifacts and keep docs aligned with code-truth context.
5. Add integration tests for analytics and anomaly bridges.

---

## 15) Canonical Architecture Documents

- High-level architecture narrative: `SYSTEM_ARCHITECTURE_PIPELINE.md`
- This file (`PROJECT_CONTEXT.md`) is now the implementation-truth snapshot and should be updated alongside major API/feature changes.
