import { describe, it, expect, vi } from "vitest";
import { listReviewComments } from "./listReviewComments.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(comments: Array<{ id: number; body: string; in_reply_to_id?: number }>): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn(),
      listReviewComments: vi.fn().mockResolvedValue({ data: comments }),
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("listReviewComments", () => {
  it("maps raw comments to threads, including inReplyToId when present", async () => {
    const client = makeFakeClient([
      { id: 1, body: "top-level" },
      { id: 2, body: "a reply", in_reply_to_id: 1 },
    ]);

    const threads = await listReviewComments(client, { owner: "acme", repo: "widgets", pullNumber: 7 });

    expect(threads).toEqual([
      { id: 1, body: "top-level" },
      { id: 2, body: "a reply", inReplyToId: 1 },
    ]);
  });

  it("throws when the client does not implement listReviewComments", async () => {
    const client: GithubClient = {
      pulls: { get: vi.fn(), createReviewComment: vi.fn() },
      reactions: { listForPullRequestReviewComment: vi.fn() },
      repos: { createOrUpdateFileContents: vi.fn() },
    };

    await expect(listReviewComments(client, { owner: "acme", repo: "widgets", pullNumber: 7 })).rejects.toThrow(
      "GithubClient does not support listReviewComments"
    );
  });
});
