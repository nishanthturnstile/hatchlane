"use client";

import {
  ArrowRightIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { SiteLocationForm } from "@/components/maps/site-location-form";
import { SiteMap } from "@/components/maps/site-map";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Asset, AssetPin } from "@/lib/assets";
import type { Door, ManholeLock } from "@/lib/manhole-locks";
import type { MapSource, SavedSiteMap } from "@/lib/site-map";
import { AssetForm, PinForm } from "./asset-form";
import { LockForm, RemoveLockForm } from "./lock-form";
import { ManholeDetails } from "./manhole-details";

type Panel =
  | { kind: "list" | "add" | "map" }
  | { kind: "details" | "edit"; id: string }
  | { kind: "pin"; id: string; pinRevision: number }
  | { kind: "lock"; id: string; door: Door }
  | { kind: "remove-lock"; id: string; lock: ManholeLock };

export function ExplorerMap({
  siteId,
  siteName,
  canEdit,
  map,
  source,
  assets,
  locks,
}: {
  siteId: string;
  siteName: string;
  canEdit: boolean;
  map?: SavedSiteMap;
  source: MapSource | null;
  assets: Asset[];
  locks: ManholeLock[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(
    map ? null : { kind: "list" },
  );
  const [draftPin, setDraftPin] = useState<AssetPin | null>(null);
  const [pinLocationTarget, setPinLocationTarget] =
    useState<HTMLDivElement | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const [currentAssets, showAsset] = useOptimistic(
    assets,
    (current, saved: Asset) =>
      [...current.filter(({ id }) => id !== saved.id), saved].sort((a, b) =>
        a.printedId.localeCompare(b.printedId, undefined, {
          sensitivity: "base",
        }),
      ),
  );
  const [currentLocks, showLockChange] = useOptimistic(
    locks,
    (current, { lock, removed }: { lock: ManholeLock; removed: boolean }) => {
      const next = current.filter(
        ({ manholeId, door }) =>
          manholeId !== lock.manholeId || door !== lock.door,
      );
      return removed ? next : [...next, lock];
    },
  );
  const panelContainer = useRef<HTMLElement>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const findButton = useRef<HTMLButtonElement>(null);
  const selectedId = panel && "id" in panel ? panel.id : undefined;
  const selected = currentAssets.find(({ id }) => id === selectedId);
  const browsing = !panel || panel.kind === "list" || panel.kind === "details";
  const placing = panel?.kind === "add" || panel?.kind === "pin";
  const kind = panel?.kind;
  const unpinnedCount = currentAssets.filter(({ pin }) => !pin).length;
  const matches = query.trim().toLowerCase();
  const visibleAssets = currentAssets.filter(
    ({ printedId, name }) =>
      printedId.toLowerCase().includes(matches) ||
      name.toLowerCase().includes(matches),
  );

  useEffect(() => {
    if (kind && panelContainer.current) panelContainer.current.scrollTop = 0;
    if (kind === "list") searchInput.current?.focus({ preventScroll: true });
    if (kind === "details" && selected?.id)
      panelHeading.current?.focus({ preventScroll: true });
    if (kind === "pin" || kind === "lock" || kind === "remove-lock")
      panelContainer.current
        ?.querySelector("h2")
        ?.focus({ preventScroll: true });
  }, [kind, selected?.id]);

  const openDetails = useCallback((id: string) => {
    setDraftPin(null);
    setPanel({ kind: "details", id });
  }, []);

  function closePanel() {
    setAnnouncement("");
    setDraftPin(null);
    setPanel(null);
    requestAnimationFrame(() =>
      findButton.current?.focus({ preventScroll: true }),
    );
  }

  function assetSaved(asset: Asset) {
    setAnnouncement(`Manhole ${asset.printedId} saved.`);
    openDetails(asset.id);
    startRefresh(() => {
      showAsset(asset);
      router.refresh();
    });
  }

  function lockSaved(lock: ManholeLock, removed: boolean) {
    setAnnouncement(
      removed
        ? `Lock ${lock.serial} removed from Door ${lock.door}.`
        : `Lock ${lock.serial} assigned to Door ${lock.door}.`,
    );
    openDetails(lock.manholeId);
    startRefresh(() => {
      showLockChange({ lock, removed });
      router.refresh();
    });
  }

  function refreshDetails() {
    startRefresh(() => router.refresh());
  }

  if (panel?.kind === "map") {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Site map settings</h1>
            <p className="text-sm">{siteName}</p>
          </div>
        </header>
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <SiteLocationForm
            siteId={siteId}
            source={source}
            saved={map}
            onSaved={closePanel}
            onCancel={closePanel}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-[calc(100dvh-3.5rem)] min-h-96 min-w-0 flex-col bg-background">
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-background px-3 py-2.5 sm:px-5">
        <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3">
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-semibold">
              Site Explorer
            </h1>
            {map && (
              <p className="text-xs text-muted-foreground">
                {map.radiusKm} km radius
              </p>
            )}
          </div>
          {browsing && canEdit && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setAnnouncement("");
                setPanel({ kind: "map" });
              }}
            >
              <SlidersHorizontalIcon
                data-icon="inline-start"
                aria-hidden="true"
              />
              {map ? "Map settings" : "Set up map"}
            </Button>
          )}
        </div>
        {browsing && (
          <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
            <legend className="sr-only">Manhole actions</legend>
            <Button
              ref={findButton}
              variant="outline"
              className="min-h-11"
              aria-expanded={panel?.kind === "list"}
              onClick={() => {
                setAnnouncement("");
                if (kind !== "list") setQuery("");
                setPanel({ kind: "list" });
                searchInput.current?.focus({ preventScroll: true });
              }}
            >
              <SearchIcon data-icon="inline-start" aria-hidden="true" />
              <span className="grid justify-items-start">
                <span>Find a manhole</span>
                {map && unpinnedCount > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {unpinnedCount} without a pin
                  </span>
                )}
              </span>
            </Button>
            {canEdit && (
              <Button
                className="min-h-11"
                onClick={() => {
                  setAnnouncement("");
                  setDraftPin(null);
                  setPanel({ kind: "add" });
                }}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Add manhole
              </Button>
            )}
          </fieldset>
        )}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-40 min-w-0 flex-1">
          {map ? (
            <SiteMap
              key={map.revision}
              archiveUrl={`/api/sites/${siteId}/map/archive/${map.revision}`}
              bounds={map.bounds}
              location={map}
              assets={currentAssets}
              fullHeight
              draftPin={draftPin}
              focusedAssetId={selectedId}
              onPlaceAsset={placing ? setDraftPin : undefined}
              pinLocationTarget={pinLocationTarget}
              onOpenAsset={browsing ? openDetails : undefined}
              selectionDisabled={savingLocation}
              onReload={refreshDetails}
            />
          ) : (
            <div className="grid h-full place-items-center bg-muted p-4 text-center">
              <div>
                <h2 className="text-lg font-semibold">No site map yet</h2>
                <p className="text-sm text-muted-foreground">
                  Manholes are available from search.
                </p>
              </div>
            </div>
          )}
        </div>

        {panel && (
          <aside
            ref={panelContainer}
            aria-label={
              panel.kind === "details" ? "Manhole details" : "Manhole panel"
            }
            className="isolate min-w-0 shrink-0 overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-card max-md:max-h-[55%] md:w-[min(23rem,43%)] md:rounded-none md:border-t-0 md:border-l"
          >
            {browsing && (
              <header className="sticky top-0 z-10 flex min-w-0 items-start justify-between gap-2 border-b bg-card px-4 py-2.5 sm:px-5 sm:py-3">
                <div className="min-w-0 self-center wrap-anywhere">
                  <h2
                    className="text-lg leading-tight font-semibold"
                    ref={panelHeading}
                    tabIndex={-1}
                  >
                    {panel.kind === "list"
                      ? "Manholes"
                      : (selected?.name ?? "Manhole details")}
                  </h2>
                  {selected && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {selected.printedId}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="Close panel"
                  onClick={closePanel}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </header>
            )}
            <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
              {panel.kind === "list" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="manhole-search" className="sr-only">
                      Search by manhole ID or name
                    </FieldLabel>
                    <Input
                      ref={searchInput}
                      id="manhole-search"
                      type="search"
                      placeholder="Search by ID or name"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </Field>
                  {visibleAssets.length ? (
                    <ul className="divide-y rounded-xl border">
                      {visibleAssets.map(({ id, printedId, name, pin }) => (
                        <li key={id} className="min-w-0">
                          <Button
                            variant="ghost"
                            className="h-auto min-h-14 w-full justify-between gap-3 px-3 py-2.5 text-left whitespace-normal"
                            onClick={() => openDetails(id)}
                          >
                            <span className="grid min-w-0 gap-0.5 wrap-anywhere">
                              <span className="font-medium">{name}</span>
                              <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                                <span className="font-mono">{printedId}</span>
                                {!pin && <span>No map pin</span>}
                              </span>
                            </span>
                            <ArrowRightIcon
                              data-icon="inline-end"
                              aria-hidden="true"
                            />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm" role="status">
                      {matches
                        ? "No manholes match your search."
                        : "No manholes registered yet."}
                    </p>
                  )}
                </>
              )}
              {panel.kind === "details" && selected && (
                <ManholeDetails
                  manhole={selected}
                  locks={currentLocks}
                  map={map}
                  canEdit={canEdit}
                  refreshing={refreshing}
                  onAssign={(door) => {
                    setAnnouncement("");
                    setPanel({ kind: "lock", id: selected.id, door });
                  }}
                  onRemove={(lock) => {
                    setAnnouncement("");
                    setPanel({ kind: "remove-lock", id: selected.id, lock });
                  }}
                  onEdit={() => setPanel({ kind: "edit", id: selected.id })}
                  onMovePin={() => {
                    setDraftPin(selected.pin);
                    setPanel({
                      kind: "pin",
                      id: selected.id,
                      pinRevision: selected.pinRevision,
                    });
                  }}
                />
              )}
              {(panel.kind === "add" ||
                (panel.kind === "edit" && selected)) && (
                <AssetForm
                  siteId={siteId}
                  asset={panel.kind === "edit" ? selected : undefined}
                  hasMap={Boolean(map)}
                  pin={draftPin}
                  locationControlRef={setPinLocationTarget}
                  onRemovePin={() => setDraftPin(null)}
                  onSaved={assetSaved}
                  onSavingChange={setSavingLocation}
                  onCancel={
                    selected ? () => openDetails(selected.id) : closePanel
                  }
                />
              )}
              {panel.kind === "pin" && selected && (
                <PinForm
                  siteId={siteId}
                  asset={selected}
                  pinRevision={panel.pinRevision}
                  pin={draftPin}
                  locationControlRef={setPinLocationTarget}
                  saving={savingLocation}
                  onRemovePin={() => setDraftPin(null)}
                  onSaved={assetSaved}
                  onSavingChange={setSavingLocation}
                  onCancel={() => {
                    openDetails(selected.id);
                    refreshDetails();
                  }}
                />
              )}
              {panel.kind === "lock" && selected && (
                <LockForm
                  siteId={siteId}
                  manhole={selected}
                  door={panel.door}
                  onSaved={(lock) => lockSaved(lock, false)}
                  onCancel={() => openDetails(selected.id)}
                  onConflict={refreshDetails}
                />
              )}
              {panel.kind === "remove-lock" && selected && (
                <RemoveLockForm
                  siteId={siteId}
                  manhole={selected}
                  lock={panel.lock}
                  onSaved={(lock) => lockSaved(lock, true)}
                  onCancel={() => openDetails(selected.id)}
                  onConflict={refreshDetails}
                />
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
