import type { Vehicle } from "@/lib/types";
import { SEARCH_RADIUS_MILES } from "@/lib/types";

export function vehiclePhoto(listing: Vehicle): string {
  return listing.photo || `/cars/${listing.id}.jpg`;
}

export function formatPrice(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function vehicleTitle(listing: Vehicle): string {
  return `${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ""}`;
}

export function formatVehicleLine(listing: Vehicle): string {
  return `${listing.body} · ${listing.seats} seats · ${listing.drivetrain.toUpperCase()} · ${listing.miles.toLocaleString()} mi · ${formatPrice(listing.price)} · ${listing.fuel}`;
}

export function gradeCaption(grade: { total: number; band: string }): { score: string; word: string } {
  return { score: String(grade.total), word: grade.band };
}

export function resultsHeadline(shown: number, matched: number): string {
  if (!shown) return "No cars yet";
  if (matched > shown) return `Showing the top ${shown} of ${matched} by score`;
  return `Showing ${shown} by score`;
}

export function outboundLinks(listing: Vehicle): Array<{ name: string; href: string }> {
  const q = encodeURIComponent(`${listing.year} ${listing.make} ${listing.model} ${listing.zip}`);
  return [
    {
      name: "Cars.com",
      href:
        listing.listingUrl ||
        `https://www.cars.com/shopping/results/?stock_type=used&zip=${encodeURIComponent(listing.zip)}&keyword=${q}`,
    },
    {
      name: "Autotrader",
      href: `https://www.autotrader.com/cars-for-sale/all-cars?zip=${encodeURIComponent(listing.zip)}&searchRadius=50&makeCodeList=${encodeURIComponent(listing.make.toUpperCase())}`,
    },
    {
      name: "Search",
      href: `https://www.google.com/search?q=${q}`,
    },
  ];
}

export function milesToMeters(miles: number): number {
  return 1609.34 * miles;
}

export function radiusBounds(lat: number, lng: number, miles = SEARCH_RADIUS_MILES): [[number, number], [number, number]] {
  const dLat = miles / 69;
  const dLng = miles / (69 * Math.max(0.2, Math.abs(Math.cos((lat * Math.PI) / 180))));
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ];
}

export function readPhoneLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

export { SEARCH_RADIUS_MILES };
