#!/bin/sh
set -eu

as_role() {
  role=$1
  shift
  PGPASSWORD=$(cat "/run/secrets/db_$role") PGUSER="hatchlane_$role" \
    psql -XqAt --set ON_ERROR_STOP=1 "$@"
}

case "${1:-}" in
  write)
    as_role migrator <<'SQL'
CREATE TABLE IF NOT EXISTS stage_zero_probe (id integer PRIMARY KEY, value text NOT NULL);
SQL
    as_role app <<'SQL'
INSERT INTO stage_zero_probe (id, value) VALUES (1, 'persisted')
  ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;

DO $$
BEGIN
  CREATE TABLE stage_zero_forbidden (id integer);
  RAISE EXCEPTION 'The application role was able to create a table';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END
$$;
SQL
    ;;
  read)
    value=$(as_role app -c 'SELECT value FROM stage_zero_probe WHERE id = 1')
    [ "$value" = persisted ]
    ;;
  *)
    echo 'Use write or read for the database smoke test.' >&2
    exit 2
    ;;
esac
