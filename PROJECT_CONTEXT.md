# FairGig Project Context

Last updated: 2026-04-18

## 1) Project Summary

FairGig is a role-based platform for gig worker income tracking, verification, grievance handling, and anomaly detection, built for SOFTEC 2026.

Current stack:

- Next.js 16 (App Router) + React 19 + TypeScript
- Hono API mounted inside Next route handlers
- Prisma ORM (PostgreSQL provider) with generated client in src/generated/prisma
- Better Auth for session and social/email auth
- TanStack React Query for client-side data operations
- Separate Python FastAPI anomaly service using robust statistical rules

## 2) Current Status (Detailed)

### 2.1 Build and Runtime Health

- Prisma module resolution issue is fixed.
  - Root cause: missing generated client folder.
  - Action taken: ran Prisma generate, which created src/generated/prisma.
- Next.js production build currently succeeds.
  - Turbopack compile: success.
  - TypeScript check: success.
  - Static generation: success.
- Non-blocking build-time warnings still appear for missing social auth env vars (GitHub/Google client credentials), but they do not fail build.

### 2.2 Anomaly Service Validation

Anomaly service was installed, executed, and validated end-to-end at service level.

Validated endpoints:

- GET /health -> 200 OK
- POST /analyze (with anomaly-service/test_payload.json) -> 200 OK
- GET /docs -> 200 OK

Observed analyze response:

- analyzed_shifts: 12
- anomalies_found: 1
- risk_level: medium
- detected anomaly type: income_cliff

### 2.3 API and Feature Implementation Level

Implemented and wired:

- Auth pages and middleware routing structure
- Domain route mounts in Hono
- Role-based page scaffolding (worker, verifier, advocate, community)
- Query key registry for domain data
- Anomaly bridge handler in Next/Hono to Python FastAPI
- Full anomaly detection logic in Python service

Still scaffold-level in multiple domains:

- Several domain handlers return scaffold responses instead of full business logic
- Most UI modules exist but require richer connected workflows
- Domain workflows need stronger validation/error modeling

## 3) Architecture

### 3.1 Next.js App

- App shell and routing in src/app
- API entry point in src/app/api/[[...route]]/route.ts
- Auth and route guard config in src/lib/auth.ts, src/lib/auth-client.ts, src/routes.ts, src/proxy.ts
- Typed Hono client for frontend hooks in src/lib/hono.ts

### 3.2 API Layer (Hono in Next)

Mounted route groups:

- /api/sample
- /api/shifts
- /api/screenshots
- /api/grievances
- /api/analytics
- /api/certificates
- /api/anomaly

### 3.3 Data Layer (Prisma)

- Prisma schema: prisma/schema.prisma
- Generator output: src/generated/prisma
- Shared DB client: src/lib/db.ts

Core domain models include:

- User/auth/session/account/token entities
- Platform and ShiftLog
- Screenshot and verification flows
- Grievance, tags, escalations
- Anomaly and vulnerability flags
- Daily platform stats
- Income certificates

### 3.4 Anomaly Service

- Entry: anomaly-service/main.py
- Models: anomaly-service/models.py
- Detection rules: anomaly-service/detection/rules.py
- Explanations: anomaly-service/detection/explainer.py

Cross-service flow:

1. Frontend sends request to /api/anomaly/analyze.
2. Hono handler fetches 90-day shift data via Prisma.
3. Handler maps payload and calls FastAPI /analyze.
4. FastAPI returns anomaly list + severity summary.
5. If service call fails, Hono returns graceful fallback:
   - anomalies: []
   - error: anomaly_service_unavailable

## 4) Access and Routing

Current route group status from src/routes.ts:

- authRoutes: sign in/up and auth-related flows
- publicRoutes: includes base and sample routes
- protectedRoutes:
  - /worker/dashboard
  - /worker/log-shift
  - /worker/certificate
  - /worker/profile
  - /verifier/queue
  - /advocate/dashboard
  - /advocate/grievances
  - /community/board

## 5) Query Layer Conventions

Query keys in src/constants/query-keys.ts:

- SAMPLE
- SHIFTS
- SCREENSHOTS
- GRIEVANCES
- ANALYTICS
- CERTIFICATES
- ANOMALY

Frontend hooks follow a typed request/response pattern with Hono client and React Query.

## 6) Important Recent Fixes

### 6.1 Build Blocking Fixes

- Generated Prisma client to resolve missing import in auth/db modules.
- Installed and aligned missing API dependency usage for Hono validators.
- Resolved multiple type-level request parsing issues in API handlers and frontend API hooks.

### 6.2 Handler Parsing Normalization

Several scaffold handlers now use explicit request parsing (json/param) rather than relying on inferred c.req.valid types in plain Context handlers.

### 6.3 Verifier Hook Typing Workaround

In verifier queue update verification API hook, a narrow call-site cast is used to satisfy current inferred Hono client typing behavior.

This is functionally valid but should be replaced with stricter route-level typing refinement later.

## 7) Environment Variables (Current Expected Set)

- DATABASE_URL
- BETTER_AUTH_SECRET
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- NEXT_PUBLIC_API_URL
- OPEN_ROUTER_API_KEY
- ANOMALY_SERVICE_URL

Reference file:

- .env.local.example

## 8) Current Risks / Gaps

1. Domain handlers are partially scaffolded and need full persistence/business behavior.
2. Some frontend pages/components are structural and need production-grade states and flows.
3. Social auth env values are not fully configured in some environments.
4. One verifier hook still uses a temporary type cast and should be hardened.

## 9) Recommended Next Work (Priority Order)

1. Complete domain handlers with full DB and validation logic.
2. Add integration tests for:
   - /api/anomaly/analyze (bridge)
   - anomaly-service /analyze (contract)
3. Replace temporary verifier request cast with robust typed route contract.
4. Harden UX states (loading/error/empty) for role dashboards.
5. Update root README to reflect FairGig architecture and runbook.

## 10) Quick Mental Model for New Contributors

The project is no longer raw scaffolding.

It already has:

- Solid app/API/data architecture
- A functioning anomaly microservice and bridge
- A passing production build

What remains is primarily product-layer completion:

- richer domain logic,
- polished UI flows,
- and stronger test coverage.
