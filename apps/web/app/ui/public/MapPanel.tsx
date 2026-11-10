import { useRef, useState, useSyncExternalStore } from "react";

import { Button } from "../Button";
import { StatusNote } from "../Note";

const subscribe = () => () => undefined;

/** Mapbox GL JS, pinned (official CDN, released 2026-10-13; D-082). */
const GL_VERSION = "3.33.0";
const GL_BASE = `https://api.mapbox.com/mapbox-gl-js/v${GL_VERSION}`;

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface MapboxGlobal {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => {
    remove(): void;
    fitBounds(bounds: [[number, number], [number, number]], o: object): void;
  };
  Marker: new () => {
    setLngLat(p: [number, number]): {
      setPopup(p: unknown): { addTo(m: unknown): void };
      addTo(m: unknown): void;
    };
  };
  Popup: new (o: object) => { setText(t: string): unknown };
}

function load(src: string, kind: "script" | "style"): Promise<void> {
  return new Promise((resolve, reject) => {
    const el =
      kind === "script"
        ? Object.assign(document.createElement("script"), { src, async: true })
        : Object.assign(document.createElement("link"), {
            rel: "stylesheet",
            href: src,
          });
    el.addEventListener("load", () => {
      resolve();
    });
    el.addEventListener("error", () => {
      reject(new Error("map asset unavailable"));
    });
    document.head.appendChild(el);
  });
}

/**
 * Optional map of FIXED premises only. The list stays primary; nothing loads
 * until the visitor asks. Mobile providers never get a pin (A10). The public
 * token comes from /api/map-session, which also counts the daily map quota.
 */
export function MapPanel({ points }: { points: readonly MapPoint[] }) {
  const js = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [state, setState] = useState<"idle" | "loading" | "open" | "off">(
    "idle",
  );
  const box = useRef<HTMLDivElement>(null);

  async function open() {
    setState("loading");
    try {
      const response = await fetch("/api/map-session", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("map unavailable");
      const { token } = await response.json<{ token?: unknown }>();
      if (typeof token !== "string") throw new Error("map unavailable");
      await Promise.all([
        load(`${GL_BASE}/mapbox-gl.css`, "style"),
        load(`${GL_BASE}/mapbox-gl.js`, "script"),
      ]);
      const gl = (window as unknown as { mapboxgl?: MapboxGlobal }).mapboxgl;
      if (!gl || !box.current) throw new Error("map unavailable");
      gl.accessToken = token;
      const map = new gl.Map({
        container: box.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [points[0]?.lng ?? 28.04, points[0]?.lat ?? -26.2],
        zoom: 11,
        cooperativeGestures: true,
      });
      for (const p of points) {
        new gl.Marker()
          .setLngLat([p.lng, p.lat])
          .setPopup(new gl.Popup({ offset: 24 }).setText(p.name))
          .addTo(map);
      }
      if (points.length > 1) {
        const lats = points.map((p) => p.lat);
        const lngs = points.map((p) => p.lng);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 40, maxZoom: 14 },
        );
      }
      setState("open");
    } catch {
      setState("off");
    }
  }

  if (!js || points.length === 0) return null;
  return (
    <section aria-label="Map of workshops" className="mt-6 grid gap-3">
      {state === "idle" || state === "loading" ? (
        <div>
          <Button
            busy={state === "loading"}
            onClick={() => {
              void open();
            }}
          >
            Show workshops on a map
          </Button>
        </div>
      ) : null}
      {state === "off" ? (
        <StatusNote title="The map isn't available right now.">
          The list below has every result.
        </StatusNote>
      ) : null}
      <div
        ref={box}
        className={state === "open" ? "h-[360px] rounded-2xl" : "hidden"}
        role="region"
        aria-label="Map. Mobile providers are not shown on the map."
      />
    </section>
  );
}
