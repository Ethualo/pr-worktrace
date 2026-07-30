import { describe, it, expect } from "vitest";
import type { GithubClient, PostedComment, ReactionSummary } from "./types.js";

describe("GithubClient contract", () => {
  it("a conforming fake client satisfies the shape used by this package", async () => {
    const fakeClient: GithubClient = {
      pulls: {
        get: async () => ({ data: "diff text" }),
        createReviewComment: async () => ({ data: { id: 1 } }),
      },
      reactions: {
        listForPullRequestReviewComment: async () => ({ data: [] }),
      },
      repos: {
        createOrUpdateFileContents: async () => ({ data: {} }),
      },
    };
    const diffResult = await fakeClient.pulls.get({
      owner: "o",
      repo: "r",
      pull_number: 1,
    });
    expect(diffResult.data).toBe("diff text");
  });
});

describe("PostedComment / ReactionSummary shape", () => {
  it("accepts well-formed objects", () => {
    const comment: PostedComment = { issueId: "issue-1", commentId: 42 };
    const summary: ReactionSummary = { commentId: 42, thumbsUp: 1, thumbsDown: 0 };
    expect(comment.commentId).toBe(summary.commentId);
  });
});
