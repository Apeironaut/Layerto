#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Layerto Documentation Validator (SPEC §13 / M5)
# Validates that curl, Python, and JavaScript examples in /docs work out-of-the-box
# against the local core with MODEL_FAKE=1 and return HTTP 200.
# ==============================================================================

export PATH="/usr/local/go/bin:/home/naviya-c/.nvm/versions/node/v24.15.0/bin:$PATH"

PORT="${PORT:-8080}"
API_URL="http://localhost:${PORT}"
CORE_PID=""

cleanup() {
  if [ -n "$CORE_PID" ]; then
    echo "Stopping test core server (PID $CORE_PID)..."
    kill "$CORE_PID" 2>/dev/null || true
    wait "$CORE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "=== 1. Checking Core Service on $API_URL ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/healthz" || echo "000")

if [ "$STATUS" != "200" ]; then
  echo "Core service not running on port $PORT. Starting local core with MODEL_FAKE=1..."
  (cd services/core && MODEL_FAKE=1 PORT="$PORT" go run ./cmd/core) &
  CORE_PID=$!

  # Wait for healthz
  for i in {1..30}; do
    if curl -s "$API_URL/healthz" | grep -q '"ok"'; then
      echo "Core service started successfully (PID $CORE_PID)."
      break
    fi
    sleep 0.5
  done

  # Verify core responded
  if ! curl -s "$API_URL/healthz" | grep -q '"ok"'; then
    echo "ERROR: Failed to start core service on port $PORT."
    exit 1
  fi
else
  echo "Core service is running on port $PORT."
fi

# Ensure sample-turtle.jpg exists
if [ ! -f "sample-turtle.jpg" ]; then
  if [ -f "test.jpg" ]; then
    cp test.jpg sample-turtle.jpg
  else
    echo "ERROR: sample-turtle.jpg and test.jpg missing."
    exit 1
  fi
fi

echo "=== 2. Setting Up Test API Key ==="
# Create test admin user (idempotent; if exists, reset password)
ADMIN_EMAIL="docs-validator@layerto.test"
(cd services/core && echo "adminpass1234" | go run ./cmd/core create-admin --email "$ADMIN_EMAIL" --password-stdin 2>/dev/null) || \
  (cd services/core && echo "adminpass1234" | go run ./cmd/core create-admin --email "$ADMIN_EMAIL" --password-stdin --reset-password >/dev/null)

# Get user ID from database
USER_ID=$(docker exec layerto-postgres psql -U layerto -d layerto -t -A -c "SELECT id FROM users WHERE email = '$ADMIN_EMAIL';")
if [ -z "$USER_ID" ]; then
  echo "ERROR: Could not retrieve user ID for $ADMIN_EMAIL"
  exit 1
fi

# Ensure user has free quota / balance
docker exec layerto-postgres psql -U layerto -d layerto -c "UPDATE balances SET free_used = 0, balance = 1000000 WHERE user_id = '$USER_ID';" >/dev/null

# Create a fresh API key
KEY_OUTPUT=$(cd services/core && go run ./cmd/core create-key --user "$USER_ID" --name "docs-validator-key")
API_KEY=$(echo "$KEY_OUTPUT" | grep '^Key:' | awk '{print $2}' | tr -d '\r')

if [ -z "$API_KEY" ]; then
  echo "ERROR: Failed to generate API key."
  exit 1
fi

echo "Using API Key: ${API_KEY:0:15}..."

echo "=== 3. Testing curl Documentation Examples ==="
echo "Testing curl /v1/vision/turtle-id..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/v1/vision/turtle-id" \
  -H "Authorization: Bearer $API_KEY" \
  -F "image=@sample-turtle.jpg")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: curl direct model call failed with HTTP $HTTP_CODE"
  exit 1
fi
echo "✓ curl direct model call returned 200 OK"

echo "Testing curl /v1/vision/auto..."
HTTP_CODE_AUTO=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/v1/vision/auto" \
  -H "Authorization: Bearer $API_KEY" \
  -F "image=@sample-turtle.jpg" \
  -F "prompt=sea turtle")

if [ "$HTTP_CODE_AUTO" != "200" ]; then
  echo "ERROR: curl auto model call failed with HTTP $HTTP_CODE_AUTO"
  exit 1
fi
echo "✓ curl auto model call returned 200 OK"

echo "=== 4. Testing Python Documentation Examples ==="
python3 -c "
import requests

api_url = '$API_URL'
key = '$API_KEY'
headers = {'Authorization': f'Bearer {key}'}

# 1. Direct call
with open('sample-turtle.jpg', 'rb') as f:
    files = {'image': ('sample-turtle.jpg', f, 'image/jpeg')}
    resp = requests.post(f'{api_url}/v1/vision/turtle-id', headers=headers, files=files)

assert resp.status_code == 200, f'Expected 200 for direct call, got {resp.status_code}: {resp.text}'
json_data = resp.json()
assert json_data.get('model') == 'turtle-id', f'Unexpected model: {json_data}'
assert 'predictions' in json_data and len(json_data['predictions']) > 0

# 2. Auto call
with open('sample-turtle.jpg', 'rb') as f:
    files = {'image': ('sample-turtle.jpg', f, 'image/jpeg')}
    data = {'prompt': 'sea turtle'}
    resp_auto = requests.post(f'{api_url}/v1/vision/auto', headers=headers, files=files, data=data)

assert resp_auto.status_code == 200, f'Expected 200 for auto call, got {resp_auto.status_code}: {resp_auto.text}'
json_auto = resp_auto.json()
assert json_auto.get('routed') == 'auto'
print('✓ Python requests direct and auto calls returned 200 OK')
"

echo "=== 5. Testing JavaScript (fetch) Documentation Examples ==="
node --input-type=module -e "
import fs from 'node:fs';

const apiUrl = '$API_URL';
const key = '$API_KEY';
const imageBuffer = fs.readFileSync('sample-turtle.jpg');

// 1. Direct call
const formDirect = new FormData();
formDirect.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'sample-turtle.jpg');

const resDirect = await fetch(\`\${apiUrl}/v1/vision/turtle-id\`, {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${key}\` },
  body: formDirect,
});

if (resDirect.status !== 200) {
  const err = await resDirect.text();
  throw new Error(\`Direct call failed: \${resDirect.status}: \${err}\`);
}
const directData = await resDirect.json();
if (directData.model !== 'turtle-id' || !directData.predictions?.length) {
  throw new Error(\`Invalid direct response structure: \${JSON.stringify(directData)}\`);
}

// 2. Auto call
const formAuto = new FormData();
formAuto.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'sample-turtle.jpg');
formAuto.append('prompt', 'sea turtle');

const resAuto = await fetch(\`\${apiUrl}/v1/vision/auto\`, {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${key}\` },
  body: formAuto,
});

if (resAuto.status !== 200) {
  const err = await resAuto.text();
  throw new Error(\`Auto call failed: \${resAuto.status}: \${err}\`);
}
const autoData = await resAuto.json();
if (autoData.routed !== 'auto' || !autoData.predictions?.length) {
  throw new Error(\`Invalid auto response structure: \${JSON.stringify(autoData)}\`);
}

console.log('✓ JavaScript fetch direct and auto calls returned 200 OK');
"

echo "=========================================================="
echo "SUCCESS: All documentation examples (curl, Python, JS) verified against local core!"
echo "=========================================================="
