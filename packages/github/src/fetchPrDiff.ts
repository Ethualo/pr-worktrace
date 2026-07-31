import type { GithubClient } from "./types.js";

export interface FetchPrDiffParams {
  owner: string;
  repo: string;
  pullNumber: number;
}

const PER_PAGE = 100;

// GitHub's diff/patch media types 406 once a PR exceeds ~300 files or ~20000
// changed lines. listFiles has a much higher ceiling (3000 files) and gives
// a per-file patch, so we page through it and reconstruct a diff-like text
// instead of relying on the single-request diff format.
export async function fetchPrDiff(client: GithubClient, params: FetchPrDiffParams): Promise<string> {
  if (!client.pulls.listFiles) {
    throw new Error("GithubClient does not support listFiles");
  }
  const listFiles = client.pulls.listFiles;

  const chunks: string[] = [];
  let page = 1;
  for (;;) {
    const response = await listFiles({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
      page,
      per_page: PER_PAGE,
    });

    for (const file of response.data) {
      const body = file.patch ?? "[diff omitted: file too large to render]";
      chunks.push(`diff --git a/${file.filename} b/${file.filename}\n${body}`);
    }

    if (response.data.length < PER_PAGE) break;
    page += 1;
  }

  return chunks.join("\n");
}
