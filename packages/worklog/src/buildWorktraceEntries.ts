import type { ReviewIssue } from "@worktrace/core";
import type { PostedComment, ReactionSummary } from "@worktrace/github";
import { classifyDecision } from "./classifyDecision.js";
import type { WorkTraceEntry } from "./types.js";

export interface BuildWorktraceEntriesParams {
  issues: ReviewIssue[];
  postedComments: PostedComment[];
  reactions: ReactionSummary[];
  reasons?: Record<string, string>;
  commitId?: string;
}

export function buildWorktraceEntries(params: BuildWorktraceEntriesParams): WorkTraceEntry[] {
  const commentIdByIssueId = new Map(params.postedComments.map((c) => [c.issueId, c.commentId]));
  const reactionsByCommentId = new Map(params.reactions.map((r) => [r.commentId, r]));

  return params.issues.map((issue) => {
    const commentId = commentIdByIssueId.get(issue.id);
    const reaction = commentId !== undefined ? reactionsByCommentId.get(commentId) : undefined;
    const decision = reaction ? classifyDecision(reaction) : "unclear";
    const reason = params.reasons?.[issue.id];

    return {
      issueId: issue.id,
      file: issue.file,
      line: issue.line,
      severity: issue.severity,
      summary: issue.summary,
      suggestion: issue.suggestion,
      decision,
      ...(reason ? { reason } : {}),
      ...(params.commitId ? { commitId: params.commitId } : {}),
    };
  });
}
