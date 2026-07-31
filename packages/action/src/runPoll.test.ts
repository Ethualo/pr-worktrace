import { describe, it, expect, vi } from "vitest";
import type { GithubClient } from "@pr-worktrace/github";
import { runPoll } from "./runPoll.js";

const TAGGED_COMMENT = "<!-- worktrace-issue:issue-1 -->\n**[high]** s\n\nsg";

function makeFakeClient(options: {
  threads: Array<{ id: number; body: string; in_reply_to_id?: number; path?: string; line?: number }>;
  reactionsByCommentId?: Record<number, Array<{ content: string }>>;
  createReplyForReviewComment?: ReturnType<typeof vi.fn>;
  createOrUpdateFileContents?: ReturnType<typeof vi.fn>;
  getContent?: ReturnType<typeof vi.fn>;
}): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn(),
      listReviewComments: vi.fn().mockResolvedValue({ data: options.threads }),
      createReplyForReviewComment: options.createReplyForReviewComment ?? vi.fn().mockResolvedValue({ data: { id: 999 } }),
    },
    reactions: {
      listForPullRequestReviewComment: vi.fn().mockImplementation(async ({ comment_id }: { comment_id: number }) => ({
        data: options.reactionsByCommentId?.[comment_id] ?? [],
      })),
    },
    repos: {
      createOrUpdateFileContents: options.createOrUpdateFileContents ?? vi.fn().mockResolvedValue({ data: {} }),
      getContent: options.getContent,
    },
  };
}

describe("runPoll", () => {
  it("asks for a reason on a rejected comment but does not commit a worklog while the PR is still open", async () => {
    const createReplyForReviewComment = vi.fn().mockResolvedValue({ data: { id: 900 } });
    const createOrUpdateFileContents = vi.fn();
    const client = makeFakeClient({
      threads: [{ id: 100, body: TAGGED_COMMENT, path: "x.ts", line: 1 }],
      reactionsByCommentId: { 100: [{ content: "-1" }, { content: "-1" }] },
      createReplyForReviewComment,
      createOrUpdateFileContents,
    });

    const result = await runPoll(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      branch: "feature/pr-7",
      date: "2026-07-30",
      isClosed: false,
    });

    expect(result.askedIssueIds).toEqual(["issue-1"]);
    expect(result.worklogPath).toBeUndefined();
    expect(createOrUpdateFileContents).not.toHaveBeenCalled();
  });

  it("commits the worklog file once the PR is closed", async () => {
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({ data: {} });
    const getContent = vi.fn().mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
    const client = makeFakeClient({
      threads: [{ id: 100, body: TAGGED_COMMENT, path: "x.ts", line: 1 }],
      reactionsByCommentId: { 100: [{ content: "+1" }] },
      createOrUpdateFileContents,
      getContent,
    });

    const result = await runPoll(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      branch: "feature/pr-7",
      date: "2026-07-30",
      isClosed: true,
    });

    expect(result.worklogPath).toBe(".worklog/2026-07-30-pr7.md");
    expect(createOrUpdateFileContents).toHaveBeenCalledWith(expect.objectContaining({ path: ".worklog/2026-07-30-pr7.md" }));
  });

  it("short-circuits with no reaction/reply calls when no bot-tagged comments are found", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient({ threads: [{ id: 100, body: "an unrelated human comment" }], createReplyForReviewComment });

    const result = await runPoll(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      branch: "feature/pr-7",
      date: "2026-07-30",
      isClosed: false,
    });

    expect(result).toEqual({ askedIssueIds: [] });
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });
});
