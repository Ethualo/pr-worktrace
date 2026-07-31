import type { ReviewIssue } from "@pr-worktrace/core";
import type { GithubClient, PostedComment, ReactionSummary } from "@pr-worktrace/github";
import { commitWorklogFile } from "@pr-worktrace/github";
import { buildWorktraceEntries, formatWorklogMarkdown, worklogFilePath } from "@pr-worktrace/worklog";

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

export async function runWorklogCommit(client: GithubClient, params: RunWorklogCommitParams): Promise<string> {
  const entries = buildWorktraceEntries({
    issues: params.issues,
    postedComments: params.postedComments,
    reactions: params.reactions,
    reasons: params.reasons,
    commitId: params.commitId,
  });

  const markdown = formatWorklogMarkdown(entries, {
    prNumber: params.pullNumber,
    date: params.date,
    repo: params.repo,
  });

  const path = worklogFilePath({ date: params.date, prNumber: params.pullNumber });

  await commitWorklogFile(client, {
    owner: params.owner,
    repo: params.repo,
    branch: params.branch,
    path,
    content: markdown,
    message: `docs(worklog): record work-trace for PR #${params.pullNumber}`,
    ...(params.existingFileSha ? { sha: params.existingFileSha } : {}),
  });

  return path;
}
