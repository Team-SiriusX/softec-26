# FairGig Voice Agent + RAG Brief (Judge-Oriented)

## 1) Executive summary

FairGig already solves core pain points for gig workers: earnings logging, verification, anomaly detection, grievance reporting, analytics, and printable income certificates. The voice agent should be positioned as a bonus intelligence layer that improves accessibility, trust, and actionability for low-tech workers, not as a replacement for core evidence systems.

Recommended one-line pitch:

FairGig Voice Saathi is a bilingual, context-aware assistant that speaks with workers, explains their verified earnings and anomaly risks in simple language, and gives evidence-backed next-step advice while clearly stating what is verified versus inferred.

---

## 2) Refined problem framing for your app

### Original pain
- Gig workers cannot easily understand fragmented earnings data.
- Workers need practical guidance after an unfair event, not only charts.
- Many users are not comfortable with complex dashboards or long text.

### Refined FairGig-specific pain
- Workers can log data, but may still not know what to do next when income drops.
- Advocates can detect systemic issues, but workers need immediate, personalized coaching in Urdu/English.
- Trust requires explanations grounded in verified records and transparent confidence.

### Refined opportunity
Use voice to convert analytics into conversational guidance:
- explain: "what happened"
- advise: "what you can do today"
- prepare: "what evidence to gather"
- escalate: "when to post grievance or seek advocate help"

---

## 3) Current app context (minor to major, reality-based)

## Layer A: Foundation (already in place)
- Multi-role platform with worker, verifier, advocate paths.
- Central Next.js + Hono API gateway under /api.
- Better Auth-based session/user identity.
- Shared Postgres via Prisma.

## Layer B: Core worker trust features (already in place)
- Shift logging and deductions capture.
- Screenshot verification queue and status lifecycle.
- Worker dashboard analytics and trend visuals.
- Printable certificate generation and public verification endpoint.

## Layer C: Systemic fairness intelligence (already in place)
- FastAPI anomaly service for statistical flags and plain-language explanations.
- Node grievance service for complaint workflows and moderation states.
- ML clustering service for collective grievance pattern detection.
- Advocate analytics and vulnerability monitoring views.

## Layer D: Human action loop (partially complete)
- Worker can see personal trends and anomalies.
- Verifier can review evidence.
- Advocate can monitor macro patterns.
- Missing user-experience bridge: conversational assistant that turns this data into guided action.

## Layer E: Bonus voice intelligence (proposed)
- Voice + RAG assistant connected to existing APIs and role-aware context.
- Personal, explainable recommendations with source references.

---

## 4) Voice agent scope (hackathon-safe)

## Must-do scope (demo-safe)
- Push-to-talk interaction in worker dashboard.
- Urdu + English responses (auto language follow).
- Uses worker's own data context only.
- Gives 3 types of outputs:
  - suggestion (optimize shifts, reduce risk)
  - advice (steps after anomaly)
  - idea (income stability actions)
- Every answer includes:
  - evidence source tags (example: verified shifts, anomaly summary, city median)
  - confidence marker (high, medium, low)
  - a short disclaimer if advisory/legal certainty is limited.

## Should-do scope (if time allows)
- "Create grievance draft from this conversation" action.
- "Share to advocate" escalation handoff.
- Voice summary card saved to worker timeline.

## Avoid in hackathon scope
- Full duplex phone-grade real-time calls.
- Complex custom DSP pipeline.
- Heavy multi-agent orchestration.
- Advice that appears as legal judgment or guaranteed financial recommendation.

---

## 5) Why this is judge-strong

Judges usually reward:
- clear user pain resolution,
- technical depth with practical constraints,
- trust and explainability,
- measurable social impact,
- solid demo reliability.

This voice feature scores well if you emphasize:
- accessibility for low-tech workers,
- bilingual guidance,
- evidence-grounded responses,
- direct integration with anomaly, verification, grievance, and certificate flows,
- honest boundary handling (verified vs inferred).

---

## 6) Proposed architecture for Voice + RAG in FairGig

## 6.1 Recommended architecture choice

Use pipeline architecture (STT -> Retrieval -> LLM -> TTS), not opaque speech-to-speech, for hackathon judging.

Reason:
- better explainability,
- easier debugging,
- auditable text outputs,
- easier to show evidence and confidence.

## 6.2 Minimal service design

Add one bonus service: voice-agent-service (FastAPI or Node).

Responsibilities:
- accept text transcript (or audio if implemented),
- fetch role and worker context,
- run retrieval from existing services,
- build grounded prompt,
- return response + citations + confidence + suggested actions.

### Suggested endpoint contracts
- POST /voice/query
  - input: worker_id, role, locale, query_text
  - output: answer_text, sources[], confidence, next_actions[]
- POST /voice/transcribe (optional)
  - input: audio blob
  - output: transcript
- POST /voice/speak (optional)
  - input: text
  - output: audio stream/url

