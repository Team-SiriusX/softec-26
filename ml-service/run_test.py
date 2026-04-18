import json
import urllib.request

with open("test_payload.json", "rb") as f:
    data = f.read()

req = urllib.request.Request(
    "http://localhost:8002/cluster",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
res = urllib.request.urlopen(req)
body = json.loads(res.read())

# Top-level summary
summary = {
    "total_grievances": body["total_grievances"],
    "total_clusters": body["total_clusters"],
    "optimal_k": body["optimal_k"],
    "avg_silhouette_score": body["avg_silhouette_score"],
    "dominant_platform": body["dominant_platform"],
    "escalation_candidates": body["escalation_candidates"],
    "cross_service_insight": body["cross_service_insight"],
}
print("=== TOP-LEVEL ===")
print(json.dumps(summary, indent=2))

# Per-cluster view
print("\n=== CLUSTERS ===")
for c in body["clusters"]:
    print(
        f"  [{c['cluster_id']}] {c['label']:35s} | "
        f"count={c['grievance_count']} | "
        f"platform={c['platform']:10s} | "
        f"severity={c['severity']:8s} | "
        f"sil={c['silhouette_score']:.4f}"
    )
    if c["anomaly_correlation"]:
        print(f"       correlation: {c['anomaly_correlation']}")
    print(f"       keywords: {c['keywords']}")
