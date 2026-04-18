# FairGig — Anomaly Detection Service

Production anomaly analysis API for gig-worker earnings. It performs robust statistical detection across payout history and can optionally enrich the final explanations with an LLM without changing the statistical outcomes.

## Service Scope

This service is responsible for:

- validating incoming earnings payloads,
- running four independent statistical detectors,
- assigning risk severity,
- returning anomaly evidence and plain-language explanations,
- optionally rewriting explanations with AI enrichment,
- exposing contracts through FastAPI OpenAPI/Swagger.

This service is intentionally stateless. It does not write to the application database directly.

## Runtime Stack

- Python 3.12+
- FastAPI
- Pydantic models for request/response contracts
- NumPy and SciPy for robust statistical operations
- python-dateutil for date parsing
- httpx for OpenRouter enrichment HTTP calls

## File Map

- `main.py`: FastAPI entrypoint, endpoint wiring, orchestration, summary selection
- `models.py`: API contracts (`AnalyzeRequest`, `AnalyzeResponse`, `AnomalyDetail`, `ShiftRecord`)
- `detection/rules.py`: all core statistical detectors
- `detection/explainer.py`: baseline deterministic plain-language explanations
- `enrichment/ai_enricher.py`: optional LLM post-processing stage
- `test_payload.json`: judge/demo payload for manual testing
- `requirements.txt`: pinned dependency set

## Quick Start

```bash
pip install -r requirements.txt
cd anomaly-service
uvicorn main:app --reload --port 8001
```

Health check:

```bash
curl http://localhost:8001/health
```

Swagger UI:

- `http://localhost:8001/docs`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPEN_ROUTER_API_KEY` | Optional | Enables AI enrichment of anomaly explanations and unified summary generation. |

Behavior when `OPEN_ROUTER_API_KEY` is missing:

- detection still runs normally,
- baseline explainer output is returned,
- request does not fail.

## API Contracts

### GET /health

Purpose: simple liveness probe.

Response example:

```json
{
  "status": "ok",
  "service": "fairgig-anomaly"
}
```

### POST /analyze

Purpose: run the anomaly pipeline over worker shift records.

Query parameter:

- `enrich` (boolean, default `true`)
  - `true`: if anomalies exist and API key is present, perform AI enrichment.
  - `false`: always skip AI enrichment and return deterministic baseline explanations.

Request schema (`AnalyzeRequest`):

| Field | Type | Description |
|---|---|---|
| `worker_id` | string | Worker identifier for correlation in caller systems. |
| `earnings` | `ShiftRecord[]` | Shift-level payout records to analyze. |

`ShiftRecord` fields:

| Field | Type | Description |
|---|---|---|
| `shift_id` | string | Shift identifier from caller system. |
| `date` | string | ISO-like date string used for ordering and windowing. |
| `platform` | string | Platform label included in explanations/context. |
| `hours_worked` | float | Shift duration used in effective-hourly calculations. |
| `gross_earned` | float | Pre-deduction amount. |
| `platform_deduction` | float | Platform deduction amount. |
| `net_received` | float | Final amount received by worker. |

Response schema (`AnalyzeResponse`):

| Field | Type | Description |
|---|---|---|
| `worker_id` | string | Echoed worker identifier. |
| `analyzed_shifts` | int | Number of shifts analyzed after input sort. |
| `anomalies_found` | int | Number of detector outputs returned. |
| `risk_level` | string | Highest severity among anomalies (`critical`, `high`, `medium`, `low`, `none`). |
| `anomalies` | `AnomalyDetail[]` | Detector outputs with evidence and explanation text. |
| `summary` | string | Baseline or AI-enriched high-level summary. |

`AnomalyDetail` fields:

| Field | Type | Description |
|---|---|---|
| `type` | string | Detector identifier (`deduction_spike`, `income_cliff`, etc.). |
| `severity` | string | Detector-assigned severity. |
| `affected_shifts` | `string[]` | Shift IDs implicated by the detector. |
| `data` | object | Numeric evidence payload for downstream inspection/debugging. |
| `explanation` | string | Worker-facing explanation text (baseline or enriched). |

## Detection Pipeline (Implemented)

Execution order in `main.py`:

1. `check_deduction_spike`
2. `check_income_cliff`
3. `check_below_minimum_wage`
4. `check_commission_creep`

Input handling:

- shifts are sorted ascending by parsed date,
- empty input returns an immediate no-data response,
- each detector runs independently,
- non-`None` detector results are appended to response anomalies.

Risk level computation:

- rank map: `critical=4`, `high=3`, `medium=2`, `low=1`, fallback `0`.
- `none` is returned when no anomalies are present.

## Rule Details

### 1) Deduction Spike

- Class: Point anomaly
- Method: Iglewicz-Hoaglin Modified Z-score
- Core metric: deduction rate = `platform_deduction / gross_earned`
- Preconditions:
  - at least 8 valid shifts (`gross_earned > 0`),
  - non-zero MAD.
- Window logic:
  - baseline from historical rates,
  - recent window = last 7 shifts.
- Trigger: `recent_mean_modified_z > 3.5`
- Severity:
  - `medium` default
  - `high` if `spike_pct >= 30`
  - `critical` if `spike_pct >= 50`

### 2) Income Cliff

- Class: Contextual anomaly
- Method: rolling weekly median with MAD bound
- Core metric: effective hourly = `net_received / hours_worked`
- Preconditions:
  - enough data to produce at least 4 weekly groups,
  - non-zero MAD over prior week medians.
- Trigger: `current_week_median < (rolling_median - 1.5 * MAD)`
- Severity:
  - `medium` default
  - `high` if `drop_pct >= 25`
  - `critical` if `drop_pct >= 40`

### 3) Below Minimum Wage

- Class: Collective anomaly
- Method: legal benchmark comparison over a trailing 30-day window
- Benchmark: `PKR_MINIMUM_HOURLY = 37000 / 208`
- Trigger: `effective_hourly < PKR_MINIMUM_HOURLY`
- Severity: always `critical`

### 4) Commission Creep

- Class: Collective anomaly
- Method: Theil-Sen slope estimation over deduction rate trend
- Preconditions:
  - at least 8 valid shifts,
  - day span of at least 28 days.
- Trigger: slope `> 0.002` per day
- Severity:
  - `medium` default
  - `high` if slope `>= 0.003`
  - `critical` if slope `>= 0.004`

## Explanation Layer

Baseline explanations (`detection/explainer.py`):

- deterministic text built directly from detector evidence,
- includes concrete numbers (rates, percentages, PKR values, thresholds),
- no network dependency.

## AI Enrichment Layer

Module: `enrichment/ai_enricher.py`

Activation conditions:

- query param `enrich=true`,
- anomalies list is non-empty,
- `OPEN_ROUTER_API_KEY` is present.

Call characteristics:

- provider: OpenRouter HTTP API
- model: `anthropic/claude-3-haiku`
- client: `httpx.AsyncClient(timeout=10.0)`
- temperature: `0.3`
- headers include Authorization bearer key and referer.

Transformation behavior:

- matches enriched entries by anomaly `type`,
- replaces `explanation` when a match exists,
- keeps baseline explanation for non-matching types,
- returns optional `unified_summary`.

Failure behavior (non-breaking by design):

- missing API key: skip enrichment silently
- HTTP error/timeouts: log and return baseline anomalies
- malformed/unexpected JSON: return baseline anomalies
- enrichment never raises to break `/analyze`

## Summary Selection Rules

`main.py` sets response summary as follows:

1. build baseline summary via `build_summary(...)`
2. if enrichment runs and `unified_summary` is non-empty, replace baseline summary
3. otherwise keep baseline summary

## Manual Test Payload

Use the bundled payload file:

```bash
curl -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

