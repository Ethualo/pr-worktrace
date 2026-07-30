import type { ReviewIssue } from "@worktrace/core";
import type { PostedComment, ReviewCommentThread } from "@worktrace/github";
export interface ReconstructedReviewState {
    issues: ReviewIssue[];
    postedComments: PostedComment[];
}
export declare function reconstructReviewState(threads: ReviewCommentThread[]): ReconstructedReviewState;
