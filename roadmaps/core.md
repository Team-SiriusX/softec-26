# FairGig — Core Feature Reference

> **Audience:** AI coding agents implementing the FairGig frontend.  
> **Companion doc:** `ux.md` defines screen-by-screen UX, layouts, and persona routing.  
> **This doc:** defines feature logic, data contracts, business rules, validation, and service boundaries that the frontend must honour.

---

## Project Overview

FairGig is a multi-role web platform for Pakistani gig workers (ride-hailing, food delivery, freelance, domestic). It solves three problems:

1. Workers have no unified income record and cannot prove earnings.
2. Workers cannot tell if a platform is deducting fairly.
3. No mechanism exists for collective grievance or systemic pattern detection.

The frontend is **React** (or Angular — pick one, stay consistent). It communicates with six backend services via REST. It must be accessible to a **non-tech-savvy rider** — plain language, large tap targets, minimal steps, clear status feedback everywhere.

---

## Service Map

Every API call the frontend makes goes to one of these services. Never cross service boundaries in the frontend — each screen owns one logical service domain.

| Service | Base path (dev) | Tech |
|---|---|---|
| Auth service | `/api/auth` | Any |
| Earnings service | `/api/earnings` | FastAPI (Python) |
| Anomaly service | `/api/anomaly` | FastAPI (Python) |
| Grievance service | `/api/grievance` | Node.js |
| Analytics service | `/api/analytics` | Any |
| Certificate renderer | `/api/certificate` | Any |

Inter-service calls happen on the backend. The frontend only ever calls the service that owns the screen it is rendering.

---

## Auth & Session

### Tokens
- Login returns a **JWT access token** and a **refresh token**.
- Store the access token in memory (not localStorage). Store the refresh token in an `httpOnly` cookie if the backend supports it; otherwise in memory.
- Attach `Authorization: Bearer <token>` to every API request.
- On 401, attempt one silent refresh via `POST /api/auth/refresh`. If that fails, redirect to login.

### Roles
Three roles: `worker`, `verifier`, `advocate`. The JWT payload contains a `role` field. Use this for frontend route guards — do not show role-specific nav items or pages to the wrong role.

### Route guards
- Unauthenticated → redirect to `/login`
- Wrong role → redirect to that role's dashboard (never a 404 or blank page)
- First-time worker (no profile) → redirect to `/onboarding/profile` before anything else

---

## Earnings Logger

### Shift object shape
```json
{
  "id": "uuid",
  "platform": "string",           // e.g. "Careem", "Foodpanda", "Upwork"
  "date": "YYYY-MM-DD",
  "hours_worked": 6.5,
  "gross_earned": 2400,           // PKR, before deductions
  "platform_deductions": 480,     // absolute amount deducted by platform
  "net_received": 1920,
  "screenshot_url": "string|null",
  "verification_status": "pending|verified|flagged|unverifiable",
  "verifier_note": "string|null",
  "created_at": "ISO 8601"
}
```

### Computed fields (calculate on the frontend, do not store)
- **Effective hourly rate** = `net_received / hours_worked`
- **Deduction rate %** = `(platform_deductions / gross_earned) * 100`

Both values must be displayed wherever a shift is shown (dashboard cards, history rows, detail view).

### Validation rules (inline, not alert popups)
- `date` — required, cannot be in the future
- `hours_worked` — required, 0.5–24, numeric
- `gross_earned` — required, > 0, numeric
- `platform_deductions` — required, ≥ 0, must be ≤ `gross_earned`
- `net_received` — auto-calculated as `gross_earned − platform_deductions`; display as read-only to confirm, allow manual override with a warning if it differs from the auto-calculation by more than 5%
- `platform` — required, free text (do not restrict to a fixed list — new platforms appear constantly)

### CSV import
- Secondary action — not prominent in the UI (small link below the main form, labelled "Import multiple shifts via CSV")
- Expected columns (header row required): `platform, date, hours_worked, gross_earned, platform_deductions, net_received`
- Show a preview table before submitting — let the user confirm or cancel
- Report per-row errors (e.g. "Row 4: hours_worked must be a number") without blocking valid rows

### After logging a shift
- Trigger `POST /api/anomaly/detect` with the worker's recent earnings history (last 90 days)
- If the response contains flagged anomalies, display the anomaly banner on the dashboard immediately
- Do not block the shift-log success state while waiting for the anomaly call — fire it in the background