Test raw-only path:

```bash
curl -X POST "http://localhost:8001/analyze?enrich=false" \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

## Expected Response Shape (Abbreviated)

```json
{
  "worker_id": "worker_test_001",
  "analyzed_shifts": 12,
  "anomalies_found": 1,
  "risk_level": "medium",
  "anomalies": [
    {
      "type": "income_cliff",
      "severity": "medium",
      "affected_shifts": ["s09", "s10", "s11", "s12"],
      "data": {
        "current_week_median_effective_hourly": 340.0,
        "rolling_median_effective_hourly": 400.0
      },
      "explanation": "..."
    }
  ],
  "summary": "..."
}
```

## Operational Notes

- CORS currently allows `http://localhost:3000`.
- Swagger/OpenAPI at `/docs` is the canonical interactive interface for judges.
- This service can run fully without AI credentials; AI is an additive enhancement.

## Troubleshooting

Common issues:

- `ModuleNotFoundError` for dependencies:
  - reinstall with `pip install -r requirements.txt`
- No enrichment output:
  - verify `OPEN_ROUTER_API_KEY` is present in process environment
  - test with `/analyze?enrich=false` to confirm statistical path is healthy
- Unexpected empty anomalies:
  - confirm payload dates/hours/gross/net values are valid and sufficient for detector preconditions

## Research Basis

1. Iglewicz, B. & Hoaglin, D.C. (1993). *How to Detect and Handle Outliers*.
2. Sen, P.K. (1968). *Estimates of the regression coefficient based on Kendall's tau*.
3. Theil, H. (1950). *A rank-invariant method of linear and polynomial regression analysis*.
4. Gujral (2023), UCR MADLab anomaly taxonomy references.
