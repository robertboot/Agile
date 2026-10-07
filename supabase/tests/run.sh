#!/usr/bin/env bash
# Replay every migration into a scratch database and run the SQL test suite.
#
# Why this is a script and not a CI job yet: `create extension pgaudit` in
# 20260523000001 needs pgaudit both installed and in shared_preload_libraries,
# which the official postgres:16 image does not have. Doing this in CI means
# running supabase/postgres as the service image — worth doing, not done here.
#
#   supabase/tests/run.sh                  # uses a local server on $PGHOST
#   PGDATABASE=scratch supabase/tests/run.sh
#
# Any connection variable psql understands (PGHOST, PGPORT, PGUSER, ...) works.
# The database is dropped and recreated on every run, so point it at a scratch
# name and never at anything real.
set -euo pipefail

db="${PGDATABASE:-agile_test}"
unset PGDATABASE
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"

echo "==> recreating $db"
psql -q -d postgres -c "drop database if exists \"$db\";" -c "create database \"$db\";"

echo "==> bootstrap"
psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/bootstrap.sql"

echo "==> migrations"
count=0
for f in "$root"/supabase/migrations/*.sql; do
    if ! psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$f"; then
        echo "FAILED: $(basename "$f")" >&2
        exit 1
    fi
    count=$((count + 1))
done
echo "    $count migrations replayed clean"

echo "==> credentialing_schema_test.sql"
# Every assertion prints a PASS notice; a failure raises and ON_ERROR_STOP
# aborts, so a non-zero exit here is a real failure.
out="$(psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/credentialing_schema_test.sql" 2>&1)" || {
    echo "$out" | grep -E 'FAIL|ERROR' >&2
    exit 1
}
echo "    $(grep -c 'PASS' <<<"$out") assertions passed"
