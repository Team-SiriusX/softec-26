# FairGig — Agentic AI Roadmap

A plan for integrating intelligent agents into the FairGig platform. Each agent is a discrete, independently runnable unit with a clear trigger, input, output, and fallback.

---

## Agent overview

| Agent                 | Trigger              | Service              | Stack                  |
| --------------------- | -------------------- | -------------------- | ---------------------- |
| Anomaly Detector      | New shift logged     | Anomaly service      | FastAPI + Python stats |
| Screenshot OCR        | Screenshot uploaded  | Earnings service     | FastAPI + Vision API   |
| Grievance Clusterer   | New complaint posted | Grievance service    | Node.js + embeddings   |
| Vulnerability Scanner | Nightly cron         | Analytics service    | FastAPI + Prisma       |
| Certificate Generator | Worker requests cert | Certificate renderer | Node.js + HTML         |
| Commission Watcher    | Nightly cron         | Analytics service    | FastAPI                |

---

## Phase 1 — Anomaly Detector Agent

**Priority: highest — judges call this endpoint directly.**

### What it does

Given a worker's recent earnings history, it detects statistically unusual deductions or sudden income drops and returns a human-readable explanation.

### Trigger

- Called by the Earnings service after every `ShiftLog` create or update
- Also exposed as a standalone REST endpoint for direct judge testing

### Input

```json
{
  "worker_id": "uuid",
  "shifts": [
    {
      "shift_date": "2026-04-01",
      "gross_earned": 3200,
      "platform_deductions": 640,
      "net_received": 2560,
      "hours_worked": 8
    }
  ]
}
```

### Detection logic

1. Compute rolling 30-day median of `platform_deductions / gross_earned` (commission rate)
2. Compute Z-score of current shift vs. rolling window
3. Flag if `|z_score| > 2.0`
4. Separately check for MoM income drop > 20% (vulnerability flag)
5. Return explanation in plain Urdu-friendly English

### Output

```json
{
  "worker_id": "uuid",
  "flags": [
    {
      "shift_date": "2026-04-15",
      "flag_type": "unusual_deduction",
      "severity": "high",
      "explanation": "Your platform deduction on April 15 was 38% of earnings — your usual rate is around 20%. This is unusually high and worth querying with the platform.",
      "z_score": 2.84
    }
  ],
  "anomaly_count": 1
}
```

### Fallback

- If fewer than 5 shifts exist, return `{ "flags": [], "reason": "insufficient_history" }`
- Never throw 500 — always return a structured response

### Files

```
services/anomaly/
  main.py          # FastAPI app
  detector.py      # detection logic
  schemas.py       # Pydantic models
  README.md
```

---

## Phase 2 — Screenshot OCR Agent

**Reduces verifier workload by pre-filling amounts from uploaded screenshots.**

### What it does

When a worker uploads an earnings screenshot, the agent extracts the gross amount, deductions, and net received using a vision model and pre-fills the verification form. The verifier still confirms — the agent just does the reading.

### Trigger

- `POST /screenshots/upload` in the Earnings service
- Runs asynchronously after file is stored (non-blocking)

### Input

- Image file (JPEG/PNG) from storage URL

### Logic

1. Fetch image from storage
2. Send to vision API (Google Vision / Claude Vision / Tesseract fallback)
3. Parse extracted text for known patterns: `Net Pay`, `Total Earnings`, `Commission`, `Deductions`
4. Return structured suggestion — not a commit

### Output

```json
{
  "screenshot_id": "uuid",
  "suggested": {
    "gross_earned": 3200,
    "platform_deductions": 640,
    "net_received": 2560,
    "confidence": "high"
  },
  "raw_text": "..."
}
```

### Fallback

- If confidence is `low`, surface to verifier as-is with a note: `"OCR could not reliably extract amounts — please review manually"`
- Never auto-commit OCR results to `ShiftLog`

---

## Phase 3 — Grievance Clusterer Agent

**Groups similar complaints so advocates can spot systemic issues at scale.**

### What it does

When a new grievance is posted, the agent generates a text embedding and finds the nearest existing cluster. If similarity exceeds threshold, it assigns the grievance to that cluster. Otherwise it seeds a new cluster.

### Trigger

- `POST /grievances` in the Grievance service
- Runs synchronously before the response returns (fast enough with local embeddings)

### Logic

1. Embed `title + description` using a lightweight model (e.g. `all-MiniLM-L6-v2` via `sentence-transformers`)
2. Compare cosine similarity against recent cluster centroids (last 90 days)
3. If `similarity > 0.78` → assign existing `cluster_id`
4. If no match → generate new `cluster_id` (UUID)
5. Store embedding in `grievances.embedding` (pgvector column) for future comparisons

### Schema addition needed

```prisma
model Grievance {
  // ... existing fields
  embedding Unsupported("vector(384)")?  // pgvector
}
```

### Output

Grievance is created with `cluster_id` populated. Advocates see cluster size on the dashboard.

### Fallback

- If embedding service is down, create grievance with `cluster_id = null` and queue for re-clustering

---

## Phase 4 — Vulnerability Scanner Agent

**Nightly cron that flags workers whose income dropped 20%+ month-on-month.**

### What it does

Runs every night at 00:30 PKT. Computes each active worker's current month net vs. previous month net. Inserts a `VulnerabilityFlag` row for any drop ≥ 20%.

