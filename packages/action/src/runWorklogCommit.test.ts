import { describe, it, expect, vi } from "vitest";
import type { GithubClient } from "@pr-worktrace/github";
import { runWorklogCommit } from "./runWorklogCommit.js";

function makeFakeClient(createOrUpdateFileContents: ReturnType<typeof vi.fn>): GithubClient {
  return {
    pulls: { get: vi.fn(), createReviewComment: vi.fn() },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents },
  };
}

describe("runWorklogCommit", () => {
  it("commits the formatted worklog markdown at the computed path and returns it", async () => {
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({ data: {} });
    const client = makeFakeClient(createOrUpdateFileContents);

    const path = await runWorklogCommit(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      pullNumber: 7,
      date: "2026-07-30",
      issues: [{ id: "issue-1", severity: "high", file: "x.ts", line: 3, summary: "s1", suggestion: "sg1" }],
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 0, thumbsDown: 2 }],
      reasons: { "issue-1": "false positive" },
    });

    expect(path).toBe(".worklog/2026-07-30-pr7.md");
    expect(createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "widgets",
        branch: "feature/pr-7",
        path: ".worklog/2026-07-30-pr7.md",
        message: "docs(worklog): record work-trace for PR #7",
      })
    );
    const call = createOrUpdateFileContents.mock.calls[0][0];
    expect(Buffer.from(call.content, "base64").toString("utf-8")).toContain("issue-1 — rejected");
    expect(call.sha).toBeUndefined();
  });

  it("passes sha through when an existing file is being updated", async () => {
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({ data: {} });
    const client = makeFakeClient(createOrUpdateFileContents);

    await runWorklogCommit(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      pullNumber: 7,
      date: "2026-07-30",
      issues: [],
      postedComments: [],
      reactions: [],
      existingFileSha: "sha-abc",
    });

    const call = createOrUpdateFileContents.mock.calls[0][0];
    expect(call.sha).toBe("sha-abc");
  });
});
