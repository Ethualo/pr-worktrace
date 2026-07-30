import { describe, it, expect, vi } from "vitest";
import { createOpenAiProvider } from "./openaiProvider.js";

describe("createOpenAiProvider", () => {
  it("parses the model's JSON response into ReviewIssue[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [
                  {
                    id: "issue-1",
                    severity: "medium",
                    file: "src/geo.ts",
                    line: 13,
                    summary: "부동소수점 오차",
                    suggestion: "상수 추출",
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    const provider = createOpenAiProvider({
      apiKey: "key",
      model: "nvidia/nim-model",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      fetchImpl: fetchMock as any,
    });
    const result = await provider.review("diff text");

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe("src/geo.ts");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
      }),
    );
  });

  it("returns empty issues when the model returns malformed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json" } }] }),
    });

    const provider = createOpenAiProvider({
      apiKey: "key",
      model: "nvidia/nim-model",
      fetchImpl: fetchMock as any,
    });
    const result = await provider.review("diff text");

    expect(result.issues).toEqual([]);
  });

  it("throws when the HTTP response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" });

    const provider = createOpenAiProvider({ apiKey: "key", model: "m", fetchImpl: fetchMock as any });

    await expect(provider.review("diff text")).rejects.toThrow(/401/);
  });
});
