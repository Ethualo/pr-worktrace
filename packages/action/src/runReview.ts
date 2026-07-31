import type { LLMProvider, ReviewIssue } from "@pr-worktrace/core";
import type { GithubClient, PostedComment } from "@pr-worktrace/github";
import { fetchPrDiff, postReviewComments } from "@pr-worktrace/github";

export interface RunReviewParams {
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
}

export interface RunReviewResult {
  issues: ReviewIssue[];
  postedComments: PostedComment[];
}

export async function runReview(
  client: GithubClient,
  provider: LLMProvider,
  params: RunReviewParams
): Promise<RunReviewResult> {
  const diff = await fetchPrDiff(client, { owner: params.owner, repo: params.repo, pullNumber: params.pullNumber });
  const { issues } = await provider.review(diff);

  if (issues.length === 0) {
    return { issues: [], postedComments: [] };
  }

  const postedComments = await postReviewComments(client, {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
    commitId: params.commitId,
    issues,
  });

  return { issues, postedComments };
}
