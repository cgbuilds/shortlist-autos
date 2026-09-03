import type { BodyStyle, Fuel, MustHaveMatrix } from "@/lib/types";
import { emptyIntakeMatrix } from "@/lib/types";

export type PrefKey = "body" | "price" | "year" | "miles" | "drive" | "fuel" | "seats";

export type PrefOption = { label: string; apply: (draft: MustHaveMatrix) => MustHaveMatrix };

export type PrefDef = {
  key: PrefKey;
  offLabel: string;
  defaultIndex: number;
  options: PrefOption[];
};

function setBody(body: BodyStyle): PrefOption["apply"] {
  return (draft) => ({ ...draft, body });
}

export function yearOptions(now = new Date()): Array<{ year: number; label: string }> {
  const latest = now.getFullYear();
  const out: Array<{ year: number; label: string }> = [];
  for (let year = latest; year >= latest - 12; year -= 1) {
    out.push({ year, label: `${year}+` });
  }
  return out;
}

function defaultYearIndex(now = new Date()): number {
  const years = yearOptions(now);
  const hit = years.findIndex((item) => item.year === 2023);
  return hit >= 0 ? hit : Math.min(3, years.length - 1);
}

export const INTAKE_PREFS: PrefDef[] = [
  {
    key: "body",
    offLabel: "Type",
    defaultIndex: 0,
    options: [
      { label: "SUV", apply: setBody("suv") },
      { label: "Sedan", apply: setBody("sedan") },
      { label: "Truck", apply: setBody("truck") },
      { label: "Minivan", apply: setBody("minivan") },
      { label: "Hatch", apply: setBody("hatchback") },
    ],
  },
  {
    key: "price",
    offLabel: "Price",
    defaultIndex: 2,
    options: [
      { label: "$25k", apply: (d) => ({ ...d, maxPrice: 25000 }) },
      { label: "$35k", apply: (d) => ({ ...d, maxPrice: 35000 }) },
      { label: "$45k", apply: (d) => ({ ...d, maxPrice: 45000 }) },
      { label: "$60k", apply: (d) => ({ ...d, maxPrice: 60000 }) },
      { label: "$80k", apply: (d) => ({ ...d, maxPrice: 80000 }) },
    ],
  },
  {
    key: "year",
    offLabel: "Year",
    defaultIndex: defaultYearIndex(),
    options: yearOptions().map((item) => ({
      label: item.label,
      apply: (d) => ({ ...d, minYear: item.year }),
    })),
  },
  {
    key: "miles",
    offLabel: "Miles",
    defaultIndex: 2,
    options: [
      { label: "40k mi", apply: (d) => ({ ...d, maxMiles: 40000 }) },
      { label: "60k mi", apply: (d) => ({ ...d, maxMiles: 60000 }) },
      { label: "70k mi", apply: (d) => ({ ...d, maxMiles: 70000 }) },
      { label: "100k mi", apply: (d) => ({ ...d, maxMiles: 100000 }) },
      { label: "Any mi", apply: (d) => ({ ...d, maxMiles: null }) },
    ],
  },
  {
    key: "drive",
    offLabel: "Drive",
    defaultIndex: 0,
    options: [
      { label: "AWD", apply: (d) => ({ ...d, awd: true }) },
      { label: "2WD ok", apply: (d) => ({ ...d, awd: false }) },
    ],
  },
  {
    key: "fuel",
    offLabel: "Fuel",
    defaultIndex: 0,
    options: [
      { label: "Hybrid", apply: (d) => ({ ...d, fuel: null, preferFuel: "hybrid" as Fuel }) },
      { label: "Plug-in", apply: (d) => ({ ...d, fuel: null, preferFuel: "plugin-hybrid" as Fuel }) },
      { label: "EV", apply: (d) => ({ ...d, fuel: null, preferFuel: "ev" as Fuel }) },
      { label: "Gas", apply: (d) => ({ ...d, fuel: "gas" as Fuel, preferFuel: null }) },
    ],
  },
  {
    key: "seats",
    offLabel: "Seats",
    defaultIndex: 1,
    options: [
      { label: "5-seat", apply: (d) => ({ ...d, minSeats: 5 }) },
      { label: "3-row", apply: (d) => ({ ...d, minSeats: 7 }) },
      { label: "8-seat", apply: (d) => ({ ...d, minSeats: 8 }) },
    ],
  },
];

/** Selected option index per preference. Missing key = pill off. */
export type IntakeState = Partial<Record<PrefKey, number>>;

export function prefDef(key: PrefKey): PrefDef {
  return INTAKE_PREFS.find((item) => item.key === key) as PrefDef;
}

export function togglePref(state: IntakeState, key: PrefKey): IntakeState {
  if (state[key] != null) {
    const next = { ...state };
    delete next[key];
    return next;
  }
  return { ...state, [key]: prefDef(key).defaultIndex };
}

export function setPrefIndex(state: IntakeState, key: PrefKey, index: number): IntakeState {
  const def = prefDef(key);
  const clamped = Math.max(0, Math.min(def.options.length - 1, index));
  return { ...state, [key]: clamped };
}

export function matrixFromIntake(state: IntakeState, searchArea: string): MustHaveMatrix {
  return INTAKE_PREFS.reduce((draft, def) => {
    const index = state[def.key];
    if (index == null) return draft;
    const option = def.options[index] ?? def.options[def.defaultIndex];
    return option ? option.apply(draft) : draft;
  }, emptyIntakeMatrix(searchArea));
}

/** Keep body as the net. Loosen price/year/miles and treat AWD/fuel/seats as scoring, not a hard cut. */
export function widenForSearch(matrix: MustHaveMatrix): MustHaveMatrix {
  return {
    ...matrix,
    maxPrice: matrix.maxPrice != null ? Math.round(matrix.maxPrice * 1.18) : null,
    maxMiles: matrix.maxMiles != null ? Math.round(matrix.maxMiles * 1.3) : null,
    minYear: matrix.minYear != null ? Math.max(2008, matrix.minYear - 2) : null,
    awd: false,
    carplay: false,
    backupCamera: false,
    tow: false,
    fuel: null,
    minSeats: matrix.minSeats > 5 ? 5 : matrix.minSeats,
  };
}
