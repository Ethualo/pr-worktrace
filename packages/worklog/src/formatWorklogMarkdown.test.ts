import { describe, it, expect } from "vitest";
import { formatWorklogMarkdown } from "./formatWorklogMarkdown.js";
import type { WorkTraceEntry } from "./types.js";

const entries: WorkTraceEntry[] = [
  {
    issueId: "issue-1",
    file: "src/geo.ts",
    line: 12,
    severity: "medium",
    summary: "부동소수점 오차",
    suggestion: "상수 추출",
    decision: "accepted",
  },
  {
    issueId: "issue-2",
    file: "src/geo.ts",
    line: 20,
    severity: "high",
    summary: "널 체크 누락",
    suggestion: "옵셔널 체이닝 사용",
    decision: "rejected",
    reason: "이미 상위에서 체크함",
    commitId: "abc123",
  },
];

describe("formatWorklogMarkdown", () => {
  it("renders a heading plus one section per entry, with reason/commit only when present", () => {
    const markdown = formatWorklogMarkdown(entries, { prNumber: 7, date: "2026-07-30", repo: "acme/widgets" });

    expect(markdown).toBe(
      `# Work Trace — acme/widgets PR #7 (2026-07-30)

## issue-1 — accepted
- **File**: \`src/geo.ts:12\`
- **Severity**: medium
- **AI Suggestion**: 부동소수점 오차 → 상수 추출

## issue-2 — rejected
- **File**: \`src/geo.ts:20\`
- **Severity**: high
- **AI Suggestion**: 널 체크 누락 → 옵셔널 체이닝 사용
- **Reason**: 이미 상위에서 체크함
- **Commit**: \`abc123\`
`
    );
  });

  it("renders just the heading when there are no entries", () => {
    const markdown = formatWorklogMarkdown([], { prNumber: 7, date: "2026-07-30", repo: "acme/widgets" });

    expect(markdown).toBe("# Work Trace — acme/widgets PR #7 (2026-07-30)\n");
  });
});