### Trigger

- Cron: `0 30 0 * * *` (APScheduler or system cron)

### Logic

```python
SELECT
  worker_id,
  SUM(CASE WHEN date_trunc('month', shift_date) = date_trunc('month', NOW()) - interval '1 month'
      THEN net_received ELSE 0 END) AS prev_month,
  SUM(CASE WHEN date_trunc('month', shift_date) = date_trunc('month', NOW())
      THEN net_received ELSE 0 END) AS curr_month
FROM shift_logs
WHERE shift_date >= date_trunc('month', NOW()) - interval '1 month'
GROUP BY worker_id
HAVING prev_month > 0
  AND (prev_month - curr_month) / prev_month >= 0.20
```

### Output

- Upserts into `vulnerability_flags` table
- Advocate dashboard reads from this table — no live computation

### Privacy note

Query runs server-side. Advocate dashboard sees counts and zone-level summaries, not individual worker names unless they click through with appropriate role access.

---

## Phase 5 — Commission Watcher Agent

**Detects platform-wide commission rate spikes — not just individual anomalies.**

### What it does

After the nightly `DailyPlatformStat` computation runs, this agent compares today's median commission rate per platform against the 30-day rolling average. If the platform rate jumped ≥ 5 percentage points, it triggers an advocate alert.

### Trigger

- Runs after `DailyPlatformStat` is populated (chained cron, 01:00 PKT)

### Logic

1. For each `(platform, city_zone, category)` group:
   - Fetch last 30 days of `avg_commission_pct` from `DailyPlatformStat`
   - Compare today vs. rolling mean
   - Flag if `today - mean >= 0.05`
2. Insert into a `PlatformAlert` table (new, simple)
3. Advocate dashboard shows these as banners

### New model

```prisma
model PlatformAlert {
  id          String   @id @default(cuid())
  platformId  String   @map("platform_id")
  cityZone    String   @map("city_zone")
  category    WorkerCategory
  alertDate   DateTime @map("alert_date") @db.Date
  prevAvgPct  Decimal  @map("prev_avg_pct") @db.Decimal(5, 4)
  todayPct    Decimal  @map("today_pct") @db.Decimal(5, 4)
  deltaPct    Decimal  @map("delta_pct") @db.Decimal(5, 4)
  resolved    Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("platform_alerts")
}
```

---

## Phase 6 — Certificate Generator Agent

**Generates a printable income certificate from verified shifts on demand.**

### What it does

Worker picks a date range, clicks "Generate Certificate". The agent fetches all `CONFIRMED` shifts in that range, renders an HTML certificate, stores the snapshot, and returns a print-ready URL.

### Trigger

- `POST /certificates` — on-demand, synchronous

### Logic

1. Query `ShiftLog` where `workerId = X`, `shiftDate BETWEEN from AND to`, `verificationStatus = CONFIRMED`
2. Aggregate: total net, shift count, platforms used, date range
3. Render HTML template with worker name, summary table, FairGig watermark
4. Store `htmlSnapshot` in `IncomeCertificate`
5. Return certificate URL

### Print requirements

```css
@media print {
  nav,
  .sidebar,
  .actions {
    display: none;
  }
  body {
    font-size: 12pt;
    color: #000;
  }
  .certificate {
    page-break-inside: avoid;
  }
}
```

### Fallback

- If zero confirmed shifts in range: return `400` with `"No verified shifts found in this date range"`
- Never include unverified shifts in a certificate

---

## Execution order for demo day

```
Seed script runs
    → DailyPlatformStat populated (seeded directly for demo)
    → VulnerabilityFlag populated (seeded for 3–5 workers)
    → PlatformAlert populated (seeded for 2 platforms)

Worker logs shift
    → Anomaly Detector runs → flags stored
    → Screenshot uploaded → OCR agent runs → pre-fills verifier form

Verifier confirms screenshot
    → ShiftLog.verificationStatus = CONFIRMED

Worker generates certificate
    → Certificate Generator runs → print-ready HTML returned

Advocate opens dashboard
    → Reads DailyPlatformStat (medians, commission trends)
    → Reads VulnerabilityFlag (at-risk workers)
    → Reads PlatformAlert (commission spikes)
    → Reads Grievance clusters
```

---

## Environment variables needed

```env
# Shared
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...

# Anomaly service
ANOMALY_SERVICE_URL=http://localhost:8001

# OCR (choose one)
GOOGLE_VISION_API_KEY=...
# or leave blank to use Tesseract fallback

# Embeddings (Grievance clusterer)
EMBEDDING_MODEL=all-MiniLM-L6-v2  # local, no API key needed

# Cron timezone
TZ=Asia/Karachi
```

---

## Key judge-facing endpoints

| Method | Path                             | Service              | Notes                                          |
| ------ | -------------------------------- | -------------------- | ---------------------------------------------- |
| `POST` | `/anomaly/detect`                | Anomaly (FastAPI)    | Judges call this directly with crafted payload |
| `GET`  | `/analytics/platform-stats`      | Analytics (FastAPI)  | Commission trends                              |
| `GET`  | `/analytics/vulnerability-flags` | Analytics (FastAPI)  | At-risk workers                                |
| `POST` | `/certificates`                  | Certificate renderer | Returns print-ready HTML                       |
| `GET`  | `/grievances/clusters`           | Grievance (Node.js)  | Clustered complaints                           |
