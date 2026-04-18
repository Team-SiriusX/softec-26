# FairGig — UX Roadmap

> **Competition:** SOFTEC 2026 Web Dev · **Platform:** FairGig — Gig Worker Income & Rights  
> **Personas:** Gig Worker · Verifier · Advocate / Analyst · Worker Community

---

## Persona Quick Reference

| Persona | Primary goal | Key screens |
|---|---|---|
| Gig worker | Log earnings, get verified, prove income | Dashboard, Shift logger, Income certificate |
| Verifier | Review screenshots, flag anomalies | Verification queue, Dispute panel |
| Advocate / analyst | Spot systemic unfairness at scale | Analytics panel, Vulnerability flags |
| Worker community | Share rate intel, post complaints | Grievance board, Bulletin board |

---

## Phase 1 — Auth & Onboarding

*Foundation screens every user touches before accessing role-specific features.*

### 1.1 Sign Up / Login
- **Persona:** All roles
- **Service:** Auth service
- Email + password registration
- JWT token issuance on login
- Token refresh flow
- Role assignment during sign-up (worker / verifier / advocate)
- Simple, low-literacy-friendly UI — large tap targets, plain language

### 1.2 Role Selection Screen
- **Persona:** All roles
- **Service:** Auth service
- First-time prompt after registration to confirm role
- Short description of what each role does
- Sets dashboard routing and feature access

### 1.3 Worker Profile Setup
- **Persona:** Gig worker
- **Service:** Earnings service
- Collect: name, city zone, primary platform category (ride-hailing / food delivery / freelance / domestic)
- Used as baseline for anonymised city-wide median comparison
- Editable from settings later

---

## Phase 2 — Worker Earnings Core

*The primary worker workflow — logging, verifying, and reviewing earnings.*

### 2.1 Worker Dashboard
- **Persona:** Gig worker
- **Services:** Earnings service, Analytics service, Anomaly service
- Summary cards: this week's net earnings, total verified earnings, effective hourly rate
- City-wide median comparison bar (from seeded aggregate data — not hardcoded)
- Anomaly alert banner if the anomaly service flags unusual deductions
- Verification status overview (pending / verified / disputed)
- Quick-log CTA and certificate generation shortcut

### 2.2 Log a Shift
- **Persona:** Gig worker
- **Service:** Earnings service
- Fields: platform, date, hours worked, gross earned, platform deductions, net received
- Optional screenshot upload (links to verification flow)
- Plain language labels — avoid financial jargon
- Validation with inline error messages
- Supports bulk CSV import for tech-savvy users (secondary action, not prominent)

### 2.3 Earnings History
- **Persona:** Gig worker
- **Service:** Earnings service
- Chronological list of all logged shifts
- Filter by platform, date range, verification status
- Each row shows: date, platform, net earned, verification badge (pending / verified / flagged / unverifiable)
- Tap row to view shift detail and screenshot status

### 2.4 Shift Detail View
- **Persona:** Gig worker
- **Service:** Earnings service
- Full breakdown: gross, deductions, net, hours, effective hourly rate
- Uploaded screenshot thumbnail with verification status
- Verifier note (if flagged or disputed)
- Option to re-upload or edit unverified entries

### 2.5 Income Analytics (Worker View)
- **Persona:** Gig worker
- **Services:** Earnings service, Analytics service
- Weekly / monthly earnings trend chart
- Effective hourly rate over time
- Platform commission rate tracker (self-reported, trends over time)
- Comparison line: worker earnings vs anonymised city-wide median for their category
- Toggle between platforms if worker logs across multiple

---

## Phase 3 — Screenshot Verification Flow

*Human-in-the-loop verification that gives workers credibility without claiming automated accuracy.*

### 3.1 Worker — Upload Screenshot
- **Persona:** Gig worker
- **Service:** Earnings service
- Upload prompt on shift log or from shift detail view
- Accepted formats: image (JPEG, PNG)
- Displays "pending review" status immediately after upload
- Honest messaging: "A verifier will review this. It may take 24–48 hours."

### 3.2 Verifier Dashboard
- **Persona:** Verifier
- **Service:** Earnings service
- Queue of unreviewed screenshots sorted by submission date
- Each queue item: worker city zone (anonymised), platform, claimed gross/net, screenshot thumbnail
- Count of pending reviews, average review time

### 3.3 Verification Review Panel
- **Persona:** Verifier
- **Service:** Earnings service
- Full screenshot view alongside worker-entered figures
- Three actions:
  - **Confirm** — figures match screenshot
  - **Flag discrepancy** — with a free-text note explaining what doesn't match
  - **Mark unverifiable** — screenshot is unclear, missing, or unreadable
- Verification status immediately propagates to worker's profile and earnings record

### 3.4 Worker — Verification Status View
- **Persona:** Gig worker
- **Service:** Earnings service
- Notification or badge update when status changes
- If flagged: shows verifier note, offers option to re-upload or dispute
- Verification badge shown on public income certificate

---

## Phase 4 — Income Certificate

*A printable, shareable document workers can present to landlords, banks, or family.*

### 4.1 Certificate Generator
- **Persona:** Gig worker
- **Services:** Earnings service, Certificate renderer service
- Date range picker (any range, defaulting to last 3 months)
- Preview before generating
- Shows only verified earnings — unverified entries are excluded with a note
- One-click generate → renders HTML certificate page

### 4.2 Income Certificate Page
- **Persona:** Gig worker (shared externally)
- **Service:** Certificate renderer service
- Clean, print-friendly HTML layout (no nav, no chrome)
- Contains: worker name, date range, total verified earnings, breakdown by platform, verification count, generated date
- "Verified by FairGig" badge with honest disclaimer: "Self-reported earnings verified by community reviewers, not a financial institution."
- Print button + shareable link
- `@media print` CSS — no background colors, legible black-on-white

