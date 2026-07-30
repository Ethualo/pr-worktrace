import { describe, it, expect } from "vitest";
import type { ReviewIssue, LLMProvider } from "./types.js";

describe("ReviewIssue shape", () => {
  it("accepts a well-formed issue object", () => {
    const issue: ReviewIssue = {
      id: "issue-1",
      severity: "medium",
      file: "src/geo.ts",
      line: 42,
      summary: "haversine 계산 부동소수점 오차 미고려",
      suggestion: "반경 상수를 별도로 추출하세요",
    };
    expect(issue.severity).toBe("medium");
  });
});

describe("LLMProvider contract", () => {
  it("a conforming provider implements review()", async () => {
    const fakeProvider: LLMProvider = {
      name: "fake",
      review: async (diff: string) => ({ issues: [] }),
    };
    const result = await fakeProvider.review("diff text");
    expect(result.issues).toEqual([]);
  });
});
