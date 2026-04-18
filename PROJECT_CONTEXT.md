# FairGig Project Context (Deep Technical Version)

Last updated: 2026-04-18
Audience: Developers, judges, and new contributors who need full implementation context.

## 1) Product and Purpose

FairGig is a role-based web platform for gig-economy fairness workflows:

- workers log earnings and receive anomaly intelligence,
- verifiers review supporting evidence,
- advocates investigate grievance patterns,
- community users post and browse complaints.

The project is built as a modern web app plus a dedicated anomaly microservice.

## 2) Tech Stack and Runtime Components

### 2.1 Web Application

- Framework: Next.js 16.2.4 (App Router, Turbopack)
- UI: React 19 + TypeScript + Tailwind/shadcn patterns
- API inside Next: Hono mounted under /api
- Auth: Better Auth
- Data access: Prisma + PostgreSQL
- Frontend data layer: TanStack React Query + typed Hono client

### 2.2 Anomaly Microservice

- Framework: FastAPI
- Python: 3.12 (venv in project)
- Numerical stack: NumPy + SciPy
- Date parsing: python-dateutil
- Validation: Pydantic v2

## 3) Repository State Snapshot

### 3.1 Build Health

Current production build status: PASS

- Turbopack compile: pass
- TypeScript: pass
- Static generation: pass
- Middleware/proxy wiring: active

Known non-blocking warning during build:

- Better Auth warns when social provider env credentials are not set.
- This does not break compile but affects social login availability.

### 3.2 Major Fixes Already Applied

1. Prisma client generation issue resolved
  - Previous failure: module not found for generated Prisma client path.
  - Fix: prisma generate executed and client emitted to src/generated/prisma.

2. API validation typing cleanup
  - Multiple handlers that used c.req.valid in plain Context were normalized to explicit parsing where needed.

3. Frontend request typing stabilization
  - Several API hooks were adjusted for safer inferred request typing.

4. Verifier queue update hook
  - A narrow cast is used for the verify patch call to align with current inferred route typing.
  - Functional now, but should be replaced by stricter route-level typing later.

## 4) High-Level Architecture

### 4.1 API Entry and Route Mounts

Main API router is in src/app/api/[[...route]]/route.ts with base path /api and these mounted modules:

- /api/sample
- /api/shifts
- /api/screenshots
- /api/grievances
- /api/analytics
- /api/certificates
- /api/anomaly

### 4.2 Auth and Route Access

Auth and route policy spans:

- src/lib/auth.ts
- src/lib/auth-client.ts
- src/routes.ts
- src/proxy.ts

Protected app routes currently include:

- /worker/dashboard
- /worker/log-shift
- /worker/certificate
- /worker/profile
- /verifier/queue
- /advocate/dashboard
- /advocate/grievances
- /community/board

### 4.3 Data Layer

Prisma schema resides at prisma/schema.prisma.

Generated client target:

- src/generated/prisma

Primary runtime client wrapper:

- src/lib/db.ts

## 5) Domain Data Models Relevant to Anomaly Flow

### 5.1 Platform

Platform holds canonical platform identity (name, slug) and links to ShiftLog.

### 5.2 ShiftLog

ShiftLog is the core earnings signal source, with fields used by anomaly pipeline:

- shiftDate
- hoursWorked
- grossEarned
- platformDeductions
- netReceived
- platform relation (for platform name mapping)

Indexes support worker/date and status lookups.

### 5.3 Screenshot

Screenshot is tied 1:1 to ShiftLog and stores review status and verifier notes.

### 5.4 AnomalyFlag

AnomalyFlag stores persisted anomaly metadata (flagType, severity, explanation, optional zScore).
Current anomaly API detection is computed service-side and can be adapted to persist into this model as next step.

### 5.5 DailyPlatformStat / VulnerabilityFlag / IncomeCertificate

These support aggregated analytics and worker document workflows and are foundational for later anomaly-informed product features.

## 6) Query Key Conventions

Defined in src/constants/query-keys.ts:

- SAMPLE
- SHIFTS
- SCREENSHOTS
- GRIEVANCES
- ANALYTICS
- CERTIFICATES
- ANOMALY

## 7) ANOMALY SYSTEM (Super Detailed)

This section is the authoritative deep context for anomaly detection behavior.

### 7.1 Components

Service files:

- anomaly-service/main.py
- anomaly-service/models.py
- anomaly-service/detection/rules.py
- anomaly-service/detection/explainer.py
- anomaly-service/requirements.txt
- anomaly-service/test_payload.json

