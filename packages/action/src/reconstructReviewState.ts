import type { ReviewIssue, Severity } from "@pr-worktrace/core";
import type { PostedComment, ReviewCommentThread } from "@pr-worktrace/github";

const ISSUE_COMMENT_PATTERN =
  /^<!-- worktrace-issue:(.+?) -->\n\*\*\[(low|medium|high|critical)\]\*\* (.+)\n\n([\s\S]*)$/;

export interface ReconstructedReviewState {
  issues: ReviewIssue[];
  postedComments: PostedComment[];
}

export function reconstructReviewState(threads: ReviewCommentThread[]): ReconstructedReviewState {
  const issues: ReviewIssue[] = [];
  const postedComments: PostedComment[] = [];

  for (const thread of threads) {
    if (thread.inReplyToId !== undefined) continue;

    const match = thread.body.match(ISSUE_COMMENT_PATTERN);
    if (!match) continue;

    const [, issueId, severity, summary, suggestion] = match;
    issues.push({
      id: issueId,
      severity: severity as Severity,
      file: thread.path ?? "",
      line: thread.line ?? 0,
      summary,
      suggestion,
    });
    postedComments.push({ issueId, commentId: thread.id });
  }

  return { issues, postedComments };
}
