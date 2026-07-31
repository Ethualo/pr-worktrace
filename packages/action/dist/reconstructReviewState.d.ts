import type { ReviewIssue } from "@pr-worktrace/core";
import type { PostedComment, ReviewCommentThread } from "@pr-worktrace/github";
export interface ReconstructedReviewState {
    issues: ReviewIssue[];
    postedComments: PostedComment[];
}
export declare function reconstructReviewState(threads: ReviewCommentThread[]): ReconstructedReviewState;
