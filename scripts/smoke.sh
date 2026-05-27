#!/usr/bin/env bash
# Smoke test: validates health, auth, tasks, analytics, and audit endpoints.
# Usage: API_URL=https://your-api.onrender.com ./scripts/smoke.sh

set -uo pipefail

API_URL="${API_URL:-http://localhost:3333}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local status="$2"
  local expected="${3:-200}"
  if [ "$status" = "$expected" ]; then
    echo "  PASS  $name (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name (expected $expected, got $status)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== Smoke Tests: $API_URL ==="
echo ""

# Health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
check "GET /api/health" "$STATUS"

# Login
LOGIN_BODY=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@techcorp.com","password":"password123"}')
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@techcorp.com","password":"password123"}')
check "POST /api/auth/login" "$LOGIN_STATUS"

TOKEN=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "  WARN  Could not extract token — skipping authenticated checks."
else
  # Tasks list
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/tasks" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/tasks" "$STATUS"

  # Analytics
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/analytics" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/analytics" "$STATUS"

  # Audit log
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/audit-log" \
    -H "Authorization: Bearer $TOKEN")
  check "GET /api/audit-log" "$STATUS"

  # Comments on first task
  TASKS_BODY=$(curl -s "$API_URL/api/tasks" -H "Authorization: Bearer $TOKEN")
  FIRST_ID=$(echo "$TASKS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['id'] if items else '')" 2>/dev/null || echo "")
  if [ -n "$FIRST_ID" ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/tasks/$FIRST_ID/comments" \
      -H "Authorization: Bearer $TOKEN")
    check "GET /api/tasks/:id/comments" "$STATUS"
  fi
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
echo ""

[ "$FAIL" -eq 0 ]
