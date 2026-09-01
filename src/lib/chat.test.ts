import { afterEach, describe, expect, it, vi } from "vitest";
import { chatReply, parseJsonObject, parseMustHaves, sanitizeMatrix } from "./chat";
import { openRouterChat } from "./openrouter";
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

describe("sanitizeMatrix", () => {
  it("keeps draft fields and maps SUV / 30k-style values", () => {
    const next = sanitizeMatrix({ body: "SUV", maxPrice: 30000, awd: true, junk: "nope" }, BROWSE_MATRIX);
    expect(next.body).toBe("suv");
    expect(next.maxPrice).toBe(30000);
    expect(next.awd).toBe(true);
    expect(next.searchArea).toBe("Tampa, FL");
    expect(next.maxMiles).toBeNull();
  });

  it("ignores invalid body values", () => {
    const next = sanitizeMatrix({ body: "spaceship" }, DEFAULT_MATRIX);
    expect(next.body).toBe("suv");
  });
});

describe("parseJsonObject", () => {
  it("reads JSON from a fenced blob", () => {
    const parsed = parseJsonObject('Sure.\n```json\n{"reply":"ok","rescore":false}\n```');
    expect(parsed?.reply).toBe("ok");
  });
});

describe("openRouterChat", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the parser when no OpenRouter key is set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const result = await openRouterChat("SUV under 30k Tampa", BROWSE_MATRIX);
    expect(result.source).toBe("parser");
    expect(result.matrix.body).toBe("suv");
    expect(result.rescore).toBe(false);
  });

  it("maps an OpenRouter JSON completion onto the matrix", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openrouter/auto");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "I heard SUV under $30,000 in Tampa. Confirm and I’ll search.",
                  matrix: { searchArea: "Tampa, FL", body: "suv", maxPrice: 30000, awd: true },
                  awaitingConfirm: true,
                  rescore: false,
                }),
              },
            },
          ],
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await openRouterChat("family SUV around 30k with AWD", BROWSE_MATRIX);
    expect(result.source).toBe("openrouter");
    expect(result.matrix.body).toBe("suv");
    expect(result.matrix.maxPrice).toBe(30000);
    expect(result.matrix.awd).toBe(true);
    expect(result.rescore).toBe(false);
    expect(result.reply).toMatch(/Confirm/);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const sent = JSON.parse(init.body) as { model: string };
    expect(sent.model).toBe("openrouter/auto");
  });
});
