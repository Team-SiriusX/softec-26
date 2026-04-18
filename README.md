# Softec 26 - Worker Justice Analytics Platform

This repository now includes a production-grade analytics API for:

- Worker dashboard visual intelligence (6 charts)
- Advocate panel structural insights (7 charts)
- Advanced injustice-detection intelligence layer (8 modules)

The analytics frontend is now implemented for worker and advocate routes, backed directly by these Hono endpoints.

## Product Strategy

### Core product promise

Turn fragmented worker earnings and grievance data into courtroom-grade evidence of platform-level injustice.

### Why this dashboard wins

The system does not stop at descriptive charts. It adds decision-ready insights:

- Platform exploitation ranking
- Worker risk scoring
- Early warning anomaly signals
- Zone-level inequity diagnostics

### User personas

- Worker: Understand income pressure, deductions, verification trust, and earnings stability.
- Advocate: Identify systemic patterns, rank grievances by urgency, compare platforms, and support legal narratives with evidence.

## Tech Architecture

### API stack

- Framework: Hono in Next.js route handler
- API root: `/api`
- Analytics root: `/api/analytics`
- Validation: Zod with `@hono/zod-validator`
- Data source: Postgres through Prisma client

### Relevant files

- API router: `src/app/api/[[...route]]/route.ts`
- Analytics controller: `src/app/api/[[...route]]/controllers/analytics/index.ts`
- Prisma schema: `prisma/schema.prisma`

## API Design Principles

- Every endpoint has strict request validation.
- All analytical windows are parameterized (`from`, `to`, `weeks`, `months` where relevant).
- Endpoints return chart-ready payloads with explicit `chart` or `insight` keys.
- Meta blocks include effective date windows and filters for reproducibility.
- Metrics are computed server-side so frontend remains mostly presentational.

## Endpoint Catalog

### Worker Dashboard Endpoints (6)

- Chart 1: `GET /api/analytics/worker/:workerId/earnings-trend`
- Purpose: Weekly net earnings as area series with city median overlay and gap-to-median.

- Chart 2: `GET /api/analytics/worker/:workerId/hourly-rate-river`
- Purpose: Weekly worker hourly line with city p25/p50/p75 band and status (`below`, `inside`, `above`).

- Chart 3: `GET /api/analytics/worker/:workerId/commission-rate-tracker`
- Purpose: Weekly commission percentage by platform with grouped line-ready series.

- Chart 4: `GET /api/analytics/worker/:workerId/platform-earnings-breakdown`
- Purpose: Monthly net earnings stacked by platform.

- Chart 5: `GET /api/analytics/worker/:workerId/earnings-distribution-dot-plot`
- Purpose: Dot-plot data with worker points and city peer points.

- Chart 6: `GET /api/analytics/worker/:workerId/verification-status-donut`
- Purpose: Verification status counts for `CONFIRMED`, `PENDING`, `FLAGGED`, `UNVERIFIABLE`.

### Advocate Panel Endpoints (7)

- Chart 7: `GET /api/analytics/advocate/commission-rate-heatmap`
- Purpose: Weekly average commission percentage per platform.

- Chart 8: `GET /api/analytics/advocate/income-distribution-histogram`
- Purpose: Worker income distribution per platform using configurable PKR buckets.

- Chart 9: `GET /api/analytics/advocate/grievance-bump-chart`
- Purpose: Weekly category count plus category ranking for bump chart rendering.

- Chart 10: `GET /api/analytics/advocate/vulnerability-flag-timeline`
- Purpose: Monthly vulnerability flag counts segmented by city zone.

- Chart 11: `GET /api/analytics/advocate/platform-comparison-radar`
- Purpose: Per-platform radar metrics including median earnings, avg commission, grievance count, verification rate, and anomaly flags.

- Chart 12: `GET /api/analytics/advocate/city-zone-treemap`
- Purpose: Treemap-ready city blocks where area is worker count and color is median net earned.

- Chart 13: `GET /api/analytics/advocate/complaint-cluster-stream`
- Purpose: Weekly grievance category flows for stream chart rendering.

### Advanced Intelligence Endpoints (8)

- Insight A: `GET /api/analytics/insights/platform-exploitation-score`
- Purpose: Weighted composite score per platform with normalized component breakdown.

- Insight B: `GET /api/analytics/insights/income-volatility-index`
- Purpose: Volatility index by platform and city zone.

- Insight C: `GET /api/analytics/insights/early-warning`
- Purpose: Detect current-window income drops versus baseline and emit threshold alerts.

- Insight D: `GET /api/analytics/insights/worker-risk-scores`
- Purpose: Weighted worker-level risk ranking from income drop, deductions, complaint pressure, and verification health.

- Insight E: `GET /api/analytics/insights/zone-intelligence`
- Purpose: City-zone x platform matrix for workforce pressure mapping.

- Insight F: `GET /api/analytics/insights/complaint-intelligence`
- Purpose: Top grievance categories, clusters, tags, keywords, and platform hotspots.

- Insight G: `GET /api/analytics/insights/cohort-analysis`
- Purpose: Cohort trend matrix with `NEW` vs `ESTABLISHED` snapshot.

- Insight H: `GET /api/analytics/insights/real-hourly-wage`
- Purpose: Worker-specific or platform-level hourly wage intelligence with minimum-wage benchmark.

