# FairGig Project Context (As of 2026-04-18)

## 1) Project Identity

FairGig is a gig worker income and rights platform for SOFTEC 2026 Web Dev Competition.

It currently consists of:

- A Next.js 16 web app (App Router)
- Better Auth for identity/session handling
- Prisma + PostgreSQL domain schema
- Hono API layer mounted under /api
- TanStack React Query typed hook pattern
- A separate Python FastAPI anomaly detection microservice

## 2) Current Maturity Snapshot

Implemented and wired:

- Core auth flow (sign in/sign up + middleware guards)
- Role-oriented app route scaffolding (worker/verifier/advocate/community)
- Business-domain API controller scaffolding in Hono
- New query key registry for all domain modules
- Anomaly API bridge from Next/Hono to Python service
- Full statistical anomaly engine in anomaly-service

Still scaffold-level in many places:

- Most domain UI pages/components are placeholders
- Several Hono handlers are scaffold responses and need full DB/business logic
- README at repo root is still generic and should be rewritten for FairGig

## 3) High-Level Architecture

### 3.1 Web Application

- Framework: Next.js 16 + React 19 + TypeScript
- API pattern: Hono route composition in src/app/api/[[...route]]/route.ts
- Data layer: Prisma client from src/lib/db.ts
- Session/auth: Better Auth in src/lib/auth.ts and src/lib/auth-client.ts
- Frontend fetching: typed hc client in src/lib/hono.ts + React Query hooks

### 3.2 Anomaly Microservice

- Framework: FastAPI
- Runtime entry: anomaly-service/main.py
- Algorithms: robust statistics in anomaly-service/detection/rules.py
- Human explanations: anomaly-service/detection/explainer.py
- Contract models: anomaly-service/models.py

### 3.3 Cross-Service Flow

1. Frontend calls Hono endpoint POST /api/anomaly/analyze.
2. Hono handler fetches worker shifts (90 days) via Prisma.
3. Hono transforms and forwards payload to FastAPI /analyze.
4. FastAPI returns detected anomalies + risk summary.
5. Hono relays response to client.

Fallback behavior is implemented: if anomaly service is unavailable, Hono returns anomalies as empty list plus error anomaly_service_unavailable.

## 4) Directory Structure (Updated)

```text
anomaly-service/
  detection/
    __init__.py
    explainer.py
    rules.py
  main.py
  models.py
  README.md
  requirements.txt
  test_payload.json

src/
  app/
    api/
      [[...route]]/
        route.ts
        middleware/
          auth-middleware.ts
        controllers/
          (base)/
            index.ts
            sample.ts
          analytics/
            index.ts
            handlers.ts
          anomaly/
            index.ts
            handlers.ts
          certificates/
            index.ts
            handlers.ts
          grievances/
            index.ts
            handlers.ts
          screenshots/
            index.ts
            handlers.ts
          shifts/
            index.ts
            handlers.ts

    worker/
      dashboard/
        page.tsx
        _components/
          earnings-chart.tsx
          anomaly-alert-card.tsx
          city-median-card.tsx
          effective-rate-card.tsx
      log-shift/
        page.tsx
        _api/
          create-shift.ts
          get-shifts.ts
          import-csv.ts
        _components/
          shift-form.tsx
          csv-upload.tsx
      certificate/
        page.tsx
        _api/
          get-certificate.ts
          create-certificate.ts
        _components/
          certificate-document.tsx
      profile/
        page.tsx

    verifier/
      queue/
        page.tsx
        _api/
          get-pending-screenshots.ts
          update-verification.ts
        _components/
          screenshot-review-card.tsx
          verification-action-bar.tsx

    advocate/
      dashboard/
        page.tsx
        _api/
          get-platform-stats.ts
          get-vulnerability-flags.ts
          get-income-distribution.ts
        _components/
          platform-commission-chart.tsx
          vulnerability-flag-table.tsx
          income-heatmap.tsx
      grievances/
        page.tsx
        _components/
          grievance-cluster-view.tsx

    community/
      board/
        page.tsx
        _api/
          get-grievances.ts
          create-grievance.ts
        _components/
          grievance-card.tsx
          post-grievance-form.tsx

  constants/
    query-keys.ts
  lib/
    auth-client.ts
    auth.ts
    current-user.ts
    db.ts
    hono.ts
    open-router.ts
  proxy.ts
  routes.ts
```

