import type { GithubClient, ReactionSummary } from "./types.js";

export interface PollReactionsRepo {
  owner: string;
  repo: string;
}

export async function pollReactions(
  client: GithubClient,
  repo: PollReactionsRepo,
  commentIds: number[]
): Promise<ReactionSummary[]> {
  const summaries: ReactionSummary[] = [];

  for (const commentId of commentIds) {
    const response = await client.reactions.listForPullRequestReviewComment({
      owner: repo.owner,
      repo: repo.repo,
      comment_id: commentId,
    });

    let thumbsUp = 0;
    let thumbsDown = 0;
    for (const reaction of response.data) {
      if (reaction.content === "+1") thumbsUp++;
      if (reaction.content === "-1") thumbsDown++;
    }

    summaries.push({ commentId, thumbsUp, thumbsDown });
  }

  return summaries;
}
