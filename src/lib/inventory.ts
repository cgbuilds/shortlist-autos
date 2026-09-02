import { SAMPLE_VEHICLES } from "@/data/vehicles";
import { haversineMiles, originFromCoords, resolveArea, TAMPA, type GeoPoint } from "@/lib/location";
import type { BodyStyle, Drivetrain, Fuel, MustHaveMatrix, SearchMode, Vehicle } from "@/lib/types";
import { SEARCH_RADIUS_MILES } from "@/lib/types";

export type InventoryQuery = {
  matrix: MustHaveMatrix;
  mode: SearchMode;
  here?: { lat: number; lng: number } | null;
};

export type ProviderNotice = {
  level: "error" | "warning";
  message: string;
};

export type InventoryResult = {
  listings: Vehicle[];
  source: "live" | "sample";
  origin: GeoPoint;
  scanned: number;
  notice?: ProviderNotice;
};

type MarketcheckListing = {
  id?: string;
  vin?: string;
  heading?: string;
  price?: number;
  miles?: number;
  vdp_url?: string;
  media?: { photo_links?: string[]; photo_links_cached?: string[] };
  dealer?: {
    name?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: string | number;
    longitude?: string | number;
  };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    vehicle_type?: string;
    drivetrain?: string;
    fuel_type?: string;
    std_seating?: string;
    city_mpg?: number;
    highway_mpg?: number;
  };
};

type LiveFetch = {
  listings: Vehicle[];
  rawCount: number;
  status?: number;
  notice?: ProviderNotice;
};

export function mapBody(raw?: string): BodyStyle {
  const v = (raw || "").toLowerCase();
  if (v.includes("suv") || v.includes("crossover") || v.includes("utility") || v.includes("sport util")) return "suv";
  if (v.includes("pickup") || v.includes("truck")) return "truck";
  if (v.includes("van") || v.includes("minivan")) return "minivan";
  if (v.includes("hatch")) return "hatchback";
  if (v.includes("coupe")) return "coupe";
  if (v.includes("wagon")) return "wagon";
  return "sedan";
}

export function mapDrivetrain(raw?: string): Drivetrain {
  const v = (raw || "").toLowerCase();
  if (/\bawd\b/.test(v) || v.includes("all wheel") || v.includes("all-wheel")) return "awd";
  if (/\b4wd\b/.test(v) || v.includes("four wheel") || v.includes("four-wheel") || v.includes("4-wheel") || v.includes("4x4")) return "4wd";
  if (v.includes("rear") || /\brwd\b/.test(v)) return "rwd";
  return "fwd";
}

export function mapFuel(raw?: string): Fuel {
  const v = (raw || "").toLowerCase();
  if (v.includes("plug") || (v.includes("electric") && v.includes("unleaded"))) return "plugin-hybrid";
  if (v.includes("hybrid")) return "hybrid";
  if (v.includes("electric") || v === "ev") return "ev";
  return "gas";
}

function headingParts(heading?: string): { year?: number; make?: string; model?: string } {
  if (!heading) return {};
  const m = heading.match(/\b(20\d{2})\s+([A-Za-z0-9-]+)\s+(.+)/);
  if (!m) return {};
  const model = m[3].replace(/\s+(AWD|FWD|4WD|RWD|4x4)\b.*/i, "").trim();
  return { year: Number(m[1]), make: m[2], model };
}

