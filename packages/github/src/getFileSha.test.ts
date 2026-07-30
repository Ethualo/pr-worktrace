import { describe, it, expect, vi } from "vitest";
import { getFileSha } from "./getFileSha.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(getContent: ReturnType<typeof vi.fn>): GithubClient {
  return {
    pulls: { get: vi.fn(), createReviewComment: vi.fn() },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn(), getContent },
  };
}

describe("getFileSha", () => {
  it("returns the file's sha when it exists", async () => {
    const getContent = vi.fn().mockResolvedValue({ data: { sha: "abc123" } });
    const client = makeFakeClient(getContent);

    const sha = await getFileSha(client, { owner: "acme", repo: "widgets", path: ".worklog/2026-07-30-pr7.md" });

    expect(sha).toBe("abc123");
    expect(getContent).toHaveBeenCalledWith({ owner: "acme", repo: "widgets", path: ".worklog/2026-07-30-pr7.md" });
  });

  it("returns undefined when the file does not exist (404)", async () => {
    const notFound = Object.assign(new Error("Not Found"), { status: 404 });
    const getContent = vi.fn().mockRejectedValue(notFound);
    const client = makeFakeClient(getContent);

    const sha = await getFileSha(client, { owner: "acme", repo: "widgets", path: ".worklog/missing.md" });

    expect(sha).toBeUndefined();
  });

  it("rethrows non-404 errors", async () => {
    const serverError = Object.assign(new Error("Server Error"), { status: 500 });
    const getContent = vi.fn().mockRejectedValue(serverError);
    const client = makeFakeClient(getContent);

    await expect(getFileSha(client, { owner: "acme", repo: "widgets", path: ".worklog/x.md" })).rejects.toThrow(
      "Server Error"
    );
  });

  it("throws when the client does not implement getContent", async () => {
    const client: GithubClient = {
      pulls: { get: vi.fn(), createReviewComment: vi.fn() },
      reactions: { listForPullRequestReviewComment: vi.fn() },
      repos: { createOrUpdateFileContents: vi.fn() },
    };

    await expect(getFileSha(client, { owner: "acme", repo: "widgets", path: ".worklog/x.md" })).rejects.toThrow(
      "GithubClient does not support getContent"
    );
  });
});
