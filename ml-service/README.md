# FairGig — ML Grievance Clustering Service

Collective intelligence layer for gig worker complaints. Complements statistical anomaly detection with unsupervised pattern recognition across workers.

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
