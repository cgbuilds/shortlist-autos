import { SAMPLE_VEHICLES } from "@/data/vehicles";
import { haversineMiles, originFromCoords, resolveArea, TAMPA, type GeoPoint } from "@/lib/location";
import type { BodyStyle, Drivetrain, Fuel, MustHaveMatrix, SearchMode, Vehicle } from "@/lib/types";
import { SEARCH_RADIUS_MILES } from "@/lib/types";

export type InventoryQuery = {
  matrix: MustHaveMatrix;
  mode: SearchMode;
  here?: { lat: number; lng: number } | null;
};

export type InventoryResult = {
  listings: Vehicle[];
  source: "live" | "sample";
  origin: GeoPoint;
};

type MarketcheckListing = {
  id?: string;
  vin?: string;
  price?: number;
  miles?: number;
  vdp_url?: string;
  media?: { photo_links?: string[]; photo_links_cached?: string[] };
  dealer?: {
    name?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: string;
    longitude?: string;
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    drivetrain?: string;
    fuel_type?: string;
    std_seating?: string;
    city_mpg?: number;
    highway_mpg?: number;
  };
};

function mapBody(raw?: string): BodyStyle {
  const v = (raw || "").toLowerCase();
  if (v.includes("suv") || v.includes("crossover")) return "suv";
  if (v.includes("pickup") || v.includes("truck")) return "truck";
  if (v.includes("van") || v.includes("minivan")) return "minivan";
  if (v.includes("hatch")) return "hatchback";
  if (v.includes("coupe")) return "coupe";
  if (v.includes("wagon")) return "wagon";
  return "sedan";
}

function mapDrivetrain(raw?: string): Drivetrain {
  const v = (raw || "").toLowerCase();
  if (v.includes("all") || v === "awd") return "awd";
  if (v.includes("four") || v.includes("4wd") || v.includes("4x4")) return "4wd";
  if (v.includes("rear") || v === "rwd") return "rwd";
  return "fwd";
}

function mapFuel(raw?: string): Fuel {
  const v = (raw || "").toLowerCase();
  if (v.includes("plug")) return "plugin-hybrid";
  if (v.includes("hybrid")) return "hybrid";
  if (v.includes("electric") || v === "ev") return "ev";
  return "gas";
}

function mapLiveListing(row: MarketcheckListing): Vehicle | null {
  const year = row.build?.year;
  const make = row.build?.make;
  const model = row.build?.model;
  if (!year || !make || !model || !row.price) return null;
  const lat = Number(row.dealer?.latitude);
  const lng = Number(row.dealer?.longitude);
  const photo = row.media?.photo_links_cached?.[0] || row.media?.photo_links?.[0];
  const seats = Number.parseInt(row.build?.std_seating || "5", 10);
  return {
    id: row.id || row.vin || `${year}-${make}-${model}-${row.price}`,
    year,
    make,
    model,
    trim: row.build?.trim || "",
    price: row.price,
    miles: row.miles ?? 0,
    city: row.dealer?.city || TAMPA.label.split(",")[0],
    state: row.dealer?.state || "FL",
    zip: row.dealer?.zip || TAMPA.zip,
    latitude: Number.isFinite(lat) ? lat : TAMPA.lat,
    longitude: Number.isFinite(lng) ? lng : TAMPA.lng,
    dealer: row.dealer?.name || "",
    body: mapBody(row.build?.body_type),
    drivetrain: mapDrivetrain(row.build?.drivetrain),
    seats: Number.isFinite(seats) && seats > 0 ? seats : 5,
    mpg: row.build?.highway_mpg ?? row.build?.city_mpg ?? null,
    fuel: mapFuel(row.build?.fuel_type),
    carplay: year >= 2019,
    backupCamera: year >= 2016,
    tow: mapBody(row.build?.body_type) === "truck",
    listingUrl: row.vdp_url,
    photo,
  };
}

function marketcheckBody(body: MustHaveMatrix["body"]): string | null {
  if (body === "suv" || body === "crossover") return "SUV";
  if (body === "truck") return "Pickup";
  if (body === "sedan") return "Sedan";
  if (body === "minivan") return "Van";
  if (body === "hatchback") return "Hatchback";
  if (body === "coupe") return "Coupe";
  if (body === "wagon") return "Wagon";
  return null;
}

async function fetchLive(origin: GeoPoint, matrix: MustHaveMatrix, mode: SearchMode): Promise<Vehicle[]> {
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    api_key: key,
    latitude: String(origin.lat),
    longitude: String(origin.lng),
    radius: String(SEARCH_RADIUS_MILES),
    car_type: "used",
    country: "us",
    rows: "40",
    start: "0",
  });
  if (mode === "grade") {
    if (matrix.maxPrice) params.set("price_range", `1-${matrix.maxPrice}`);
    if (matrix.maxMiles) params.set("miles_range", `0-${matrix.maxMiles}`);
    if (matrix.minYear) params.set("year_range", `${matrix.minYear}-${new Date().getFullYear() + 1}`);
    const body = marketcheckBody(matrix.body);
    if (body) params.set("body_type", body);
    if (matrix.awd) params.set("drivetrain", "AWD,4WD");
    if (matrix.fuel === "ev") params.set("fuel_type", "Electric");
    if (matrix.fuel === "hybrid") params.set("fuel_type", "Hybrid");
    if (matrix.fuel === "gas") params.set("fuel_type", "Unleaded");
  }
  const url = `https://api.marketcheck.com/v2/search/car/active?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { listings?: MarketcheckListing[] };
    return (data.listings || []).map(mapLiveListing).filter((row): row is Vehicle => Boolean(row));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function sampleNear(origin: GeoPoint): Vehicle[] {
  const nearby = SAMPLE_VEHICLES.filter((car) => haversineMiles(origin, { lat: car.latitude, lng: car.longitude }) <= SEARCH_RADIUS_MILES * 2.5);
  return nearby.length ? nearby : SAMPLE_VEHICLES;
}

export async function loadInventory(query: InventoryQuery): Promise<InventoryResult> {
  const origin = query.here ? originFromCoords(query.here) : resolveArea(query.matrix.searchArea);
  const live = await fetchLive(origin, query.matrix, query.mode);
  if (live.length) return { listings: live, source: "live", origin };
  return { listings: sampleNear(origin), source: "sample", origin };
}
