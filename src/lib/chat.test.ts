import { describe, expect, it } from "vitest";
import { chatReply, parseMustHaves } from "./chat";
import { BROWSE_MATRIX, DEFAULT_MATRIX } from "./types";

describe("chatReply", () => {
  it("parses must-haves and waits for confirm instead of searching", () => {
    const { reply, rescore, matrix, awaitingConfirm } = chatReply("SUV under 30k AWD CarPlay Tampa", DEFAULT_MATRIX);
    expect(rescore).toBe(false);
    expect(awaitingConfirm).toBe(true);
    expect(matrix.maxPrice).toBe(30000);
    expect(reply).toMatch(/I heard:/);
    expect(reply).toMatch(/Tampa, FL/);
    expect(reply).toMatch(/AWD\/4WD/);
    expect(reply).toMatch(/CarPlay/);
  });

  it("runs the search only after confirm", () => {
    const draft = parseMustHaves("SUV under 30k AWD CarPlay Tampa", BROWSE_MATRIX);
    const { rescore, awaitingConfirm, reply } = chatReply("confirm", draft, true);
    expect(rescore).toBe(true);
    expect(awaitingConfirm).toBe(false);
    expect(reply).toMatch(/Searching nearby listings/);
  });

  it("treats yes as confirm", () => {
    expect(chatReply("yes", DEFAULT_MATRIX).rescore).toBe(true);
  });
});
