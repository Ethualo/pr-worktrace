import type { GithubClient } from "./types.js";

export interface ReviewCommentThread {
  id: number;
  body: string;
  inReplyToId?: number;
  path?: string;
  line?: number;
}

export interface ListReviewCommentsParams {
  owner: string;
  repo: string;
  pullNumber: number;
}

export async function listReviewComments(
  client: GithubClient,
  params: ListReviewCommentsParams
): Promise<ReviewCommentThread[]> {
  if (!client.pulls.listReviewComments) {
    throw new Error("GithubClient does not support listReviewComments");
  }

  const response = await client.pulls.listReviewComments({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
  });

  return response.data.map((comment) => ({
    id: comment.id,
    body: comment.body,
    ...(comment.in_reply_to_id !== undefined ? { inReplyToId: comment.in_reply_to_id } : {}),
    ...(comment.path !== undefined ? { path: comment.path } : {}),
    ...(comment.line !== undefined && comment.line !== null ? { line: comment.line } : {}),
  }));
}
