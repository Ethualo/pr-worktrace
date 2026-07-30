import { describe, it, expect } from "vitest";
import { buildWorktraceEntries } from "./buildWorktraceEntries.js";
import type { ReviewIssue } from "@worktrace/core";
import type { PostedComment, ReactionSummary } from "@worktrace/github";

const issues: ReviewIssue[] = [
  {
    id: "issue-1",
    severity: "medium",
    file: "src/geo.ts",
    line: 12,
    summary: "부동소수점 오차",
    suggestion: "상수 추출",
  },
  {
    id: "issue-2",
    severity: "high",
    file: "src/geo.ts",
    line: 20,
    summary: "널 체크 누락",
    suggestion: "옵셔널 체이닝 사용",
  },
];

const postedComments: PostedComment[] = [
  { issueId: "issue-1", commentId: 100 },
  { issueId: "issue-2", commentId: 101 },
];

const reactions: ReactionSummary[] = [
  { commentId: 100, thumbsUp: 1, thumbsDown: 0 },
  { commentId: 101, thumbsUp: 0, thumbsDown: 1 },
];

describe("buildWorktraceEntries", () => {
  it("joins issues + posted comments + reactions into classified entries", () => {
    const entries = buildWorktraceEntries({ issues, postedComments, reactions });

    expect(entries).toEqual([
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
      },
    ]);
  });

  it("attaches an optional reason when a reply reason is provided for the issue", () => {
    const entries = buildWorktraceEntries({
      issues,
      postedComments,
      reactions,
      reasons: { "issue-2": "이미 상위에서 체크함" },
    });

    expect(entries[1].reason).toBe("이미 상위에서 체크함");
    expect(entries[0].reason).toBeUndefined();
  });

  it("attaches the commit id the issue was reviewed against, when provided", () => {
    const entries = buildWorktraceEntries({ issues, postedComments, reactions, commitId: "abc123" });

    expect(entries[0].commitId).toBe("abc123");
    expect(entries[1].commitId).toBe("abc123");
  });

  it("defaults to 'unclear' when a posted comment has no matching reaction summary", () => {
    const entries = buildWorktraceEntries({
      issues: [issues[0]],
      postedComments: [postedComments[0]],
      reactions: [],
    });

    expect(entries[0].decision).toBe("unclear");
  });
});
