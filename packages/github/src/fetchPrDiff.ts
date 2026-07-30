import type { GithubClient } from "./types.js";

export interface FetchPrDiffParams {
  owner: string;
  repo: string;
  pullNumber: number;
}

export async function fetchPrDiff(client: GithubClient, params: FetchPrDiffParams): Promise<string> {
  const response = await client.pulls.get({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    mediaType: { format: "diff" },
  });

  if (typeof response.data !== "string") {
    throw new Error("Expected diff response to be a string");
  }

  return response.data;
}
