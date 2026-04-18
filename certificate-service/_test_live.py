"""
End-to-end test: hit the running certificate service and print the full error.
"""
import urllib.request
import urllib.parse
import json
import os
from dotenv import load_dotenv

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(root, ".env"))
load_dotenv(os.path.join(root, ".env.local"), override=True)

BASE = "http://127.0.0.1:8004"

# 1. Health check
print("=== /health ===")
with urllib.request.urlopen(f"{BASE}/health") as r:
    print(r.read().decode())

# 2. Sample (no auth needed)
print("\n=== /certificate/sample (first 200 chars) ===")
try:
    with urllib.request.urlopen(f"{BASE}/certificate/sample") as r:
        print(r.read(200).decode())
except Exception as e:
    print("FAIL:", e)

# 3. Preview with a real worker id from the DB
print("\n=== /certificate/preview ===")
params = urllib.parse.urlencode({
    "worker_id": "hXkP9XI9pt54rUD8jR0WskZp6nfF844u",
    "from_date": "2025-10-18",
    "to_date": "2026-04-18",
    "include_unverified": "true",
})
try:
    with urllib.request.urlopen(f"{BASE}/certificate/preview?{params}") as r:
        print("Status:", r.status)
        print(r.read(300).decode())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print("HTTP Error:", e.code, e.reason)
    print("Detail:", body)

# 4. POST /certificate/generate
print("\n=== POST /certificate ===")
payload = json.dumps({
    "worker_id": "hXkP9XI9pt54rUD8jR0WskZp6nfF844u",
    "from_date": "2025-10-18",
    "to_date": "2026-04-18",
    "include_unverified": True,
}).encode()
req = urllib.request.Request(
    f"{BASE}/certificate",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
        print("certificate_id:", data.get("certificate_id"))
        print("html length:", len(data.get("html", "")))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print("HTTP Error:", e.code, e.reason)
    print("Detail:", body)
