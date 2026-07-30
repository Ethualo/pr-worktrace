import type { PostedComment, ReviewCommentThread } from "@worktrace/github";
export declare function extractReasons(threads: ReviewCommentThread[], postedComments: PostedComment[]): Record<string, string>;
