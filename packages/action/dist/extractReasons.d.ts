import type { PostedComment, ReviewCommentThread } from "@pr-worktrace/github";
export declare function extractReasons(threads: ReviewCommentThread[], postedComments: PostedComment[]): Record<string, string>;
