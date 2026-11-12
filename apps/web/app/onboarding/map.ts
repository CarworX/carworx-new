export interface Centre {
  lat: number;
  lng: number;
}
export interface SelectedPin extends Centre {
  source: "tap" | "device";
}
export const PICKER_WIDTH = 640;
export const PICKER_HEIGHT = 360;
export const PICKER_ZOOM = 12;
export const DEFAULT_CENTRE: Centre = { lat: -26.2041, lng: 28.0473 };

export function inSouthAfrica(point: Centre): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -35 &&
    point.lat <= -22 &&
    point.lng >= 16 &&
    point.lng <= 33
  );
}

/** Mapbox's north-up static images use Web Mercator and a 512px world at zoom zero. */
export function pixelPin(
  centre: Centre,
  x: number,
  y: number,
): SelectedPin | null {
  if (
    !inSouthAfrica(centre) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > PICKER_WIDTH ||
    y < 0 ||
    y > PICKER_HEIGHT
  )
    return null;
  const size = 512 * 2 ** PICKER_ZOOM;
  const latitude = (centre.lat * Math.PI) / 180;
  const worldY =
    (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2;
  const result = {
    lng: centre.lng + ((x - PICKER_WIDTH / 2) * 360) / size,
    lat:
      (Math.atan(
        Math.sinh(
          Math.PI * (1 - 2 * (worldY + (y - PICKER_HEIGHT / 2) / size)),
        ),
      ) *
        180) /
      Math.PI,
    source: "tap" as const,
  };
  return inSouthAfrica(result) ? result : null;
}