Web bridge files:

- src/app/api/[[...route]]/controllers/anomaly/index.ts
- src/app/api/[[...route]]/controllers/anomaly/handlers.ts

### 7.2 API Contracts (FastAPI)

#### Health

- Method: GET
- Path: /health
- Response: { status: "ok", service: "fairgig-anomaly" }

#### Analyze

- Method: POST
- Path: /analyze
- Request model: AnalyzeRequest
- Response model: AnalyzeResponse

AnalyzeRequest shape:

- worker_id: string
- earnings: ShiftRecord[] where ShiftRecord contains:
  - shift_id
  - date (ISO-like date string)
  - platform
  - hours_worked
  - gross_earned
  - platform_deduction
  - net_received

AnalyzeResponse shape:

- worker_id
- analyzed_shifts
- anomalies_found
- risk_level
- anomalies: AnomalyDetail[]
- summary

AnomalyDetail:

- type
- severity
- affected_shifts
- data (detector-specific numeric payload)
- explanation (human-readable)

### 7.3 Detection Orchestration

main.py orchestrates detectors in this order:

1. check_deduction_spike
2. check_income_cliff
3. check_below_minimum_wage
4. check_commission_creep

Input shifts are sorted by date before checks.

If no earnings are provided, the service returns a no-data response with risk_level none.

### 7.4 Risk Aggregation

Risk level is derived from highest anomaly severity rank:

- critical > high > medium > low > none

No anomalies => risk_level none.

### 7.5 Rule-by-Rule Details

#### Rule A: Deduction Spike (Point Anomaly)

Function: check_deduction_spike
Method: Iglewicz-Hoaglin Modified Z-Score on deduction rates

Key logic:

- Uses deduction rate = platform_deduction / gross_earned
- Requires at least 8 valid shifts (gross_earned > 0)
- Computes baseline median and MAD from all valid rates
- Evaluates last 7 shifts as recent window
- Computes modified z values for recent window
- Triggers when recent_mean_modified_z > 3.5

Severity:

- medium default
- high if spike_pct >= 30
- critical if spike_pct >= 50

Data payload includes:

- baseline_median_rate
- recent_median_rate
- spike_pct
- recent_mean_modified_z
- max_modified_z
- mad

#### Rule B: Income Cliff (Contextual Anomaly)

Function: check_income_cliff
Method: Weekly median effective hourly vs rolling MAD bound

Key logic:

- effective hourly = net_received / hours_worked
- groups by ISO week
- needs at least 4 weeks
- current week median compared to threshold:
  threshold = rolling_median - (1.5 * MAD)
- triggers when current_median < threshold

Severity:

- medium default
- high if drop_pct >= 25
- critical if drop_pct >= 40

Data payload includes:

- current_week_median_effective_hourly
- rolling_median_effective_hourly
- rolling_mad
- contextual_threshold
- drop_pct

#### Rule C: Below Minimum Wage (Collective Anomaly)

Function: check_below_minimum_wage
Method: 30-day aggregate effective hourly comparison to legal benchmark

Legal benchmark:

- PKR_MINIMUM_HOURLY = 37000 / 208

Key logic:

- takes latest 30-day window from latest shift date
- effective_hourly = total_net / total_hours
- triggers if effective_hourly < legal_minimum_hourly

Severity:

- always critical when triggered

Data payload includes:

- effective_hourly
- legal_minimum_hourly
- gap_pct
- window_days
- total_hours
- total_net

#### Rule D: Commission Creep (Collective Anomaly)

Function: check_commission_creep
Method: Theil-Sen trend slope on deduction rate over time

Key logic:

- requires at least 8 valid shifts
- requires day span >= 28
- x axis: days since first shift
- y axis: deduction rate
- slope estimated via scipy.stats.theilslopes
- triggers if slope > 0.002 per day

Severity:

- medium default
- high if slope >= 0.003
- critical if slope >= 0.004

Data payload includes:

- theil_sen_slope_per_day
- intercept
- threshold
- start_rate
- end_rate
- day_span

### 7.6 Explanation Layer

explainer.py converts detector output into non-technical worker-facing language.
All four explainers embed concrete values (PKR rates, percentages, Z-score, slope, window details).

### 7.7 Web-App Bridge (Hono -> FastAPI)

Bridge endpoint in web app:

- POST /api/anomaly/analyze
- request body expected by web endpoint: { workerId: string }