export function mapLiveListing(row: MarketcheckListing): Vehicle | null {
  const fromHeading = headingParts(row.heading);
  const year = row.build?.year || fromHeading.year;
  const make = row.build?.make || fromHeading.make;
  const model = row.build?.model || fromHeading.model;
  if (!year || !make || !model) return null;
  const lat = Number(row.dealer?.latitude);
  const lng = Number(row.dealer?.longitude);
  const photo = row.media?.photo_links_cached?.[0] || row.media?.photo_links?.[0];
  const seats = Number.parseInt(String(row.build?.std_seating || "5"), 10);
  const price = typeof row.price === "number" && row.price > 0 ? row.price : null;
  if (price == null) return null;
  return {
    id: String(row.id || row.vin || `${year}-${make}-${model}-${price}`),
    year,
    make,
    model,
    trim: row.build?.trim || "",
    price,
    miles: row.miles ?? 0,
    city: row.dealer?.city || TAMPA.label.split(",")[0],
    state: row.dealer?.state || "FL",
    zip: row.dealer?.zip || TAMPA.zip,
    latitude: Number.isFinite(lat) ? lat : TAMPA.lat,
    longitude: Number.isFinite(lng) ? lng : TAMPA.lng,
    dealer: row.dealer?.name || "",
    body: mapBody(row.build?.body_type || row.build?.vehicle_type),
    drivetrain: mapDrivetrain(row.build?.drivetrain),
    seats: Number.isFinite(seats) && seats > 0 ? seats : 5,
    mpg: row.build?.highway_mpg ?? row.build?.city_mpg ?? null,
    fuel: mapFuel(row.build?.fuel_type),
    carplay: true,
    backupCamera: true,
    tow: mapBody(row.build?.body_type) === "truck",
    listingUrl: row.vdp_url,
    photo,
    featuresUnknown: true,
    drivetrainUnknown: !row.build?.drivetrain,
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

function providerMessage(status: number, body: string): string {
  if (status === 401 || status === 403) return `MarketCheck refused the key (HTTP ${status}).`;
  if (status === 429) return "MarketCheck rate-limited this search. Try again in a minute.";
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 180);
  return snippet ? `MarketCheck error ${status}: ${snippet}` : `MarketCheck error HTTP ${status}.`;
}

export function applyLocation(
  params: URLSearchParams,
  origin: GeoPoint,
  here?: { lat: number; lng: number } | null,
): void {
  params.set("radius", "100");
  // MarketCheck is zip+radius OR lat/lng+radius. Sending both often returns 0 rows.
  if (here) {
    params.set("latitude", String(here.lat));
    params.set("longitude", String(here.lng));
    return;
  }
  params.set("zip", origin.zip);
}

function applyRangeFilters(params: URLSearchParams, matrix: MustHaveMatrix): void {
  const yearMax = Math.max(matrix.minYear ?? new Date().getFullYear(), new Date().getFullYear());
  if (matrix.maxPrice) params.set("price_range", `1-${matrix.maxPrice}`);
  if (matrix.maxMiles) params.set("miles_range", `0-${matrix.maxMiles}`);
  if (matrix.minYear) params.set("year_range", `${matrix.minYear}-${yearMax}`);
  const body = marketcheckBody(matrix.body);
  if (body) params.set("body_type", body);
}

function preferMintListings(params: URLSearchParams, photos: boolean, cleanTitle: boolean): void {
  params.set("has_price", "true");
  params.set("has_miles", "true");
  params.set("sort_by", "miles");
  params.set("sort_order", "asc");
  if (photos) params.set("photo_links", "true");
  if (cleanTitle) params.set("carfax_clean_title", "true");
}

function baseParams(key: string, origin: GeoPoint, here?: { lat: number; lng: number } | null): URLSearchParams {
  const params = new URLSearchParams({
    api_key: key,
    car_type: "used",
    country: "us",
    rows: "50",
    start: "0",
  });
  applyLocation(params, origin, here);
  return params;
}

async function requestLive(url: string, signal: AbortSignal): Promise<LiveFetch> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    return { listings: [], rawCount: 0, status: res.status, notice: { level: "error", message: providerMessage(res.status, text) } };
  }
  let data: { listings?: MarketcheckListing[]; num_found?: number } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { listings: [], rawCount: 0, status: res.status, notice: { level: "error", message: "MarketCheck returned a non-JSON body." } };
  }
  const raw = data.listings || [];
  const listings = raw.map(mapLiveListing).filter((row): row is Vehicle => Boolean(row));
  if (!raw.length) {
    return {
      listings: [],
      rawCount: data.num_found ?? 0,
      status: res.status,
    };
  }
  if (!listings.length) {
    return {
      listings: [],
      rawCount: raw.length,
      status: res.status,
      notice: {
        level: "error",
        message: `MarketCheck returned ${raw.length} cars but none had enough data to list (year/make/model/price).`,
      },
    };
  }
  return { listings, rawCount: raw.length, status: res.status };
}

