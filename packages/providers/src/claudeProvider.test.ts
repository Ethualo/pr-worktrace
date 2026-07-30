import { describe, it, expect, vi } from "vitest";
import { createClaudeProvider } from "./claudeProvider.js";

describe("createClaudeProvider", () => {
  it("parses the model's JSON response into ReviewIssue[]", async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
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
          ],
        }),
      },
    };

    const provider = createClaudeProvider({ client: fakeClient as any, model: "claude-sonnet-5" });
    const result = await provider.review("diff text");

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe("src/geo.ts");
    expect(fakeClient.messages.create).toHaveBeenCalledOnce();
  });

  it("returns empty issues when the model returns malformed JSON", async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "not json" }],
        }),
      },
    };

    const provider = createClaudeProvider({ client: fakeClient as any, model: "claude-sonnet-5" });
    const result = await provider.review("diff text");

    expect(result.issues).toEqual([]);
  });
});
