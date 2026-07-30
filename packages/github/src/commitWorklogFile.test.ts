import { describe, it, expect, vi } from "vitest";
import { commitWorklogFile } from "./commitWorklogFile.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(): GithubClient {
  return {
    pulls: { get: vi.fn(), createReviewComment: vi.fn() },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn().mockResolvedValue({ data: {} }) },
  };
}

describe("commitWorklogFile", () => {
  it("base64-encodes the content and commits it to the given branch/path", async () => {
    const client = makeFakeClient();

    await commitWorklogFile(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      path: ".worklog/2026-07-30-pr7.md",
      content: "# work trace\n\nissue-1: accepted\n",
      message: "chore(worklog): record PR #7 decisions",
    });

    expect(client.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      path: ".worklog/2026-07-30-pr7.md",
      message: "chore(worklog): record PR #7 decisions",
      content: Buffer.from("# work trace\n\nissue-1: accepted\n", "utf-8").toString("base64"),
      branch: "feature/pr-7",
    });
  });

  it("forwards an existing file sha when provided, to update rather than create", async () => {
    const client = makeFakeClient();

    await commitWorklogFile(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      path: ".worklog/2026-07-30-pr7.md",
      content: "updated content",
      message: "chore(worklog): update PR #7 decisions",
      sha: "existing-sha",
    });

    expect(client.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: "existing-sha" })
    );
  });
});