async function fetchLive(
  origin: GeoPoint,
  matrix: MustHaveMatrix,
  mode: SearchMode,
  here?: { lat: number; lng: number } | null,
): Promise<LiveFetch> {
  const key = process.env.MARKETCHECK_API_KEY?.trim();
  if (!key) {
    if (mode === "browse") return { listings: [], rawCount: 0 };
    return { listings: [], rawCount: 0, notice: { level: "error", message: "No MARKETCHECK_API_KEY on the server. Add it on Vercel and redeploy." } };
  }
  const yearMax = Math.max(matrix.minYear ?? new Date().getFullYear(), new Date().getFullYear());
  const attempts: Array<{ label: string; apply: (params: URLSearchParams) => void }> =
    mode === "grade"
      ? [
          {
            label: "filters",
            apply: (params) => {
              applyRangeFilters(params, matrix);
            },
          },
          {
            label: "year-price",
            apply: (params) => {
              if (matrix.maxPrice) params.set("price_range", `1-${matrix.maxPrice}`);
              if (matrix.minYear) params.set("year_range", `${matrix.minYear}-${yearMax}`);
            },
          },
          {
            label: "nearby-used",
            apply: () => undefined,
          },
        ]
      : [
          {
            label: "mint",
            apply: (params) => {
              applyRangeFilters(params, matrix);
              preferMintListings(params, true, true);
            },
          },
          {
            label: "photos",
            apply: (params) => {
              applyRangeFilters(params, matrix);
              preferMintListings(params, true, false);
            },
          },
          {
            label: "filters",
            apply: (params) => {
              applyRangeFilters(params, matrix);
              preferMintListings(params, false, false);
            },
          },
        ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    let last: LiveFetch = { listings: [], rawCount: 0 };
    let widened = false;
    for (const attempt of attempts) {
      const params = baseParams(key, origin, here ?? null);
      attempt.apply(params);
      last = await requestLive(`https://api.marketcheck.com/v2/search/car/active?${params.toString()}`, controller.signal);
      if (last.status && last.status >= 400) return last;
      if (last.listings.length) {
        if (widened) {
          last.notice = {
            level: "warning",
            message: "MarketCheck had 0 cars for the exact filters, so this is a wider used-car pull nearby, then graded locally (AWD and plug-in/hybrid are applied here, not in the feed query).",
          };
        }
        return last;
      }
      widened = true;
    }
    return {
      listings: [],
      rawCount: last.rawCount,
      status: last.status,
      notice: {
        level: "warning",
        message: `MarketCheck found 0 used cars near ${origin.label} even after widening the query.`,
      },
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      listings: [],
      rawCount: 0,
      notice: {
        level: "error",
        message: timedOut ? "MarketCheck timed out." : "Couldn’t reach MarketCheck.",
      },
    };
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
  const live = await fetchLive(origin, query.matrix, query.mode, query.here);
  if (live.listings.length) {
    return { listings: live.listings, source: "live", origin, scanned: live.listings.length, notice: live.notice };
  }
  if (query.mode === "grade") {
    return {
      listings: [],
      source: "live",
      origin,
      scanned: 0,
      notice: {
        level: live.notice?.level === "error" ? "error" : "warning",
        message:
          live.notice?.message ||
          `MarketCheck found 0 used cars near ${origin.label}. The Tampa sample set doesn’t cover this search, so nothing was substituted.`,
      },
    };
  }
  const sample = sampleNear(origin);
  const fallback = live.notice?.message || "Live inventory was empty, so this used the Tampa sample set.";
  return {
    listings: sample,
    source: "sample",
    origin,
    scanned: sample.length,
    notice: { level: live.notice?.level === "error" ? "error" : "warning", message: `${fallback} Showing sample cars instead.` },
  };
}
