import type { LLMProvider, ReviewIssue } from "@pr-worktrace/core";
import type { GithubClient, PostedComment } from "@pr-worktrace/github";
export interface RunReviewParams {
    owner: string;
    repo: string;
    pullNumber: number;
    commitId: string;
}
export interface RunReviewResult {
    issues: ReviewIssue[];
    postedComments: PostedComment[];
}
export declare function runReview(client: GithubClient, provider: LLMProvider, params: RunReviewParams): Promise<RunReviewResult>;
