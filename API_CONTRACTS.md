# FairGig Service API Contracts

This document lists inter-service REST contracts used by the platform.

## Main App BFF (Next.js + Hono)

### Earnings Service Boundary (`/api/shifts` + `/api/screenshots`)

- `GET /api/shifts` - list worker shifts with filters (`status`, `platform`, `from`, `to`)
- `GET /api/shifts/:id` - get one shift
- `POST /api/shifts` - create shift
- `PATCH /api/shifts/:id` - update shift
- `DELETE /api/shifts/:id` - delete shift
- `POST /api/shifts/import` - bulk CSV row import
- `GET /api/screenshots` - list screenshots (worker or verifier view)
- `POST /api/screenshots` - attach/upload reference for shift screenshot
- `PATCH /api/screenshots/:id/verify` - verifier decision (`CONFIRMED|FLAGGED|UNVERIFIABLE`)

### Grievance Service Boundary (`/api/grievances`)

- `GET /api/grievances` - list grievances with filters
- `POST /api/grievances` - create grievance
- `POST /api/grievances/:id/tags` - add grievance tag
- `POST /api/grievances/cluster` - assign cluster to grievance set
- `POST /api/grievances/:id/escalate` - escalate grievance
- `PATCH /api/grievances/:id/resolve` - resolve grievance

### Certificate Renderer Boundary (`/api/certificates`)

- `POST /api/certificates` - generate income certificate record and HTML snapshot
- `GET /api/certificates/:id` - fetch certificate JSON (`?format=html` for HTML)
- `GET /api/certificates/:id/print` - print-friendly HTML document

## Anomaly Service (FastAPI)

Base service in [anomaly-service](anomaly-service).

- `POST /analyze` - detect anomalies for one worker payload
- `POST /analyze/batch` - detect anomalies for worker batch

Main app integration:
- `POST /api/anomaly/analyze` -> forwards to anomaly service `/analyze`
- `POST /api/anomaly/batch` -> forwards to anomaly service `/analyze/batch`

## Grievance Service (Node.js + Hono)

Standalone service in [grievance-service](grievance-service).

- `GET /grievances`
- `POST /grievances`
- `GET /grievances/:id`
- `PATCH /grievances/:id`
- `DELETE /grievances/:id`
- `POST /grievances/:id/tags`
- `DELETE /grievances/:id/tags/:tag`
- `POST /grievances/:id/escalate`
- `PATCH /grievances/:id/resolve`
- `GET /grievances/for-clustering`
- `GET /grievances/stats`

## Certificate Renderer Service (FastAPI)

Standalone service in [certificate-service](certificate-service).

- `GET /health`
- `POST /render` - returns `{ html: string }`
