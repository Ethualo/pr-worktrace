import type { GithubClient, PostedComment, ReactionSummary } from "@pr-worktrace/github";
import { listReviewComments, replyToReviewComment } from "@pr-worktrace/github";
import { classifyDecision } from "@pr-worktrace/worklog";

export const REASON_REQUEST_MARKER = "<!-- worktrace-reason-request -->";
const REASON_REQUEST_BODY = `${REASON_REQUEST_MARKER}\n이유 한 줄만 남겨주시겠어요? 판단 기록(work-trace)에 반영합니다.`;

export interface RequestReasonForRejectionsParams {
  owner: string;
  repo: string;
  pullNumber: number;
  postedComments: PostedComment[];
  reactions: ReactionSummary[];
}

export async function requestReasonForRejections(
  client: GithubClient,
  params: RequestReasonForRejectionsParams
): Promise<string[]> {
  const reactionsByCommentId = new Map(params.reactions.map((r) => [r.commentId, r]));
  const threads = await listReviewComments(client, {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
  });
  const repliedToCommentIds = new Set(
    threads.filter((t) => t.inReplyToId !== undefined).map((t) => t.inReplyToId as number)
  );

  const askedIssueIds: string[] = [];

  for (const posted of params.postedComments) {
    const reaction = reactionsByCommentId.get(posted.commentId);
    if (!reaction) continue;
    if (classifyDecision(reaction) !== "rejected") continue;
    if (repliedToCommentIds.has(posted.commentId)) continue;

    await replyToReviewComment(client, {
      owner: params.owner,
      repo: params.repo,
      pullNumber: params.pullNumber,
      commentId: posted.commentId,
      body: REASON_REQUEST_BODY,
    });

    askedIssueIds.push(posted.issueId);
  }

  return askedIssueIds;
}
