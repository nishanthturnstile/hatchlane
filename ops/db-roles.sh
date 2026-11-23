#!/bin/sh
set -eu

PGPASSWORD=$(cat /run/secrets/db_bootstrap)
MIGRATOR_PASSWORD=$(cat /run/secrets/db_migrator)
APP_PASSWORD=$(cat /run/secrets/db_app)
export PGPASSWORD MIGRATOR_PASSWORD APP_PASSWORD

psql -X --set ON_ERROR_STOP=1 <<'SQL'
\getenv migrator_password MIGRATOR_PASSWORD
\getenv app_password APP_PASSWORD

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('hatchlane:db-role-setup'));

SELECT format('CREATE ROLE hatchlane_migrator LOGIN PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hatchlane_migrator')
\gexec

SELECT format('CREATE ROLE hatchlane_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hatchlane_app')
\gexec

REVOKE ALL ON DATABASE hatchlane FROM PUBLIC;
GRANT CONNECT ON DATABASE hatchlane TO hatchlane_migrator, hatchlane_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS hatchlane AUTHORIZATION hatchlane_migrator;
GRANT USAGE ON SCHEMA hatchlane TO hatchlane_app;
ALTER ROLE hatchlane_migrator IN DATABASE hatchlane SET search_path = hatchlane;
ALTER ROLE hatchlane_app IN DATABASE hatchlane SET search_path = hatchlane;

ALTER DEFAULT PRIVILEGES FOR ROLE hatchlane_migrator IN SCHEMA hatchlane
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hatchlane_app;
ALTER DEFAULT PRIVILEGES FOR ROLE hatchlane_migrator IN SCHEMA hatchlane
  GRANT USAGE ON SEQUENCES TO hatchlane_app;
ALTER DEFAULT PRIVILEGES FOR ROLE hatchlane_migrator
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
SQL
