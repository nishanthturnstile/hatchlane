"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  CrosshairIcon,
  LocateFixedIcon,
  MapIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import {
  addProtocol,
  type GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
} from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Asset, AssetPin } from "@/lib/assets";
import {
  containsBounds,
  coverageBounds,
  coverageCircle,
  defaultMapRadius,
  isWithinRadius,
  type MapBounds,
  type SiteLocation,
} from "@/lib/site-map";
import { cn } from "@/lib/utils";

let archiveProtocol: Protocol | undefined;

function fitCoverage(map: MapLibreMap, area: SiteLocation, selecting: boolean) {
  const bounds = coverageBounds(area);
  const options = { padding: 28, maxZoom: 17 };
  if (!selecting) {
    map.fitBounds(bounds, { ...options, duration: 0 });
    return;
  }
  const camera = map.cameraForBounds(bounds, options);
  // The midpoint of projected bounds can differ from the selected coordinates.
  if (camera)
    map.jumpTo({ ...camera, center: [area.longitude, area.latitude] });
}

function fitSiteSelection(
  map: MapLibreMap,
  area: SiteLocation,
  bounds: MapBounds,
) {
  const { latitude, longitude } = area;
  if (containsBounds(bounds, [longitude, latitude, longitude, latitude])) {
    fitCoverage(map, area, true);
  }
}

function locationFeatures(
  location: SiteLocation | undefined,
  maskOutside: boolean,
) {
  const circle = location ? coverageCircle(location) : [];
  return {
    type: "FeatureCollection" as const,
    features: location
      ? [
          {
            type: "Feature" as const,
            properties: { kind: "coverage" },
            geometry: {
              type: "Polygon" as const,
              coordinates: [circle],
            },
          },
          {
            type: "Feature" as const,
            properties: { kind: "center" },
            geometry: {
              type: "Point" as const,
              coordinates: [location.longitude, location.latitude],
            },
          },
          ...(maskOutside
            ? [
                {
                  type: "Feature" as const,
                  properties: { kind: "mask" },
                  geometry: {
                    type: "Polygon" as const,
                    coordinates: [
                      [
                        [-180, -85],
                        [180, -85],
                        [180, 85],
                        [-180, 85],
                        [-180, -85],
                      ],
                      circle,
                    ],
                  },
                },
              ]
            : []),
        ]
      : [],
  };
}

