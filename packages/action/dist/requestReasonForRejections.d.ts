import type { GithubClient, PostedComment, ReactionSummary, ReviewCommentThread } from "@pr-worktrace/github";
export declare const REASON_REQUEST_MARKER = "<!-- worktrace-reason-request -->";
export interface RequestReasonForRejectionsParams {
    owner: string;
    repo: string;
    pullNumber: number;
    threads: ReviewCommentThread[];
    postedComments: PostedComment[];
    reactions: ReactionSummary[];
}
export declare function requestReasonForRejections(client: GithubClient, params: RequestReasonForRejectionsParams): Promise<string[]>;
