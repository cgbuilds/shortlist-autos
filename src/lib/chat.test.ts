import { describe, expect, it } from "vitest";
import { chatReply } from "./chat";
import { DEFAULT_MATRIX } from "./types";

describe("chatReply", () => {
  it("returns the live-style summary line", () => {
    const { reply, rescore, matrix } = chatReply("SUV under 30k AWD CarPlay Tampa", DEFAULT_MATRIX);
    expect(rescore).toBe(true);
    expect(matrix.maxPrice).toBe(30000);
    expect(reply).toMatch(/Updated must-haves:/);
    expect(reply).toMatch(/Tampa, FL/);
    expect(reply).toMatch(/AWD\/4WD/);
    expect(reply).toMatch(/CarPlay/);
  });
});
