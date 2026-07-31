import type { GithubClient } from "@pr-worktrace/github";
export interface RunPollParams {
    owner: string;
    repo: string;
    pullNumber: number;
    branch: string;
    date: string;
    isClosed: boolean;
    commitId?: string;
}
export interface RunPollResult {
    askedIssueIds: string[];
    worklogPath?: string;
}
export declare function runPoll(client: GithubClient, params: RunPollParams): Promise<RunPollResult>;
