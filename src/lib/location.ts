import { SEARCH_RADIUS_MILES } from "@/lib/types";

export type GeoPoint = { lat: number; lng: number; zip: string; label: string };

export const TAMPA: GeoPoint = {
  lat: 27.9506,
  lng: -82.4572,
  zip: "33602",
  label: "Tampa, FL",
};

const AREAS: GeoPoint[] = [
  TAMPA,
  { lat: 27.7676, lng: -82.6403, zip: "33701", label: "St. Petersburg, FL" },
  { lat: 27.9378, lng: -82.2859, zip: "33511", label: "Brandon, FL" },
  { lat: 27.9659, lng: -82.8001, zip: "33755", label: "Clearwater, FL" },
  { lat: 28.151, lng: -82.461, zip: "33549", label: "Lutz, FL" },
  { lat: 28.0186, lng: -82.1123, zip: "33563", label: "Plant City, FL" },
  { lat: 27.8661, lng: -82.3243, zip: "33578", label: "Riverview, FL" },
  { lat: 28.0395, lng: -81.9498, zip: "33801", label: "Lakeland, FL" },
];

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function resolveArea(label?: string | null): GeoPoint {
  if (!label) return TAMPA;
  const needle = label.trim().toLowerCase();
  const hit = AREAS.find((area) => area.label.toLowerCase() === needle || needle.includes(area.label.split(",")[0].toLowerCase()));
  return hit ?? TAMPA;
}

/** Use the phone point when it is near a known metro; otherwise Tampa. */
export function originFromCoords(here: { lat: number; lng: number } | null | undefined): GeoPoint {
  if (!here) return TAMPA;
  let best = AREAS[0];
  let bestMiles = Infinity;
  for (const area of AREAS) {
    const miles = haversineMiles(here, area);
    if (miles < bestMiles) {
      best = area;
      bestMiles = miles;
    }
  }
  if (bestMiles <= SEARCH_RADIUS_MILES * 3) {
    return { ...best, lat: here.lat, lng: here.lng };
  }
  return TAMPA;
}