---

## Screenshot Verification Flow

### Upload (worker side)
- Accepted: JPEG, PNG only. Max size: 5 MB (show a clear error if exceeded).
- Upload to `POST /api/earnings/shifts/:id/screenshot`
- Immediately set local status to `pending` — do not wait for a verifier
- Show honest copy: *"A community reviewer will check this. It may take 24–48 hours."*
- Do not use language like "verified by FairGig" before actual verification

### Verification status values and what they mean in the UI

| Status | Worker sees | Badge color |
|---|---|---|
| `pending` | "Awaiting review" | Neutral / grey |
| `verified` | "Verified ✓" | Green |
| `flagged` | "Discrepancy flagged" + verifier note | Amber |
| `unverifiable` | "Could not be verified" + note | Red |

- `flagged` and `unverifiable` must show the verifier's note directly on the shift detail view
- `flagged` must offer a re-upload button
- `unverifiable` must explain that the worker can re-upload a clearer screenshot

### Verifier actions
Three and only three:
1. **Confirm** — figures match screenshot → sets status to `verified`
2. **Flag discrepancy** — requires a free-text note → sets status to `flagged`
3. **Mark unverifiable** — requires a free-text note → sets status to `unverifiable`

Status propagation is immediate — the worker's dashboard badge updates on next poll or websocket push.

---

## Income Certificate

### What it contains
- Worker name
- Date range (worker-chosen; default last 3 months)
- Total verified earnings (PKR)
- Breakdown by platform (verified earnings per platform)
- Count of verified shifts
- Generated date

### What it must NOT contain
- Unverified, flagged, or unverifiable entries. If entries are excluded, show a count: *"3 shifts excluded — not yet verified."*
- Navigation bars, sidebars, or app chrome (the page is shared externally)

### Honest disclaimer (mandatory, visible on the page)
> *"Self-reported earnings verified by community reviewers, not a financial institution."*

### Print behaviour
- `@media print` CSS: no background colours, black text on white, hide print button, hide share button
- The page must render correctly when printed directly from the browser without any extra setup

### Shareable link
- The certificate lives at a stable URL (e.g. `/certificate/:token`)
- The token is opaque — it does not expose the worker's ID
- Anyone with the link can view the certificate without logging in

---

## Anomaly Detection

### When to call the anomaly service
- After every new shift is saved
- The frontend sends the worker's last 90 days of shift data to `POST /api/anomaly/detect`

### Request payload shape
```json
{
  "worker_id": "uuid",
  "earnings_history": [
    {
      "date": "YYYY-MM-DD",
      "platform": "string",
      "gross_earned": 2400,
      "platform_deductions": 480,
      "net_received": 1920,
      "hours_worked": 6.5
    }
  ]
}
```

### Response shape
```json
{
  "anomalies": [
    {
      "type": "high_deduction_rate | income_drop | other",
      "severity": "low | medium | high",
      "explanation": "Plain-language string the frontend shows directly to the worker"
    }
  ]
}
```

### UI rules for anomaly alerts
- Show as a dismissible banner at the top of the worker dashboard — not a modal, not a toast
- Use the `explanation` string verbatim — do not rephrase it
- Include a direct link: "Report as grievance" → pre-fills the grievance form with the platform and category
- If `anomalies` is empty or the call fails, show nothing (fail silently)

---

## Grievance Board

### Complaint object shape
```json
{
  "id": "uuid",
  "worker_id": "uuid|null",       // null if anonymous
  "platform": "string",
  "category": "commission_change|deactivation|payment_error|other",
  "description": "string",
  "anonymous": true,
  "status": "open|tagged|escalated|resolved",
  "tags": ["string"],
  "cluster_id": "uuid|null",
  "resolution_note": "string|null",
  "upvote_count": 42,
  "created_at": "ISO 8601"
}
```

### Worker posting rules
- Anonymous toggle: when on, do not send `worker_id`; display the poster as "Anonymous worker"
- Category is a fixed enum (show as a select/radio — do not allow free-text category)
- Description: max 1000 characters, show character count
- Workers can upvote any complaint including their own
- Workers can comment on any complaint (comments are always tied to a worker or shown as anonymous)
- Workers can mark "Same happened to me" — this increments a separate `solidarity_count`, distinct from upvotes

