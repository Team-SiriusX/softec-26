SOFTEC Society, FAST-NU
Block-B, Faisal Town,
## Lahore, Pakistan
E-Mail: info@softecnu.org
## SOFTEC 2026
## Web Dev Competition

FairGig — Gig Worker Income & Rights Platform

A real-world problem at the intersection of labour rights, financial transparency, and
the informal gig economy.

Background & problem statement

Pakistan has millions of gig workers like ride-hailing drivers, food delivery riders,
freelance designers, domestic workers; who earn income across multiple platforms
with no unified record, no payslip, and no protection when platforms change
commission rates overnight or deactivate accounts without explanation.
These workers cannot prove their income to landlords, banks, or family. They have
no visibility into whether the platform is fairly calculating their earnings. They
have no community to collectively surface grievances or share rate intelligence.
Your task is to build FairGig, a platform that empowers gig workers to log, verify,
and understand their earnings across platforms and gives labour advocates a
dashboard to spot systemic unfairness at scale.
The platform must work for a rider who is not tech-savvy, be honest about what it can
and cannot verify, and surface patterns that an individual worker would never see
Foundation for Advancement of Science & Technology




SOFTEC Society, FAST-NU
Block-B, Faisal Town,
## Lahore, Pakistan
E-Mail: info@softecnu.org
alone.
User personas
Gig worker  Verifier  Advocate /
analyst
## Worker
community
Logs shifts and
earnings,
uploads platform
screenshots for
verification,
views
income analytics,
generates a
shareable
income report

## Reviews
uploaded
earnings
screenshots,
flags anomalies,
approves or
disputes a
workers
submitted
earnings record.

## Monitors
aggregate
trends;
commission rate
changes across
platforms, income
volatility by city
zone,
deactivation
complaint
clusters.
## Anonymous
bulletin
board where
workers
post rate intel,
platform
complaints, and
support
requests are then
moderated by
advocates.

Core functional requirements
● Earnings logger: workers log shifts with platform, date, hours worked, gross
earned, platform deductions, and net received. Supports bulk CSV import for
tech-savvy users.
● Screenshot verification flow: workers upload a platform earnings screenshot; a
verifier reviews it and either confirms, flags a discrepancy, or marks it unverifiable.
Foundation for Advancement of Science & Technology




SOFTEC Society, FAST-NU
Block-B, Faisal Town,
## Lahore, Pakistan
E-Mail: info@softecnu.org
Verification status is shown on the worker's profile.
● Income analytics dashboard (worker view) : weekly/monthly earnings trends,
effective hourly rate over time, platform commission rate tracker, and a comparison
against the anonymised city-wide median for their category.
● Shareable income certificate: a worker can generate a clean, printable income
summary (PDF-style HTML page) covering any date range, showing verified
earnings. Designed for use with landlords or banks.
● Grievance board : workers post complaints (platform, category, description).
Advocates can tag, cluster similar complaints, and mark them escalated or resolved.
● Advocate analytics panel : aggregate view of commission rates reported across
platforms over time, income distribution by city zone, top complaint categories this
week, and workers whose income dropped more than 20% month-on-month
(vulnerability flag).
● Anomaly detection service : a FastAPI service that, given a worker's recent earnings
log, flags statistically unusual deductions or sudden income drops and returns a
human-readable explanation.
Required service architecture
Services must be logically separated with clear REST API boundaries. There is
no Docker compulsion, each service must be independently runnable with a
single start command and a README. Inter-service communication via REST or
a lightweight event mechanism.
Foundation for Advancement of Science & Technology




SOFTEC Society, FAST-NU
Block-B, Faisal Town,
## Lahore, Pakistan
E-Mail: info@softecnu.org
● Auth service
JWT login, role management (worker, verifier, advocate), token refresh.
● Earnings service
CRUD for shift logs, CSV import, screenshot upload reference, verification status
tracking.
● Anomaly service
Python FastAPI. Accepts a worker's earnings history, returns flagged anomalies
with plain-language explanations.
● Grievance service
Node.js. Complaint CRUD, tagging, clustering similar complaints,
escalation workflow.
● Analytics service
Aggregate KPIs for the advocate panel. Platform commission trends,
income distributions, vulnerability flags.
● Certificate renderer
Dedicated service that generates a clean printable HTML income certificate
from verified earnings data.
Technical constraints
● The anomaly detection service must be Python FastAPI. At least one other
backend service must also be FastAPI.
● The grievance service must be Node.js.
Foundation for Advancement of Science & Technology




SOFTEC Society, FAST-NU
Block-B, Faisal Town,
## Lahore, Pakistan
E-Mail: info@softecnu.org
● Frontend in React or Angular. No WordPress, no low-code platforms.
● Database choice is free, teams must justify it during evaluation, particularly around
how anonymised aggregate queries are handled without exposing individual
worker data.
● The city-wide median comparison on the worker dashboard must use real
aggregated data from seeded records not hardcoded values.
● The anomaly service must expose its detection logic as a documented API
endpoint, judges will call it directly with a crafted payload.
● All inter-service API contracts must be documented, a simple table or
Postman collection is sufficient.
● The income certificate page must be print-friendly.

Foundation for Advancement of Science & Technology
