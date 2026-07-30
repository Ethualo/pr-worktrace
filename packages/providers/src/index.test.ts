import { describe, it, expect } from "vitest";
import { createProvider } from "./index.js";

describe("createProvider", () => {
  it("returns a claude provider when config.provider is 'claude'", () => {
    const provider = createProvider({ provider: "claude", apiKey: "fake-key", model: "claude-sonnet-5" });
    expect(provider.name).toBe("claude");
  });

  it("throws on unknown provider name", () => {
    expect(() =>
      createProvider({ provider: "unknown" as any, apiKey: "x", model: "x" })
    ).toThrow("Unknown provider: unknown");
  });
});
