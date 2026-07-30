import type { GithubClient } from "./types.js";

export interface GetFileShaParams {
  owner: string;
  repo: string;
  path: string;
}

export async function getFileSha(client: GithubClient, params: GetFileShaParams): Promise<string | undefined> {
  if (!client.repos.getContent) {
    throw new Error("GithubClient does not support getContent");
  }

  try {
    const response = await client.repos.getContent({ owner: params.owner, repo: params.repo, path: params.path });
    return response.data.sha;
  } catch (error: unknown) {
    if ((error as { status?: number } | undefined)?.status === 404) {
      return undefined;
    }
    throw error;
  }
}
