import { describe, it, expect } from "vitest";
import type { Decision, WorkTraceEntry } from "./types.js";

describe("WorkTraceEntry shape", () => {
  it("accepts a well-formed entry with each decision value", () => {
    const decisions: Decision[] = ["accepted", "rejected", "unclear"];
    const entry: WorkTraceEntry = {
      issueId: "issue-1",
      file: "src/geo.ts",
      line: 12,
      severity: "medium",
      summary: "부동소수점 오차",
      suggestion: "상수 추출",
      decision: "accepted",
    };
    expect(decisions).toContain(entry.decision);
  });

  it("allows an optional reason field for rejected entries", () => {
    const entry: WorkTraceEntry = {
      issueId: "issue-2",
      file: "src/geo.ts",
      line: 20,
      severity: "high",
      summary: "널 체크 누락",
      suggestion: "옵셔널 체이닝 사용",
      decision: "rejected",
      reason: "이미 상위에서 체크함",
    };
    expect(entry.reason).toBe("이미 상위에서 체크함");
  });
});
