export type SearchStage = "pull" | "pool" | "extras" | "ai";

export const SEARCH_STAGE_LABEL: Record<SearchStage, string> = {
  pull: "Pulling listings",
  pool: "First cut",
  extras: "Dealer notes",
  ai: "Scoring",
};

const LINES: Record<SearchStage, string[]> = {
  pull: [
    "Combing a couple million used cars for ones that actually fit you.",
    "Casting a wide net across live inventory. Millions exist. We want your slice.",
    "Pulling listings near you from a very large pile of used cars.",
    "Searching the live market — not a canned dozen. Hang tight.",
    "Wide net first: grab the field, then we’ll get picky.",
  ],
  pool: [
    "Found a top 50. Now picking the cream of the crop.",
    "50 made the first cut. Narrowing to cars worth your time.",
    "Shortlist of 50 is in. Sorting keepers from almosts.",
    "Top 50 locked. Next: which of these actually deserve a score.",
    "First cut done. Cream of the crop coming up.",
  ],
  extras: [
    "Reading seller write-ups for one-owner and clean-car tells.",
    "Skimming dealer notes so the score isn’t just the odometer.",
    "Checking listing extras: comments, options, those little flags.",
    "Pulling the fine print the pills never asked for.",
  ],
  ai: [
    "Doing a bit of AI scoring on the finalists.",
    "Ranking the cream. Fit, value, and whether it looks carefully used.",
    "AI pass on the top picks. Scores incoming.",
    "Scoring the shortlist — not a vibe check, an actual rank.",
    "Last mile: pick 7–10 and put a number on each.",
  ],
};

export function pickStatusLine(stage: SearchStage, avoid?: string, rand: () => number = Math.random): string {
  const pool = LINES[stage];
  const choices = avoid ? pool.filter((line) => line !== avoid) : pool;
  const list = choices.length ? choices : pool;
  return list[Math.floor(rand() * list.length)] ?? pool[0];
}

export function statusPayload(stage: SearchStage, avoid?: string) {
  return { type: "status" as const, stage, label: SEARCH_STAGE_LABEL[stage], line: pickStatusLine(stage, avoid) };
}
