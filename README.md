# Hatchlane

Hatchlane runs a local software simulation of the permit workflow. The workspace serves one Next.js app and its Hono API through Caddy. PostgreSQL stores accounts, sites and memberships. See the [implementation roadmap](docs/implementation-roadmap.md) for the product stages.

## Start the workspace

Use the workstation's Docker Engine and Compose plugin, with `openssl` and `curl` on the host. The workspace was verified with Compose 5.7.2. The container build uses Node.js 26.13.1 and pnpm 12.21.0 with `pnpm-lock.yaml`. For host-side JavaScript commands, use those same versions. The Linux amd64 release rehearsal and site VM follow the host pins in the architecture. [Stack and version pins](docs/core/architecture.md#stack-and-version-pins)

```sh
cp -n .env.example .env
./scripts/init-local.sh
docker compose build
docker compose up --wait
docker compose ps -a
docker compose logs --tail 50 app db migrate caddy mailpit
```

The credential script creates database passwords and the authentication secret under `.local/secrets` and preserves existing values. If you change `HATCHLANE_SECRET_DIR`, use a private directory under `.local` or outside the checkout and pass the same path to `./scripts/init-local.sh`. The `db-roles` container provisions the database roles. The `migrate` container applies versioned SQL with the migration owner before the app starts. Keep the secret files with the database volume for normal restarts.

## Set up the Administrator and first site

From an interactive terminal, run `pnpm auth:admin:setup` after the stack is ready. Enter a name, email address and password, then confirm the password. The command masks password entry and assigns the Administrator role. If an Admin already exists, use the existing account or recover its password from the sign-in page.

Open [Hatchlane sign-in](https://hatchlane.localhost:8443/sign-in). After signing in, create the first site with its name, time zone and optional description. Send one invitation per email address, or continue straight to the workspace. Use the site switcher at the top of the sidebar to switch among your sites or open **Create site**. The account menu at the bottom opens settings and signs out. [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/base/sidebar) · [Base UI Dialog](https://base-ui.com/react/components/dialog)

## Set up a local site map

**Site location** is optional during first-time onboarding. After setup, Site Explorer displays the saved map. On an existing site, admins can choose **Set up map** or open **Map settings**. A new location starts at the device's location when the browser grants permission. Use the map, coordinate fields or **Use current location** to pick a center. The map fits the coverage circle when the radius changes and starts at 1 km for a new map. Hatchlane extracts tiles intersecting the selected circle, stores them in PostgreSQL and displays only the circle in Site Explorer. [Browser location permissions](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition)

From a provisioning workstation with Docker and internet access, choose a dated Protomaps basemap and an area broader than any individual site's radius. The India workspace uses a nationwide extract prepared once on the provisioning workstation. This example uses a bounding box in west, south, east, north order. A buffered country GeoJSON with `--region` produces a smaller archive. [Protomaps basemap builds](https://docs.protomaps.com/basemaps/downloads)

```sh
mkdir -p .local/map-source
docker run --rm --mount "type=bind,source=$PWD/.local/map-source,target=/maps" \
  protomaps/go-pmtiles:v1.31.2@sha256:06574f01f55a78f78f887bc7ebf729a5c093c0d6e17d9876300cfcb0758b59d3 \
  extract https://build.protomaps.com/20261122.pmtiles /maps/region-pending.pmtiles \
  --bbox=67.5,6.3,98,37.5 --maxzoom=15
```

Stop the app while replacing the picker source. Move the completed file to `.local/map-source/region.pmtiles`, then start the stack. Set `HATCHLANE_MAP_SOURCE_DIR` to use another directory containing `region.pmtiles`. The runtime expects a clustered PMTiles v3 archive with the Protomaps building, road and water layers and zoom 15. If the source is absent, finish onboarding with **Skip for now**. Previously saved maps continue to load over the local network while external internet is disconnected. [PMTiles CLI](https://docs.protomaps.com/pmtiles/cli) · [MapLibre PMTiles support](https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/)

In **Site Explorer**, choose **Add manhole** or select a manhole already on the map. An Admin can review a device location, adjust the pin and save it locked. Open the manhole and register one lock per door by typing its ID or scanning a label. For a camera test, display the sample for [Door 1 · SL-1042](public/samples/smart-lock-door-1.png) or [Door 2 · SL-1043](public/samples/smart-lock-door-2.png) on a second screen, then scan it from a phone on the trusted Hatchlane HTTPS origin. Review the filled ID and select **Confirm assignment**.

Open the [local Mailpit inbox](http://127.0.0.1:8025/) to test **Forgot password** and invitations. Mailpit captures messages for this Compose workspace. Caddy binds the inbox to loopback, and SMTP runs on a private Compose network. `HATCHLANE_MAILPIT_PORT` changes the loopback port. Reset links open at the configured Hatchlane HTTPS origin and expire after 30 minutes. Invitations expire after seven days. An invitee sets a password from the private link or signs in with their existing account to accept it. Sending another invitation replaces the previous pending link for that site and email. [Mailpit Docker setup](https://mailpit.axllent.org/docs/install/docker/)

## Check HTTPS and stop

From the repository root, copy Caddy's public root certificate and verify the two responses.

```sh
mkdir -p .local
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .local/root.crt
curl --fail --location --cacert .local/root.crt https://hatchlane.localhost:8443/
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

The first command runs Biome and TypeScript with the pinned toolchain. The smoke script uses a disposable Compose project with separate loopback ports, credentials and volumes. It verifies trusted HTTPS, static assets, database role permissions, a 503 during a database outage, recovery and persistence after container replacement. It can run alongside the routine workspace.

Run the Chromium account journey with the project's pinned Node.js and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
./scripts/test-local.sh --auth
```

The account suite verifies Admin bootstrap serialization, protected access, onboarding across refreshes, invitation activation, joining a second site with the same account, and password reset expiry, replay protection and session revocation. It uses disposable test credentials and the test project's Mailpit inbox. [Playwright test configuration](https://playwright.dev/docs/test-configuration)

To cover map selection and local viewing, copy a prepared Bengaluru regional archive into the disposable project's source directory through the test runner.

```sh
HATCHLANE_TEST_MAP_SOURCE="$PWD/.local/map-source/region.pmtiles" ./scripts/test-local.sh --auth
```

Set `HATCHLANE_TEST_INDIA_MAP=1` with the nationwide source to run the same workflow with a simulated location in Delhi.

## Implementation references

- The Next.js CLI generated the TypeScript App Router and Biome scaffold. The image runs the standalone server. [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app) · [Standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- The build copies pnpm from its official image and uses a frozen lockfile with strict peer checks. [pnpm Docker guide](https://github.com/pnpm/pnpm/blob/v12.21.0/pnpm/docs/docker.md)
- Hono handles the health route and uses a bounded pool for PostgreSQL. [Hono App Router adapter](https://hono.dev/docs/getting-started/nextjs) · [node-postgres pool](https://node-postgres.com/apis/pool)
- Compose starts PostgreSQL, provisions roles, applies migrations, starts the app, and brings up HTTPS. The PostgreSQL and Caddy volumes persist across replacement. [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) · [PostgreSQL image](https://hub.docker.com/_/postgres) · [Caddy local HTTPS](https://caddyserver.com/docs/running#usage)
