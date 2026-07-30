import { describe, it, expect } from "vitest";
import { worklogFilePath } from "./worklogFilePath.js";

describe("worklogFilePath", () => {
  it("builds the standard .worklog/<date>-pr<number>.md path", () => {
    expect(worklogFilePath({ date: "2026-07-30", prNumber: 7 })).toBe(".worklog/2026-07-30-pr7.md");
  });

  it("does not zero-pad the PR number", () => {
    expect(worklogFilePath({ date: "2026-01-05", prNumber: 142 })).toBe(".worklog/2026-01-05-pr142.md");
  });
});
