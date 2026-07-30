import { describe, it, expect, vi } from "vitest";
import { replyToReviewComment } from "./replyToReviewComment.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(): { client: GithubClient; createReplyForReviewComment: ReturnType<typeof vi.fn> } {
  const createReplyForReviewComment = vi.fn().mockResolvedValue({ data: { id: 999 } });
  const client: GithubClient = {
    pulls: { get: vi.fn(), createReviewComment: vi.fn(), createReplyForReviewComment },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
  return { client, createReplyForReviewComment };
}

describe("replyToReviewComment", () => {
  it("posts a reply and returns the new comment id", async () => {
    const { client, createReplyForReviewComment } = makeFakeClient();

    const id = await replyToReviewComment(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commentId: 100,
      body: "이유 한 줄만 남겨주시겠어요?",
    });

    expect(id).toBe(999);
    expect(createReplyForReviewComment).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      pull_number: 7,
      comment_id: 100,
      body: "이유 한 줄만 남겨주시겠어요?",
    });
  });

  it("throws when the client does not implement createReplyForReviewComment", async () => {
    const client: GithubClient = {
      pulls: { get: vi.fn(), createReviewComment: vi.fn() },
      reactions: { listForPullRequestReviewComment: vi.fn() },
      repos: { createOrUpdateFileContents: vi.fn() },
    };

    await expect(
      replyToReviewComment(client, { owner: "acme", repo: "widgets", pullNumber: 7, commentId: 100, body: "x" })
    ).rejects.toThrow("GithubClient does not support createReplyForReviewComment");
  });
});
