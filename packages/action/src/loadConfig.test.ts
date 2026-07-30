import { describe, it, expect } from "vitest";
import { loadConfig } from "./loadConfig.js";

describe("loadConfig", () => {
  it("builds a ProviderConfig from valid claude config json and an api key", () => {
    const config = loadConfig({
      configJson: JSON.stringify({ provider: "claude", model: "claude-sonnet-5" }),
      apiKey: "sk-test-123",
    });

    expect(config).toEqual({ provider: "claude", apiKey: "sk-test-123", model: "claude-sonnet-5" });
  });

  it("builds a ProviderConfig from valid openai config json", () => {
    const config = loadConfig({
      configJson: JSON.stringify({ provider: "openai", model: "gpt-5" }),
      apiKey: "sk-test-456",
    });

    expect(config).toEqual({ provider: "openai", apiKey: "sk-test-456", model: "gpt-5" });
  });

  it("throws when provider is missing or unrecognized", () => {
    expect(() => loadConfig({ configJson: JSON.stringify({ model: "x" }), apiKey: "k" })).toThrow(
      "Invalid provider in config: undefined"
    );
    expect(() =>
      loadConfig({ configJson: JSON.stringify({ provider: "gemini", model: "x" }), apiKey: "k" })
    ).toThrow("Invalid provider in config: gemini");
  });

  it("throws when model is missing", () => {
    expect(() => loadConfig({ configJson: JSON.stringify({ provider: "claude" }), apiKey: "k" })).toThrow(
      "Missing model in config"
    );
  });

  it("throws when apiKey is empty", () => {
    expect(() =>
      loadConfig({ configJson: JSON.stringify({ provider: "claude", model: "x" }), apiKey: "" })
    ).toThrow("Missing API key");
  });
});
