# Hatchlane development

- [Implementation roadmap](docs/implementation-roadmap.md) defines stage order and exit checks.
- [Architecture](docs/core/architecture.md) defines version pins, runtime boundaries, data and permissions.
- [Product plan](docs/core/product-plan.md) defines actors, permit and screen behavior, and accessibility checks.
- [Startup guide](README.md) covers build, startup, logs, health, HTTPS trust, stop and isolated tests.

Work locally on the software simulation. Physical equipment integration requires a separate engineering decision. Hosted, staging and site deployments require product sign-off and deployment approval as described in the roadmap. Keep operational data and credentials local. Only Caddy publishes a port. Use distinct migration and application database identities and enforce site membership and duty checks on protected reads and commands as those features land. Keep real credentials, private CA material and database artifacts out of Git.

## Commands and tests

- Initialize once with `cp -n .env.example .env` and `./scripts/init-local.sh`. Run `docker compose build` and `docker compose up --wait`.
- Inspect with `docker compose ps -a` and `docker compose logs app db caddy`. Check HTTPS with the public Caddy root as shown in the startup guide. Use `docker compose stop` for routine shutdown.
- Run `docker build --target checks .` for pinned Biome and TypeScript checks and `./scripts/test-local.sh` for the disposable Compose smoke test. Use Node's built-in test runner and real PostgreSQL for domain and database tests as the product workflows arrive.
- Preserve routine workspace data on restarts. Create or reset fixtures only in a disposable project. Measure acceptance against the relevant roadmap stage and record the commands, observed outcomes and any outstanding checks.

## Workspace tools

- Use pnpm 12.21.0 for project dependencies and scripts. Keep `pnpm-lock.yaml` in sync with `package.json`.
- Verify framework behavior with Find Docs and Context7. Resolve with `pnpm dlx ctx7@latest library <name> "<topic>"`, then fetch with `pnpm dlx ctx7@latest docs <library-id> "<topic>"`. When documentation for a pin is absent from the index, check the pinned CLI's `--help` and the publisher's versioned reference. Record the primary source with the relevant change.
- Use the shared browser for interactive workflows. Open the local origin manually if the shared browser is unavailable, and use the README's `curl --cacert` commands for HTTP checks. Use a real phone for LAN HTTPS and later for camera and location permissions. Choose one repeatable browser runner when sign-in lands.
- Use Codebase Memory MCP for cross-module traces once application code warrants indexing. Use `rg --files`, `rg -n '<symbol>'` and direct file reads for the Stage 0 workspace or when the index is unavailable.
