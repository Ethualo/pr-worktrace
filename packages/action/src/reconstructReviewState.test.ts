import { describe, it, expect } from "vitest";
import type { ReviewCommentThread } from "@pr-worktrace/github";
import { reconstructReviewState } from "./reconstructReviewState.js";

describe("reconstructReviewState", () => {
  it("reconstructs an issue and posted comment from a tagged top-level thread", () => {
    const threads: ReviewCommentThread[] = [
      {
        id: 100,
        body: "<!-- worktrace-issue:issue-1 -->\n**[high]** null check missing\n\nAdd a guard before dereferencing.",
        path: "src/x.ts",
        line: 12,
      },
    ];

    const result = reconstructReviewState(threads);

    expect(result.issues).toEqual([
      {
        id: "issue-1",
        severity: "high",
        file: "src/x.ts",
        line: 12,
        summary: "null check missing",
        suggestion: "Add a guard before dereferencing.",
      },
    ]);
    expect(result.postedComments).toEqual([{ issueId: "issue-1", commentId: 100 }]);
  });

  it("preserves a multi-line suggestion", () => {
    const threads: ReviewCommentThread[] = [
      {
        id: 101,
        body: "<!-- worktrace-issue:issue-2 -->\n**[low]** style nit\n\nLine one.\nLine two.",
        path: "src/y.ts",
        line: 3,
      },
    ];

    const result = reconstructReviewState(threads);

    expect(result.issues[0]?.suggestion).toBe("Line one.\nLine two.");
  });

  it("skips reply threads (they are never the original issue comment)", () => {
    const threads: ReviewCommentThread[] = [
      {
        id: 200,
        body: "<!-- worktrace-issue:issue-3 -->\n**[medium]** s\n\nsg",
        inReplyToId: 199,
        path: "src/z.ts",
        line: 1,
      },
    ];

    const result = reconstructReviewState(threads);

    expect(result.issues).toEqual([]);
    expect(result.postedComments).toEqual([]);
  });

  it("skips top-level threads that don't match the worktrace-issue tag format (human comments)", () => {
    const threads: ReviewCommentThread[] = [{ id: 300, body: "looks good to me", path: "src/z.ts", line: 1 }];

    const result = reconstructReviewState(threads);

    expect(result.issues).toEqual([]);
    expect(result.postedComments).toEqual([]);
  });

  it("defaults file/line to empty/zero when the underlying comment has none", () => {
    const threads: ReviewCommentThread[] = [
      { id: 400, body: "<!-- worktrace-issue:issue-4 -->\n**[critical]** s\n\nsg" },
    ];

    const result = reconstructReviewState(threads);

    expect(result.issues[0]).toMatchObject({ file: "", line: 0 });
  });
});
