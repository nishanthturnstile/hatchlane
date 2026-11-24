"use client";

import {
  CheckIcon,
  EllipsisIcon,
  Grid3X3Icon,
  LockIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset } from "@/lib/assets";
import { type Door, type ManholeLock, manholeDoors } from "@/lib/manhole-locks";
import { isWithinRadius, type SavedSiteMap } from "@/lib/site-map";

export function ManholeDetails({
  manhole,
  locks,
  map,
  canEdit,
  refreshing,
  onAssign,
  onRemove,
  onEdit,
  onMovePin,
}: {
  manhole: Asset;
  locks: ManholeLock[];
  map?: SavedSiteMap;
  canEdit: boolean;
  refreshing: boolean;
  onAssign: (door: Door) => void;
  onRemove: (lock: ManholeLock) => void;
  onEdit: () => void;
  onMovePin: () => void;
}) {
  const { pin, locationNote } = manhole;
  const locationFirst = Boolean(map && !pin);
  const locationDetails = (
    <section
      aria-labelledby="manhole-location-heading"
      className={locationFirst ? "grid gap-2.5" : "grid gap-2.5 border-t pt-4"}
    >
      <h3 id="manhole-location-heading" className="text-sm font-semibold">
        Location
      </h3>
      {locationNote && (
        <p className="text-sm wrap-anywhere whitespace-pre-wrap">
          {locationNote}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
        {pin ? (
          <>
            <span className="font-mono text-xs tabular-nums">
              {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
            </span>
            <Badge variant="secondary">
              <LockIcon data-icon="inline-start" aria-hidden="true" />
              Pin locked
            </Badge>
          </>
        ) : (
          "No pin saved"
        )}
      </div>
      {map && pin && !isWithinRadius(map, pin.latitude, pin.longitude) && (
        <p className="text-sm">Outside the current map area.</p>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {map && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={refreshing}
              onClick={onMovePin}
            >
              {pin ? "Unlock pin" : "Place pin"}
            </Button>
          )}
          <Button variant="ghost" className="min-h-11" onClick={onEdit}>
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            Edit manhole
          </Button>
        </div>
      )}
    </section>
  );
  return (
    <>
      {locationFirst && locationDetails}
      <section aria-labelledby="manhole-locks-heading" className="grid gap-2.5">
        <h3 id="manhole-locks-heading" className="text-sm font-semibold">
          Door locks
        </h3>
        {manholeDoors.map((door) => {
          const lock = locks.find(
            (entry) =>
              entry.manholeId === manhole.id && entry.door === door.number,
          );
          const CoverIcon = door.number === 1 ? SquareIcon : Grid3X3Icon;
          return (
            <section
              key={door.number}
              className="min-w-0 rounded-xl border bg-card"
            >
              <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                  <CoverIcon
                    className={
                      door.number === 1 ? "size-5 fill-current" : "size-5"
                    }
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm leading-snug font-semibold">
                    {door.cover}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Door {door.number}
                  </p>
                </div>
                {lock && canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11"
                        />
                      }
                      aria-label={`Door ${door.number} lock actions`}
                      title={`Door ${door.number} lock actions`}
                      disabled={refreshing}
                    >
                      <EllipsisIcon aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          className="min-h-11"
                          onClick={() => onRemove(lock)}
                        >
                          <Trash2Icon aria-hidden="true" />
                          Remove assignment
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-3 py-2.5">
                {lock ? (
                  <>
                    <dl className="min-w-0 flex-1">
                      <dt className="text-xs text-muted-foreground">Lock ID</dt>
                      <dd className="font-mono text-sm font-medium wrap-anywhere">
                        {lock.serial}
                      </dd>
                    </dl>
                    <Badge variant="secondary">
                      <CheckIcon data-icon="inline-start" aria-hidden="true" />
                      Assigned
                    </Badge>
                    {lock.description && (
                      <p className="w-full text-sm wrap-anywhere whitespace-pre-wrap text-muted-foreground">
                        {lock.description}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Badge variant="outline">Unassigned</Badge>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={refreshing}
                        aria-label={`Assign lock to Door ${door.number}`}
                        onClick={() => onAssign(door.number)}
                      >
                        <PlusIcon data-icon="inline-start" aria-hidden="true" />
                        Assign lock
                      </Button>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </section>

      {!locationFirst && locationDetails}
    </>
  );
}
