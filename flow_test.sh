set -e
BASE='http://localhost:3000'
ROOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
echo "ROOT_CODE=$ROOT_CODE"

TS=$(date +%s)
ADV_EMAIL="adv_$TS@example.com"
ADV_PASS='Passw0rd!123'
ADV_COOKIE="/tmp/adv_ai_model_cookie_$TS.txt"

echo "Signing up advocate..."
curl -s -c "$ADV_COOKIE" -b "$ADV_COOKIE" -X POST "$BASE/api/auth/sign-up/email" \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  -d "{\"name\":\"Advocate\",\"fullName\":\"Advocate User\",\"email\":\"$ADV_EMAIL\",\"password\":\"$ADV_PASS\",\"role\":\"ADVOCATE\"}" > /tmp/adv_signup.json

echo "Signing in advocate..."
curl -s -c "$ADV_COOKIE" -b "$ADV_COOKIE" -X POST "$BASE/api/auth/sign-in/email" \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  -d "{\"email\":\"$ADV_EMAIL\",\"password\":\"$ADV_PASS\"}" > /tmp/adv_signin.json

echo "Fetching queue..."
QUEUE=$(curl -s -c "$ADV_COOKIE" -b "$ADV_COOKIE" "$BASE/api/community/moderation/queue")
echo "QUEUE_RESP: $QUEUE"
QUEUE_COUNT=$(echo "$QUEUE" | jq -r '.data | length' || echo "0")
echo "QUEUE_COUNT=$QUEUE_COUNT"

POST_ID=$(echo "$QUEUE" | jq -r '.data[0].post.id // empty' 2>/dev/null || true)

if [[ -z "$POST_ID" ]]; then
  echo "No posts in queue, creating one..."
  WORK_EMAIL="worker_$TS@example.com"
  WORK_PASS='Passw0rd!123'
  WORK_COOKIE="/tmp/worker_ai_model_cookie_$TS.txt"

  curl -s -c "$WORK_COOKIE" -b "$WORK_COOKIE" -X POST "$BASE/api/auth/sign-up/email" \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d "{\"name\":\"Worker\",\"fullName\":\"Worker User\",\"email\":\"$WORK_EMAIL\",\"password\":\"$WORK_PASS\",\"role\":\"WORKER\"}" > /tmp/worker_signup.json
  curl -s -c "$WORK_COOKIE" -b "$WORK_COOKIE" -X POST "$BASE/api/auth/sign-in/email" \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d "{\"email\":\"$WORK_EMAIL\",\"password\":\"$WORK_PASS\"}" > /tmp/worker_signin.json

  CREATED=$(curl -s -c "$WORK_COOKIE" -b "$WORK_COOKIE" -X POST "$BASE/api/community/posts" \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d '{"title":"AI model test post title","body":"This is a diagnostic post body for advocate AI review model verification flow.","isAnonymous":false}')
  echo "CREATED_RESP: $CREATED"
  CREATED_ID=$(echo "$CREATED" | jq -r '.data.id')
  echo "CREATED_ID=$CREATED_ID"

  curl -s -c "$WORK_COOKIE" -b "$WORK_COOKIE" -X POST "$BASE/api/community/posts/$CREATED_ID/request-verification" \
    -H 'origin: http://localhost:3000' > /tmp/request_verification.json

  QUEUE=$(curl -s -c "$ADV_COOKIE" -b "$ADV_COOKIE" "$BASE/api/community/moderation/queue")
  QUEUE_COUNT=$(echo "$QUEUE" | jq -r '.data | length' || echo "0")
  POST_ID=$(echo "$QUEUE" | jq -r '.data[0].post.id // empty' 2>/dev/null || true)
  echo "QUEUE_COUNT_AFTER_CREATE=$QUEUE_COUNT"
fi

if [[ -z "$POST_ID" || "$POST_ID" == "null" ]]; then
  echo "ERROR=No post available for moderation queue"
  exit 1
fi

echo "TARGET_POST_ID=$POST_ID"

HTTP_STATUS=$(curl -s -o /tmp/ai_review_response.json -w "%{http_code}" \
  -c "$ADV_COOKIE" -b "$ADV_COOKIE" \
  -X PATCH "$BASE/api/community/moderation/posts/$POST_ID/ai-review" \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  --data '{"note":"model switch verification","includeRawResponse":true}')

echo "AI_REVIEW_STATUS=$HTTP_STATUS"
cat /tmp/ai_review_response.json

echo -e "\nSUMMARY:"
jq -r '{error, verificationStatus: .data.verificationStatus, trustScore: .data.trustScore, model: .data.aiReview.model, verdict: .data.aiReview.verdict, recommendation: .data.aiReview.recommendation, latencyMs: .data.aiReview.latencyMs, totalTokens: .data.aiReview.usage.totalTokens}' /tmp/ai_review_response.json
