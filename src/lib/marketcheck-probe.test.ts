import { describe, expect, it } from "vitest";
import { keyFingerprint, summarizeProbeStatus } from "./marketcheck-probe";

describe("MarketCheck probe helpers", () => {
  it("fingerprints a key without exposing it", () => {
    expect(keyFingerprint("abcd1234wxyz")).toEqual({ keyLength: 12, keySuffix: "wxyz" });
  });

  it("explains refused keys", () => {
    expect(summarizeProbeStatus(401, '{"error":"invalid"}')).toContain("refused the key");
    expect(summarizeProbeStatus(401, '{"error":"invalid"}')).toContain("not the client secret");
    expect(summarizeProbeStatus(403, "")).toContain("403");
  });
});