## 6.3 Retrieval design (RAG) using your current system

Use hybrid retrieval from live FairGig APIs plus lightweight text corpus.

Source group A: personal worker context
- shifts and net trends,
- verification states,
- recent anomalies,
- certificate totals/date ranges.

Source group B: systemic context
- city median comparisons,
- platform-level commission trends,
- grievance cluster trends relevant to worker category/platform.

Source group C: policy and guidance snippets
- "what to do when account deactivated"
- "how to document disputed deductions"
- "when to escalate to advocate"

### Retrieval strategy
- Structured retrieval first (API and SQL facts).
- Lightweight semantic/keyword retrieval for policy snippets.
- Merge into context bundle with strict token budget.

---

## 7) Trust and safety design (critical for judging)

## Hard rules
- Never claim a fact that is not retrieved from data.
- Distinguish clearly:
  - Verified fact
  - Estimated signal
  - Recommendation
- If confidence is low, say so.
- No absolute legal advice; suggest escalation paths.

## Response format rule
Each response should contain:
1. Short answer in user language.
2. Why (facts used).
3. What to do next (max 3 actions).
4. Caution/limitations sentence.

---

## 8) Prompt design pattern (grounded)

System behavior goals:
- plain-language,
- non-judgmental,
- action-oriented,
- worker-first tone,
- bilingual continuity,
- strict grounding.

Prompt sections:
- Role and persona: FairGig Worker Advisor.
- Grounding constraints: use only provided context bundle.
- Output schema: answer, evidence bullets, confidence, next actions.
- Refusal policy: if data missing, ask one concise clarifying question.

---

## 9) Evaluation metrics to show judges

## Quality metrics
- Grounding rate: percentage of claims tied to retrieved evidence.
- Advice usefulness score: user thumbs-up/down after each response.
- Hallucination incidents: target near zero in demo scenarios.

## Experience metrics
- First response latency target:
  - text mode <= 2.5s
  - voice mode <= 4s end-to-end in demo network.
- Conversation completion rate: user reaches an actionable step.

## Impact metrics (hackathon story)
- Time to understand income issue reduced.
- Number of guided grievance drafts created.
- Number of workers who generate certificate after voice guidance.

---

## 10) Incremental roadmap (minor to major)

## Phase 0 (today): text advisor MVP
- No audio yet.
- Chat box in worker dashboard.
- RAG over worker/anomaly/analytics context.

## Phase 1: voice input/output demo
- Add transcribe and speak endpoints.
- Push-to-talk only.
- Bilingual responses.

## Phase 2: action-integrated assistant
- "Create grievance draft" one-click.
- "Share context with advocate" workflow.
- "Generate certificate for this period" shortcut.

## Phase 3: proactive intelligence
- Triggered voice/text nudges after anomaly spikes.
- Personalized weekly fairness summary.
- Risk-prevention coaching loops.

---

## 11) Judge-facing demo flow (recommended)

1. Worker logs in and taps voice button.
2. Asks in Urdu: "Meri income itni kam kyun hui?"
3. Assistant explains:
   - recent drop,
   - deduction anomaly,
   - city median comparison.
4. Assistant proposes 3 actions:
   - review disputed shifts,
   - draft grievance,
   - generate certificate for evidence.
5. Worker taps "Create grievance draft".
6. Advocate view shows related cluster trend.

This demonstrates end-to-end value across personas, not just chatbot novelty.

---

## 12) Likely judge questions and strong answers

Q: How do you avoid hallucination?
A: Structured retrieval first, strict grounded prompt, response citations, confidence labeling, and explicit unknown handling.

Q: Why voice, not only dashboard?
A: Voice lowers friction for low-tech users and increases accessibility in multilingual contexts while preserving evidence-backed trust.

Q: Is this legally risky advice?
A: Assistant provides guidance, not legal determination. It routes high-risk cases to advocate workflows and clearly labels limitations.

Q: Does this replace your core platform?
A: No. It is a conversational layer over existing verified modules: logging, anomaly, grievance, analytics, and certificates.

---

## 13) Implementation recommendation for your current codebase

## Best immediate path
- Keep existing architecture untouched.
- Add a small voice-agent-service and call current /api routes as retrieval providers.
- Start with text-only grounded assistant in UI first.
- Add speech after text quality is stable.

## Why this path wins
- Lowest regression risk.
- Reuses your strongest completed modules.
- Demo reliability stays high.
- Easier to explain to judges in 2 to 3 minutes.

---

## 14) Final strategic advice

Treat voice as a usability amplifier, not a new product.

Your winning narrative should be:
- We already built the evidence engine.
- We now made it accessible and actionable through a context-aware bilingual advisor.
- Every recommendation is grounded in the worker's verified reality and system-level fairness signals.

If you keep this discipline, the bonus feature increases your score for innovation without weakening credibility.
