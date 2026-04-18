# FairGig Certificate Renderer Service

Dedicated renderer service for print-friendly HTML income certificates.

## Run

```bash
cd certificate-service
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8004 --reload
```

## Endpoints

- `GET /health` - service health check
- `POST /render` - generate HTML certificate from verified earnings summary

### Request body for `POST /render`

```json
{
  "workerName": "Ali Khan",
  "workerId": "worker-uuid",
  "fromDate": "2026-01-01",
  "toDate": "2026-01-31",
  "totalVerified": 45230.0,
  "shiftCount": 27,
  "platforms": ["Careem", "Bykea"],
  "generatedAt": "2026-04-18T11:00:00Z"
}
```

### Response

```json
{
  "html": "<!doctype html>..."
}
```

## Integration

Set this variable in the main app to use the service:

- `CERTIFICATE_RENDERER_URL=http://localhost:8004`

If unavailable, the main app falls back to an internal HTML renderer.
