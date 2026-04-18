"""FairGig ML Service — FastAPI entrypoint.

This service is the collective intelligence layer that complements
anomaly-service statistical detection with unsupervised pattern
recognition across workers. While anomaly-service detects individual
signals, this service surfaces systemic issues hiding in aggregate
grievance data.

Endpoints:
    POST /cluster  — TF-IDF + KMeans grievance clustering
    POST /trends   — weekly grievance volume trend analysis
    GET  /health   — liveness probe
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_local_path = os.path.join(root_dir, ".env.local")
env_path = os.path.join(root_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
if os.path.exists(env_local_path):
    load_dotenv(env_local_path, override=True)

from clustering.clusterer import determine_optimal_k, run_clustering
from clustering.vectorizer import build_tfidf_matrix
from models import (
    ClusterRequest,
    ClusterResponse,
    TrendRequest,
    TrendResponse,
)

app = FastAPI(
    title="FairGig ML Service",
    version="1.0.0",
    description=(
        "Unsupervised grievance clustering. "
        "Complements anomaly-service statistical detection "
        "with collective pattern recognition across workers."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "fairgig-ml"}


@app.post("/cluster", response_model=ClusterResponse)
def cluster_grievances(request: ClusterRequest):
    """Cluster grievances by topic using TF-IDF + KMeans.

    Accepts a list of GrievanceInput records and optional AnomalyContext
    objects from anomaly-service. When anomaly contexts are supplied, each
    ClusterResult is enriched with a cross-service correlation string showing
    how many workers in that cluster also have statistical anomalies.

    Returns a ClusterResponse with silhouette-validated k, per-cluster
    evidence, escalation candidates, and an optional platform-level insight.
    """
    if len(request.grievances) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 grievances to cluster",
        )

    try:
        # 1. Vectorize
        texts = [g.text for g in request.grievances]
        matrix, vectorizer = build_tfidf_matrix(texts)

        # 2. Select k via silhouette scoring
        optimal_k, avg_sil = determine_optimal_k(matrix)

        # 3. Run KMeans and build cluster results
        clusters = run_clustering(
            request.grievances,
            matrix,
            vectorizer,
            optimal_k,
            request.anomaly_contexts,
        )

        # 4. Dominant platform across all grievances
        dominant_platform = Counter(
            g.platform for g in request.grievances
        ).most_common(1)[0][0]

        # 5. Escalation candidates: critical or high severity clusters
        escalation_candidates = [
            c.label for c in clusters if c.severity in ("critical", "high")
        ]

        # 6. Cross-service insight: fires when any cluster's dominant platform
        #    also appears in the supplied anomaly contexts, indicating overlap
        #    between collective grievances and individual statistical signals.
        cross_service_insight = None
        if request.anomaly_contexts:
            anomaly_worker_ids = {ctx.worker_id for ctx in request.anomaly_contexts}
            for cluster in clusters:
                cluster_worker_ids = set(cluster.worker_ids)
                if cluster_worker_ids & anomaly_worker_ids:
                    platform = cluster.platform
                    cross_service_insight = (
                        f"Platform {platform} appears in both statistical anomaly "
                        f"flags and grievance clusters — systemic issue likely."
                    )
                    break

        return ClusterResponse(
            total_grievances=len(request.grievances),
            total_clusters=len(clusters),
            optimal_k=optimal_k,
            avg_silhouette_score=avg_sil,
            clusters=clusters,
            dominant_platform=dominant_platform,
            escalation_candidates=escalation_candidates,
            cross_service_insight=cross_service_insight,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


@app.post("/trends", response_model=TrendResponse)
def get_trends(body: TrendRequest):
    """Compute weekly grievance volume trend.

    Optionally filters to a single platform before bucketing grievances into
    ISO week strings. Compares first-half vs second-half total counts to
    determine whether complaints are trending upward.
    """
    # 1. Optional platform filter
    filtered = [
        g for g in body.grievances
        if not body.platform or g.platform == body.platform
    ]

    if not filtered:
        raise HTTPException(status_code=400, detail="No grievances found")

    # 2. Bucket into week keys
    weekly_counts: Counter = Counter()
    for g in filtered:
        try:
            d = datetime.fromisoformat(g.created_at.split("T")[0])
            week_key = d.strftime("%Y-W%W")
            weekly_counts[week_key] += 1
        except Exception:
            continue

    if not weekly_counts:
        raise HTTPException(
            status_code=422,
            detail="Could not parse any dates",
        )

    # 3. Trend computation: compare first vs second half of the date range
    sorted_weeks = sorted(weekly_counts.keys())
    peak_week = max(weekly_counts, key=weekly_counts.get)  # type: ignore[arg-type]

    mid = len(sorted_weeks) // 2
    first_total = sum(weekly_counts[w] for w in sorted_weeks[:mid])
    second_total = sum(weekly_counts[w] for w in sorted_weeks[mid:])
    is_trending_up = second_total > first_total

    return TrendResponse(
        platform=body.platform,
        weekly_counts=dict(weekly_counts),
        is_trending_up=is_trending_up,
        peak_week=peak_week,
        total=len(filtered),
    )
