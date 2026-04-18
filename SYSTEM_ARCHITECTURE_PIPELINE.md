# FairGig System Architecture and Pipeline Design

Last updated: 2026-04-18

## 1. Purpose

This document describes the end-to-end architecture of the FairGig app, including:

- web frontend and backend API flow,
- auth and data access patterns,
- anomaly detection microservice pipeline,
- ML grievance clustering pipeline,
- how services are connected,
- where data is persisted,
- what happens on failures.

It is designed as a practical engineering map for implementation, debugging, and judging/demo walkthroughs.

## 2. High-Level System Map

```text
+------------------------+
|      User Browser      |
+-----------+------------+
            |
            v
+------------------------+        +---------------------------+
| Next.js App Router     |------->| Better Auth Endpoints     |
| (Pages + UI + Client)  |        | (Session/Token Validation)|
+-----------+------------+        +-------------+-------------+
            |
            v
+------------------------+        +---------------------------+
| Hono API Bridge /api/* |------->| PostgreSQL via Prisma     |
| (Validation + I/O)     |        | (Core persistent storage) |
+-----------+------------+        +---------------------------+
            |
            v
+------------------------+        +---------------------------+
| FastAPI Anomaly :8001  |------->| OpenRouter (Optional LLM) |
| (/health, /analyze)    |        | (Text enrichment only)    |
+-----------+------------+        +---------------------------+
            |
            +------ future/direct integration ------+
                                                    v
                                     +---------------------------+
                                     | FastAPI ML Service :8002  |
                                     | (/cluster, /trends)       |
                                     +---------------------------+
```

## 3. Core Runtime Components

### 3.1 Next.js Application

- Framework: Next.js App Router + React + TypeScript.
- Responsibility: pages, UI rendering, client-side query orchestration, route middleware/proxy logic.

### 3.2 Hono API Bridge inside Next

- API base path: `/api`.
- Mounted modules: sample, shifts, screenshots, grievances, analytics, certificates, anomaly.
- Responsibility: request validation, DB I/O, integration with Python services.

### 3.3 Better Auth

- Responsibility: authentication/session/token flows.
- Social providers configured (GitHub/Google) with env-based credentials.

### 3.4 Prisma + PostgreSQL

- Runtime DB client wrapper in `src/lib/db.ts`.
- Generated Prisma client path: `src/generated/prisma`.
- Responsibility: persistent storage for workers, shifts, screenshots, grievances, anomaly flags, platform stats, certificates.

### 3.5 Anomaly Service (FastAPI)

- Port: 8001 (local default).
- Endpoints: `GET /health`, `POST /analyze`.
- Responsibility: deterministic statistical anomaly detection over shift earnings.
- Optional enrichment path: OpenRouter call for rewriting explanation text and summary.

### 3.6 ML Service (FastAPI)

- Port: 8002 (local default).
- Endpoints: `GET /health`, `POST /cluster`, `POST /trends`.
- Responsibility: unsupervised clustering of grievance text and trend extraction.
- Optional cross-service context: accepts anomaly contexts by worker ID.

## 4. Main Data Entities and Their Role

- Platform: canonical platform metadata used by shifts and aggregation.
- ShiftLog: primary earnings signal source (`hoursWorked`, `grossEarned`, `platformDeductions`, `netReceived`, `shiftDate`).
- Screenshot: verifier evidence attached to shift logs.
- Grievance: worker complaint text and category used by ML clustering/trends.
- AnomalyFlag: persisted anomaly output from anomaly analysis bridge.
- DailyPlatformStat: aggregated platform-level indicators for dashboards/analytics.
- IncomeCertificate: generated certificate snapshots and range output.

## 5. Request and Pipeline Flows

## 5.1 Auth and Protected Route Flow

```text
Browser                    Next.js App                Better Auth               PostgreSQL
   |                           |                           |                           |
   | Navigate to protected page|                           |                           |
   |-------------------------->|                           |                           |
   |                           | Validate session/token    |                           |
   |                           |-------------------------->|                           |
   |                           |                           | Read auth/session records |
   |                           |                           |-------------------------->|
   |                           |                           | Session state             |
   |                           |                           |<--------------------------|
   |                           | Auth result               |                           |
   |                           |<--------------------------|                           |
   | Allow or redirect         |                           |                           |
   |<--------------------------|                           |                           |
```

## 5.2 Shift Capture and Evidence Flow

```text
Worker UI                 Hono API (/shifts, /screenshots)          PostgreSQL              Verifier UI
   |                                   |                                 |                        |
   | Submit shift data                 |                                 |                        |
   |---------------------------------->| Create ShiftLog                 |                        |
   |                                   |-------------------------------->|                        |
   |                                   | Shift persisted                 |                        |
   |                                   |<--------------------------------|                        |
   | Upload screenshot/evidence        |                                 |                        |
   |---------------------------------->| Create Screenshot -> ShiftLog   |                        |
   |                                   |-------------------------------->|                        |
   |                                   | Evidence persisted              |                        |
   |                                   |<--------------------------------|                        |
   |                                   |                                 |                        |
   |                                   |                                 |                        | Review queue fetch/update
   |                                   |<---------------------------------------------------------|
   |                                   | Read/Update screenshot/shift    |                        |
   |                                   |-------------------------------->|                        |
   |                                   | Updated verification state      |                        |
   |                                   |<--------------------------------|                        |
```

## 5.3 Anomaly Detection Flow (Current Live Path)

