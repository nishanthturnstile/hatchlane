# Hatchlane implementation roadmap

Build the first software simulation on local Docker Compose. Use trusted local HTTPS for desk and phone tests. Stages 0–6 run on the workstation or a local VM, including release rehearsal. Any hosted preview, staging environment or site install waits until the product is finalized and the site deployment is approved. The five product slices below use the product requirements, stack pins and accessibility checks. [Product plan](core/product-plan.md#build-order-and-acceptance) · [Architecture](core/architecture.md#delivery-and-verification) · [Accessibility checks](core/product-plan.md#accessibility-checks)

| Order | What the team can demonstrate |
|---|---|
| 0 · Local workspace | Start, inspect and restart the Compose stack from a clean checkout. |
| 1 · Find and review | Sign in, locate an asset, submit and revise a permit, then approve one reservation. |
| 2 · Outer access | Start approved work and observe an outer opening after an independent simulated decision. |
| 3 · Authorization and attendance | Record a supervisor decision, confirm inner access and account for people through a stop or connection loss. |
| 4 · Closeout and recovery | Close or cancel a permit, find its history and recover the simulation from a local backup. |
| 5 · Commissioning | Add an asset through the UI, identify it in the field and recover from a failed simulated sensor. |
| 6 · Local product acceptance | Run the complete simulation and rehearse installation, recovery and rollback locally. |
| 7 · Deployment after sign-off | Install the finalized simulation release on the approved site VM. |

## 0 · Local workspace

- Add a root `AGENTS.md` that links the core documents and this roadmap and records the local commands, simulation boundary, permissions and test expectations. Add a short startup guide, sample environment configuration with placeholders, and ignore rules for local credentials, CA private material, database artifacts and generated files.
- Scaffold an ESM TypeScript app with Next.js standalone packaging, a Hono health route and PostgreSQL connectivity. Pin app dependencies and images from the architecture, install the pinned Node.js and pnpm toolchain in the container, and commit `pnpm-lock.yaml` and the pinned Biome configuration. Use the workstation's Docker Engine and Compose for local work. Apply the architecture's host pins to the Linux amd64 release rehearsal and site target.
- Put the app, PostgreSQL and Caddy in a local Compose project with health checks, private app and database networking, and persistent PostgreSQL and Caddy volumes. Publish only the proxy. Use loopback for routine work and enable LAN access for tests on a trusted phone. Set up a local hostname and trust the development CA's public root on test devices. Use local-only secrets and separate migration and application database credentials.
- Document build, start, logs, health, stop and isolated test commands. Create an isolated test Compose project and establish repeatable fixtures. Add the actual migration, bootstrap and seed commands to the guide as they arrive. Normal starts and restarts preserve data. Recreate demo state only in an explicitly disposable instance.

Use the tools already available to the workspace. Record the chosen tools and their fallback commands in `AGENTS.md` during setup.

| Work | Tool setup |
|---|---|
| Verify framework APIs and versions | Use the Find Docs skill with the Context7 CLI. Record the primary source with the relevant implementation change. |
| Review screens and replay workflows | Use the shared browser for interactive checks. Select one local browser runner for repeatable tests when the sign-in flow lands. Use a real phone to verify HTTPS, camera and location permissions. |
| Trace cross-module changes | Use the Codebase Memory MCP when there is enough application code for indexing to improve navigation. Start with the files and local commands in the repository. |

**Exit check.** From a clean checkout, start the stack and open the app and Hono health endpoint through the same local HTTPS origin. Confirm database readiness and persisted data after container replacement. Run Biome, TypeScript and the first database smoke test from the documented commands. Reach the same HTTPS origin from a test phone.

## How to build each slice with AI

Give each implementation task the actor, starting state, screen entry point, expected stored result and one or more failure cases. Name the core sections the task implements. Use the subdivisions below when a milestone needs smaller tasks. Each subdivision ends in a usable workflow through the browser and the same server commands used in a local demonstration.

1. Add only the schema changes, server commands, authorized reads, screens and seed data needed for that workflow. Keep the state change and its audit event in the same transaction. Use real PostgreSQL integration checks when correctness depends on permissions, retries, ordering, locking or durable records.
2. Demonstrate the normal path and its blocker through the named users' screens. Include phone and desktop states as applicable, with the next action, actor and persisted result visible after refresh. Use separate sessions for different roles and separate database clients for race tests. Add keyboard and field-width checks as the screens arrive.
3. Run the slice's acceptance checks and the relevant earlier checks before starting the next one. Record the commands run, demo accounts or fixtures used, and any open result in the change summary. Have a separate review pass inspect the cross-stack workflow, permissions and regressions. Resolve behavior gaps in the core documents before implementation agents make assumptions.

## 1 · Find and review

**1A · Sign in and manage site access.** Create the reviewed Better Auth migration and site membership, duty eligibility and account gate records. Bootstrap the demo site and a named Site Admin together using a local Compose command. Build Admin provisioning, password reset and disablement with session revocation. Give users the temporary password change and sign-in flows and return them to an authorized saved destination. Check account status, site membership and duty eligibility on protected reads and commands.

**1B · Find an asset and get a decision.** Seed a complete versioned simulation checklist, named demo users and duty assignments, a representative multi-page drawing and commissioned MH-001 and MH-002. Snapshot the full checklist at submission and implement the later stage validators in their own slices. Connect the drawing pin, searchable list and printed ID to one asset detail with an authorized download. Connect a saved draft to immutable submission, return, resubmission, approval and decline. Show the outcome in **My permits** and **Review queue**. Store decisions and the unique asset reservation transactionally. Take site time at the input and display boundaries and store permit windows in UTC. Introduce the injectable server clock for permit-window checks.

**Local exit check.** An Admin provisions a user, and the user changes their temporary password and returns to an authorized saved link. Reject public sign-up. Test reset, disablement, session revocation and retry of an interrupted reset while the account remains blocked. Verify page, API and drawing download access for users outside the site and for a facilitator restricted to equipment and command context. With external internet unavailable and the LAN reachable, find MH-001 on a phone and submit a draft. Reject review by a team member. A desk reviewer outside the team returns the request with a reason, then approves the revised version in a separate session. Race two approvals using separate Admin sessions. Verify one reservation, a visible conflict and MH-002 still available. Recreate the app container and reopen the same record.

## 2 · Outer access

Let the assigned field operator confirm the label, start a reserved permit within its window, record pre-opening evidence and request outer release. Give the separate simulator facilitator the named target and request result controls. Record each of the four simulated position or bolt observations independently and update the asset detail and Explorer through authenticated polling. Show **Simulation**, source, freshness, waiting state, and alerts on the affected asset.

Implement the controller lease, application startup invalidation, operation IDs and one unresolved intent per layer. Deliver stop and expiry in the same slice as the first release request. Recheck current server-side validity at request and fulfilment, and use the expiry sweep to persist visible events. Acknowledgement changes the request result. Only fresh, post-acknowledgement opening feedback from the current assignments and controller session advances the workflow. After denial or timeout, require fresh secured feedback on the target and a deliberate new request.

**Local exit check.** Check that a wrong asset label or a permit outside its window blocks the appropriate action. Confirm a simulated request and withhold feedback. Both displayed values stay as observed, and the permit waits. Publish the outer bolt and cover observations separately and verify progress. Exercise denial, duplicate taps, timeout, explicit stop, disconnect and restart. Check that late, stale or prior-session events leave the current state and expired requests intact, and that stop, expiry and reconnection issue no relock. While viewing MH-001, discover and open an MH-002 fault from Explorer.

## 3 · Authorization and attendance

**3A · Record assessment and get a supervisor decision.** Validate assessment and monitoring evidence against the checklist already snapshotted on the permit. Record ventilation runs and interruptions. Let the assigned supervisor withhold or authorize against the current permit and evidence. Apply the seeded simulation rules to timely monitoring updates, adverse evidence, corrections and expiry. Show the stop reason and affected evidence. A completed ventilation timer leaves the supervisor decision due.

**3B · Confirm inner access and account for people.** Let the assigned attendant take responsibility and establish the permit lease. Tie the inner request and the separate facilitator's decision to current authorization, an online attendant and the required fresh position and bolt feedback. Accept planned entry only after acknowledgement and fresh open/disengaged feedback on both layers, including post-acknowledgement inner observations. Add entry, exit and re-entry with stable entrant and visit IDs, plus observed movement and reconciliation. Use the same asset and permit locks for attendance and state changes. Keep exits and observed movements usable through a stop or hold. Resolve uncertain records by operation ID and require a new deliberate online action for a release or entry authorization.

**Local exit check.** Block authorization on missing evidence, then record it and obtain the supervisor's decision. Verify a timely monitoring update renews the deadline and delayed evidence leaves a stopped permit stopped. Race inner fulfilment against evidence invalidation. Check that a planned-entry command creates no visit before facilitator acknowledgement, with any required observation missing or stale, or during a reconciliation hold. Record two entrants and one exit. The same named person remains inside after refresh and restart. Expire the evidence and keep exits available. Interrupt the attendant connection with an apparently empty roster and verify the hold persists until reconciliation and operational actions require fresh input.

## 4 · Closeout and recovery

**4A · Secure the asset and close the record.** Give active and stopped work a closeout path. Withdrawal on started work stops the job, invalidates pending intents and authorization and retains the roster and reservation. Unused cancellation requires no start, request, movement or unresolved occupancy and four fresh secured observations. Let a Site Admin hand off recovery duties with reasons and preserved original signatures. Have the attendant confirm everyone out, the field operator verify secured feedback in inner-then-outer order and record field checks, and the supervisor sign. Release the reservation on commit. Add searchable history, append-only corrections and late movement reporting, including the reconcilable asset-wide hold for uncertain occupancy.

**4B · Restore and reconcile local state.** Back up PostgreSQL and its attachments with the consistent manifest described in the architecture, then restore into an isolated local Compose project. Verify schema, counts, attachment hashes, reservations and rosters. Before reopening the workspace, invalidate restored sessions, requests and authorization, mark observations stale and place assets on recovery hold. Mark restored started jobs stopped and preserve their reservations. Verify account changes since the backup and keep subsequently disabled accounts blocked. Have the Site Admin and attendant reconcile and verify every asset before allowing new work.

**Local exit check.** Withdraw approval with somebody inside and keep exit logging available. Hand off an unavailable duty holder and verify missing outer bolt feedback blocks closure. Race a reported movement against final closeout on two clients in both commit orders. Report a late movement after a successor job starts and verify that it stops with its own roster and reservation intact. Clear the hold through recorded reconciliation. Find the completed record and cancel a verified unused permit. Restore a verified backup, check a previously disabled account and reconcile both a restored reservation and an asset whose job was absent from the backup. Measure against the architecture's targets of at most 24 hours of data loss and two hours for recovery.

## 5 · Commissioning

**5A · Create and commission an asset.** Let a Site Admin add an asset, upload an immutable drawing revision, place and confirm a pin, and assign the gateway and both layer devices by serial. Reject conflicting assignments and require fresh feedback before accepting commissioning. Persist attachment bytes and metadata together with the authorized revision or photo. Keep old pins on their original revision until confirmation and retain list and printed ID lookup.

**5B · Identify the asset and devices in the field.** Add QR scans for asset lookup and device assignment, with typed fallback and specific feedback for a mismatched site, unknown ID or wrong label type. On deliberate user action, capture optional GPS with accuracy and time, or a photo.

**5C · Replace a failed device on a stopped job.** After the attendant confirms everyone out, let the Site Admin replace the failed simulated device and recommission against four fresh observations. Retain prior assignments in history and preserve the reservation through supervisor closeout.

**Local exit check.** Add MH-003 through the UI. Upload a representative PDF, reject an oversized streamed upload via Caddy, revise the drawing and find its pin through zoom and rotation. Successfully scan asset and device labels and submit optional GPS and photo data on a phone. Deny camera and location access in a separate run and complete identification using a typed asset ID and serial. Reject a serial already assigned and run a complete permit on MH-003. Fail a sensor during closeout, replace it, and verify an old assignment's feedback cannot satisfy the check. Record disk, upload memory and backup growth.

## 6 · Local product acceptance

- Run all five workflow demonstrations from a clean Compose project as the named users. Use a separate disposable seed instance for runs that intentionally retain reservations. Check role restrictions, restart behavior, delayed feedback, lost connectivity and the history trail on a phone and desk browser. Repeat the field path with external internet unavailable and the LAN reachable.
- Exercise the product's accessibility checks, including keyboard drawing interactions, screen-reader announcements, phone reflow and warnings that remain understandable in grayscale. Measure polling load, upload limits, capacity and backup and recovery time using representative data.
- Build the release candidate locally with standalone Next.js, maintenance commands, local fonts and PDF resources. On an isolated local Linux amd64 VM, load the pinned images from the release bundle and rehearse installation with external internet unavailable. Verify readiness, a reboot with the data disk detached, upgrades with a verified backup, both rollback paths and recovery holds before reopening writes.

**Gate to deployment.** Finalize the simulation scope, resolve acceptance failures, record the exact candidate and its local evidence, and get the product owner's sign-off. Keep the candidate and all development environments local until that gate passes.

## 7 · Deployment after sign-off

After approval, schedule the finalized simulation release on the site VM. Use the pinned offline bundle and verified release manifest. Confirm the data mount, certificate trust and backup destination and follow the architecture's migration and maintenance procedure. Check sign-in, permit lookup and an API read in maintenance mode. Using an isolated site demo instance, verify scan, GPS, asset lookup and permit submission on the site's LAN with external internet unavailable. Enable operational writes and timers after those checks pass. Record the release digest, outcome and rollback point. Physical equipment integration and field acceptance are separate work. [Architecture delivery and verification](core/architecture.md#delivery-and-verification)
