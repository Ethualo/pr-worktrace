import { describe, it, expect, vi } from "vitest";
import type { GithubClient } from "@pr-worktrace/github";
import type { LLMProvider, ReviewResult } from "@pr-worktrace/core";
import { runReview } from "./runReview.js";

function makeFakeClient(diff: string, createReviewComment: ReturnType<typeof vi.fn>): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment,
      listFiles: vi.fn().mockResolvedValue({ data: [{ filename: "x", status: "modified", patch: diff }] }),
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

function makeFakeProvider(result: ReviewResult): LLMProvider {
  return { name: "fake", review: vi.fn().mockResolvedValue(result) };
}

describe("runReview", () => {
  it("posts a comment per issue and returns issues + posted comments", async () => {
    const createReviewComment = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 501 } })
      .mockResolvedValueOnce({ data: { id: 502 } });
    const client = makeFakeClient("--- a/x\n+++ b/x\n", createReviewComment);
    const provider = makeFakeProvider({
      issues: [
        { id: "issue-1", severity: "high", file: "x.ts", line: 3, summary: "s1", suggestion: "sg1" },
        { id: "issue-2", severity: "low", file: "y.ts", line: 9, summary: "s2", suggestion: "sg2" },
      ],
    });

    const result = await runReview(client, provider, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
    });

    expect(result.issues).toHaveLength(2);
    expect(result.postedComments).toEqual([
      { issueId: "issue-1", commentId: 501 },
      { issueId: "issue-2", commentId: 502 },
    ]);
    expect(createReviewComment).toHaveBeenCalledTimes(2);
  });

  it("skips posting and returns empty arrays when the provider finds no issues", async () => {
    const createReviewComment = vi.fn();
    const client = makeFakeClient("--- a/x\n+++ b/x\n", createReviewComment);
    const provider = makeFakeProvider({ issues: [] });

    const result = await runReview(client, provider, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
    });

    expect(result).toEqual({ issues: [], postedComments: [] });
    expect(createReviewComment).not.toHaveBeenCalled();
  });
});
