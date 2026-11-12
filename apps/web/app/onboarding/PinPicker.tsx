import { useState } from "react";
import { useFetcher } from "react-router";
import { CsrfField } from "../auth/ui";
import { CSRF_FIELD } from "../server/security/csrf";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import type { AreaCandidate } from "../server/geo/geocode";
import {
  DEFAULT_CENTRE,
  inSouthAfrica,
  pixelPin,
  PICKER_HEIGHT,
  PICKER_WIDTH,
  type Centre,
  type SelectedPin,
} from "./map";

export interface GeoReply {
  problem: string | null;
  candidates: AreaCandidate[] | null;
  map: { image: string; centre: Centre } | null;
}

export function PinPicker({
  csrf,
  action,
  initial,
  mapEnabled,
}: {
  csrf: string;
  action: string;
  initial: SelectedPin | null;
  mapEnabled: boolean;
}) {
  const places = useFetcher<GeoReply>();
  const map = useFetcher<GeoReply>();
  const [pin, setPin] = useState(initial);
  const [permission, setPermission] = useState(false);
  const [locating, setLocating] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [cursor, setCursor] = useState({
    x: PICKER_WIDTH / 2,
    y: PICKER_HEIGHT / 2,
  });
  const display = map.data?.map;
  function recenter(centre: Centre) {
    void map.submit(
      {
        [CSRF_FIELD]: csrf,
        intent: "map",
        lat: String(centre.lat),
        lng: String(centre.lng),
      },
      { method: "post", action },
    );
    setCursor({ x: PICKER_WIDTH / 2, y: PICKER_HEIGHT / 2 });
  }
  function device() {
    setPermission(false);
    setDeviceError("");
    if (!navigator.geolocation) {
      setDeviceError(
        "This browser cannot share a location. Search and tap the map instead.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const point = { lat: coords.latitude, lng: coords.longitude };
        if (!inSouthAfrica(point)) {
          setDeviceError("Choose a location in South Africa.");
          return;
        }
        setPin({ ...point, source: "device" });
        if (mapEnabled) recenter(point);
      },
      () => {
        setLocating(false);
        setDeviceError(
          "Your location wasn't shared. You can try again or search and tap the map.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }
  return (
    <section className="grid gap-4" aria-label="Choose your location">
      {mapEnabled ? (
        <>
          <places.Form
            method="post"
            action={action}
            className="flex flex-wrap items-end gap-2"
          >
            <CsrfField token={csrf} />
            <input type="hidden" name="intent" value="locate" />
            <TextField
              label="Find a place on the map"
              name="place"
              minLength={2}
              maxLength={120}
              required
              hint="Search only moves the map. It does not fill your public address or save a pin."
            />
            <Button type="submit" busy={places.state !== "idle"}>
              Find place
            </Button>
          </places.Form>
          {places.data?.candidates?.length ? (
            <ul className="grid gap-2" aria-label="Places found">
              {places.data.candidates.map((candidate, i) => (
                <li key={i}>
                  <Button type="button" onClick={() => recenter(candidate)}>
                    {candidate.label}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {places.data?.candidates?.length === 0 ? (
            <p role="status">No places found. Try a nearby street or suburb.</p>
          ) : null}
          {places.data?.problem ? (
            <p role="alert">{places.data.problem}</p>
          ) : null}
          {!display ? (
            <Button
              type="button"
              onClick={() => recenter(initial ?? DEFAULT_CENTRE)}
              busy={map.state !== "idle"}
            >
              Open location map
            </Button>
          ) : null}
          {display ? (
            <>
              <p className="type-caption">
                Tap the exact spot. With a keyboard, use the arrow keys to move
                the crosshair, then Enter to choose.
              </p>
              <button
                type="button"
                className="relative block w-full overflow-hidden rounded-xl"
                aria-label="Location map. Arrow keys move the crosshair; Enter chooses its position."
                onClick={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const x =
                    event.detail === 0
                      ? cursor.x
                      : ((event.clientX - bounds.left) / bounds.width) *
                        PICKER_WIDTH;
                  const y =
                    event.detail === 0
                      ? cursor.y
                      : ((event.clientY - bounds.top) / bounds.height) *
                        PICKER_HEIGHT;
                  const selected = pixelPin(display.centre, x, y);
                  if (selected) {
                    setPin(selected);
                    setCursor({ x, y });
                  }
                }}
                onKeyDown={(event) => {
                  const moves: Record<string, [number, number]> = {
                    ArrowLeft: [-10, 0],
                    ArrowRight: [10, 0],
                    ArrowUp: [0, -10],
                    ArrowDown: [0, 10],
                  };
                  const move = moves[event.key];
                  if (!move) return;
                  event.preventDefault();
                  setCursor((current) => ({
                    x: Math.max(0, Math.min(PICKER_WIDTH, current.x + move[0])),
                    y: Math.max(
                      0,
                      Math.min(PICKER_HEIGHT, current.y + move[1]),
                    ),
                  }));
                }}
              >
                <img
                  src={display.image}
                  alt="Mapbox map. Tap or use the crosshair to choose a location."
                  width={PICKER_WIDTH}
                  height={PICKER_HEIGHT}
                  className="block h-auto w-full"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute text-2xl font-bold text-black"
                  style={{
                    left: `${String((cursor.x / PICKER_WIDTH) * 100)}%`,
                    top: `${String((cursor.y / PICKER_HEIGHT) * 100)}%`,
                    transform: "translate(-50%, -50%)",
                    textShadow: "0 0 3px white",
                  }}
                >
                  +
                </span>
              </button>
            </>
          ) : null}
          {map.data?.problem ? <p role="alert">{map.data.problem}</p> : null}
        </>
      ) : (
        <p className="type-caption">
          Map search is temporarily unavailable. You can still choose your
          device location.
        </p>
      )}
      <div>
        <Button
          type="button"
          onClick={() => setPermission(true)}
          busy={locating}
        >
          Use my location
        </Button>
      </div>
      {permission ? (
        <div
          className="cx-surface grid gap-3 rounded-xl p-4"
          role="group"
          aria-label="Location permission"
        >
          <p>
            CarworX will ask your browser for your current location once. Only
            continue when you are at your business premises or mobile base. Your
            mobile base stays private.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={device}>
              Continue to browser permission
            </Button>
            <Button type="button" onClick={() => setPermission(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {deviceError ? <p role="alert">{deviceError}</p> : null}
      <p role="status">
        {pin
          ? `Location chosen (${pin.source === "device" ? "your device" : "map tap"}): ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. Your mobile base is never shown publicly.`
          : "No location chosen yet. Choose a map pin or your device location before continuing."}
      </p>
      {/* Associated with the separate application form, never the lookup forms. */}
      <input
        form="application-step"
        type="hidden"
        name="pinLat"
        value={pin?.lat ?? ""}
      />
      <input
        form="application-step"
        type="hidden"
        name="pinLng"
        value={pin?.lng ?? ""}
      />
      <input
        form="application-step"
        type="hidden"
        name="pinSource"
        value={pin?.source ?? ""}
      />
    </section>
  );
}