## 5) API Surface (Hono Mounts)

Current mount points in src/app/api/[[...route]]/route.ts:

- /api/sample
- /api/shifts
- /api/screenshots
- /api/grievances
- /api/analytics
- /api/certificates
- /api/anomaly

## 6) Route Access Model

Defined in src/routes.ts:

- authRoutes: sign-in/up and verification flows
- publicRoutes: /, /sample, /chat
- protectedRoutes:
  - /worker/dashboard
  - /worker/log-shift
  - /worker/certificate
  - /worker/profile
  - /verifier/queue
  - /advocate/dashboard
  - /advocate/grievances
  - /community/board

Middleware in src/proxy.ts enforces redirects for auth/public/protected scenarios.

## 7) Client Query Key Registry

Defined in src/constants/query-keys.ts:

- SAMPLE
- SHIFTS
- SCREENSHOTS
- GRIEVANCES
- ANALYTICS
- CERTIFICATES
- ANOMALY

## 8) Anomaly Service Technical Notes

### 8.1 Start/Install

- Install: pip install -r requirements.txt
- Run: uvicorn main:app --reload --port 8001
- Judge testing: GET /docs

### 8.2 Implemented Detection Rules

1. Deduction Spike (Point Anomaly)
   - Iglewicz-Hoaglin modified Z-score
   - Threshold |mZ| > 3.5
   - Recent window vs baseline behavior

2. Income Cliff (Contextual Anomaly)
   - Weekly effective-hourly medians
   - Rolling median with MAD-normalized lower bound

3. Below Minimum Wage (Collective Anomaly)
   - PKR 37,000/month converted to hourly threshold (37000/208)
   - Last 30-day aggregate effective rate

4. Commission Creep (Collective Anomaly)
   - Theil-Sen slope estimation
   - Upward trend threshold slope > 0.002/day

### 8.3 Output UX Design

- Explanations are worker-facing plain language
- Include concrete numbers (percentages, PKR rates, trend values)
- Return risk_level based on highest severity among anomalies

## 9) Environment Variables (Current Inferred Set)

- DATABASE_URL
- BETTER_AUTH_SECRET
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- NEXT_PUBLIC_API_URL
- OPEN_ROUTER_API_KEY
- ANOMALY_SERVICE_URL

Reference env example file:

- .env.local.example

## 10) Data Domain Status

Prisma schema already includes core FairGig entities:

- User, Session, Account, Verification, RefreshToken
- Platform, ShiftLog, Screenshot
- AnomalyFlag, VulnerabilityFlag
- Grievance, GrievanceTag, GrievanceEscalation
- DailyPlatformStat
- IncomeCertificate

This means database domain modeling is relatively mature; the main work left is service-level logic and UI completion.

## 11) Practical Development Guidance

When extending features:

- Follow sample co-location pattern for new page modules
- Keep typed Hono client flow for hooks
- Keep robust error handling in API handlers
- Keep anomaly service and web app decoupled via ANOMALY_SERVICE_URL

Priority next steps:

1. Replace scaffold handlers with full DB-backed implementations.
2. Connect placeholder UI components to real hooks and role-aware data.
3. Add integration tests for Hono anomaly bridge and FastAPI analyze endpoint.

This means the project is already positioned for feature scaling without a major structural rewrite.

## 14) If You Are New to This Repo: Fast Mental Model

Think of this project as:

- A Next.js application shell with authentication and route guarding done
- A typed internal API setup done (Hono)
- A rich, serious Postgres schema done for a worker-rights/earnings-verification product
- Business endpoints, workflows, and polished product UX still being built

In short: the foundation is in place; the product layer is the next major implementation phase.

## 15) Suggested Next Documentation Files (Optional)

To make onboarding even stronger after this file, you could add:

- API_CONTRACTS.md: every endpoint grouped by domain with request/response examples
- DATA_MODEL_GUIDE.md: table-by-table domain explanation with relationship diagrams
- AUTH_FLOW.md: full session lifecycle and protected-route behavior
- FEATURE_ROADMAP.md: what domain modules are scaffolded vs fully implemented
