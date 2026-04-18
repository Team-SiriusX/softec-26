# FairGig API Contracts

This document lists the inter-service REST contracts used by FairGig.

## Gateway

All frontend traffic goes through the Next.js + Hono gateway under `/api`.

## Auth Service

Authentication is handled through Better Auth routes and session middleware.

| Endpoint | Method | Purpose | Auth |
| --- | --- | --- | --- |
| `/api/auth/*` | various | Sign in, sign up, session, callbacks | Public/Session |
| `/api/me` | GET | Current signed-in user profile | Session required |

## Earnings Service (Shifts + Screenshot Verification)

### Shift Logs

| Gateway Endpoint | Method | Service Responsibility |
| --- | --- | --- |
| `/api/shifts` | GET | List worker shift logs with filters |
| `/api/shifts/:id` | GET | Get one shift log |
| `/api/shifts` | POST | Create shift log |
| `/api/shifts/:id` | PATCH | Update shift log |
| `/api/shifts/:id` | DELETE | Delete shift log |
| `/api/shifts/import` | POST | Bulk CSV import |

Create shift payload:

```json
{
  "platform": "Uber",
  "shiftDate": "2026-04-19",
  "hoursWorked": 8,
  "grossEarned": 6200,
  "platformDeductions": 1800,
  "netReceived": 4400,
  "notes": "Peak hours",
  "screenshots": [
    {
      "fileUrl": "https://...",
      "fileKey": "uploads/abc.png"
    }
  ]
}
```

### Screenshot Verification

| Gateway Endpoint | Method | Service Responsibility |
| --- | --- | --- |
| `/api/screenshots` | GET | List screenshots pending/reviewed |
| `/api/screenshots` | POST | Attach screenshot metadata to shift |
| `/api/screenshots/:id/verify` | PATCH | Verifier confirms/flags/unverifiable |

Verify payload:

```json
{
  "status": "CONFIRMED",
  "verifierNotes": "Numbers match app statement"
}
```

## Grievance Service (Node.js)

Backend service: `grievance-service` (independently runnable with `pnpm dev` / `pnpm start`).

| Gateway Endpoint | Method | Purpose | Role |
| --- | --- | --- | --- |
| `/api/grievances` | GET | List grievances (workers get their own by default) | Authenticated |
| `/api/grievances/:id` | GET | Get grievance detail | Authenticated |
| `/api/grievances/platforms` | GET | Supported platform list | Authenticated |
| `/api/grievances/stats` | GET | Aggregate grievance stats | Advocate |
| `/api/grievances/for-cluster` | GET | ML input batch for clustering | Advocate |
| `/api/grievances` | POST | Create grievance | Worker |
| `/api/grievances/:id` | PATCH | Update grievance | Advocate |
| `/api/grievances/:id` | DELETE | Delete grievance | Advocate |
| `/api/grievances/:id/tags` | POST | Add grievance tag | Advocate |
| `/api/grievances/:id/tags/:tag` | DELETE | Remove tag | Advocate |
| `/api/grievances/:id/escalate` | POST | Escalate grievance | Advocate |
| `/api/grievances/:id/resolve` | PATCH | Resolve grievance | Advocate |
| `/api/grievances/cluster` | POST | Run cluster analysis through ML service | Advocate |
| `/api/grievances/trends` | POST | Trend analysis through ML service | Advocate |

Create grievance payload:

```json
{
  "platformId": "platform_uuid",
  "category": "COMMISSION_CHANGE",
  "description": "Platform deduction increased from 22% to 31% this week.",
  "isAnonymous": true
}
```

Add tag payload:

```json
{
  "tag": "commission-spike"
}
```

Escalate payload:

```json
{
  "note": "Pattern appears in multiple workers from the same city zone"
}
```

## Analytics Service

Gateway mount: `/api/analytics`.

This surface powers worker and advocate dashboards.

Examples:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/analytics/worker/:workerId/earnings-trend` | GET | Worker earnings trend vs city median |
| `/api/analytics/worker/:workerId/hourly-rate-river` | GET | Worker hourly band vs city distribution |
| `/api/analytics/advocate/*` | GET | Advocate aggregate KPIs, distribution, flags |
| `/api/analytics/insights/*` | GET | Advocate insight endpoints |

## Anomaly Service (FastAPI)

Gateway mount: `/api/anomaly`.

Service-level API (direct judge-call capable): `anomaly-service/main.py`.

| Gateway Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/anomaly/detect` | POST | Detect anomalies for one worker |
| `/api/anomaly/analyze` | POST | Detailed anomaly analysis for one worker |
| `/api/anomaly/batch` | POST | Batch anomaly analysis |
| `/api/anomaly/city-median` | GET | Real aggregated city median benchmark |

Detect payload:

```json
{
  "workerId": "worker_uuid"
}
```

## Certificate Renderer Service (FastAPI)

Gateway mount: `/api/certificates`.

| Gateway Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/certificates/generate` | POST | Generate certificate metadata and verification id |
| `/api/certificates/preview` | GET | Print-friendly HTML certificate preview |
| `/api/certificates/sample` | GET | Sample output for demos |
| `/api/certificates/verify/:certificateId` | GET | Verify certificate authenticity |

Preview query parameters:

- `workerId` (required)
- `from` (required, ISO date)
- `to` (required, ISO date)
- `autoPrint` (optional, `1` enables print dialog)

## Inter-service Integration Summary

- Grievance clustering and trends call ML endpoints from grievance gateway handlers.
- Anomaly and certificate services are independently deployable FastAPI apps.
- Gateway keeps contracts stable for frontend while allowing service-level independent execution.
- All mutable grievance moderation actions are role-gated and require authenticated advocate context.
