import { describe, it, expect, vi } from "vitest";
import { pollReactions } from "./pollReactions.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(reactionsByCommentId: Record<number, Array<{ content: string }>>): GithubClient {
  return {
    pulls: { get: vi.fn(), createReviewComment: vi.fn() },
    reactions: {
      listForPullRequestReviewComment: vi.fn().mockImplementation(async ({ comment_id }: { comment_id: number }) => ({
        data: reactionsByCommentId[comment_id] ?? [],
      })),
    },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("pollReactions", () => {
  it("summarizes thumbs up/down counts per comment id", async () => {
    const client = makeFakeClient({
      100: [{ content: "+1" }, { content: "+1" }, { content: "heart" }],
      101: [{ content: "-1" }],
    });

    const summaries = await pollReactions(client, { owner: "acme", repo: "widgets" }, [100, 101]);

    expect(summaries).toEqual([
      { commentId: 100, thumbsUp: 2, thumbsDown: 0 },
      { commentId: 101, thumbsUp: 0, thumbsDown: 1 },
    ]);
  });

  it("returns zero counts for a comment with no reactions", async () => {
    const client = makeFakeClient({});

    const summaries = await pollReactions(client, { owner: "acme", repo: "widgets" }, [200]);

    expect(summaries).toEqual([{ commentId: 200, thumbsUp: 0, thumbsDown: 0 }]);
  });
});
