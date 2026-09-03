export type BodyStyle = "suv" | "crossover" | "sedan" | "minivan" | "truck" | "hatchback" | "coupe" | "wagon";
export type Fuel = "gas" | "hybrid" | "plugin-hybrid" | "ev";
export type Drivetrain = "fwd" | "rwd" | "awd" | "4wd";
export type GradeBand = "superb" | "excellent" | "good" | "ok" | "miss";

export type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  miles: number;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  dealer: string;
  body: BodyStyle;
  drivetrain: Drivetrain;
  seats: number;
  mpg: number | null;
  fuel: Fuel;
  carplay: boolean;
  backupCamera: boolean;
  tow: boolean;
  listingUrl?: string;
  photo?: string;
  /** Live feed often omits options; don’t fail CarPlay/camera/tow must-haves. */
  featuresUnknown?: boolean;
  drivetrainUnknown?: boolean;
  carfaxOneOwner?: boolean;
  carfaxCleanTitle?: boolean;
  certified?: boolean;
  exteriorColor?: string;
  interiorColor?: string;
  daysOnMarket?: number;
  distMiles?: number;
  sellerComments?: string;
  options?: string[];
  features?: string[];
};

export type LayoutMode = "gallery" | "split";

export const LAYOUT_KEY = "shortlist-autos-layout-v1";

export type MustHaveMatrix = {
  searchArea: string;
  maxPrice: number | null;
  maxMiles: number | null;
  minYear: number | null;
  body: BodyStyle | null;
  awd: boolean;
  minSeats: number;
  carplay: boolean;
  backupCamera: boolean;
  tow: boolean;
  fuel: Fuel | null;
  /** Scored as a plus, not a hard filter — e.g. "plugin ideally, not strictly". */
  preferFuel: Fuel | null;
};

export type Grade = {
  total: number;
  band: GradeBand;
  mustHaveFailed: boolean;
  why: string;
};

export type RankedRow = {
  listing: Vehicle;
  grade: Grade;
};

export type SearchMode = "browse" | "grade";

/** First-look shortlist: recent, priced, and low-mile in any city. */
export const BROWSE_MAX_PRICE = 45000;
export const BROWSE_MAX_MILES = 70000;
export const BROWSE_MAX_AGE_YEARS = 3;

export function browseMinYear(now = new Date()): number {
  return now.getFullYear() - BROWSE_MAX_AGE_YEARS;
}

export function browseMatrix(searchArea = "Tampa, FL", now = new Date()): MustHaveMatrix {
  return {
    searchArea,
    maxPrice: BROWSE_MAX_PRICE,
    maxMiles: BROWSE_MAX_MILES,
    minYear: browseMinYear(now),
    body: null,
    awd: false,
    minSeats: 5,
    carplay: false,
    backupCamera: false,
    tow: false,
    fuel: null,
    preferFuel: null,
  };
}

/** Empty intake: location only. Cars wait until the shopper searches. */
export function emptyIntakeMatrix(searchArea = "Tampa, FL"): MustHaveMatrix {
  return {
    searchArea,
    maxPrice: null,
    maxMiles: null,
    minYear: null,
    body: null,
    awd: false,
    minSeats: 5,
    carplay: false,
    backupCamera: false,
    tow: false,
    fuel: null,
    preferFuel: null,
  };
}
export const BROWSE_MATRIX: MustHaveMatrix = browseMatrix();

/** Example confirmed shortlist (tests / chat parser baseline). */
export const DEFAULT_MATRIX: MustHaveMatrix = {
  searchArea: "Tampa, FL",
  maxPrice: 35000,
  maxMiles: 80000,
  minYear: 2018,
  body: "suv",
  awd: false,
  minSeats: 5,
  carplay: false,
  backupCamera: false,
  tow: false,
  fuel: null,
  preferFuel: null,
};

export const SEARCH_RADIUS_MILES = 20;
export const SHORTLIST_POOL = 50;
export const SHORTLIST_KEEP_MIN = 7;
export const SHORTLIST_KEEP_MAX = 10;
export const SESSION_KEY = "shortlist-autos-session-v2";
export const DEMO_COOKIE = "sa_demo";
