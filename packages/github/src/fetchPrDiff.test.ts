import { describe, it, expect, vi } from "vitest";
import { fetchPrDiff } from "./fetchPrDiff.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(listFiles: ReturnType<typeof vi.fn>): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn(),
      listFiles,
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("fetchPrDiff", () => {
  it("reconstructs a diff-like text from a single page of files", async () => {
    const listFiles = vi.fn().mockResolvedValue({
      data: [{ filename: "x.ts", status: "modified", patch: "+added line" }],
    });
    const client = makeFakeClient(listFiles);

    const diff = await fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 });

    expect(diff).toBe("diff --git a/x.ts b/x.ts\n+added line");
    expect(listFiles).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      pull_number: 7,
      page: 1,
      per_page: 100,
    });
  });

  it("pages through listFiles until a short page is returned", async () => {
    const fullPage = { data: Array.from({ length: 100 }, (_, i) => ({ filename: `f${i}.ts`, status: "added", patch: "+x" })) };
    const shortPage = { data: [{ filename: "last.ts", status: "added", patch: "+y" }] };
    const listFiles = vi.fn().mockResolvedValueOnce(fullPage).mockResolvedValueOnce(shortPage);
    const client = makeFakeClient(listFiles);

    const diff = await fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 });

    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(diff).toContain("f99.ts");
    expect(diff).toContain("last.ts");
  });

  it("substitutes a placeholder when a file's patch is omitted (file too large)", async () => {
    const listFiles = vi.fn().mockResolvedValue({
      data: [{ filename: "huge.json", status: "modified" }],
    });
    const client = makeFakeClient(listFiles);

    const diff = await fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 });

    expect(diff).toBe("diff --git a/huge.json b/huge.json\n[diff omitted: file too large to render]");
  });

  it("throws when the client does not support listFiles", async () => {
    const client: GithubClient = {
      pulls: { get: vi.fn(), createReviewComment: vi.fn() },
      reactions: { listForPullRequestReviewComment: vi.fn() },
      repos: { createOrUpdateFileContents: vi.fn() },
    };

    await expect(
      fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 })
    ).rejects.toThrow("GithubClient does not support listFiles");
  });
});
