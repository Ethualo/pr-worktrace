import type { GithubClient } from "@pr-worktrace/github";
import { getFileSha, listReviewComments, pollReactions } from "@pr-worktrace/github";
import { worklogFilePath } from "@pr-worktrace/worklog";
import { extractReasons } from "./extractReasons.js";
import { reconstructReviewState } from "./reconstructReviewState.js";
import { requestReasonForRejections } from "./requestReasonForRejections.js";
import { runWorklogCommit } from "./runWorklogCommit.js";

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

export async function runPoll(client: GithubClient, params: RunPollParams): Promise<RunPollResult> {
  const threads = await listReviewComments(client, {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
  });
  const { issues, postedComments } = reconstructReviewState(threads);

  if (postedComments.length === 0) {
    return { askedIssueIds: [] };
  }

  const reactions = await pollReactions(
    client,
    { owner: params.owner, repo: params.repo },
    postedComments.map((p) => p.commentId)
  );

  const askedIssueIds = await requestReasonForRejections(client, {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
    postedComments,
    reactions,
  });

  if (!params.isClosed) {
    return { askedIssueIds };
  }

  const path = worklogFilePath({ date: params.date, prNumber: params.pullNumber });
  const existingFileSha = await getFileSha(client, { owner: params.owner, repo: params.repo, path });
  const reasons = extractReasons(threads, postedComments);

  const worklogPath = await runWorklogCommit(client, {
    owner: params.owner,
    repo: params.repo,
    branch: params.branch,
    pullNumber: params.pullNumber,
    date: params.date,
    issues,
    postedComments,
    reactions,
    reasons,
    ...(params.commitId ? { commitId: params.commitId } : {}),
    ...(existingFileSha ? { existingFileSha } : {}),
  });

  return { askedIssueIds, worklogPath };
}
