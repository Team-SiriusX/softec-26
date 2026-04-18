# FairGig — Anomaly Detection Service

Statistically-grounded anomaly detection for gig worker earnings, built on peer-reviewed outlier detection methods. This robust API analyzes shift-level payout data, identifies pattern anomalies, and uses generative AI to provide human-readable explanations suitable for worker advocacy.

## Features Implemented

- **Robust Statistical Detection**: Four distinct algorithms for identifying systemic gig-economy wage theft, unannounced commission spikes, and discriminatory algorithm changes.
- **LLM Enrichment**: Automatically explains complex statistical anomalies in plain, worker-friendly language (via `OPEN_ROUTER_API_KEY`).
- **Resilient to Outliers**: Uses median-based dispersion (MAD) and Theil-Sen slope estimation, preventing normal gig surges from skewing the detection baselines.
- **Severity Scoring**: Dynamic calculation of severity based on statistical thresholds (`medium`, `high`, `critical`).

---

## Quick Start

```bash
pip install -r requirements.txt
cd anomaly-service
uvicorn main:app --reload --port 8001
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPEN_ROUTER_API_KEY` | Optional | Enables AI enrichment of explanations via `ai_enricher.py`. If omitted, returns hardcoded statistical explanations. |

---

## API Reference

### `GET /health`
Returns the status of the anomaly service.

**Response**
| Field | Type | Description |
|---|---|---|
| `status` | string | Current status (e.g., "ok") |
| `service` | string | Identifier (`fairgig-anomaly`) |

### `POST /analyze`
Analyzes an array of shift logs for statistical anomalies.

**Query Parameters**
- `enrich` (boolean, default `true`): Enable optional LLM explanation enrichment. 

**Request Schema**
| Field | Type | Description |
|---|---|---|
| `worker_id` | string | Unique worker identifier |
| `earnings` | array | Array of `ShiftRecord` objects |

**ShiftRecord Sub-schema**
| Field | Type | Description |
|---|---|---|
| `shift_id` | string | Unique shift ID |
| `date` | string | ISO date string (YYYY-MM-DD) |
| `platform` | string | Platform name (e.g., "Careem") |
| `hours_worked` | float | Total hours active |
| `gross_earned` | float | Amount before deductions |
| `platform_deduction` | float | Commission / fees taken by platform |
| `net_received` | float | Final payout amount |

**Response Schema**
| Field | Type | Description |
|---|---|---|
| `worker_id` | string | Worker identifier |
| `analyzed_shifts` | integer | Total shifts processed |
| `anomalies_found` | integer | Number of detected anomaly triggers |
| `risk_level` | string | Max severity: `critical`, `high`, `medium`, `low`, or `none` |
| `summary` | string | Worker-friendly summary message |
| `anomalies` | array | List of `AnomalyDetail` objects |

**AnomalyDetail Sub-schema**
| Field | Type | Description |
|---|---|---|
| `type` | string | Name of the rule triggered |
| `severity` | string | Calculated severity (`medium`, `high`, `critical`) |
| `affected_shifts` | list | Shift IDs involved in the anomaly |
| `data` | dict | Raw statistical variables computed |
| `explanation` | string | Plain-language or AI-enriched description |

---

## Detection Rules & Implementation Details

### 1. Deduction Spike (Point Anomaly)
Detects sudden, undisclosed jumps in platform commission rates.
- **Algorithm**: Iglewicz-Hoaglin Modified Z-Score (1993)
- **Mechanism**: Compares recent deduction rates (last 7 shifts) against the historic median absolute deviation (MAD).
- **Trigger Condition**: Modified Z-Score `> 3.5` on the recent mean deduction rate.
- **Severity Ratings**: `medium` (base), `high` (≥ 30% spike), `critical` (≥ 50% spike).

### 2. Income Cliff (Contextual Anomaly)
Detects sudden collapses in hourly earnings, factoring in weekly volatility.
- **Algorithm**: Rolling Weekly Median + MAD bounds
- **Mechanism**: Groups effective hourly rates by week, calculating the median of the prior 3 weeks' medians. 
- **Trigger Condition**: Current week's median `< rolling_median - 1.5 * MAD`.
- **Severity Ratings**: `medium` (base), `high` (≥ 25% drop), `critical` (≥ 40% drop).

### 3. Below Minimum Wage (Collective Anomaly)
Detects systemic underpayment across a sustained timeframe.
- **Algorithm**: Legal Threshold Comparison
- **Mechanism**: Evaluates the trailing 30-day net effective hourly rate against Pakistan's Labour Policy 2024.
- **Trigger Condition**: 30-day average `< PKR 177.88/hour` (approx. PKR 37,000 / month).
- **Severity Ratings**: Always `critical`.

### 4. Commission Creep (Collective Anomaly)
Detects a slow, covert algorithmic increase in commission percentages over time.
- **Algorithm**: Theil-Sen Estimator (Sen 1968, Theil 1950)
- **Mechanism**: Calculates robust rank-based linear regression over at least 28 days of shifts, filtering out outliers naturally.
- **Trigger Condition**: Positive slope `> 0.002` percentage points per day.
- **Severity Ratings**: `medium` (base), `high` (slope ≥ 0.003), `critical` (slope ≥ 0.004).

---

## Research Foundation

1. Iglewicz, B. & Hoaglin, D.C. (1993). *Volume 16: How to Detect and Handle Outliers.* ASQC Basic References in Quality Control.
2. Sen, P.K. (1968). *Estimates of the regression coefficient based on Kendall's tau.* Journal of the American Statistical Association.
3. Theil, H. (1950). *A rank-invariant method of linear and polynomial regression analysis*.
4. Gujral, E. (2023). *Survey: Anomaly Detection Methods*. UC Riverside MADLab.
5. Dubal, V. (2023). *On Algorithmic Wage Discrimination*. Columbia Law Review.

---

## Interactive Testing

1. Launch the server locally (`uvicorn main:app --reload --port 8001`).
2. Visit **http://localhost:8001/docs** to use the interactive Swagger UI.
3. You can paste the contents of `test_payload.json` directly into the `/analyze` endpoint payload tester.

Alternatively, test directly via `curl`:
```bash
curl -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

## Expected Output format (`test_payload.json` Example)

```json
{
  "worker_id": "worker_test_001",
  "analyzed_shifts": 12,
  "anomalies_found": 1,
  "risk_level": "medium",
  "anomalies": [
    {
      "type": "deduction_spike",
      "severity": "medium",
      "affected_shifts": ["s09", "s10", "s11", "s12"],
      "data": { ... },
      "explanation": "..."
    }
  ],
  "summary": "We analyzed 12 shifts and found 1 anomaly signal(s)..."
}
```
