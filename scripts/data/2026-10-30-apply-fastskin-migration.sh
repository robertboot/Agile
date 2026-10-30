#!/usr/bin/env bash
# 2026-10-30 — apply the FastSkin migration to production.
#
# Adds 'FastSkin' to products_line_check, then seeds the FastSkin Patch
# product (G0465) INACTIVE with its 1-Kit size (MXA00405). No cost row is
# written: product_costs requires a non-null cost and COGS, and the kit price
# is not yet agreed. The product cannot be ordered until an admin prices it
# and publishes with GO LIVE.
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN must be set}"
PROJECT=lqrrmlmeagpgwlyijeyd
SQL_FILE="$(dirname "$0")/../../supabase/migrations/20261030000001_fastskin_product_line.sql"

python3 - "$SQL_FILE" <<'PY' > /tmp/fastskin-migration.json
import json, sys
print(json.dumps({"query": open(sys.argv[1]).read()}))
PY

curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/fastskin-migration.json
echo
echo "--- verify ---"
curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"select p.code, p.name, p.line, p.active, s.sku, s.label, s.cm2 from products p left join product_sizes s on s.product_code=p.code where p.code=''G0465'';"}'
echo
rm -f /tmp/fastskin-migration.json
