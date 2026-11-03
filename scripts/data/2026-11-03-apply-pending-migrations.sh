#!/usr/bin/env bash
# 2026-11-03 — apply the two migrations the portal is waiting on.
#
#   20261030000001_fastskin_product_line.sql
#     Adds the FastSkin line + the FastSkin Patch product (inactive, unpriced).
#
#   20261031000001_provider_discount.sql
#     Adds providers.discount_pct, widens orders.discount_tier to 0-100, and
#     creates fn_set_provider_discount.
#
# RUN THIS BEFORE DEPLOYING. Order placement reads providers.discount_pct; if
# the code ships first, placing an order fails on the missing column.
#
# Safe to re-run: every statement is idempotent (if not exists / on conflict /
# create or replace / drop constraint if exists).
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN must be set}"
PROJECT=lqrrmlmeagpgwlyijeyd
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

run_sql_file() {
  local file="$1"
  echo "--- applying $(basename "$file")"
  python3 - "$file" > /tmp/agile-migration.json <<'PY'
import json, sys
print(json.dumps({"query": open(sys.argv[1]).read()}))
PY
  curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary @/tmp/agile-migration.json
  echo
  rm -f /tmp/agile-migration.json
}

run_sql_file "$ROOT/supabase/migrations/20261030000001_fastskin_product_line.sql"
run_sql_file "$ROOT/supabase/migrations/20261031000001_provider_discount.sql"

echo
echo "--- verify ---"
curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"select (select count(*) from information_schema.columns where table_name=''providers'' and column_name=''discount_pct'') as provider_discount_col, (select count(*) from pg_proc where proname=''fn_set_provider_discount'') as discount_fn, (select count(*) from products where code=''G0465'') as fastskin_product, (select count(distinct discount_pct) from providers) as distinct_rates;"}'
echo
