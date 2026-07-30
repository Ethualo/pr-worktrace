import { readFileSync } from "node:fs";
import * as core from "@actions/core";
import { createGithubClient } from "@worktrace/github";
import { loadConfig } from "./loadConfig.js";
import { runPoll } from "./runPoll.js";
import { runReview } from "./runReview.js";

function isGithubAuthError(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 401 || status === 403;
}

async function runReviewMode(): Promise<void> {
  const [owner, repo] = core.getInput("repository", { required: true }).split("/");
  const pullNumber = parseInt(core.getInput("pull_number", { required: true }), 10);
  const commitId = core.getInput("commit_id", { required: true });
  const configPath = core.getInput("config_path") || "worktrace.config.json";
  const githubToken = core.getInput("github_token", { required: true });
  const apiKey = core.getInput("llm_api_key", { required: true });

  const client = createGithubClient(githubToken);
  const config = loadConfig({ configJson: readFileSync(configPath, "utf-8"), apiKey });
  const { createProvider } = await import("@worktrace/providers");
  const provider = createProvider(config);

  try {
    const result = await runReview(client, provider, { owner, repo, pullNumber, commitId });
    core.setOutput("issues_count", result.issues.length);
  } catch (error: unknown) {
    if (isGithubAuthError(error)) {
      core.setFailed(`GitHub API auth/permission error: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    core.warning(`worktrace-bot review step failed, continuing without blocking the PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runPollMode(): Promise<void> {
  const [owner, repo] = core.getInput("repository", { required: true }).split("/");
  const pullNumber = parseInt(core.getInput("pull_number", { required: true }), 10);
  const branch = core.getInput("branch", { required: true });
  const date = core.getInput("date", { required: true });
  const isClosed = core.getInput("pr_state") === "closed";
  const commitId = core.getInput("commit_id") || undefined;
  const githubToken = core.getInput("github_token", { required: true });

  const client = createGithubClient(githubToken);

  try {
    const result = await runPoll(client, { owner, repo, pullNumber, branch, date, isClosed, commitId });
    core.setOutput("asked_count", result.askedIssueIds.length);
    if (result.worklogPath) {
      core.setOutput("worklog_path", result.worklogPath);
    }
  } catch (error: unknown) {
    if (isGithubAuthError(error)) {
      core.setFailed(`GitHub API auth/permission error: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    core.warning(`worktrace-bot poll step failed, continuing without blocking the PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function run(): Promise<void> {
  const mode = core.getInput("mode") || "review";
  if (mode === "poll") {
    await runPollMode();
    return;
  }
  await runReviewMode();
}

run();
