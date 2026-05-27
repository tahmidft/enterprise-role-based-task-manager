#!/usr/bin/env bash
# Smoke test: validates health, auth, tasks, and audit endpoints.
# Usage: API_URL=https://your-api.onrender.com ./scripts/smoke.sh

set -euo pipefail

API_URL="${API_URL:-http://localhost:3333}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local status="$2"
  local expected="${3:-200}"
  if [ "$status" = "$expected" ]; then
    echo "  PASS  $name (HTTP $status)"
    ((PASS++))
  else
    echo "  FAIL  $name (expected $expected, got $status)"
    ((FAIL++))
  fi
}

echo ""
echo "=== Smoke Tests: $API_URL ==="
echo ""

# Health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
check "GET /api/health" "$STATUS"

# Login
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@techcorp.com","password":"password123"}')
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)
LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n 1)
check "POST /api/auth/login" "$LOGIN_STATUS"

TOKEN=$(echo "$LOGIN_BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$TOKEN" ]; then
  echo ""
  echo "Could not extract token — skipping authenticated checks."
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
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
echo ""

[ "$FAIL" -eq 0 ]
