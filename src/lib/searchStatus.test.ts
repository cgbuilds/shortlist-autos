import { describe, expect, it } from "vitest";
import { pickStatusLine, SEARCH_STAGE_LABEL, statusPayload } from "./searchStatus";

describe("search status lines", () => {
  it("has a label for every stage", () => {
    expect(SEARCH_STAGE_LABEL.pull).toMatch(/Pulling/i);
    expect(SEARCH_STAGE_LABEL.pool).toBeTruthy();
    expect(SEARCH_STAGE_LABEL.ai).toMatch(/Scor/i);
  });

  it("returns a pull line about the wide net", () => {
    const line = pickStatusLine("pull", undefined, () => 0);
    expect(line.length).toBeGreaterThan(20);
    expect(line).toMatch(/million|inventory|listings|net|market/i);
  });

  it("avoids repeating the last line when it can", () => {
    const first = pickStatusLine("ai", undefined, () => 0);
    const second = pickStatusLine("ai", first, () => 0);
    expect(second).not.toBe(first);
  });

  it("packs stage + line for the stream", () => {
    const event = statusPayload("pool");
    expect(event.type).toBe("status");
    expect(event.stage).toBe("pool");
    expect(event.label).toBe(SEARCH_STAGE_LABEL.pool);
    expect(event.line.length).toBeGreaterThan(10);
  });
});