### Advocate actions on grievances
- Tag with one or more category labels (free-text, auto-suggest from existing tags)
- Cluster: mark multiple complaints as belonging to the same cluster (assign a `cluster_id`)
- Escalation transitions: `open → tagged → escalated → resolved` (in order, no skipping)
- Resolution note: required when marking `resolved`; visible to workers who posted in that cluster

### Public feed rules
- Anyone (including logged-out) can read the grievance feed
- Logged-out users cannot post, upvote, or comment
- Worker-posted content is moderated by advocates before appearing in the public feed
- Filter options: platform, category, city zone, status

---

## Analytics Panel (Advocate only)

All data in this panel is **aggregate and anonymised**. No individual worker record is ever exposed.

### City-wide median comparison
- The worker dashboard shows a comparison bar: *"Your effective hourly rate vs. city median for [category]"*
- This median is computed from seeded aggregate data in the analytics service
- **Must not be hardcoded** — the value must come from `GET /api/analytics/median?category=ride-hailing&zone=lahore-central`

### Vulnerability flag logic
A worker is flagged as vulnerable if their net income dropped more than 20% month-on-month for the most recent completed month.

- The analytics service computes this — the frontend does not
- The advocate sees a list of anonymised identifiers (e.g. "Worker #4471") with their income trend
- Clicking a flagged worker shows their anonymised income chart and any associated complaints
- Advocate can "reach out" (internal message, if messaging is implemented) or "mark reviewed"

### Commission rate tracker
- Source: deduction percentages calculated from worker-logged shift data
- Display per platform over time (line chart)
- Show distribution, not just average — a box plot or band chart is preferred so outlier spikes are visible
- Filterable by city zone and worker category

---

## Privacy Rules the Frontend Must Enforce

These are not just design preferences — violating them would undermine the platform's trust.

1. Never display a worker's real name or ID in any cross-role view. Use anonymised identifiers in verifier queue, grievance feed, and advocate analytics.
2. The verifier queue shows only: city zone, platform, claimed gross/net, and screenshot thumbnail. No name, no identifier.
3. Advocate analytics expose only aggregate data. No drill-down to an individual worker's full history from the analytics panel.
4. Grievance board: anonymous posts must never leak the poster's identity — not in the DOM, not in network responses.

---

## Error & Loading State Standards

Apply these consistently across every screen.

| Situation | UI pattern |
|---|---|
| API call in flight | Skeleton loaders (not spinners) for content areas; spinner only for button actions |
| API error (5xx) | Inline error message in plain language ("Something went wrong. Try again.") — no raw error codes |
| Validation error | Inline beneath the field, red text, no alert popups |
| Empty state | Descriptive empty state with a call to action (e.g. "No shifts logged yet. Log your first shift →") |
| Session expired | Silent token refresh attempt; if failed, redirect to login with message "Your session expired. Please sign in again." |

---

## Accessibility Baseline

The primary user may have low digital literacy and be on a mid-range Android phone.

- Minimum tap target: 44×44px
- All form labels must be visible (no placeholder-only labels)
- All status badges must use both colour AND text (never colour alone)
- Font size: body minimum 16px, labels minimum 14px
- All images (screenshots, badges) must have descriptive `alt` text
- Forms must be keyboard-navigable
- Language: plain Urdu-familiar English. Avoid: "gross", "net", "deductions" without explanation. Prefer: "total earned", "amount received", "platform cut"

---

## Seeding & Demo Data Requirements

The following must work at demo time with seeded data (not hardcoded values):

- City-wide median endpoint returns a computed value from seeded shift records
- Advocate analytics panel shows meaningful charts (seed at least 50 workers × 12 weeks of shifts)
- Grievance feed has at least 10–15 varied complaints across platforms and categories
- Verifier queue has at least 3–5 screenshots pending review
- Anomaly service returns at least one flagged anomaly for a demonstrable crafted payload

---

## What the Judges Will Test

1. **Anomaly API directly** — `POST /api/anomaly/detect` with a crafted payload. Ensure it returns the documented response shape with human-readable `explanation` strings.
2. **Income certificate print** — they will print the certificate page. Ensure `@media print` works.
3. **City-wide median** — they will inspect the network call to confirm it is not a hardcoded value.
4. **Role isolation** — they will attempt to access advocate routes as a worker and vice versa.
5. **Verification flow end-to-end** — log shift → upload screenshot → verifier confirms → worker sees "Verified" badge.
6. **Grievance escalation** — post complaint → advocate tags → escalates → resolves with note → worker sees resolution.