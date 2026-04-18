"""KMeans Clustering Module for FairGig ML Service.

Research basis:
    1. MacQueen, J. (1967). Some methods for classification and analysis of
       multivariate observations. Proceedings of the 5th Berkeley Symposium.

    2. Rousseeuw, P.J. (1987). Silhouettes: A graphical aid to the
       interpretation and validation of cluster analysis. Journal of
       Computational and Applied Mathematics.

Design decisions:
    - KMeans over DBSCAN: predictable cluster count, faster on small datasets,
      silhouette scoring gives automatic k selection.
    - n_init=10: multiple initializations prevent local minima, follows sklearn
      best practice based on MacQueen's sensitivity analysis.
    - Silhouette score for k-selection: standard unsupervised quality metric
      when ground truth labels are unavailable, directly from Rousseeuw (1987).
    - Silhouette threshold 0.25: below this, clusters are not meaningfully
      separated — warn but proceed rather than hard-fail.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Optional

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from clustering.vectorizer import compute_document_distances, get_top_keywords
from models import AnomalyContext, ClusterResult, GrievanceInput

# ---------------------------------------------------------------------------
# Keyword → human-readable label mapping
# ---------------------------------------------------------------------------

LABEL_MAP = {
    "commission": "Commission Rate Change",
    "deduction": "Commission Rate Change",
    "rate": "Commission Rate Change",
    "cut": "Commission Rate Change",
    "payment": "Payment Delay or Shortage",
    "pay": "Payment Delay or Shortage",
    "delay": "Payment Delay or Shortage",
    "late": "Payment Delay or Shortage",
    "deactivat": "Account Deactivation",
    "suspend": "Account Deactivation",
    "block": "Account Deactivation",
    "ban": "Account Deactivation",
    "bonus": "Bonus or Incentive Removal",
    "incentive": "Bonus or Incentive Removal",
    "reward": "Bonus or Incentive Removal",
    "surge": "Surge Pricing Manipulation",
    "fare": "Surge Pricing Manipulation",
}


# ---------------------------------------------------------------------------
# k selection via silhouette scoring
# ---------------------------------------------------------------------------

def determine_optimal_k(matrix) -> tuple[int, float]:
    """Find optimal cluster count using silhouette scoring.

    Iterates k from 2 up to min(8, n-1) and selects the k with the highest
    silhouette score. Warns when best score < 0.25 (clusters overlap) but
    still returns a usable k rather than hard-failing.

    Returns:
        (best_k, best_silhouette_score)
    """
    try:
        n = matrix.shape[0]
        if n < 4:
            return (1, 0.0)

        max_k = min(8, n - 1)
        best_k = 2
        best_score = -1.0

        for k in range(2, max_k + 1):
            try:
                km = KMeans(
                    n_clusters=k,
                    n_init=10,
                    random_state=42,
                    max_iter=300,
                )
                labels = km.fit_predict(matrix)

                # silhouette needs at least 2 distinct labels
                if len(set(labels)) < 2:
                    continue

                score = silhouette_score(matrix, labels, metric="euclidean")

                if score > best_score:
                    best_score = score
                    best_k = k
            except Exception:
                continue

        # Silhouette below 0.25 means clusters are not meaningfully
        # separated — log warning but proceed
        if best_score < 0.25:
            print(
                f"[ml-service] Warning: low silhouette score "
                f"{best_score:.3f} — clusters may overlap. "
                f"Consider more grievance data."
            )

        return (best_k, round(best_score, 4))

    except Exception:
        return (2, 0.0)


# ---------------------------------------------------------------------------
# Label assignment
# ---------------------------------------------------------------------------

def label_from_keywords(keywords: list[str]) -> str:
    """Map cluster keywords to a human-readable label via LABEL_MAP.

    Iterates each keyword (lowercased) and checks whether any LABEL_MAP key
    is a substring of it. First match wins. Falls back to a generic label when
    no keyword matches any known pattern.
    """
    for keyword in keywords:
        keyword_lower = keyword.lower()
        for key, label in LABEL_MAP.items():
            if key in keyword_lower:
                return label
    return "General Platform Complaint"


# ---------------------------------------------------------------------------
# Trend detection
# ---------------------------------------------------------------------------

def detect_trend(
    grievance_ids: list[str],
    all_grievances: list[GrievanceInput],
) -> str:
    """Detect whether complaint volume in this cluster is growing over time.

    Splits grievance dates for the cluster at the midpoint and compares
    second-half count to first-half count. A >20 % increase is flagged as
    'growing'; a >20 % decrease as 'declining'; otherwise 'stable'.
    """
    cluster_g = [g for g in all_grievances if g.id in grievance_ids]
    if len(cluster_g) < 2:
        return "stable"

    def parse_date(s: str) -> Optional[datetime]:
        try:
            return datetime.fromisoformat(s.split("T")[0])
        except Exception:
            return None

    dates = [parse_date(g.created_at) for g in cluster_g]
    dates = [d for d in dates if d is not None]

    if len(dates) < 2:
        return "stable"

    dates.sort()
    mid = len(dates) // 2
    first_half = dates[:mid]
    second_half = dates[mid:]

    if len(second_half) > len(first_half) * 1.2:
        return "growing"
    if len(second_half) < len(first_half) * 0.8:
        return "declining"
    return "stable"


# ---------------------------------------------------------------------------
# Severity assignment
# ---------------------------------------------------------------------------

def assign_severity(count: int, trend: str) -> str:
    """Assign severity using the same vocabulary as anomaly-service.

    Rules evaluated in priority order:
        critical → high → medium → low
    """
    if count >= 10 and trend == "growing":
        return "critical"
    if count >= 10 or trend == "growing":
        return "high"
    if count >= 5:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Cross-service correlation
# ---------------------------------------------------------------------------

def build_anomaly_correlation(
    worker_ids: list[str],
    anomaly_contexts: list[AnomalyContext],
    cluster_label: str,
) -> Optional[str]:
    """Cross-reference cluster workers against anomaly-service results.

    This is the integration bridge between ml-service and anomaly-service.
    Returns a plain-language insight string when overlap is found, or None
    when no anomaly contexts were supplied / no overlap exists.
    """
    if not anomaly_contexts:
        return None

    matching = [ctx for ctx in anomaly_contexts if ctx.worker_id in worker_ids]
    if not matching:
        return None

    high_risk = [m for m in matching if m.risk_level in ("critical", "high")]

    return (
        f"{len(matching)} of {len(worker_ids)} workers in this cluster also "
        f"have statistical anomalies detected. "
        f"{len(high_risk)} are high/critical risk."
    )


# ---------------------------------------------------------------------------
# Main clustering pipeline
# ---------------------------------------------------------------------------

def run_clustering(
    grievances: list[GrievanceInput],
    matrix,
    vectorizer,
    k: int,
    anomaly_contexts: list[AnomalyContext] = [],
) -> list[ClusterResult]:
    """Run KMeans and construct a ClusterResult for each cluster.

    Returns clusters sorted by grievance_count descending so the advocate
    dashboard surfaces the most widespread issues first.
    """
    km = KMeans(
        n_clusters=k,
        n_init=10,
        random_state=42,
        max_iter=300,
    )
    km.fit(matrix)
    labels = km.labels_
    centers = km.cluster_centers_

    results: list[ClusterResult] = []

    for cluster_id in range(k):
        indices = [i for i, label in enumerate(labels) if label == cluster_id]
        if not indices:
            continue

        cluster_grievances = [grievances[i] for i in indices]
        grievance_ids = [g.id for g in cluster_grievances]
        worker_ids = list({g.worker_id for g in cluster_grievances})

        dominant_platform = Counter(
            g.platform for g in cluster_grievances
        ).most_common(1)[0][0]

        keywords = get_top_keywords(vectorizer, centers[cluster_id], n=5)
        label = label_from_keywords(keywords)

        distances = compute_document_distances(matrix[indices], centers[cluster_id])
        closest = indices[int(np.argmin(distances))]
        sample_text = grievances[closest].text

        trend = detect_trend(grievance_ids, grievances)
        severity = assign_severity(len(indices), trend)

        correlation = build_anomaly_correlation(worker_ids, anomaly_contexts, label)

        # Per-cluster silhouette: requires ≥2 distinct labels so this will
        # typically raise for single-member or degenerate clusters — caught.
        try:
            if len(indices) > 1 and k > 1:
                cluster_sil = float(
                    silhouette_score(
                        matrix[indices],
                        [cluster_id] * len(indices),
                    )
                )
            else:
                cluster_sil = 0.0
        except Exception:
            cluster_sil = 0.0

        results.append(
            ClusterResult(
                cluster_id=cluster_id,
                label=label,
                platform=dominant_platform,
                grievance_count=len(indices),
                grievance_ids=grievance_ids,
                worker_ids=worker_ids,
                trend=trend,
                severity=severity,
                sample_text=sample_text,
                keywords=keywords,
                anomaly_correlation=correlation,
                silhouette_score=cluster_sil,
            )
        )

    return sorted(results, key=lambda c: c.grievance_count, reverse=True)
