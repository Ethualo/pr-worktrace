import { Octokit } from "@octokit/rest";
import type { GithubClient } from "./types.js";

export function createGithubClient(token: string): GithubClient {
  return new Octokit({ auth: token }) as unknown as GithubClient;
}
