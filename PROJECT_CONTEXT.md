# FairGig Project Context

FairGig is a full-stack, monorepo platform designed to support gig worker justice, enabling workers to track their earnings, identify algorithmic wage theft via anomalies, file grievances, generate verified income certificates, and engage in community discussions. The system architecture coordinates multiple specialized domains (Shifts, Analytics, Community, Anomaly detection, and Verification) across different user roles.

## System Architecture & Tech Stack

*   **Frontend**: Next.js (App Router), React 19, Tailwind CSS v4, `shadcn/ui`, `lucide-react`, TanStack Query.
*   **Backend System**: Next.js API Routes powered by **Hono** acting as an internal orchestration/RPC layer.
    *   **Services**: Divided into logical domains (Analytics, Anomaly, Auth, Certificate, Community, Grievance, Platform, Screenshot, Shift).
*   **External Python Microservice**: FastAPI server (`anomaly-service/`) designated for statistical ML tasks (e.g., earnings variations detection, using algorithms like Modified Z-score and LLM enrichments).
*   **Database**: PostgreSQL managed by Prisma. Schema located in `prisma/schema.prisma`. Output client sent to `src/generated/prisma`.
*   **Key Dependencies**:
    *   `better-auth` for user authentication.
    *   `zod` + `react-hook-form` for strong typing and validation.
    *   `uploadthing` for handling screenshot/media uploads.
    *   `hono/client` for end-to-end typed frontend API consumption.

## User Roles
*   `WORKER`: The primary user. Tracks shifts, files grievances, participates in the community feed, and requests verified income certificates.
*   `VERIFIER`: Dedicated internal role evaluating uploaded screenshots of earnings to mark `ShiftLogs` as `CONFIRMED`.
*   `ADVOCATE`: Oversees the platform, handles escalated grievances, flags systemic issues across clusters of workers, and interacts with automated anomaly data.

---

## Directory Structure & Functionality

### Root Configuration
*   `.env` / `.env.local`: Application environment variables.
*   `AGENTS.md` / `API_CONTRACTS.md` / `problem_statement.md`: Critical guidelines, AI rules, API definitions, and product problem framing.
*   `package.json` / `pnpm-workspace.yaml` / `next.config.ts`: Workspace configs, Next.js configurations, and dependency manifests.

### Postgres Database (`prisma/`)
*   `schema.prisma`: The master database map, establishing models such as:
    *   **Auth**: `User`, `Session`, `Account`.
    *   **Earnings**: `Platform`, `ShiftLog`, `Screenshot`.
    *   **Detection**: `AnomalyFlag`, `VulnerabilityFlag`.
    *   **Grievances**: `Grievance`, `GrievanceTag`, `GrievanceEscalation`.
    *   **Community**: `CommunityPost`, `CommunityPostComment`, `CommunityPostVote`, `CommunityPostReviewQueue`.
    *   **Analytics**: `DailyPlatformStat`, `IncomeCertificate`.

### Core Application (`src/`)

#### API Layer (`src/app/api/[[...route]]/`)
Centralized Hono definitions forming the internal microservices:
*   `analytics/`: Aggregates snapshots, city-wide medians, gap calculations, and trend data.
*   `anomaly/`: Handles DB persistence of `AnomalyFlag` events and bridges calls to the Python `anomaly-service`.
*   `auth/`: Custom logic surrounding user persistence to complement `better-auth`.
*   `certificates/`: Handles rendering and signing of `IncomeCertificate` payloads.
*   `community/`: Manages the Community V2 lifecycle: posts, comments, media, upvotes, reporting, and AI trust-score reviews.
*   `grievances/`: Manages grievance lifecycle (Creation, Tags, Escalations).
*   `platforms/`: Registry of gig platforms (Uber, Foodpanda, InDrive, Careem).
*   `screenshots/`: Verifier queues to review uploaded shift image files.
*   `shifts/`: `ShiftLog` CRUD (hours, gross, deductions, net) and effective hourly rate computation.
*   `middleware/`: Hono middleware routing including `auth-middleware.ts`.

#### Application Routes (`src/app/`)
*   `auth/`: Frontend components for `sign-in/` and `sign-up/`.
*   `certificate/verify/`: Public endpoint to verify a worker's hashed income certificate.
*   `pending-approval/`: Waiting screen for `ADVOCATE` or `VERIFIER` roles before authorization.
*   `verifier/queue/`: Interfaces designed for manual screenshot reviewing, utilizing grids of pending logs.
*   `worker/`: The primary worker portal housing specific micro-frontends:
    *   `anomaly-detection/`: Notifications and explanations of ML-detected wage irregularities.
    *   `certificate/`: Request area for verifiable income exports.
    *   `community-feed/`: The localized worker discussion board.
    *   `dashboard/`: Primary widget overview featuring earnings charts, effective rate cards, and city-wide benchmarks.
    *   `earnings/`: Detailed table views, platform filters, and shift specific detail sheets.
    *   `grievances/`: A ticketing form to file issues (optionally anonymous) regarding algorithmic unfairness or platform conditions.
    *   `log-shift/`: Data entry interfaces including a manual form and a CSV uploader (`csv-upload.tsx`).
    *   `profile/`: Account settings and worker category assignments.

#### Shared Components (`src/components/`)
*   `ui/`: Highly polished, accessible generic design building blocks leveraging `shadcn/ui` (inputs, cards, dialogues, sliding logos, animated sections).
*   `auth/`: Role selection utilities and session handlers.
*   `providers/`: Global wrap-arounds like `query-provider.tsx` for React Query.

#### Logic Utilities (`src/lib/` & `src/hooks/`)
*   `auth.ts`, `auth-client.ts`: Instantiation of the `better-auth` system.
*   `db.ts`: Secure Prisma instance caching.
*   `hono.ts`: The unified frontend RPC client utilizing Hono type definitions.
*   `open-router.ts`: Integration proxy used for executing generative AI tasks (like bilingual anomaly translations via `ai_enricher` or community safety scanning).
*   `hooks/`: Reusable state logic (`use-current-user.ts`, `use-grievances.ts`, `use-community.ts`).

### Python Machine Learning Service (`anomaly-service/`)
A completely decoupled FastAPI microservice designed for statistical computations and NLP tasks.
*   `main.py`: Endpoints connecting Next.js Hono calls to detection engines.
*   `models.py`: Pydantic contracts asserting exact parameter shapes expected by the API.
*   `detection/`: Core mathematical models.
    *   `rules.py`: Hardcoded variance triggers or statistical checks (e.g. Z-Score bounding).
    *   `explainer.py`: Logic to decode mathematical variances into understandable strings.
*   `enrichment/`:
    *   `ai_enricher.py`: LLM-driven module responsible for translating and simplifying detected algorithmic anomalies into contextualized bilingual alerts (English/Urdu) for workers.
