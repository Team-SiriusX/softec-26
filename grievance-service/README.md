# FairGig — Grievance Service

Standalone Node.js + Hono microservice for
complaint CRUD, tagging, escalation workflow,
and advocate moderation.

## Architecture Role
This service is the grievance data layer for all worker complaints. The Next.js Hono bridge proxies frontend grievance calls to this service, and `ml-service` calls `/grievances/for-clustering` to fetch complaint texts in a clustering-ready payload for unsupervised pattern detection.

## Quick Start
```bash
cd grievance-service
pnpm install
cp .env.example .env
# Edit .env with your DATABASE_URL
pnpm db:generate
pnpm start
```

Service runs on: http://localhost:8003

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection (same as main app)
- `PORT` — default 8003

## Shared Database
This service connects to the SAME PostgreSQL
database as the main Next.js app. Do NOT run
`prisma migrate` from this service — run all
migrations from the root project.

## API Reference

| Method | Path | Description | Auth Required |
| --- | --- | --- | --- |
| GET | /health | Health check | No |
| GET | /grievances | List grievances | Via bridge |
| GET | /grievances/stats | Aggregate stats | Via bridge |
| GET | /grievances/for-clustering | ML service feed | Internal |
| POST | /grievances | Create complaint | Via bridge |
| GET | /grievances/:id | Get single | Via bridge |
| PATCH | /grievances/:id | Update | Via bridge |
| DELETE | /grievances/:id | Delete | Via bridge |
| POST | /grievances/:id/tags | Add tag | Via bridge |
| DELETE | /grievances/:id/tags/:tag | Remove tag | Via bridge |
| POST | /grievances/:id/escalate | Escalate | Via bridge |
| PATCH | /grievances/:id/resolve | Resolve | Via bridge |

## Query Params — GET /grievances
`platformId`, `category`, `status`, `workerId`,
`limit` (default 50), `offset` (default 0)

## Status Transition Rules
OPEN -> ESCALATED (via /escalate)
OPEN -> RESOLVED (via /resolve)
ESCALATED -> RESOLVED (via /resolve)
RESOLVED is terminal (no backward transitions allowed).

## ML Service Integration
`GET /grievances/for-clustering` returns grievances
in the exact shape expected by ml-service
`POST /cluster` endpoint. The ml-service calls
this endpoint to get fresh complaint data
before running TF-IDF + KMeans clustering.

## Privacy
`isAnonymous=true` grievances have worker identity
replaced with `"Anonymous Worker"` in list
and single GET responses. `worker_id` is sent as
`"anonymous"` to the ml-service clustering feed.

## Test Commands

```bash
curl http://localhost:8003/health

curl http://localhost:8003/grievances/stats

curl -X POST http://localhost:8003/grievances \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "your-worker-id",
    "platformId": "your-platform-id",
    "category": "COMMISSION_CHANGE",
    "description": "Careem ne meri commission 20% se 31% kar di bina kisi notice ke. Koi announcement nahi tha.",
    "isAnonymous": false
  }'

curl "http://localhost:8003/grievances/for-clustering?platform=Careem"
```