export default function SiteMapCanvas({
  archiveUrl,
  bounds,
  location,
  cameraTarget,
  autoLocate = false,
  onPick,
  assets,
  draftPin,
  onPlaceAsset,
  pinLocationTarget,
  onOpenAsset,
  fullHeight = false,
  focusedAssetId,
  selectionDisabled = false,
  onReload,
}: {
  archiveUrl: string;
  bounds: MapBounds;
  location?: SiteLocation;
  cameraTarget?: SiteLocation;
  autoLocate?: boolean;
  onPick?: (latitude: number, longitude: number, automatic: boolean) => boolean;
  assets?: Asset[];
  draftPin?: AssetPin | null;
  onPlaceAsset?: (pin: AssetPin) => void;
  pinLocationTarget?: HTMLElement | null;
  onOpenAsset?: (id: string) => void;
  fullHeight?: boolean;
  focusedAssetId?: string;
  selectionDisabled?: boolean;
  onReload?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>(null);
  const overlay = useRef<GeoJSONSource>(null);
  const locationRequest = useRef(0);
  const attemptedAutoLocation = useRef(false);
  const lastReportedCenter = useRef<
    { latitude: number; longitude: number } | undefined
  >(undefined);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [tileError, setTileError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [west, south, east, north] = bounds;
  const selecting = Boolean(onPick);
  const placingAsset = Boolean(onPlaceAsset);
  const pick = useRef(onPick);
  pick.current = selectionDisabled ? undefined : onPick;
  const placeAsset = useRef(onPlaceAsset);
  placeAsset.current = selectionDisabled ? undefined : onPlaceAsset;
  const selected = useRef(location);
  selected.current = location;
  const currentDraft = useRef(draftPin);
  currentDraft.current = draftPin;

  const cancelLocationRequest = useCallback(() => {
    attemptedAutoLocation.current = true;
    locationRequest.current++;
    setLocating(false);
    setLocationMessage(undefined);
  }, []);

  const syncCameraCenter = useCallback((map: MapLibreMap) => {
    if (!pick.current) return;
    const { lat, lng } = map.getCenter().wrap();
    const latitude = Number(lat.toFixed(6));
    const longitude = Number(lng.toFixed(6));
    const last = lastReportedCenter.current;
    if (last?.latitude === latitude && last.longitude === longitude) return;

    lastReportedCenter.current = { latitude, longitude };
    pick.current(latitude, longitude, false);
  }, []);

  const moveDraft = useCallback((latitude: number, longitude: number) => {
    if (!placeAsset.current) return false;
    locationRequest.current++;
    setLocating(false);
    const site = selected.current;
    if (!site || !isWithinRadius(site, latitude, longitude)) {
      setLocationMessage("Place the pin inside the saved map area.");
      return false;
    }
    setLocationMessage(undefined);
    placeAsset.current?.({ latitude, longitude });
    return true;
  }, []);

  const findLocation = useCallback(
    (automatic: boolean) => {
      if (!navigator.geolocation) {
        setLocationMessage("This browser cannot share its location.");
        return;
      }
      const request = ++locationRequest.current;
      const draftAtRequest = currentDraft.current;
      setLocationMessage(undefined);
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        ({ coords, timestamp }) => {
          if (request !== locationRequest.current || !mapRef.current) return;
          setLocating(false);
          if (
            (placingAsset && !placeAsset.current) ||
            (selecting && !pick.current)
          )
            return;
          if (placingAsset && currentDraft.current !== draftAtRequest) return;
          const { latitude, longitude } = coords;
          const site = selected.current;
          if (selecting) {
            if (
              !containsBounds(
                [west, south, east, north],
                [longitude, latitude, longitude, latitude],
              )
            ) {
              setLocationMessage(
                "Your location is outside the installed map. Choose a site on the map or enter coordinates.",
              );
              return;
            }
            if (pick.current?.(latitude, longitude, automatic)) {
              lastReportedCenter.current = undefined;
              fitCoverage(
                mapRef.current,
                {
                  latitude,
                  longitude,
                  radiusKm: site?.radiusKm ?? defaultMapRadius,
                },
                true,
              );
            }
          } else if (site && isWithinRadius(site, latitude, longitude)) {
            placeAsset.current?.({
              latitude,
              longitude,
              gps: {
                accuracyMetres: coords.accuracy,
                capturedAt: new Date(timestamp).toISOString(),
              },
            });
            mapRef.current.easeTo({
              center: [longitude, latitude],
              zoom: Math.max(17, mapRef.current.getZoom()),
            });
          } else {
            setLocationMessage("Your location is outside this saved site map.");
          }
        },
        (error) => {
          if (request !== locationRequest.current) return;
          setLocating(false);
          const reason =
            error.code === 1
              ? "Location access is blocked in your browser."
              : "Your current location is unavailable.";
          setLocationMessage(
            selecting
              ? `${reason} Choose a site on the map or enter coordinates.`
              : reason,
          );
        },
        {
          timeout: 10000,
          maximumAge: automatic ? 30000 : 0,
          enableHighAccuracy: placingAsset,
        },
      );
    },
    [selecting, placingAsset, west, south, east, north],
  );

  useEffect(() => {
    if (!container.current) return;
    setStatus("loading");
    setTileError(false);
    if (!archiveProtocol) {
      setWorkerUrl(
        new URL(
          "maplibre-gl/dist/maplibre-gl-worker.mjs",
          import.meta.url,
        ).toString(),
      );
      archiveProtocol = new Protocol();
      addProtocol("pmtiles", archiveProtocol.tile);
    }

    let map: MapLibreMap;
    try {
      const url = new URL(archiveUrl, window.location.origin);
      // PMTiles can retain a rejected archive header promise across map instances.
      if (attempt > 0) archiveProtocol.add(new PMTiles(url.href));
      map = new MapLibreMap({
        container: container.current,
        bounds: [west, south, east, north],
        fitBoundsOptions: { padding: 24 },
        maxZoom: 19,
        dragPan: selecting ? { maxSpeed: 0 } : true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        style: {
          version: 8,
          sources: {
            basemap: {
              type: "vector",
              url: `pmtiles://${url.href}`,
              attribution:
                '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
            },
            coverage: {
              type: "geojson",
              data: locationFeatures(undefined, false),
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#efefe7" },
            },
            {
              id: "water",
              type: "fill",
              source: "basemap",
              "source-layer": "water",
              paint: { "fill-color": "#bbd5d9" },
            },
            {
              id: "road-edges",
              type: "line",
              source: "basemap",
              "source-layer": "roads",
              paint: {
                "line-color": "#c6c4b4",
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  5,
                  0.5,
                  12,
                  2,
                  15,
                  4,
                ],
              },
            },
            {
              id: "roads",
              type: "line",
              source: "basemap",
              "source-layer": "roads",
              paint: {
                "line-color": "#fffefa",
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  5,
                  0.25,
                  12,
                  1.2,
                  15,
                  2.5,
                ],
              },
            },
            {
              id: "buildings",
              type: "fill",
              source: "basemap",
              "source-layer": "buildings",
              paint: {
                "fill-color": "#b5b2a2",
                "fill-outline-color": "#9e9b8d",
              },
            },
            {
              id: "place-labels",
              type: "symbol",
              source: "basemap",
              "source-layer": "places",
              filter: selecting
                ? [
                    "match",
                    ["get", "kind"],
                    ["region", "locality", "neighbourhood"],
                    true,
                    false,
                  ]
                : ["==", ["get", "kind"], "locality"],
              layout: {
                "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
                "text-font": ["Arial"],
                "text-size": 11,
                "symbol-sort-key": ["coalesce", ["get", "sort_rank"], 1000],
              },
              paint: {
                "text-color": "#454736",
                "text-halo-color": "#efefe7",
                "text-halo-width": 1.25,
              },
            },
            {
              id: "outside-site",
              type: "fill",
              source: "coverage",
              filter: ["==", ["get", "kind"], "mask"],
              paint: { "fill-color": "#efefe7", "fill-antialias": false },
            },
            {
              id: "coverage-fill",
              type: "fill",
              source: "coverage",
              filter: ["==", ["get", "kind"], "coverage"],
              paint: { "fill-color": "#6d8138", "fill-opacity": 0.14 },
            },
            {
              id: "boundary",
              type: "line",
              source: "coverage",
              filter: ["==", ["get", "kind"], "coverage"],
              paint: {
                "line-color": "#52662a",
                "line-width": 2,
                "line-dasharray": [3, 2],
              },
            },
            {
              id: "center",
              type: "circle",
              source: "coverage",
              filter: ["==", ["get", "kind"], "center"],
              layout: { visibility: selecting ? "none" : "visible" },
              paint: {
                "circle-radius": 7,
                "circle-color": "#465523",
                "circle-stroke-color": "#fffefa",
                "circle-stroke-width": 2,
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error("Site map could not initialize", error);
      setStatus("error");
      return;
    }

    mapRef.current = map;
    map.on("wheel", (event) => {
      if (!event.originalEvent.ctrlKey && !event.originalEvent.metaKey) {
        event.preventDefault();
      }
    });
    map.on("movestart", ({ originalEvent }) => {
      if (!pick.current || !originalEvent) return;
      cancelLocationRequest();
      lastReportedCenter.current = undefined;
    });
    map.on("move", ({ originalEvent }) => {
      if (originalEvent) syncCameraCenter(map);
    });
    map.on("moveend", ({ originalEvent }) => {
      if (originalEvent) syncCameraCenter(map);
    });
    map.on("click", ({ lngLat }) => {
      if (pick.current) {
        cancelLocationRequest();
        if (
          !containsBounds(
            [west, south, east, north],
            [lngLat.lng, lngLat.lat, lngLat.lng, lngLat.lat],
          )
        ) {
          setLocationMessage(
            "Choose a center inside the installed map region.",
          );
          return;
        }
        lastReportedCenter.current = undefined;
        if (pick.current(lngLat.lat, lngLat.lng, false)) {
          fitCoverage(
            map,
            {
              latitude: Number(lngLat.lat.toFixed(6)),
              longitude: Number(lngLat.lng.toFixed(6)),
              radiusKm: selected.current?.radiusKm ?? defaultMapRadius,
            },
            true,
          );
        }
      } else if (placeAsset.current) {
        moveDraft(lngLat.lat, lngLat.lng);
      }
    });
    let loaded = false;
    map.on("error", ({ error }) => {
      console.error("Site map could not load", error.message);
      setTileError(true);
      if (!loaded) setStatus("error");
    });
    map.on("load", () => {
      loaded = true;
      overlay.current = map.getSource<GeoJSONSource>("coverage") ?? null;
      if (selecting && selected.current) {
        fitSiteSelection(map, selected.current, [west, south, east, north]);
      }
      setStatus("ready");
    });
    return () => {
      locationRequest.current++;
      lastReportedCenter.current = undefined;
      mapRef.current = null;
      overlay.current = null;
      map.remove();
    };
  }, [
    archiveUrl,
    west,
    south,
    east,
    north,
    moveDraft,
    attempt,
    cancelLocationRequest,
    selecting,
    syncCameraCenter,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Entering or leaving asset placement cancels the previous location request.
  useEffect(() => {
    locationRequest.current++;
    setLocating(false);
    setLocationMessage(undefined);
  }, [placingAsset, selectionDisabled]);

  useEffect(() => {
    if (
      status === "ready" &&
      autoLocate &&
      !selectionDisabled &&
      !attemptedAutoLocation.current
    ) {
      attemptedAutoLocation.current = true;
      findLocation(true);
    }
  }, [status, autoLocate, selectionDisabled, findLocation]);

  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const radiusKm = location?.radiusKm;
  useEffect(() => {
    if (status !== "ready") return;
    const area =
      latitude === undefined ||
      longitude === undefined ||
      radiusKm === undefined
        ? undefined
        : { latitude, longitude, radiusKm };
    overlay.current?.setData(locationFeatures(area, !selecting));
    const map = mapRef.current;
    if (!selecting && map && area) fitCoverage(map, area, false);
  }, [latitude, longitude, radiusKm, selecting, status]);

  // Typed form edits steer the camera. Coordinates reported by map gestures only update the preview.
  useEffect(() => {
    const map = mapRef.current;
    if (map && cameraTarget) {
      lastReportedCenter.current = undefined;
      fitSiteSelection(map, cameraTarget, [west, south, east, north]);
    }
  }, [cameraTarget, west, south, east, north]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !location) return;

    if (placingAsset && draftPin) {
      const draftCoordinates: [number, number] = [
        draftPin.longitude,
        draftPin.latitude,
      ];
      const element = document.createElement("button");
      element.type = "button";
      element.className = cn(
        "size-11 rounded-full border-4 border-background bg-primary shadow-md",
        !selectionDisabled && "cursor-move",
      );
      element.setAttribute("aria-label", "Draft manhole pin");
      element.disabled = selectionDisabled;
      element.addEventListener("click", (event) => event.stopPropagation());
      const marker = new Marker({ element, draggable: !selectionDisabled })
        .setLngLat(draftCoordinates)
        .addTo(map);
      function commitMove() {
        const { lat, lng } = marker.getLngLat();
        if (!moveDraft(lat, lng)) marker.setLngLat(draftCoordinates);
      }
      marker.on("dragend", commitMove);
      element.addEventListener("keydown", (event) => {
        const offsets: Record<string, [number, number]> = {
          ArrowLeft: [-5, 0],
          ArrowRight: [5, 0],
          ArrowUp: [0, -5],
          ArrowDown: [0, 5],
        };
        const offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault();
        event.stopPropagation();
        const point = map.project(marker.getLngLat());
        const { lat, lng } = map.unproject([
          point.x + offset[0],
          point.y + offset[1],
        ]);
        if (moveDraft(lat, lng)) {
          requestAnimationFrame(() =>
            map
              .getCanvasContainer()
              .querySelector<HTMLButtonElement>(
                '[aria-label="Draft manhole pin"]',
              )
              ?.focus(),
          );
        }
      });
      return () => {
        marker.remove();
      };
    }

    if (placingAsset || !assets || !onOpenAsset) return;
    const markers = assets.flatMap(({ id, printedId, pin }) => {
      if (!pin || !isWithinRadius(location, pin.latitude, pin.longitude))
        return [];

      const element = document.createElement("button");
      element.type = "button";
      element.className = buttonVariants({
        variant: id === focusedAssetId ? "default" : "outline",
        size: "default",
        className:
          "min-h-11 cursor-pointer border-2 border-background px-3 font-mono shadow-sm before:size-2 before:rounded-full before:bg-current",
      });
      element.setAttribute("aria-label", `Open manhole ${printedId}`);
      if (id === focusedAssetId) element.setAttribute("aria-current", "true");
      element.title = printedId;
      element.textContent =
        printedId.length > 18 ? `${printedId.slice(0, 16)}…` : printedId;
      element.addEventListener("click", () => {
        element.focus();
        onOpenAsset(id);
      });
      return new Marker({ element })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map);
    });

    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [
    assets,
    draftPin,
    focusedAssetId,
    location,
    moveDraft,
    onOpenAsset,
    placingAsset,
    selectionDisabled,
    status,
  ]);

  const focusedPin = assets?.find(({ id }) => id === focusedAssetId)?.pin;
  const focusLatitude = focusedPin?.latitude;
  const focusLongitude = focusedPin?.longitude;
  useEffect(() => {
    if (
      status !== "ready" ||
      focusLatitude === undefined ||
      focusLongitude === undefined
    )
      return;
    const map = mapRef.current;
    const site = selected.current;
    if (map && site && isWithinRadius(site, focusLatitude, focusLongitude))
      map.easeTo({
        center: [focusLongitude, focusLatitude],
        zoom: Math.max(15, map.getZoom()),
      });
  }, [focusLatitude, focusLongitude, status]);

  const locationFeedback = (locating || locationMessage) && (
    <p role="status" className="text-sm">
      {locating ? "Finding your location…" : locationMessage}
    </p>
  );
  const locateDisabled = status !== "ready" || locating || selectionDisabled;
  const canChooseCenter = status === "ready" && !selectionDisabled;
  return (
    <div className={cn("flex flex-col gap-2", fullHeight && "relative h-full")}>
      <section
        data-map-status={status}
        aria-label={onPick ? "Choose site center on the map" : "Saved site map"}
        className={cn(
          "relative w-full overflow-hidden bg-muted",
          fullHeight ? "h-full" : "h-72 rounded-lg border md:h-96",
        )}
      >
        <div ref={container} className="size-full" />
        {selecting && status === "ready" && (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center"
            aria-hidden="true"
          >
            <CrosshairIcon className="size-8 rounded-full bg-background/85 p-1 text-foreground shadow-sm" />
          </div>
        )}
        <fieldset
          className={cn(
            "absolute right-3 z-10 flex flex-col items-end gap-1",
            fullHeight
              ? "bottom-9 gap-0 rounded-xl border bg-card p-0.5 shadow-sm"
              : "top-3",
          )}
        >
          <legend className="sr-only">Map controls</legend>
          <Button
            type="button"
            variant={fullHeight ? "ghost" : "outline"}
            size="icon"
            className="size-11"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={status !== "ready"}
            onClick={() => mapRef.current?.zoomIn()}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant={fullHeight ? "ghost" : "outline"}
            size="icon"
            className="size-11"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={status !== "ready"}
            onClick={() => mapRef.current?.zoomOut()}
          >
            <MinusIcon aria-hidden="true" />
          </Button>
          {!placingAsset && (
            <Button
              type="button"
              variant={fullHeight ? "ghost" : "outline"}
              size="icon"
              className="size-11"
              aria-label="Use current location"
              title="Use current location"
              aria-busy={locating}
              disabled={locateDisabled}
              onClick={() => findLocation(false)}
            >
              <LocateFixedIcon aria-hidden="true" />
            </Button>
          )}
        </fieldset>
      </section>
      {selecting && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 self-start"
            disabled={!canChooseCenter}
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              cancelLocationRequest();
              lastReportedCenter.current = undefined;
              map.fitBounds(bounds, { padding: 24, duration: 0 });
              syncCameraCenter(map);
            }}
          >
            <MapIcon data-icon="inline-start" aria-hidden="true" />
            Show map region
          </Button>
          <p className="text-sm text-muted-foreground">
            Drag the map to place the site under the crosshair. You can also tap
            a point or enter coordinates below.
          </p>
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-2 empty:hidden",
          fullHeight &&
            "absolute bottom-5 left-3 z-10 max-w-[55%] rounded-md bg-card px-3 py-2 shadow-sm",
        )}
      >
        {!placingAsset && locationFeedback}
        {status === "loading" && (
          <p role="status" className="text-sm">
            Loading site map…
          </p>
        )}
        {(status === "error" || tileError) && (
          <>
            <p role="status" className="text-sm">
              {status === "ready" && "Some map details could not load."}
              {status === "error" &&
                fullHeight &&
                "The site map could not load. You can still find manholes by ID or name."}
              {status === "error" &&
                !fullHeight &&
                "The map could not load. Retry or enter coordinates below."}
            </p>
            <Button
              type="button"
              className="min-h-11 self-start"
              variant="outline"
              onClick={() => {
                onReload?.();
                setAttempt((value) => value + 1);
              }}
            >
              Retry map
            </Button>
          </>
        )}
      </div>
      {placingAsset &&
        pinLocationTarget &&
        createPortal(
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-busy={locating}
              disabled={locateDisabled}
              onClick={() => findLocation(false)}
            >
              <LocateFixedIcon data-icon="inline-start" aria-hidden="true" />
              Get current location
            </Button>
            {locationFeedback}
          </>,
          pinLocationTarget,
        )}
    </div>
  );
}
