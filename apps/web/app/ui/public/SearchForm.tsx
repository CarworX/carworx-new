import { useRef, useState, useSyncExternalStore } from "react";

import { CATEGORIES } from "../../catalogue/taxonomy";
import { Button } from "../Button";
import { TextField } from "../Field";

const RADII = [5, 10, 25, 50] as const;
const subscribe = () => () => undefined;
/** True after hydration; false during server rendering (no JavaScript). */
function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * The search form. Works without JavaScript: a plain GET to /search with an
 * area name. With JavaScript, "Use my location" asks the browser for the
 * position, rounds it to 0.01 degrees on the device (about 1 km) and submits
 * that instead. Nothing is stored.
 */
export function SearchForm({
  area = "",
  category = "",
  radius = 25,
}: {
  area?: string;
  category?: string;
  radius?: number;
}) {
  const form = useRef<HTMLFormElement>(null);
  const hydrated = useHydrated();
  const js =
    hydrated && typeof navigator !== "undefined" && "geolocation" in navigator;
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function useMyLocation() {
    setLocationError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const f = form.current;
        if (!f) return;
        const round = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
        const set = (name: string, value: string) => {
          const input = f.elements.namedItem(name);
          if (input instanceof HTMLInputElement) input.value = value;
        };
        set("lat", round(position.coords.latitude));
        set("lng", round(position.coords.longitude));
        set("area", "");
        f.submit();
      },
      () => {
        setLocating(false);
        setLocationError(
          "We couldn't get your location. Type your suburb or town instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <form
      ref={form}
      method="get"
      action="/search"
      className="cx-tile grid gap-4 p-5 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
      role="search"
      aria-label="Find a car service"
    >
      <TextField
        label="Suburb, town or postcode"
        name="area"
        defaultValue={area}
        autoComplete="address-level2"
        maxLength={80}
        hint="Used only for this search. Not stored."
        {...(locationError ? { error: locationError } : {})}
      />
      <input type="hidden" name="lat" defaultValue="" disabled={!js} />
      <input type="hidden" name="lng" defaultValue="" disabled={!js} />
      <div className="cx-field">
        <label htmlFor="search-category">Service</label>
        <select
          id="search-category"
          name="category"
          className="cx-input"
          defaultValue={category}
        >
          <option value="">All services</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="cx-field">
        <label htmlFor="search-radius">Distance</label>
        <select
          id="search-radius"
          name="radius"
          className="cx-input"
          defaultValue={String(radius)}
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              Within {r} km
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          Search
        </Button>
        {js ? (
          <Button type="button" busy={locating} onClick={useMyLocation}>
            Use my location
          </Button>
        ) : null}
      </div>
    </form>
  );
}
