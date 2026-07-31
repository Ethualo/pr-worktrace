import { describe, it, expect, vi } from "vitest";
import { postReviewComments } from "./postReviewComments.js";
import type { GithubClient } from "./types.js";
import type { ReviewIssue } from "@pr-worktrace/core";

const issues: ReviewIssue[] = [
  {
    id: "issue-1",
    severity: "medium",
    file: "src/geo.ts",
    line: 12,
    summary: "부동소수점 오차",
    suggestion: "상수 추출",
  },
  {
    id: "issue-2",
    severity: "high",
    file: "src/geo.ts",
    line: 20,
    summary: "널 체크 누락",
    suggestion: "옵셔널 체이닝 사용",
  },
];

function makeFakeClient(): GithubClient {
  let nextId = 100;
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn().mockImplementation(async () => ({ data: { id: nextId++ } })),
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("postReviewComments", () => {
  it("posts one tagged inline comment per issue and returns issueId/commentId pairs", async () => {
    const client = makeFakeClient();

    const posted = await postReviewComments(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
      issues,
    });

    expect(posted).toEqual([
      { issueId: "issue-1", commentId: 100 },
      { issueId: "issue-2", commentId: 101 },
    ]);
    expect(client.pulls.createReviewComment).toHaveBeenCalledTimes(2);
    expect(client.pulls.createReviewComment).toHaveBeenNthCalledWith(1, {
      owner: "acme",
      repo: "widgets",
      pull_number: 7,
      commit_id: "abc123",
      path: "src/geo.ts",
      line: 12,
      body: "<!-- worktrace-issue:issue-1 -->\n**[medium]** 부동소수점 오차\n\n상수 추출",
    });
  });

  it("returns an empty array when there are no issues", async () => {
    const client = makeFakeClient();

    const posted = await postReviewComments(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
      issues: [],
    });

    expect(posted).toEqual([]);
    expect(client.pulls.createReviewComment).not.toHaveBeenCalled();
  });
});
