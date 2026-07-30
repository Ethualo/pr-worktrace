import type { PostedComment, ReviewCommentThread } from "@worktrace/github";
import { REASON_REQUEST_MARKER } from "./requestReasonForRejections.js";

export function extractReasons(
  threads: ReviewCommentThread[],
  postedComments: PostedComment[]
): Record<string, string> {
  const reasons: Record<string, string> = {};

  for (const posted of postedComments) {
    const humanReply = threads.find(
      (t) => t.inReplyToId === posted.commentId && !t.body.includes(REASON_REQUEST_MARKER)
    );
    if (humanReply) {
      reasons[posted.issueId] = humanReply.body.trim();
    }
  }

  return reasons;
}