## Validation Coverage

Validation is enforced for:

- Path params: `workerId`
- Time windows: `from`, `to`, `weeks`, `months`
- Pagination/sample controls: `workerLimit`, `cityLimit`, `limit`
- Scoring weights for exploitation and risk models
- Histogram bucket size and threshold controls
- Wage benchmark inputs (`minWageMonthlyPkr`, `expectedHoursPerMonth`)

Invalid payloads are rejected before any query execution.

## Key Formula Definitions

### Platform exploitation score

`exploitation_score =` weighted sum of normalized components:

- avg commission %
- income volatility
- complaint density
- sudden drop frequency

### Worker risk score

`risk_score =` weighted sum of normalized components:

- income drop %
- deduction (commission) %
- complaint pressure (grievances + vulnerability flags)
- unverified shift ratio

### Real hourly wage

`real_hourly = net_received / hours_worked`

### Minimum wage baseline

`min_wage_hourly = min_wage_monthly / expected_hours_per_month`

## Frontend Chart Plan (Implementation Later)

Below is the implemented frontend contract and data mapping.

### Worker dashboard chart plan

- Chart 1 - Earnings Trend Area (Recharts)
- Endpoint: `/worker/:workerId/earnings-trend`
- Mapping: X = `weekStart`, area Y = `workerNet`, dotted line Y = `cityMedianNet`.
- Tooltip: net, city median, and gap.

- Chart 2 - Hourly Rate River (Nivo Stream/Line Band)
- Endpoint: `/worker/:workerId/hourly-rate-river`
- Mapping: band = `p25` to `p75`, line = `workerHourly`.
- Visual cue: color by status (`below`, `inside`, `above`).

- Chart 3 - Commission Tracker (Recharts Multi-line)
- Endpoint: `/worker/:workerId/commission-rate-tracker`
- Mapping: one line per `platformName`, Y = `commissionPct`.

- Chart 4 - Platform Breakdown (Recharts Stacked Bar)
- Endpoint: `/worker/:workerId/platform-earnings-breakdown`
- Mapping: X = `monthStart`, stack key = `platformName`, Y = `netEarned`.

- Chart 5 - Earnings Dot Plot (Recharts Scatter)
- Endpoint: `/worker/:workerId/earnings-distribution-dot-plot`
- Mapping: X = `hoursWorked`, Y = `netEarned`, two layers = worker vs city.

- Chart 6 - Verification Donut (Recharts Pie/Radial)
- Endpoint: `/worker/:workerId/verification-status-donut`
- Mapping: segment size = status count.
- Trust cue: confirmed ratio.

### Advocate panel chart plan

- Chart 7 - Commission Heatmap (Nivo HeatMap)
- Endpoint: `/advocate/commission-rate-heatmap`
- Mapping: rows = platform, columns = week, cell value = `avgCommissionPct`.

- Chart 8 - Income Histogram (Recharts Bar)
- Endpoint: `/advocate/income-distribution-histogram`
- Mapping: X = income bucket, Y = `workerCount`, series = platform.

- Chart 9 - Grievance Bump (Nivo Bump)
- Endpoint: `/advocate/grievance-bump-chart`
- Mapping: X = week, Y = `rank`, series = grievance category.

- Chart 10 - Vulnerability Timeline (Recharts Bar)
- Endpoint: `/advocate/vulnerability-flag-timeline`
- Mapping: X = month, Y = `flaggedWorkers`, segmented by city zone.

- Chart 11 - Platform Radar (Recharts Radar)
- Endpoint: `/advocate/platform-comparison-radar`
- Axes: median earnings, commission, grievances, verification, anomalies.

- Chart 12 - Zone Treemap (Recharts Treemap)
- Endpoint: `/advocate/city-zone-treemap`
- Mapping: area = `workerCount`, color = `medianNetEarned`.

- Chart 13 - Complaint Stream (Nivo Stream)
- Endpoint: `/advocate/complaint-cluster-stream`
- Mapping: X = week, layer width = `count`, layer key = grievance category.

### Advanced intelligence modules (UI plan)

- Platform exploitation leaderboard with weight controls
- Early-warning alert rail with severity labels
- Worker risk watchlist table (sortable and filterable)
- Zone intelligence matrix with drilldown by platform
- Complaint intelligence board with keywords/tags/issues
- Cohort insight cards + trend chart
- Real hourly wage benchmark panel with minimum-wage overlay

## Run Locally

Use `pnpm` for all commands.

```bash
pnpm dev
```

To populate realistic data for all worker and advocate charts:

```bash
pnpm seed
```

The seed is deterministic and creates:

- Multi-platform, multi-zone workers
- 56 weeks of shift logs
- Grievances, tags, escalations, anomalies, vulnerability flags
- Income certificates and daily platform stats snapshots

This is required for meaningful 8-52 week chart windows.

## Local Access Behavior

In development mode, worker users can read advocate analytics endpoints to simplify local QA of both dashboards from a single account.

- Production remains restricted to `ADVOCATE` and `VERIFIER` roles.
- Development override can be disabled by setting:
  - `ANALYTICS_ALLOW_WORKER_ADVOCATE_VIEW=false`

## Next Improvements

- Add caching for heavy analytics queries.
- Add integration tests for all analytics contracts.
- Add dashboard filters (city zone, platform, window presets) in UI.
