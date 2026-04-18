# FairGig — ML Grievance Clustering Service

Collective intelligence layer for gig worker complaints. Complements statistical anomaly detection with unsupervised pattern recognition across workers.

## AI Model Context For Vibe Coding

This section gives an AI coding agent the shortest accurate context needed to modify this service safely.

### What the model is

- Unsupervised NLP pipeline built per request:
  - TF-IDF vectorization
  - LSA-style dimensionality reduction via TruncatedSVD
  - KMeans clustering
  - silhouette-based k selection
- No pretrained deep model and no external model API dependency.

### What the model is not

- Not a supervised classifier.
- Not a persisted embedding index.
- Not a neural network service.
- Not dependent on anomaly-service to function.

### Non-negotiable invariants

1. The service must run fully offline with request data only.
2. `optimal_k` must be data-driven (silhouette selection), not hardcoded.
3. Cluster outputs must remain explainable: label, keywords, sample text, severity.
4. Cross-service anomaly correlation must be additive context, not a hard dependency.

### Current model pipeline details

- Vectorizer config currently uses:
  - max_features 500
  - ngram_range (1, 2)
  - stop_words english
  - min_df 1
  - max_df 0.95
  - sublinear_tf true
- Dimensionality reduction:
  - TruncatedSVD with adaptive component clamp for small corpora
  - L2 normalization after SVD
- Clustering:
  - KMeans with n_init 10, random_state 42
  - k search over bounded range with silhouette scoring

### Why this matters for vibe coding agents

- You can ship fast without model-download complexity.
- Every output artifact can be explained to judges with transparent math.
- Small accidental parameter changes can alter cluster quality dramatically, so treat vectorizer and k-selection settings as high-impact configuration.

### Safe change checklist for AI agents

- Keep request/response schemas backward compatible.
- Keep trend and severity semantics stable unless explicitly changing product behavior.
- Preserve anomaly-context optionality (`anomaly_contexts` may be empty).
- If changing label heuristics, verify no major drop in interpretability.
- If changing k bounds or silhouette logic, document rationale and expected behavior on small datasets.

### Integration contract with anomaly-service

- `anomaly_contexts` is keyed by worker_id and used for overlap insights.
- Cluster generation does not require anomaly data.
- Correlation strings and cross-service insight are informational overlays.

### Do not regress

- `/cluster` and `/trends` endpoint availability and schema shape.
- Offline operation without API keys.
- Human-readable and evidence-backed cluster outputs.

## Architecture Role

The anomaly-service detects individual statistical signals — a single worker's deduction rate spiking, their hourly income collapsing below a rolling median. This service operates at a different layer: it finds collective patterns across workers, grouping complaints by topic to reveal whether an issue is isolated or systemic. Together, the two services give advocates both individual evidence (statistical anomalies per worker) and systemic proof (clusters of workers reporting the same issue at the same time on the same platform). One layer alone is insufficient — the combination is the argument.

## Quick Start

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

Swagger UI: http://localhost:8002/docs

## No Model Downloads Required

TF-IDF vocabulary and KMeans centroids are computed fresh from each request. There are no pretrained weight files, no Hugging Face downloads, no `OPEN_ROUTER_API_KEY` or any other API key required. The service is fully self-contained and works offline. The only dependency is the grievance text passed in the request body.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/cluster` | `ClusterRequest` → `ClusterResponse` — TF-IDF + KMeans clustering |
| `POST` | `/trends` | `TrendRequest` → `TrendResponse` — weekly volume trend analysis |

## Algorithm Decisions

| Choice | Alternative Considered | Reason |
|---|---|---|
| TF-IDF with `sublinear_tf=True` | Word2Vec / BERT | No pretrained model needed, interpretable feature weights, validated for short domain-specific texts (Salton & Buckley 1988). Judges can inspect centroid weights directly. |
| KMeans with `n_init=10` | DBSCAN | Predictable cluster count, silhouette scoring gives automatic k selection, faster on small datasets (MacQueen 1967). DBSCAN requires tuning epsilon per dataset. |
| Silhouette score k-selection | Elbow method | Quantitative optimum without visual inspection, standard unsupervised quality metric when ground truth labels are unavailable (Rousseeuw 1987). |
| `sublinear_tf=True` | Raw term frequency | Log normalization reduces repeated-keyword bias — workers emphasize words for emotional impact, not semantic frequency. Prevents a single repeated term from dominating the cluster centroid. |

## Anomaly Service Integration

The `ClusterRequest` accepts an optional `anomaly_contexts` array containing results from anomaly-service calls. Each entry carries a `worker_id`, `anomaly_types`, and `risk_level`.

When provided, two things happen:

1. **Per-cluster correlation**: Each `ClusterResult` gains an `anomaly_correlation` string — e.g. `"4 of 6 workers in this cluster also have statistical anomalies detected. 3 are high/critical risk."` This is computed by cross-referencing `ClusterResult.worker_ids` against the supplied contexts.

2. **Top-level insight**: The `ClusterResponse.cross_service_insight` field fires when any cluster's workers overlap with anomaly-flagged workers — e.g. `"Platform Careem appears in both statistical anomaly flags and grievance clusters — systemic issue likely."` This is the single most actionable output for an advocate preparing a case.

To use it, pipe anomaly-service `/analyze` results into the `anomaly_contexts` field of `/cluster`:

```bash
# 1. Get anomaly results from anomaly-service (port 8001)
# 2. Pass worker_id, anomaly_types, risk_level into anomaly_contexts
# 3. POST to ml-service /cluster (port 8002)
```

## Test

```bash
curl -X POST http://localhost:8002/cluster \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

**Expected output** (15 grievances, 4 clusters):

| Cluster Label | Count | Platform | Anomaly Correlation |
|---|---|---|---|
| Commission Rate Change | 6 | Careem | 4 of 6 workers flagged by anomaly-service |
| Payment Delay or Shortage | 4 | Foodpanda | — |
| Account Deactivation | 3 | Careem | — |
| Bonus or Incentive Removal | 2 | Bykea | — |

`optimal_k` is computed by silhouette scoring over `k=2..8`, not hardcoded. `cross_service_insight` will name Careem as the systemic overlap platform given the supplied `anomaly_contexts`.

**Trend endpoint:**

```bash
curl -X POST http://localhost:8002/trends \
  -H "Content-Type: application/json" \
  -d '{"grievances": [...], "platform": "Careem"}'
```

## Research Basis

1. Salton, G. & Buckley, C. (1988). *Term-weighting approaches in automatic text retrieval*. Information Processing & Management.
2. MacQueen, J. (1967). *Some methods for classification and analysis of multivariate observations*. Proceedings of the 5th Berkeley Symposium.
3. Rousseeuw, P.J. (1987). *Silhouettes: A graphical aid to the interpretation and validation of cluster analysis*. Journal of Computational and Applied Mathematics.
4. Dubal, V. (2023). *On Algorithmic Wage Discrimination*. Columbia Law Review. — Collective grievance patterns as evidence of systemic wage discrimination.
