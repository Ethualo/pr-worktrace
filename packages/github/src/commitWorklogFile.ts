import type { GithubClient } from "./types.js";

export interface CommitWorklogFileParams {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  sha?: string;
}

export async function commitWorklogFile(client: GithubClient, params: CommitWorklogFileParams): Promise<void> {
  await client.repos.createOrUpdateFileContents({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    message: params.message,
    content: Buffer.from(params.content, "utf-8").toString("base64"),
    branch: params.branch,
    ...(params.sha ? { sha: params.sha } : {}),
  });
}
