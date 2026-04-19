# Inter-Service API Contracts

This document outlines the communication contracts between the various microservices in the ecosystem. All services are proxied through the Next.js API layer.

## Service Connectivity

| Service Name | Base URL Variable | Default Port | Implementation |
| :--- | :--- | :--- | :--- |
| **Advisor Service** | `ADVISOR_SERVICE_URL` | 8001 | Python (FastAPI) |
| **ML Service** | `ML_SERVICE_URL` | 8002 | Python (FastAPI) |
| **Grievance Service** | `GRIEVANCE_SERVICE_URL` | 8003 | Node.js (Hono/Express) |
| **Certificate Service** | `CERTIFICATE_SERVICE_URL` | 8004 | Python (FastAPI) |
| **Anomaly Service** | `ANOMALY_SERVICE_URL` | 8005 | Python (FastAPI) |

---

## 1. Advisor Service (`advisor-service`)
**Purpose**: AI-powered gig worker "Saathi" (companion) for querying earnings and anomalies via text or voice.

| Method | Endpoint | Purpose | Key Parameters (Req/Res) |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness check | - |
| `POST` | `/advisor/query` | RAG-based query analysis | **Req**: `worker_id`, `query`, `locale` (en/ur) |
| `POST` | `/advisor/voice/transcribe` | Audio to text transcription | **Req**: `file` (multipart/form-data) |
| `POST` | `/advisor/voice/query` | Voice-to-answer pipeline | **Req**: `worker_id`, `file`, `locale` |

---

## 2. Anomaly Service (`anomaly-service`)
**Purpose**: Statistical detection of earnings irregularities (Deduction Spikes, Income Cliffs, etc.).

| Method | Endpoint | Purpose | Key Parameters (Req/Res) |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness check | - |
| `POST` | `/analyze` | Statistical & LLM enriched analysis | **Req**: `worker_id`, `earnings` (list of shifts), `enrich` (bool) |
| `POST` | `/detect` | Phase 7 specific detection flags | **Req**: `worker_id`, `earnings` |
| `POST` | `/analyze/batch` | Batch analysis for multiple workers | **Req**: `workers` (list of worker objects) |

---

## 3. ML Service (`ml-service`)
**Purpose**: Unsupervised pattern recognition and trend analysis across collective grievances.

| Method | Endpoint | Purpose | Key Parameters (Req/Res) |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness check | - |
| `POST` | `/cluster` | TF-IDF + KMeans grievance clustering | **Req**: `grievances` (list), `anomaly_contexts` (optional) |
| `POST` | `/trends` | Weekly volume trend analysis | **Req**: `grievances`, `platform` (optional) |

---

## 4. Grievance Service (`grievance-service`)
**Purpose**: Core CRUD and workflow management for worker grievances.

| Method | Endpoint | Purpose | Key Parameters (Req/Res) |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness check | - |
| `GET` | `/grievances` | List/filter grievances | **Query**: `workerId`, `platform`, `status` |
| `POST` | `/grievances` | Create a new grievance | **Req**: `workerId`, `text`, `platform`, `category` |
| `PATCH` | `/grievances/:id` | Update grievance status/tags | **Req**: `status`, `tags` |
| `POST` | `/grievances/:id/escalate` | Trigger escalation workflow | **Res**: Escalation status |

---

## 5. Certificate Service (`certificate-service`)
**Purpose**: Generation of printable HTML income certificates for verified earnings.

| Method | Endpoint | Purpose | Key Parameters (Req/Res) |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness check | - |
| `POST` | `/certificate` | Generate and persist certificate | **Req**: `worker_id`, `from_date`, `to_date`, `include_unverified` |
| `GET` | `/certificate/verify/:id` | Verify certificate authenticity | **Path**: `certificate_id` |
| `GET` | `/certificate/preview` | Render HTML preview | **Query**: `worker_id`, `from_date`, `to_date` |

---

## 6. Next.js Hono Proxy (`src/app/api`)
**Purpose**: Unified API surface with authentication, translation, and service orchestration.

| Proxy Route | Target Service Endpoint | Logic Added |
| :--- | :--- | :--- |
| `/api/advisor/query` | `ADVISOR_SERVICE_URL/advisor/query` | Auth injection, 10s timeout, Urdu fallback. |
| `/api/anomaly/analyze`| `ANOMALY_SERVICE_URL/analyze` | Fetches DB shifts before calling service. |
| `/api/grievances/cluster` | `ML_SERVICE_URL/cluster` | Aggregates grievances from DB first. |
| `/api/certificates/generate` | `CERTIFICATE_SERVICE_URL/certificate` | Multi-URL retry logic (failover). |
