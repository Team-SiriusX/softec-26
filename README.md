# FairGig

FairGig is a role-based platform for gig worker fairness workflows.
It combines a Next.js web app, a Hono API layer, PostgreSQL persistence, and two Python intelligence services:

- anomaly detection for earnings/payout irregularities,
- grievance clustering for systemic issue discovery.

## Current Highlights

- Next.js 16 + React 19 App Router web app is running with Hono under `/api`.
- Prisma schema and generated client are active and used through `src/lib/db.ts`.
- Anomaly bridge endpoints are now implemented:
  - `POST /api/anomaly/analyze`
  - `POST /api/anomaly/batch`
  - `GET /api/anomaly/city-median`
- Daily anomaly deduplication is in place for `analyze` persistence path.
- Demo seed pipeline is available at `pnpm seed`.

## Tech Stack

- Web: Next.js 16.2.4, React 19, TypeScript
- API layer: Hono + Zod validators
- Database: PostgreSQL + Prisma 7
- Auth: Better Auth
- Frontend data: TanStack Query
- Anomaly service: FastAPI + NumPy/SciPy
- ML service: FastAPI + scikit-learn

## Repository Layout

```text
.
├── src/
│   ├── app/
│   │   └── api/[[...route]]/
│   │       ├── route.ts
│   │       └── controllers/
│   ├── lib/
│   │   └── db.ts
│   └── constants/
│       └── query-keys.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── anomaly-service/
│   ├── main.py
│   └── detection/
├── ml-service/
│   └── main.py
├── PROJECT_CONTEXT.md
└── SYSTEM_ARCHITECTURE_PIPELINE.md
```

## Prerequisites

- Node.js 20+
- pnpm
- Python 3.12+
- PostgreSQL (local or hosted)

## Environment Variables

Create a local env file (for example `.env.local`) and set at least:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `ANOMALY_SERVICE_URL` (recommended: `http://localhost:8001`)

Optional but supported:

- `OPEN_ROUTER_API_KEY` (enables anomaly explanation enrichment)
- social auth provider credentials

## Local Setup

1. Install dependencies

```bash
pnpm install
```

2. Generate Prisma client (if needed)

```bash
pnpm generate
```

3. Run migrations and seed

```bash
pnpm dlx prisma migrate dev
pnpm seed
```

4. Start web app

```bash
pnpm dev
```

The app is served at `http://localhost:3000`.

## Start Intelligence Services

Run services in separate terminals.

### Anomaly Service (port 8001)

```bash
python -m pip install -r anomaly-service/requirements.txt
cd anomaly-service
python -m uvicorn main:app --reload --port 8001
```

Health check:

```bash
curl http://127.0.0.1:8001/health
```

### ML Service (port 8002)

```bash
python -m pip install -r ml-service/requirements.txt
cd ml-service
python -m uvicorn main:app --reload --port 8002
```

Health check:

```bash
curl http://127.0.0.1:8002/health
```

## API Overview

Main API mount is `src/app/api/[[...route]]/route.ts` under `/api`.

Core mounted domains:

- `/api/sample`
- `/api/shifts`
- `/api/screenshots`
- `/api/grievances`
- `/api/analytics`
- `/api/certificates`
- `/api/anomaly`

### Anomaly Endpoints

1. `POST /api/anomaly/analyze`
	- Request: `{ "workerId": "..." }`
	- Behavior: loads last 90 days of shifts, calls anomaly service `/analyze`, persists non-duplicate daily anomaly flags.

2. `POST /api/anomaly/batch`
	- Request: `{ "workerIds": ["w1", "w2"] }`
	- Guardrail: max 50 workers.
	- Behavior: calls anomaly service `/analyze/batch?enrich=false`.

3. `GET /api/anomaly/city-median?cityZone=...&category=...`
	- Behavior: aggregates last 90 days from `DailyPlatformStat` and returns zone/category medians and sample size.

## Query Keys

Defined in `src/constants/query-keys.ts`:

- `ANOMALY`
- `ANOMALY_BATCH`
- `CITY_MEDIAN`

along with `SAMPLE`, `SHIFTS`, `SCREENSHOTS`, `GRIEVANCES`, `ANALYTICS`, `CERTIFICATES`.

## Key Commands

```bash
pnpm dev            # start Next.js app
pnpm build          # production build
pnpm lint           # lint checks
pnpm format         # format code
pnpm generate       # prisma generate
pnpm seed           # seed demo data
```

## Important Project Notes

- Package manager in this repository is pnpm.
- Prisma client should be imported from generated output (`src/generated/prisma`) or `src/lib/db.ts`.
- The anomaly API persistence path is intentionally fail-open so detection response is never blocked by DB write errors.

## Architecture and Deep Context

For full technical documentation and implementation history:

- `PROJECT_CONTEXT.md`
- `SYSTEM_ARCHITECTURE_PIPELINE.md`

## Status

This repo is in a strong implementation phase: architecture and intelligence services are integrated, while some non-anomaly domain handlers are still being expanded toward full production depth.