```text
Worker/Advocate UI        Hono /api/anomaly/analyze        PostgreSQL          FastAPI /analyze         OpenRouter (optional)
        |                            |                          |                       |                            |
        | POST workerId              |                          |                       |                            |
        |--------------------------->|                          |                       |                            |
        |                            | Fetch ~90d ShiftLog+Platform                      |                            |
        |                            |------------------------->|                       |                            |
        |                            | Shift dataset            |                       |                            |
        |                            |<-------------------------|                       |                            |
        |                            | POST worker_id + earnings[]                      |                            |
        |                            |-------------------------------------------------->|                            |
        |                            |                          | Run 4 statistical detectors                         |
        |                            |                          |                       |                            |
        |                            |                          | enrich=true + key?    |                            |
        |                            |                          |---------------------->| Rewrite explanation text   |
        |                            |                          |                       |--------------------------->|
        |                            |                          |                       | Enriched text              |
        |                            |                          |                       |<---------------------------|
        |                            | anomalies + risk + summary                         |                            |
        |                            |<--------------------------------------------------|                            |
        |                            | createMany AnomalyFlag (non-blocking)            |                            |
        |                            |------------------------->|                       |                            |
        |                            | persisted or error       |                       |                            |
        |                            |<-------------------------|                       |                            |
        | Return anomaly response    |                          |                       |                            |
        |<---------------------------|                          |                       |                            |

Notes:
- If anomaly DB persistence fails, API still returns analysis response.
- If anomaly service is unavailable, API returns fallback response with empty anomalies and error marker.
```

### 5.3.1 What the anomaly engine actually computes

The anomaly service runs deterministic statistical checks:

1. Deduction spike (point anomaly via modified Z-score).
2. Income cliff (contextual anomaly via rolling weekly median and MAD bound).
3. Below minimum wage (collective anomaly on trailing 30-day effective hourly).
4. Commission creep (collective trend anomaly via Theil-Sen slope).

Important design invariant:

- anomaly decisions are statistical;
- LLM enrichment only rewrites language;
- enrichment never changes anomaly type/severity/evidence numbers.

## 5.4 ML Grievance Intelligence Flow

```text
Caller App/Service                            ML Service /cluster
       |                                              |
       | grievances[] (text + worker_id)             |
       |--------------------------------------------->|
       |                                              | Step 1: TF-IDF vectorization
       |                                              | Step 2: Dimensionality reduction (SVD)
       |                                              | Step 3: Select k with silhouette scoring
       |                                              | Step 4: KMeans clustering
       |                                              |
       |                                              | If anomaly_contexts provided:
       |                                              | - correlate by worker_id
       |                                              | - compute anomaly correlation signal
       |                                              | - append cross-service insights
       |                                              |
       | cluster labels, keywords, severity, trends, insights
       |<---------------------------------------------|
```

### 5.4.1 Where ML text comes from

The ML model does not fetch text itself.

- Input complaint text is provided by caller in request body: `grievances[].text`.
- If caller sends many workers' grievances together, ML can detect shared issue clusters.

## 6. Integration Between Anomaly and ML Layers

There are two integration styles:

1. Statistical-first workflow:
- run anomaly analysis per worker,
- persist anomaly flags,
- pass selected anomaly contexts to ML cluster request.

2. ML-first workflow:
- cluster grievances first,
- call anomaly service for workers in high-severity clusters,
- enrich cluster outputs with anomaly overlap.

Current repository status:

- anomaly bridge from Hono to anomaly-service is implemented and active,
- ML service supports anomaly contexts in API contract,
- direct Hono route-to-ML wiring may be partial depending on module implementation status.

## 7. Operational Configuration

Key environment wiring:

- `DATABASE_URL`: PostgreSQL connection for web app and auth/db clients.
- `ANOMALY_SERVICE_URL`: Hono bridge target for anomaly analysis.
- `OPEN_ROUTER_API_KEY`: optional, enables anomaly explanation enrichment.
- `NEXT_PUBLIC_API_URL`: frontend typed Hono client base URL.

Local service ports (common setup):

- Web app: 3000
- Anomaly service: 8001
- ML service: 8002

## 8. Failure and Resilience Behavior

### 8.1 Anomaly Service Failure

If Hono cannot call anomaly service successfully:

- fallback response returns empty anomalies with service-unavailable error indicator,
- web API remains available.

### 8.2 Anomaly Flag Persistence Failure

If anomaly analysis succeeds but DB insert fails:

- anomaly response still returns to caller,
- persistence error is logged.

### 8.3 LLM Enrichment Failure

If OpenRouter call fails or returns malformed payload:

- anomaly service falls back to deterministic baseline explanations,
- no request failure is propagated for enrichment issues.

## 9. Practical End-to-End Interpretation

To explain the app quickly:

1. Workers submit earnings and evidence.
2. Verifiers validate records.
3. Anomaly engine checks payout behavior for statistical unfairness.
4. Results can be stored as anomaly flags for downstream use.
5. Grievance ML groups complaint text to detect systemic issue themes.
6. Cross-linking worker IDs across both layers strengthens evidence:
- individual statistical abnormality + collective complaint convergence.

## 10. Next Architecture Hardening Priorities

1. Add explicit integration tests for Hono <-> anomaly-service contract and persistence side effects.
2. Add deduplication or idempotency strategy for anomaly flag writes.
3. Add direct orchestrated API route connecting grievance retrieval and ML clustering pipeline where needed.
4. Add structured observability across web API and both FastAPI services.
