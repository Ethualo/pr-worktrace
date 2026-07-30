import type { ReviewIssue } from "@worktrace/core";
import type { GithubClient, PostedComment, ReactionSummary } from "@worktrace/github";
export interface RunWorklogCommitParams {
    owner: string;
    repo: string;
    branch: string;
    pullNumber: number;
    date: string;
    issues: ReviewIssue[];
    postedComments: PostedComment[];
    reactions: ReactionSummary[];
    reasons?: Record<string, string>;
    commitId?: string;
    existingFileSha?: string;
}
export declare function runWorklogCommit(client: GithubClient, params: RunWorklogCommitParams): Promise<string>;
