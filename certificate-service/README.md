# FairGig — Certificate Renderer Service

Standalone Python FastAPI service that generates 
print-friendly HTML income certificates from 
verified gig worker earnings.

## Purpose
Gig workers need to prove income to landlords and 
banks. This service generates a clean, printable 
HTML certificate showing verified earnings across 
any date range.

## Quick Start
```bash
cd certificate-service
pip install -r requirements.txt
cp .env.example .env
# Edit .env with DATABASE_URL
uvicorn main:app --reload --port 8004
```

Service runs on: http://localhost:8004
Swagger UI: http://localhost:8004/docs

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| POST | /certificate | Generate certificate (JSON + HTML) |
| GET | /certificate/preview | Preview in browser (HTML only) |
| GET | /certificate/sample | Sample certificate (no auth needed) |

## POST /certificate — Request Body
```json
{
  "worker_id": "string",
  "from_date": "2025-10-01",
  "to_date": "2026-04-18",
  "include_unverified": false
}
```

## GET /certificate/preview — Query Params
`?worker_id=xxx&from_date=2025-10-01&to_date=2026-04-18&include_unverified=false`

## Response Shape
```json
{
  "certificate_id": "uuid",
  "worker_id": "string",
  "html": "<complete HTML document>",
  "data": { ...CertificateData fields... }
}
```

## Print Flow
1. Frontend calls GET `/certificate/preview` with params.
2. Opens result in new tab or iframe.
3. Worker clicks Print button on the page.
4. Browser handles print dialog.
5. No PDF library needed — browser print handles it.

## Privacy
- Only shifts belonging to the requesting worker_id are included.
- City-wide median data is never included in certs.
- Certificate ID is random UUID — not guessable.

## Environment Variables
- `DATABASE_URL` — PostgreSQL (same as main app)
- `PORT` — default 8004

## Test
```bash
curl http://localhost:8004/health

# Preview sample certificate in browser:
open http://localhost:8004/certificate/sample

# Generate real certificate:
curl -X POST http://localhost:8004/certificate \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "your-worker-id",
    "from_date": "2025-10-01",
    "to_date": "2026-04-18",
    "include_unverified": false
  }'
```
