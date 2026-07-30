import type { GithubClient } from "./types.js";

export interface ReplyToReviewCommentParams {
  owner: string;
  repo: string;
  pullNumber: number;
  commentId: number;
  body: string;
}

export async function replyToReviewComment(client: GithubClient, params: ReplyToReviewCommentParams): Promise<number> {
  if (!client.pulls.createReplyForReviewComment) {
    throw new Error("GithubClient does not support createReplyForReviewComment");
  }

  const response = await client.pulls.createReplyForReviewComment({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    comment_id: params.commentId,
    body: params.body,
  });

  return response.data.id;
}
