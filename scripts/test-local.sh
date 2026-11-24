#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
umask 077
mkdir -p .local
scratch=$(mktemp -d "$PWD/.local/test.XXXXXXXX")
suffix=$(basename "$scratch" | cut -d. -f2 | tr '[:upper:]' '[:lower:]')
project="hatchlane-test-$suffix"
export HATCHLANE_SECRET_DIR="$scratch/secrets"
export HATCHLANE_MAP_SOURCE_DIR="$scratch/maps"
mkdir -p "$HATCHLANE_MAP_SOURCE_DIR"
chmod 755 "$HATCHLANE_MAP_SOURCE_DIR"
if [ -n "${HATCHLANE_TEST_MAP_SOURCE:-}" ]; then
  cp "$HATCHLANE_TEST_MAP_SOURCE" "$HATCHLANE_MAP_SOURCE_DIR/region.pmtiles"
  chmod 644 "$HATCHLANE_MAP_SOURCE_DIR/region.pmtiles"
fi
export HATCHLANE_HOSTNAME=hatchlane-test.localhost
export HATCHLANE_BIND_IP=127.0.0.1
HATCHLANE_HTTPS_PORT=$(node -e 'const server = require("node:net").createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')
export HATCHLANE_HTTPS_PORT

compose() {
  docker compose --env-file /dev/null -p "$project" -f compose.yaml -f compose.test.yaml "$@"
}

cleanup() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    compose ps -a >&2 || true
    compose logs --tail 30 >&2 || true
  fi
  if compose down --volumes --remove-orphans --rmi local; then
    if docker image inspect "$project-maintenance" >/dev/null 2>&1; then
      docker image rm "$project-maintenance" >/dev/null || true
    fi
    rm -rf "$scratch"
  else
    printf 'Test cleanup failed for Compose project %s. Files are in %s\n' "$project" "$scratch" >&2
    exit 1
  fi
  exit "$result"
}

set_origin() {
  binding=$(compose port caddy 443)
  port=${binding##*:}
  origin="https://$HATCHLANE_HOSTNAME:$port"
}

https() {
  curl --silent --show-error --max-time 5 --noproxy '*' --cacert "$scratch/root.crt" \
    --resolve "$HATCHLANE_HOSTNAME:$port:127.0.0.1" "$@"
}

./scripts/init-local.sh "$HATCHLANE_SECRET_DIR"
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

compose up -d --build --wait --wait-timeout 90
compose cp caddy:/data/caddy/pki/authorities/local/root.crt "$scratch/root.crt"
set_origin
https --fail --location "$origin/" -o "$scratch/page.html"
grep -q 'Sign in to Hatchlane' "$scratch/page.html"
stylesheet=$(grep -oE '/_next/static/[^" ]+\.css' "$scratch/page.html" | head -n 1)
test -n "$stylesheet"
https --fail "$origin$stylesheet" -o /dev/null
https --fail "$origin/robots.txt" -o /dev/null
https --fail -D "$scratch/health-headers" "$origin/api/health" -o "$scratch/health"
grep -qi '^cache-control: .*no-store' "$scratch/health-headers"
grep -q '"status":"ok"' "$scratch/health"

compose run --rm --no-deps -T db-smoke write
compose run --rm --no-deps -T db-smoke read

compose stop db
test "$(https -o "$scratch/health" -w '%{http_code}' "$origin/api/health")" = 503
grep -q '"status":"unavailable"' "$scratch/health"
https --fail "$origin/sign-in" -o /dev/null
compose start --wait --wait-timeout 30 db
https --fail "$origin/api/health" -o /dev/null

compose up -d --force-recreate --wait --wait-timeout 90
set_origin
https --fail "$origin/api/health" -o /dev/null
compose run --rm --no-deps -T db-smoke read
printf 'Local smoke passed: trusted HTTPS, static assets, DB roles, outage recovery, and persisted data and CA.\n'

if [ "${1:-}" = '--auth' ]; then
  compose run --rm --no-deps -T admin-setup node --input-type=module - <<'JS'
import assert from "node:assert/strict";
import { getPool } from "./server/db/pool.ts";
import { bootstrapAdministrator } from "./server/domain/admin.ts";
try {
  const setup = { name: "Test Administrator", email: "admin@example.test", password: "disposable-admin-password" };
  assert.deepEqual((await Promise.all([bootstrapAdministrator(setup), bootstrapAdministrator(setup)])).sort(), [false, true]);
} finally {
  await getPool().end();
}
JS
  mail_binding=$(compose port caddy 8025)
  HATCHLANE_TEST_ORIGIN="$origin" HATCHLANE_TEST_INBOX="http://127.0.0.1:${mail_binding##*:}" HATCHLANE_TEST_PROJECT="$project" \
    pnpm exec playwright test --output "$scratch/playwright"
fi
