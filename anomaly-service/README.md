<!-- FairGig scaffold — implement logic here -->

# FairGig Anomaly Service

Statistically-grounded anomaly detection for gig worker earnings data.

## Quick Start

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the service:

```bash
uvicorn main:app --reload --port 8001
```

Interactive docs for judges:

- Open `GET /docs` after startup
- FastAPI Swagger UI is generated automatically

## Detection Rules

| Rule               | Algorithm                                                           | Anomaly Taxonomy Class | Severity                            |
| ------------------ | ------------------------------------------------------------------- | ---------------------- | ----------------------------------- | ------------- | ------------------------------------ |
| Deduction Spike    | Iglewicz-Hoaglin Modified Z-Score (`                                | mZ                     | > 3.5`) on deduction rates          | Point Anomaly | Medium/High/Critical (by spike size) |
| Income Cliff       | Rolling weekly median vs `median - 1.5 * MAD` bound                 | Contextual Anomaly     | Medium/High/Critical (by drop size) |
| Below Minimum Wage | Legal threshold check vs PKR `37000/208` hourly minimum             | Collective Anomaly     | Critical                            |
| Commission Creep   | Theil-Sen slope (`scipy.stats.theilslopes`) on deduction-rate trend | Collective Anomaly     | Medium/High/Critical (by slope)     |

## Analyze Endpoint

- `POST /analyze`
- Request body schema: `AnalyzeRequest` from `models.py`
- Response schema: `AnalyzeResponse` from `models.py`

### Sample payload

```json
{
  "worker_id": "worker_test_001",
  "earnings": [
    {
      "shift_id": "s01",
      "date": "2026-01-06",
      "platform": "Careem",
      "hours_worked": 8.0,
      "gross_earned": 4000,
      "platform_deduction": 800,
      "net_received": 3200
    },
    {
      "shift_id": "s02",
      "date": "2026-01-13",
      "platform": "Careem",
      "hours_worked": 7.5,
      "gross_earned": 3800,
      "platform_deduction": 760,
      "net_received": 3040
    },
    {
      "shift_id": "s03",
      "date": "2026-01-20",
      "platform": "Careem",
      "hours_worked": 8.5,
      "gross_earned": 4200,
      "platform_deduction": 840,
      "net_received": 3360
    },
    {
      "shift_id": "s04",
      "date": "2026-01-27",
      "platform": "Careem",
      "hours_worked": 8.0,
      "gross_earned": 4100,
      "platform_deduction": 820,
      "net_received": 3280
    },
    {
      "shift_id": "s05",
      "date": "2026-02-03",
      "platform": "Careem",
      "hours_worked": 8.0,
      "gross_earned": 4000,
      "platform_deduction": 800,
      "net_received": 3200
    },
    {
      "shift_id": "s06",
      "date": "2026-02-10",
      "platform": "Careem",
      "hours_worked": 7.0,
      "gross_earned": 3600,
      "platform_deduction": 720,
      "net_received": 2880
    },
    {
      "shift_id": "s07",
      "date": "2026-02-17",
      "platform": "Careem",
      "hours_worked": 8.5,
      "gross_earned": 4300,
      "platform_deduction": 860,
      "net_received": 3440
    },
    {
      "shift_id": "s08",
      "date": "2026-02-24",
      "platform": "Careem",
      "hours_worked": 8.0,
      "gross_earned": 4000,
      "platform_deduction": 800,
      "net_received": 3200
    },
    {
      "shift_id": "s09",
      "date": "2026-03-03",
      "platform": "Careem",
      "hours_worked": 8.0,
      "gross_earned": 4100,
      "platform_deduction": 1271,
      "net_received": 2829
    },
    {
      "shift_id": "s10",
      "date": "2026-03-10",
      "platform": "Careem",
      "hours_worked": 8.0,
      "gross_earned": 4000,
      "platform_deduction": 1280,
      "net_received": 2720
    },
    {
      "shift_id": "s11",
      "date": "2026-03-17",
      "platform": "Careem",
      "hours_worked": 7.5,
      "gross_earned": 3900,
      "platform_deduction": 1209,
      "net_received": 2691
    },
    {
      "shift_id": "s12",
      "date": "2026-03-24",
      "platform": "Careem",
      "hours_worked": 8.5,
      "gross_earned": 4200,
      "platform_deduction": 1302,
      "net_received": 2898
    }
  ]
}
```