---

## Phase 5 — Grievance Board

*Community space for workers to surface complaints and for advocates to cluster and escalate them.*

### 5.1 Grievance Board (Worker View)
- **Persona:** Gig worker, Worker community
- **Service:** Grievance service (Node.js)
- Post a complaint: platform, category (commission change / deactivation / payment error / other), description
- Anonymous posting option
- See own submitted complaints and their status (open / tagged / escalated / resolved)
- Upvote similar complaints to signal scale

### 5.2 Grievance Feed (Community View)
- **Persona:** Worker community
- **Service:** Grievance service
- Public feed of complaints moderated by advocates
- Filter by platform, category, city zone
- Workers can comment or mark "same happened to me"
- Advocates' tags visible (e.g. "commission-spike", "mass-deactivation")

### 5.3 Advocate — Grievance Management Panel
- **Persona:** Advocate / analyst
- **Service:** Grievance service
- Full list of complaints with filtering and bulk actions
- Tag complaints with category labels
- Mark similar complaints as a cluster
- Escalation workflow: open → tagged → escalated → resolved
- Free-text resolution notes visible to workers

---

## Phase 6 — Advocate Analytics Panel

*Aggregate intelligence dashboard for spotting systemic patterns across the platform.*

### 6.1 Advocate Dashboard
- **Persona:** Advocate / analyst
- **Service:** Analytics service
- Commission rate trends by platform over time (sourced from worker-submitted earnings logs)
- Income distribution by city zone (box plot or median bands — anonymised)
- Top complaint categories this week
- Vulnerability flag list: workers whose income dropped more than 20% month-on-month

### 6.2 Vulnerability Flag Detail
- **Persona:** Advocate / analyst
- **Services:** Analytics service, Earnings service
- List of flagged workers (anonymised identifiers)
- Income trend for each flagged worker
- Associated complaints (if any)
- Option to reach out via platform's internal message or mark as reviewed

### 6.3 Platform Commission Tracker
- **Persona:** Advocate / analyst
- **Service:** Analytics service
- Per-platform commission rate over time, sourced from worker-logged deduction percentages
- Shows rate distribution (not just average) to expose outlier events
- Filterable by city zone and worker category

---

## Phase 7 — Anomaly Detection Integration

*Surfaces unusual patterns to workers in plain language, and exposes the logic via documented API.*

### 7.1 Anomaly Alert (Worker-facing)
- **Persona:** Gig worker
- **Service:** Anomaly service (Python FastAPI)
- Triggered after each new shift log
- If flagged: banner on worker dashboard with plain-language explanation
  - e.g. "Your platform deduction this week (34%) is significantly higher than your usual rate (22%). You may want to check your earnings breakdown."
- Worker can dismiss or report as a grievance directly from the alert

### 7.2 Anomaly Service API (Judge-callable endpoint)
- **Persona:** Judges (direct API call), Advocate / analyst
- **Service:** Anomaly service (Python FastAPI)
- `POST /detect` — accepts a worker's earnings history payload
- Returns: list of flagged anomalies, severity, and human-readable explanation per flag
- Fully documented endpoint with example request/response in README
- Logic: statistical z-score on deduction rates, rolling income drop detection (>20% month-on-month)

---

## Screen Inventory Summary

| Screen | Persona | Service(s) | Phase |
|---|---|---|---|
| Sign up / login | All | Auth | 1 |
| Role selection | All | Auth | 1 |
| Worker profile setup | Worker | Earnings | 1 |
| Worker dashboard | Worker | Earnings, Analytics, Anomaly | 2 |
| Log a shift | Worker | Earnings | 2 |
| Earnings history | Worker | Earnings | 2 |
| Shift detail view | Worker | Earnings | 2 |
| Income analytics | Worker | Earnings, Analytics | 2 |
| Upload screenshot | Worker | Earnings | 3 |
| Verifier dashboard | Verifier | Earnings | 3 |
| Verification review panel | Verifier | Earnings | 3 |
| Verification status (worker) | Worker | Earnings | 3 |
| Certificate generator | Worker | Earnings, Certificate renderer | 4 |
| Income certificate page | Worker (external) | Certificate renderer | 4 |
| Grievance board (post) | Worker | Grievance | 5 |
| Grievance feed (community) | Community | Grievance | 5 |
| Grievance management panel | Advocate | Grievance | 5 |
| Advocate dashboard | Advocate | Analytics | 6 |
| Vulnerability flag detail | Advocate | Analytics, Earnings | 6 |
| Platform commission tracker | Advocate | Analytics | 6 |
| Anomaly alert (worker) | Worker | Anomaly | 7 |
| Anomaly API endpoint | Judges, Advocate | Anomaly | 7 |

---

## Key UX Principles

**Accessible by default.** The platform must work for a non-tech-savvy rider. Plain language everywhere, large tap targets, minimal form steps, clear status feedback.

**Honest about what it can and cannot verify.** Verification status badges are explicit — "verified by a community reviewer" not "verified by FairGig." The income certificate includes a disclaimer.

**Privacy-first aggregation.** City-wide median and advocate analytics use anonymised, aggregate data only. Individual worker data is never exposed in public or cross-role views.

**Patterns individuals can't see alone.** The advocate panel and anomaly service exist specifically to surface systemic issues that no single worker would notice — commission spikes, income volatility clusters, deactivation waves.

**Service boundaries map to UX boundaries.** Each service owns a coherent set of screens. No screen should require knowledge of another service's internals.