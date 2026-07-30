import { readFileSync } from "node:fs";
import * as core from "@actions/core";
import { createProvider } from "@worktrace/providers";
import { createGithubClient } from "@worktrace/github";
import { loadConfig } from "./loadConfig.js";
import { runReview } from "./runReview.js";

function isGithubAuthError(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 401 || status === 403;
}

async function run(): Promise<void> {
  const [owner, repo] = core.getInput("repository", { required: true }).split("/");
  const pullNumber = parseInt(core.getInput("pull_number", { required: true }), 10);
  const commitId = core.getInput("commit_id", { required: true });
  const configPath = core.getInput("config_path") || "worktrace.config.json";
  const githubToken = core.getInput("github_token", { required: true });
  const apiKey = core.getInput("llm_api_key", { required: true });

  const client = createGithubClient(githubToken);
  const config = loadConfig({ configJson: readFileSync(configPath, "utf-8"), apiKey });
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

run();
