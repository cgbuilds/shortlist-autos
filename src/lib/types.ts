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

/** Open the app on nearby inventory — no must-haves until the user confirms them. */
export const BROWSE_MATRIX: MustHaveMatrix = {
  searchArea: "Tampa, FL",
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
};

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
};

export const SEARCH_RADIUS_MILES = 20;
export const SESSION_KEY = "shortlist-autos-session-v1";
export const DEMO_COOKIE = "sa_demo";
