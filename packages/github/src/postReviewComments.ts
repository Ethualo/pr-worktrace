import type { ReviewIssue } from "@worktrace/core";
import type { GithubClient, PostedComment } from "./types.js";

export interface PostReviewCommentsParams {
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
  issues: ReviewIssue[];
}

export function formatCommentBody(issue: ReviewIssue): string {
  return `<!-- worktrace-issue:${issue.id} -->\n**[${issue.severity}]** ${issue.summary}\n\n${issue.suggestion}`;
}

export async function postReviewComments(
  client: GithubClient,
  params: PostReviewCommentsParams
): Promise<PostedComment[]> {
  const posted: PostedComment[] = [];

  for (const issue of params.issues) {
    const response = await client.pulls.createReviewComment({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
      commit_id: params.commitId,
      path: issue.file,
      line: issue.line,
      body: formatCommentBody(issue),
    });
    posted.push({ issueId: issue.id, commentId: response.data.id });
  }

  return posted;
}
