import { useState } from "react";
import { useFetcher } from "react-router";
import { CsrfField } from "../auth/ui";
import { CSRF_FIELD } from "../server/security/csrf";
import { ObIcon } from "../sites/onboarding/kit";
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
  title,
  hint,
  privateBase,
}: {
  csrf: string;
  action: string;
  initial: SelectedPin | null;
  mapEnabled: boolean;
  title: string;
  hint: string;
  /** Mobile only: the pin is a private base, never shown. */
  privateBase: boolean;
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
    const geolocation = (navigator as Partial<Navigator>).geolocation;
    if (!geolocation) {
      setDeviceError(
        "This browser cannot share a location. Search and tap the map instead.",
      );
      return;
    }
    setLocating(true);
    geolocation.getCurrentPosition(
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
    <div
      className="ob-q ob-q-pin"
      role="group"
      aria-labelledby="q-pin-t"
      aria-describedby="q-pin-h"
    >
      <p className="ob-qt" id="q-pin-t">
        {title}
      </p>
      <p className="ob-qh" id="q-pin-h">
        {hint}
      </p>
      {mapEnabled ? (
        <>
          <places.Form method="post" action={action} className="ob-mapsearch">
            <CsrfField token={csrf} />
            <input type="hidden" name="intent" value="locate" />
            <label className="cx-vh" htmlFor="ms-pin">
              Search for an address or place
            </label>
            <input
              className="ob-input"
              id="ms-pin"
              type="search"
              name="place"
              minLength={2}
              maxLength={120}
              required
              autoComplete="off"
              placeholder="Search an address or place"
              aria-describedby="ms-pin-note"
            />
            <button type="submit" className="cx-vh">
              Find place
            </button>
            <span className="cx-vh" id="ms-pin-note">
              Search only moves the map. It does not fill your public address or
              save a pin.
            </span>
            {places.data?.candidates?.length ? (
              <ul className="ob-results" aria-label="Places found">
                {places.data.candidates.map((candidate, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="ob-result"
                      onClick={() => {
                        recenter(candidate);
                      }}
                    >
                      <b>{candidate.label}</b>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </places.Form>
          {places.data?.candidates?.length === 0 ? (
            <p className="ob-qh" role="status">
              No places found. Try a nearby street or suburb.
            </p>
          ) : null}
          {places.data?.problem ? (
            <p className="ob-err" role="alert">
              {places.data.problem}
            </p>
          ) : null}
          {display ? (
            <button
              type="button"
              className="ob-map ob-map-live"
              aria-label="Location map. Arrow keys move the pin; Enter drops it."
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
                  y: Math.max(0, Math.min(PICKER_HEIGHT, current.y + move[1])),
                }));
              }}
            >
              <img
                src={display.image}
                alt="Mapbox map. Tap or use the arrow keys to choose a location."
                width={PICKER_WIDTH}
                height={PICKER_HEIGHT}
              />
              <svg
                className="pin"
                viewBox="0 0 34 44"
                aria-hidden="true"
                style={{
                  left: `${String((cursor.x / PICKER_WIDTH) * 100)}%`,
                  top: `${String((cursor.y / PICKER_HEIGHT) * 100)}%`,
                }}
              >
                <path
                  d="M17 43s15-14 15-26A15 15 0 0 0 2 17c0 12 15 26 15 26Z"
                  fill="#0d0f12"
                />
                <circle cx="17" cy="17" r="5.5" fill="#fff" />
              </svg>
            </button>
          ) : (
            <div className="ob-map ob-map-closed">
              <button
                type="button"
                className="cx-btn outlined sm"
                aria-busy={map.state !== "idle" || undefined}
                onClick={() => {
                  recenter(initial ?? DEFAULT_CENTRE);
                }}
              >
                <ObIcon name="pin" /> Open the map
              </button>
            </div>
          )}
          {map.data?.problem ? (
            <p className="ob-err" role="alert">
              {map.data.problem}
            </p>
          ) : null}
        </>
      ) : (
        <p className="ob-qh">
          Map search is temporarily unavailable. You can still use your device
          location.
        </p>
      )}
      <div className="ob-maprow">
        <p className="ob-pinread" role="status">
          {pin
            ? `Pin dropped (${pin.source === "device" ? "your location" : "map tap"})`
            : "Search, tap the map, or use your location"}
          {pin ? (
            <small>
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </small>
          ) : null}
        </p>
        <button
          type="button"
          className="cx-btn outlined sm"
          aria-busy={locating || undefined}
          onClick={() => {
            setPermission(true);
          }}
        >
          <ObIcon name="loc" /> Use my location
        </button>
      </div>
      {permission ? (
        <div className="ob-perm" role="region" aria-label="Location permission">
          <span className="ic">
            <ObIcon name="loc" />
          </span>
          <div>
            <b>Allow CarworX to use your location?</b>
            <p>
              We use it once to place your pin
              {privateBase ? ". Your base stays private" : ""}. We don&apos;t
              track you or keep your device&apos;s location. Your browser will
              ask you next.
            </p>
            <div className="acts">
              <button
                type="button"
                className="cx-btn primary sm"
                onClick={device}
              >
                Allow location
              </button>
              <button
                type="button"
                className="ob-link"
                onClick={() => {
                  setPermission(false);
                }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deviceError ? (
        <p className="ob-err" role="alert">
          {deviceError}
        </p>
      ) : null}
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
    </div>
  );
}
