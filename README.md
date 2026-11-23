# Hatchlane

Hatchlane runs a local software simulation of the permit workflow. The Stage 0 workspace serves one Next.js app and its Hono API through Caddy. PostgreSQL stores the workspace data. See the [implementation roadmap](docs/implementation-roadmap.md) for the product stages.

## Start the workspace

Use the workstation's Docker Engine and Compose plugin, with `openssl` and `curl` on the host. The workspace was verified with Compose 5.7.2. The container build uses Node.js 26.13.1 and pnpm 12.21.0 with `pnpm-lock.yaml`. For host-side JavaScript commands, use those same versions. The Linux amd64 release rehearsal and site VM follow the host pins in the architecture. [Stack and version pins](docs/core/architecture.md#stack-and-version-pins)

```sh
cp -n .env.example .env
./scripts/init-local.sh
docker compose build
docker compose up --wait
docker compose ps -a
docker compose logs --tail 50 app db caddy
```

The credential script creates three passwords under a private local directory, `.local/secrets`, and preserves existing credentials. If you change `HATCHLANE_SECRET_DIR`, use a private directory under `.local` or outside the checkout. Pass the same path to `./scripts/init-local.sh`. The one-shot `db-roles` container provisions the migration owner and restricted app role in the `hatchlane` schema, then exits. The app container receives only its own database password. Keep the password files with their database volume for normal restarts. Stage 1 introduces the versioned product migrations and the explicit admin bootstrap and demo seed commands.

## Check HTTPS and stop

From the repository root, copy Caddy's public root certificate and verify the two responses.

```sh
mkdir -p .local
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .local/root.crt
curl --fail --cacert .local/root.crt https://hatchlane.localhost:8443/
curl --fail --cacert .local/root.crt https://hatchlane.localhost:8443/api/health
```

Install the public root in your test browser or workstation trust store to open [the app](https://hatchlane.localhost:8443/) and [the health endpoint](https://hatchlane.localhost:8443/api/health) in a browser. The health endpoint returns HTTP 200 when the app role can query the database and HTTP 503 when it cannot. The proxy alone publishes a port. To stop the workspace, run `docker compose stop`. To remove its containers and networks, run `docker compose down`. Both preserve PostgreSQL data and Caddy's CA. Bring the workspace back with `docker compose up --wait`.

## Open the same origin on a test phone

1. On a trusted Wi-Fi network, choose a hostname the workstation and phone both resolve to the workstation's LAN IP. Use local DNS or, on macOS, the Bonjour hostname printed by `scutil --get LocalHostName` with `.local` appended. Set `HATCHLANE_HOSTNAME` in `.env` to that hostname.
2. If Docker runs directly on the workstation, set `HATCHLANE_BIND_IP` to the workstation's LAN IP. With Colima, leave it at `127.0.0.1` and use the tunnel below. Run `docker compose up --wait`.
3. Copy out the public CA root using the same `docker compose cp` command and trust that certificate on the phone. On iOS, install the profile and enable full trust under **Settings → General → About → Certificate Trust Settings**. With both devices on the same network, open `https://<hostname>:8443/` and `https://<hostname>:8443/api/health` on each device. The browser should accept the certificate and show the page and an `ok` status.
4. After testing, stop the tunnel if you used it, restore the loopback settings in `.env.example`, and run `docker compose up --wait`.

On Android, copy `root.crt` to the phone and install it under **Settings → Security and privacy → More security and privacy → Encryption and credentials → Install a certificate → CA certificate**. On the Android 17 Pixel 8, Chrome also needed **Settings → Apps → Chrome → Permissions → Nearby devices → Allow** to reach the Wi-Fi origin.

For Colima, run this with the Mac's actual LAN address and leave it open while testing. The tunnel binds only that interface and forwards HTTPS to the guest's published loopback port. Use the same port as `HATCHLANE_HTTPS_PORT` on both sides.

```sh
lan_ip=192.168.1.20
(
  ssh_config=$(mktemp)
  trap 'rm -f "$ssh_config"' EXIT
  colima ssh-config > "$ssh_config"
  ssh -F "$ssh_config" -S none -o ExitOnForwardFailure=yes -g -NT \
    -L "${lan_ip}:8443:127.0.0.1:8443" colima
)
```

## Run isolated checks

```sh
docker build --target checks .
./scripts/test-local.sh
```

The first command runs Biome and TypeScript with the pinned toolchain. The smoke script uses its own Compose project, loopback port, credentials and volumes. It verifies trusted HTTPS, static assets, database role permissions, a 503 during a database outage, recovery and persistence after container replacement. It removes only the test project and its disposable state. It can run alongside the routine workspace.

## Implementation references

- The Next.js CLI generated the TypeScript App Router and Biome scaffold. The image runs the standalone server. [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app) · [Standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- The build copies pnpm from its official image and uses a frozen lockfile with strict peer checks. [pnpm Docker guide](https://github.com/pnpm/pnpm/blob/v12.21.0/pnpm/docs/docker.md)
- Hono handles the health route and uses a bounded pool for PostgreSQL. [Hono App Router adapter](https://hono.dev/docs/getting-started/nextjs) · [node-postgres pool](https://node-postgres.com/apis/pool)
- Compose starts PostgreSQL, provisions roles, starts the app, and brings up HTTPS. The PostgreSQL and Caddy volumes persist across replacement. [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) · [PostgreSQL image](https://hub.docker.com/_/postgres) · [Caddy local HTTPS](https://caddyserver.com/docs/running#usage)