Bridge handler behavior:

1. Reads workerId.
2. Queries ShiftLog for last 90 days, includes Platform relation, ordered ascending by shiftDate.
3. Maps Prisma ShiftLog fields to FastAPI AnalyzeRequest fields.
4. Calls FastAPI analyze endpoint from ANOMALY_SERVICE_URL.
5. Returns FastAPI JSON if successful.

Fallback behavior (fail-open):

- If fetch fails or non-2xx response, returns:
  - anomalies: []
  - error: anomaly_service_unavailable

Endpoint normalization logic:

- If ANOMALY_SERVICE_URL already ends with /analyze, use as-is.
- Otherwise append /analyze safely.

### 7.8 Runtime and Dependency Notes

anomaly-service/requirements.txt:

- fastapi==0.115.0
- uvicorn[standard]==0.30.0
- numpy==1.26.4
- scipy==1.13.1
- pydantic==2.7.0
- python-dateutil==2.9.0

### 7.9 Operational Runbook (Anomaly Service)

From repo root:

1. Install deps
  - c:/Users/ahmad/Desktop/softec-26/.venv/Scripts/python.exe -m pip install -r anomaly-service/requirements.txt

2. Start service
  - cd anomaly-service
  - c:/Users/ahmad/Desktop/softec-26/.venv/Scripts/python.exe -m uvicorn main:app --reload --port 8001

3. Validate service
  - GET http://127.0.0.1:8001/health
  - POST http://127.0.0.1:8001/analyze with anomaly-service/test_payload.json
  - GET http://127.0.0.1:8001/docs

### 7.10 Last Verified Test Evidence

Most recent validated service outputs:

- Health endpoint returned status ok.
- Analyze endpoint returned:
  - worker_id worker_test_001
  - analyzed_shifts 12
  - anomalies_found 1
  - risk_level medium
  - top detected anomaly income_cliff
- Docs endpoint reachable (HTTP 200).

### 7.11 Known Limitations in Current Anomaly Pipeline

1. Detection output is not yet persisted to AnomalyFlag table by default.
2. Bridge endpoint currently requires workerId with existing shift data; no synthetic fallback path for missing workers.
3. CORS currently allows localhost:3000 only in FastAPI service.
4. No automated contract test suite yet between Hono bridge and FastAPI response model.

## 8) Environment Configuration

Expected env keys (see .env.local.example):

- DATABASE_URL
- BETTER_AUTH_SECRET
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- NEXT_PUBLIC_API_URL
- OPEN_ROUTER_API_KEY
- ANOMALY_SERVICE_URL

Recommended local anomaly URL:

- ANOMALY_SERVICE_URL=http://localhost:8001

## 9) Implementation Maturity by Domain

### 9.1 Worker

- dashboard, log-shift, certificate, profile pages scaffolded
- API hooks present
- business logic partially scaffolded

### 9.2 Verifier

- queue page and related hooks/components scaffolded
- verification patch flow wired
- typing hardening still pending in one hook

### 9.3 Advocate

- dashboard and grievances pages scaffolded
- analytics-oriented hooks/components present

### 9.4 Community

- board page and create/list grievance hooks scaffolded

### 9.5 API Controllers

- all domain controllers mounted
- anomaly controller has real integration logic
- many non-anomaly handlers still placeholder-level

## 10) Open Risks and Active Technical Debt

1. Placeholder handlers in several domains need full validation and DB workflows.
2. Type-level ergonomics between Hono route validators and inferred client request types can still be improved.
3. Integration tests are missing for critical cross-service scenarios.
4. Social auth provider envs not always populated in all environments.

## 11) Recommended Next Steps (Priority)

1. Add integration tests for anomaly:
  - FastAPI /analyze contract tests
  - Hono bridge route tests
2. Persist selected anomaly outputs into AnomalyFlag when appropriate.
3. Harden verifier patch typing by improving route-level request type inference.
4. Complete placeholder API handlers in shifts/screenshots/grievances/certificates/analytics.
5. Upgrade UI states (loading, empty, error, retry) for worker/verifier/advocate/community pages.
6. Write API_CONTRACTS.md with request/response examples per mounted route.

## 12) Quick Onboarding Mental Model

FairGig is currently in a strong "foundation-complete, product-completion-in-progress" stage:

- architecture is stable,
- build is passing,
- anomaly engine is operational and validated,
- remaining effort is domain depth, UX polish, and automated quality gates.
