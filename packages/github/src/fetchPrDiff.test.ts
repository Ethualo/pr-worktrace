import { describe, it, expect, vi } from "vitest";
import { fetchPrDiff } from "./fetchPrDiff.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(diffData: unknown): GithubClient {
  return {
    pulls: {
      get: vi.fn().mockResolvedValue({ data: diffData }),
      createReviewComment: vi.fn(),
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("fetchPrDiff", () => {
  it("requests the diff media type and returns the raw diff text", async () => {
    const client = makeFakeClient("diff --git a/x b/x\n+added line\n");

    const diff = await fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 });

    expect(diff).toBe("diff --git a/x b/x\n+added line\n");
    expect(client.pulls.get).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      pull_number: 7,
      mediaType: { format: "diff" },
    });
  });

  it("throws if the client does not return a string", async () => {
    const client = makeFakeClient({ not: "a string" });

    await expect(
      fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 })
    ).rejects.toThrow("Expected diff response to be a string");
  });
});
