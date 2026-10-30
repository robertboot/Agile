#!/usr/bin/env bash
# 2026-10-30 — allow the portal's /auth/callback as a Supabase redirect target.
#
# Why: password recovery had nowhere to land. The portal now serves
# /auth/callback, but uri_allow_list was EMPTY, so Supabase would refuse the
# redirect_to on every recovery link and the flow could never complete.
#
# Scope: only adds redirect targets. Touches no other auth setting — not the
# site URL, not SMTP, not the email rate limit.
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN must be set}"
PROJECT=lqrrmlmeagpgwlyijeyd

curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"uri_allow_list":"https://agilemedgroup.com/auth/callback**,https://www.agilemedgroup.com/auth/callback**,http://localhost:3000/auth/callback**"}' \
  -o /dev/null -w "PATCH HTTP %{http_code}\n"

curl -sS "https://api.supabase.com/v1/projects/${PROJECT}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('uri_allow_list:', d.get('uri_allow_list'))"
