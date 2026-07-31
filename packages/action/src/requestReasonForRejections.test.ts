import { describe, it, expect, vi } from "vitest";
import type { GithubClient, ReviewCommentThread } from "@pr-worktrace/github";
import { requestReasonForRejections } from "./requestReasonForRejections.js";

function makeFakeClient(createReplyForReviewComment: ReturnType<typeof vi.fn>): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn(),
      listReviewComments: vi.fn(),
      createReplyForReviewComment,
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("requestReasonForRejections", () => {
  it("replies once to a rejected comment with no existing reply", async () => {
    const createReplyForReviewComment = vi.fn().mockResolvedValue({ data: { id: 900 } });
    const client = makeFakeClient(createReplyForReviewComment);
    const threads: ReviewCommentThread[] = [{ id: 100, body: "review comment" }];

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      threads,
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
    const client = makeFakeClient(createReplyForReviewComment);
    const threads: ReviewCommentThread[] = [
      { id: 100, body: "review comment" },
      { id: 101, body: "이유 한 줄만...", inReplyToId: 100 },
    ];

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      threads,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 0, thumbsDown: 2 }],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });

  it("does not reply to comments that are accepted or unclear", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient(createReplyForReviewComment);
    const threads: ReviewCommentThread[] = [{ id: 100, body: "review comment" }];

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      threads,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 2, thumbsDown: 0 }],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });

  it("skips a posted comment that has no reaction data yet", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient(createReplyForReviewComment);
    const threads: ReviewCommentThread[] = [{ id: 100, body: "review comment" }];

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      threads,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });
});
