import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * "Use my location" for the Sites search card. Shown only with JavaScript.
 * The position is rounded on the device to 0.01° (about 1 km) and sent as
 * lat/lng in place of the typed area. Nothing is stored. Same rules as
 * ui/public/SearchForm.tsx.
 */
export function UseMyLocation({ formId }: { formId: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!hydrated || !("geolocation" in navigator)) return null;
  return (
    <div className="bar" style={{ marginTop: 12 }}>
      <button
        type="button"
        className="btn secondary"
        aria-busy={busy}
        onClick={() => {
          setError(null);
          setBusy(true);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const f = document.getElementById(formId);
              if (!(f instanceof HTMLFormElement)) return;
              const round = (n: number) =>
                (Math.round(n * 100) / 100).toFixed(2);
              const set = (name: string, value: string) => {
                const input = f.elements.namedItem(name);
                if (input instanceof HTMLInputElement) input.value = value;
              };
              set("lat", round(position.coords.latitude));
              set("lng", round(position.coords.longitude));
              set("area", "");
              const area = f.elements.namedItem("area");
              if (area instanceof HTMLInputElement) area.required = false;
              const near = f.elements.namedItem("near");
              if (near instanceof HTMLInputElement) near.disabled = true;
              f.submit();
            },
            () => {
              setBusy(false);
              setError(
                "We couldn't get your location. Type your suburb or town instead.",
              );
            },
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
          );
        }}
      >
        {busy ? "Finding you…" : "Use my location"}
      </button>
      {error ? (
        <span className="small" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
