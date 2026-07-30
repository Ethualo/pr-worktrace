import { describe, it, expect, vi } from "vitest";
import type { GithubClient } from "@worktrace/github";
import { requestReasonForRejections } from "./requestReasonForRejections.js";

function makeFakeClient(
  threads: Array<{ id: number; body: string; in_reply_to_id?: number }>,
  createReplyForReviewComment: ReturnType<typeof vi.fn>
): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn(),
      listReviewComments: vi.fn().mockResolvedValue({ data: threads }),
      createReplyForReviewComment,
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("requestReasonForRejections", () => {
  it("replies once to a rejected comment with no existing reply", async () => {
    const createReplyForReviewComment = vi.fn().mockResolvedValue({ data: { id: 900 } });
    const client = makeFakeClient([{ id: 100, body: "review comment" }], createReplyForReviewComment);

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 0, thumbsDown: 2 }],
    });

    expect(asked).toEqual(["issue-1"]);
    expect(createReplyForReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 100 })
    );
  });

  it("does not reply again when the comment already has a reply thread", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient(
      [
        { id: 100, body: "review comment" },
        { id: 101, body: "이유 한 줄만...", in_reply_to_id: 100 },
      ],
      createReplyForReviewComment
    );

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 0, thumbsDown: 2 }],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });

  it("does not reply to comments that are accepted or unclear", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient([{ id: 100, body: "review comment" }], createReplyForReviewComment);

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 2, thumbsDown: 0 }],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });

  it("skips a posted comment that has no reaction data yet", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient([{ id: 100, body: "review comment" }], createReplyForReviewComment);

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });
});
