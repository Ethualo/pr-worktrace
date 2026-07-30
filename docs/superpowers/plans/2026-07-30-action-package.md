# packages/action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/action`, the GitHub Action entrypoint that wires `@worktrace/core` → `@worktrace/providers` → `@worktrace/github` → `@worktrace/worklog` together, including the "이유 한 줄만" (one-line-reason) reply-on-👎 behavior from the design spec (`docs/superpowers/specs/2026-07-30-worktrace-bot-design.md`, 데이터 흐름 point 4).

**Architecture:** Two `@worktrace/github` primitives are added first (`listReviewComments`, `replyToReviewComment`) since the design spec explicitly keeps business-decision logic ("ask once, don't spam") out of `github`/`worklog` and in the orchestration layer. `packages/action` then adds four pure/DI-testable orchestration functions (`loadConfig`, `runReview`, `requestReasonForRejections`, `runWorklogCommit`) following the same dependency-injection pattern already used across the repo (client/dependency passed as first arg, fakes via `vi.fn()`, no mocking libraries). A thin `main.ts` wires those functions to `@actions/core` inputs — this file is untested glue, matching the existing precedent of `packages/github/src/createGithubClient.ts` (no test file).

**Tech Stack:** TypeScript strict/NodeNext, Vitest, pnpm workspace, `@actions/core` (GitHub Actions toolkit), Node 20.

---

## Context: existing types you will use

```ts
// @worktrace/core
export type Severity = "low" | "medium" | "high" | "critical";
export interface ReviewIssue { id: string; severity: Severity; file: string; line: number; summary: string; suggestion: string; }
export interface ReviewResult { issues: ReviewIssue[]; }
export interface LLMProvider { name: string; review(diff: string): Promise<ReviewResult>; }

// @worktrace/providers
export interface ProviderConfig { provider: "claude" | "openai"; apiKey: string; model: string; }
export function createProvider(config: ProviderConfig): LLMProvider;

// @worktrace/github (current)
export interface PostedComment { issueId: string; commentId: number; }
export interface ReactionSummary { commentId: number; thumbsUp: number; thumbsDown: number; }
export function fetchPrDiff(client: GithubClient, params: { owner: string; repo: string; pullNumber: number }): Promise<string>;
export function postReviewComments(client: GithubClient, params: { owner: string; repo: string; pullNumber: number; commitId: string; issues: ReviewIssue[] }): Promise<PostedComment[]>;
export function pollReactions(client: GithubClient, repo: { owner: string; repo: string }, commentIds: number[]): Promise<ReactionSummary[]>;
export function commitWorklogFile(client: GithubClient, params: { owner: string; repo: string; branch: string; path: string; content: string; message: string; sha?: string }): Promise<void>;
export function createGithubClient(token: string): GithubClient;

// @worktrace/worklog
export type Decision = "accepted" | "rejected" | "unclear";
export interface WorkTraceEntry { issueId: string; file: string; line: number; severity: Severity; summary: string; suggestion: string; decision: Decision; reason?: string; commitId?: string; }
export function classifyDecision(reactions: ReactionSummary): Decision;
export function buildWorktraceEntries(params: { issues: ReviewIssue[]; postedComments: PostedComment[]; reactions: ReactionSummary[]; reasons?: Record<string, string>; commitId?: string }): WorkTraceEntry[];
export function worklogFilePath(params: { date: string; prNumber: number }): string;
export function formatWorklogMarkdown(entries: WorkTraceEntry[], meta: { prNumber: number; date: string; repo: string }): string;
```

---

### Task 1: `@worktrace/github` — add `listReviewComments` primitive

**Files:**
- Modify: `packages/github/src/types.ts`
- Create: `packages/github/src/listReviewComments.ts`
- Test: `packages/github/src/listReviewComments.test.ts`
- Modify: `packages/github/src/index.ts`

The two new GithubClient methods are added as **optional** (`?:`) so every existing fake-client object literal in `pollReactions.test.ts`, `postReviewComments.test.ts`, `fetchPrDiff.test.ts`, `commitWorklogFile.test.ts` keeps type-checking without modification.

- [ ] **Step 1: Write the failing test**

```ts
// packages/github/src/listReviewComments.test.ts
import { describe, it, expect, vi } from "vitest";
import { listReviewComments } from "./listReviewComments.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(comments: Array<{ id: number; body: string; in_reply_to_id?: number }>): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn(),
      listReviewComments: vi.fn().mockResolvedValue({ data: comments }),
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("listReviewComments", () => {
  it("maps raw comments to threads, including inReplyToId when present", async () => {
    const client = makeFakeClient([
      { id: 1, body: "top-level" },
      { id: 2, body: "a reply", in_reply_to_id: 1 },
    ]);

    const threads = await listReviewComments(client, { owner: "acme", repo: "widgets", pullNumber: 7 });

    expect(threads).toEqual([
      { id: 1, body: "top-level" },
      { id: 2, body: "a reply", inReplyToId: 1 },
    ]);
  });

  it("throws when the client does not implement listReviewComments", async () => {
    const client: GithubClient = {
      pulls: { get: vi.fn(), createReviewComment: vi.fn() },
      reactions: { listForPullRequestReviewComment: vi.fn() },
      repos: { createOrUpdateFileContents: vi.fn() },
    };

    await expect(listReviewComments(client, { owner: "acme", repo: "widgets", pullNumber: 7 })).rejects.toThrow(
      "GithubClient does not support listReviewComments"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/github && pnpm test -- listReviewComments`
Expected: FAIL with "Cannot find module './listReviewComments.js'" (or similar not-found error).

- [ ] **Step 3: Add the optional methods to `GithubClient`**

In `packages/github/src/types.ts`, inside the `pulls` block of `GithubClient`, add after `createReviewComment(...)`:

```ts
    listReviewComments?(params: {
      owner: string;
      repo: string;
      pull_number: number;
    }): Promise<{ data: Array<{ id: number; body: string; in_reply_to_id?: number }> }>;
    createReplyForReviewComment?(params: {
      owner: string;
      repo: string;
      pull_number: number;
      comment_id: number;
      body: string;
    }): Promise<{ data: { id: number } }>;
```

- [ ] **Step 4: Write minimal implementation**

```ts
// packages/github/src/listReviewComments.ts
import type { GithubClient } from "./types.js";

export interface ReviewCommentThread {
  id: number;
  body: string;
  inReplyToId?: number;
}

export interface ListReviewCommentsParams {
  owner: string;
  repo: string;
  pullNumber: number;
}

export async function listReviewComments(
  client: GithubClient,
  params: ListReviewCommentsParams
): Promise<ReviewCommentThread[]> {
  if (!client.pulls.listReviewComments) {
    throw new Error("GithubClient does not support listReviewComments");
  }

  const response = await client.pulls.listReviewComments({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
  });

  return response.data.map((comment) => ({
    id: comment.id,
    body: comment.body,
    ...(comment.in_reply_to_id !== undefined ? { inReplyToId: comment.in_reply_to_id } : {}),
  }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/github && pnpm test -- listReviewComments`
Expected: PASS (2 tests)

- [ ] **Step 6: Export from barrel**

In `packages/github/src/index.ts`, add:

```ts
export { listReviewComments } from "./listReviewComments.js";
export type { ReviewCommentThread, ListReviewCommentsParams } from "./listReviewComments.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/github/src/types.ts packages/github/src/listReviewComments.ts packages/github/src/listReviewComments.test.ts packages/github/src/index.ts
git commit -m "feat(github): add listReviewComments"
```

---

### Task 2: `@worktrace/github` — add `replyToReviewComment` primitive

**Files:**
- Create: `packages/github/src/replyToReviewComment.ts`
- Test: `packages/github/src/replyToReviewComment.test.ts`
- Modify: `packages/github/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/github/src/replyToReviewComment.test.ts
import { describe, it, expect, vi } from "vitest";
import { replyToReviewComment } from "./replyToReviewComment.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(): { client: GithubClient; createReplyForReviewComment: ReturnType<typeof vi.fn> } {
  const createReplyForReviewComment = vi.fn().mockResolvedValue({ data: { id: 999 } });
  const client: GithubClient = {
    pulls: { get: vi.fn(), createReviewComment: vi.fn(), createReplyForReviewComment },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
  return { client, createReplyForReviewComment };
}

describe("replyToReviewComment", () => {
  it("posts a reply and returns the new comment id", async () => {
    const { client, createReplyForReviewComment } = makeFakeClient();

    const id = await replyToReviewComment(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commentId: 100,
      body: "이유 한 줄만 남겨주시겠어요?",
    });

    expect(id).toBe(999);
    expect(createReplyForReviewComment).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      pull_number: 7,
      comment_id: 100,
      body: "이유 한 줄만 남겨주시겠어요?",
    });
  });

  it("throws when the client does not implement createReplyForReviewComment", async () => {
    const client: GithubClient = {
      pulls: { get: vi.fn(), createReviewComment: vi.fn() },
      reactions: { listForPullRequestReviewComment: vi.fn() },
      repos: { createOrUpdateFileContents: vi.fn() },
    };

    await expect(
      replyToReviewComment(client, { owner: "acme", repo: "widgets", pullNumber: 7, commentId: 100, body: "x" })
    ).rejects.toThrow("GithubClient does not support createReplyForReviewComment");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/github && pnpm test -- replyToReviewComment`
Expected: FAIL with "Cannot find module './replyToReviewComment.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/github/src/replyToReviewComment.ts
import type { GithubClient } from "./types.js";

export interface ReplyToReviewCommentParams {
  owner: string;
  repo: string;
  pullNumber: number;
  commentId: number;
  body: string;
}

export async function replyToReviewComment(client: GithubClient, params: ReplyToReviewCommentParams): Promise<number> {
  if (!client.pulls.createReplyForReviewComment) {
    throw new Error("GithubClient does not support createReplyForReviewComment");
  }

  const response = await client.pulls.createReplyForReviewComment({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    comment_id: params.commentId,
    body: params.body,
  });

  return response.data.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/github && pnpm test -- replyToReviewComment`
Expected: PASS (2 tests)

- [ ] **Step 5: Export from barrel**

In `packages/github/src/index.ts`, add:

```ts
export { replyToReviewComment } from "./replyToReviewComment.js";
export type { ReplyToReviewCommentParams } from "./replyToReviewComment.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/github/src/replyToReviewComment.ts packages/github/src/replyToReviewComment.test.ts packages/github/src/index.ts
git commit -m "feat(github): add replyToReviewComment"
```

---

### Task 3: Scaffold `packages/action`

**Files:**
- Create: `packages/action/package.json`
- Create: `packages/action/tsconfig.json`
- Create: `packages/action/src/index.ts` (temporary empty barrel, filled in Task 8)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@worktrace/action",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@worktrace/core": "workspace:*",
    "@worktrace/providers": "workspace:*",
    "@worktrace/github": "workspace:*",
    "@worktrace/worklog": "workspace:*",
    "@actions/core": "^1.10.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "composite": true },
  "references": [
    { "path": "../core" },
    { "path": "../providers" },
    { "path": "../github" },
    { "path": "../worklog" }
  ]
}
```

- [ ] **Step 3: Create placeholder barrel**

```ts
// packages/action/src/index.ts
export {};
```

- [ ] **Step 4: Install workspace dependencies**

Run: `pnpm install`
Expected: lockfile updates, `@worktrace/action` linked into the workspace, `@actions/core` downloaded. If pnpm reports an ignored build script warning, this is expected boilerplate (same as prior packages) — no action needed.

- [ ] **Step 5: Commit**

```bash
git add packages/action/package.json packages/action/tsconfig.json packages/action/src/index.ts pnpm-lock.yaml
git commit -m "chore(action): scaffold packages/action"
```

---

### Task 4: `loadConfig`

Reads the parsed `worktrace.config.json` contents plus an API key (env var, injected by caller — never read directly from the config file per the security rule of never hardcoding/storing secrets in files) and returns a `ProviderConfig` ready for `createProvider`.

**Files:**
- Create: `packages/action/src/loadConfig.ts`
- Test: `packages/action/src/loadConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/action/src/loadConfig.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./loadConfig.js";

describe("loadConfig", () => {
  it("builds a ProviderConfig from valid claude config json and an api key", () => {
    const config = loadConfig({
      configJson: JSON.stringify({ provider: "claude", model: "claude-sonnet-5" }),
      apiKey: "sk-test-123",
    });

    expect(config).toEqual({ provider: "claude", apiKey: "sk-test-123", model: "claude-sonnet-5" });
  });

  it("builds a ProviderConfig from valid openai config json", () => {
    const config = loadConfig({
      configJson: JSON.stringify({ provider: "openai", model: "gpt-5" }),
      apiKey: "sk-test-456",
    });

    expect(config).toEqual({ provider: "openai", apiKey: "sk-test-456", model: "gpt-5" });
  });

  it("throws when provider is missing or unrecognized", () => {
    expect(() => loadConfig({ configJson: JSON.stringify({ model: "x" }), apiKey: "k" })).toThrow(
      "Invalid provider in config: undefined"
    );
    expect(() =>
      loadConfig({ configJson: JSON.stringify({ provider: "gemini", model: "x" }), apiKey: "k" })
    ).toThrow("Invalid provider in config: gemini");
  });

  it("throws when model is missing", () => {
    expect(() => loadConfig({ configJson: JSON.stringify({ provider: "claude" }), apiKey: "k" })).toThrow(
      "Missing model in config"
    );
  });

  it("throws when apiKey is empty", () => {
    expect(() =>
      loadConfig({ configJson: JSON.stringify({ provider: "claude", model: "x" }), apiKey: "" })
    ).toThrow("Missing API key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/action && pnpm test -- loadConfig`
Expected: FAIL with "Cannot find module './loadConfig.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/action/src/loadConfig.ts
import type { ProviderConfig } from "@worktrace/providers";

export interface LoadConfigParams {
  configJson: string;
  apiKey: string;
}

export function loadConfig(params: LoadConfigParams): ProviderConfig {
  const parsed = JSON.parse(params.configJson) as { provider?: string; model?: string };

  if (parsed.provider !== "claude" && parsed.provider !== "openai") {
    throw new Error(`Invalid provider in config: ${String(parsed.provider)}`);
  }
  if (!parsed.model) {
    throw new Error("Missing model in config");
  }
  if (!params.apiKey) {
    throw new Error("Missing API key");
  }

  return { provider: parsed.provider, apiKey: params.apiKey, model: parsed.model };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/action && pnpm test -- loadConfig`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/action/src/loadConfig.ts packages/action/src/loadConfig.test.ts
git commit -m "feat(action): add loadConfig"
```

---

### Task 5: `runReview`

Orchestrates step 1-2 of the design's data flow: fetch the PR diff, ask the provider to review it, post inline comments for any issues found.

**Files:**
- Create: `packages/action/src/runReview.ts`
- Test: `packages/action/src/runReview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/action/src/runReview.test.ts
import { describe, it, expect, vi } from "vitest";
import type { GithubClient } from "@worktrace/github";
import type { LLMProvider, ReviewResult } from "@worktrace/core";
import { runReview } from "./runReview.js";

function makeFakeClient(diff: string, createReviewComment: ReturnType<typeof vi.fn>): GithubClient {
  return {
    pulls: {
      get: vi.fn().mockResolvedValue({ data: diff }),
      createReviewComment,
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

function makeFakeProvider(result: ReviewResult): LLMProvider {
  return { name: "fake", review: vi.fn().mockResolvedValue(result) };
}

describe("runReview", () => {
  it("posts a comment per issue and returns issues + posted comments", async () => {
    const createReviewComment = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 501 } })
      .mockResolvedValueOnce({ data: { id: 502 } });
    const client = makeFakeClient("--- a/x\n+++ b/x\n", createReviewComment);
    const provider = makeFakeProvider({
      issues: [
        { id: "issue-1", severity: "high", file: "x.ts", line: 3, summary: "s1", suggestion: "sg1" },
        { id: "issue-2", severity: "low", file: "y.ts", line: 9, summary: "s2", suggestion: "sg2" },
      ],
    });

    const result = await runReview(client, provider, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
    });

    expect(result.issues).toHaveLength(2);
    expect(result.postedComments).toEqual([
      { issueId: "issue-1", commentId: 501 },
      { issueId: "issue-2", commentId: 502 },
    ]);
    expect(createReviewComment).toHaveBeenCalledTimes(2);
  });

  it("skips posting and returns empty arrays when the provider finds no issues", async () => {
    const createReviewComment = vi.fn();
    const client = makeFakeClient("--- a/x\n+++ b/x\n", createReviewComment);
    const provider = makeFakeProvider({ issues: [] });

    const result = await runReview(client, provider, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
    });

    expect(result).toEqual({ issues: [], postedComments: [] });
    expect(createReviewComment).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/action && pnpm test -- runReview`
Expected: FAIL with "Cannot find module './runReview.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/action/src/runReview.ts
import type { LLMProvider, ReviewIssue } from "@worktrace/core";
import type { GithubClient, PostedComment } from "@worktrace/github";
import { fetchPrDiff, postReviewComments } from "@worktrace/github";

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

export async function runReview(
  client: GithubClient,
  provider: LLMProvider,
  params: RunReviewParams
): Promise<RunReviewResult> {
  const diff = await fetchPrDiff(client, { owner: params.owner, repo: params.repo, pullNumber: params.pullNumber });
  const { issues } = await provider.review(diff);

  if (issues.length === 0) {
    return { issues: [], postedComments: [] };
  }

  const postedComments = await postReviewComments(client, {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
    commitId: params.commitId,
    issues,
  });

  return { issues, postedComments };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/action && pnpm test -- runReview`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/action/src/runReview.ts packages/action/src/runReview.test.ts
git commit -m "feat(action): add runReview"
```

---

### Task 6: `requestReasonForRejections`

Implements 데이터 흐름 point 4: for each posted comment whose reactions classify as `"rejected"` (via `classifyDecision`) and which has no existing reply thread yet, post the one-line-reason request reply exactly once. Because the bot's own reply becomes a thread reply on the next poll, this naturally prevents re-asking — no separate "already asked" store needed.

**Files:**
- Create: `packages/action/src/requestReasonForRejections.ts`
- Test: `packages/action/src/requestReasonForRejections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/action/src/requestReasonForRejections.test.ts
import { describe, it, expect, vi } from "vitest";
import type { GithubClient } from "@worktrace/github";
import { requestReasonForRejections } from "./requestReasonForRejections.js";

function makeFakeClient(
  threads: Array<{ id: number; body: string; in_reply_to_id?: number }>,
  createReplyForReviewComment: ReturnType<typeof vi.fn>
): GithubClient {
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn(),
      listReviewComments: vi.fn().mockResolvedValue({ data: threads }),
      createReplyForReviewComment,
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("requestReasonForRejections", () => {
  it("replies once to a rejected comment with no existing reply", async () => {
    const createReplyForReviewComment = vi.fn().mockResolvedValue({ data: { id: 900 } });
    const client = makeFakeClient([{ id: 100, body: "review comment" }], createReplyForReviewComment);

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 0, thumbsDown: 2 }],
    });

    expect(asked).toEqual(["issue-1"]);
    expect(createReplyForReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 100 })
    );
  });

  it("does not reply again when the comment already has a reply thread", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient(
      [
        { id: 100, body: "review comment" },
        { id: 101, body: "이유 한 줄만...", in_reply_to_id: 100 },
      ],
      createReplyForReviewComment
    );

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 0, thumbsDown: 2 }],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });

  it("does not reply to comments that are accepted or unclear", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient([{ id: 100, body: "review comment" }], createReplyForReviewComment);

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 2, thumbsDown: 0 }],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });

  it("skips a posted comment that has no reaction data yet", async () => {
    const createReplyForReviewComment = vi.fn();
    const client = makeFakeClient([{ id: 100, body: "review comment" }], createReplyForReviewComment);

    const asked = await requestReasonForRejections(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [],
    });

    expect(asked).toEqual([]);
    expect(createReplyForReviewComment).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/action && pnpm test -- requestReasonForRejections`
Expected: FAIL with "Cannot find module './requestReasonForRejections.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/action/src/requestReasonForRejections.ts
import type { GithubClient, PostedComment, ReactionSummary } from "@worktrace/github";
import { listReviewComments, replyToReviewComment } from "@worktrace/github";
import { classifyDecision } from "@worktrace/worklog";

const REASON_REQUEST_BODY = "이유 한 줄만 남겨주시겠어요? 판단 기록(work-trace)에 반영합니다.";

export interface RequestReasonForRejectionsParams {
  owner: string;
  repo: string;
  pullNumber: number;
  postedComments: PostedComment[];
  reactions: ReactionSummary[];
}

export async function requestReasonForRejections(
  client: GithubClient,
  params: RequestReasonForRejectionsParams
): Promise<string[]> {
  const reactionsByCommentId = new Map(params.reactions.map((r) => [r.commentId, r]));
  const threads = await listReviewComments(client, {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
  });
  const repliedToCommentIds = new Set(
    threads.filter((t) => t.inReplyToId !== undefined).map((t) => t.inReplyToId as number)
  );

  const askedIssueIds: string[] = [];

  for (const posted of params.postedComments) {
    const reaction = reactionsByCommentId.get(posted.commentId);
    if (!reaction) continue;
    if (classifyDecision(reaction) !== "rejected") continue;
    if (repliedToCommentIds.has(posted.commentId)) continue;

    await replyToReviewComment(client, {
      owner: params.owner,
      repo: params.repo,
      pullNumber: params.pullNumber,
      commentId: posted.commentId,
      body: REASON_REQUEST_BODY,
    });

    askedIssueIds.push(posted.issueId);
  }

  return askedIssueIds;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/action && pnpm test -- requestReasonForRejections`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/action/src/requestReasonForRejections.ts packages/action/src/requestReasonForRejections.test.ts
git commit -m "feat(action): add requestReasonForRejections"
```

---

### Task 7: `runWorklogCommit`

Implements 데이터 흐름 point 5: build worktrace entries, format markdown, compute the file path, and commit it via `@worktrace/github`.

**Files:**
- Create: `packages/action/src/runWorklogCommit.ts`
- Test: `packages/action/src/runWorklogCommit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/action/src/runWorklogCommit.test.ts
import { describe, it, expect, vi } from "vitest";
import type { GithubClient } from "@worktrace/github";
import { runWorklogCommit } from "./runWorklogCommit.js";

function makeFakeClient(createOrUpdateFileContents: ReturnType<typeof vi.fn>): GithubClient {
  return {
    pulls: { get: vi.fn(), createReviewComment: vi.fn() },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents },
  };
}

describe("runWorklogCommit", () => {
  it("commits the formatted worklog markdown at the computed path and returns it", async () => {
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({ data: {} });
    const client = makeFakeClient(createOrUpdateFileContents);

    const path = await runWorklogCommit(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      pullNumber: 7,
      date: "2026-07-30",
      issues: [{ id: "issue-1", severity: "high", file: "x.ts", line: 3, summary: "s1", suggestion: "sg1" }],
      postedComments: [{ issueId: "issue-1", commentId: 100 }],
      reactions: [{ commentId: 100, thumbsUp: 0, thumbsDown: 2 }],
      reasons: { "issue-1": "false positive" },
    });

    expect(path).toBe(".worklog/2026-07-30-pr7.md");
    expect(createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "widgets",
        branch: "feature/pr-7",
        path: ".worklog/2026-07-30-pr7.md",
        message: "docs(worklog): record work-trace for PR #7",
      })
    );
    const call = createOrUpdateFileContents.mock.calls[0][0];
    expect(Buffer.from(call.content, "base64").toString("utf-8")).toContain("issue-1 — rejected");
    expect(call.sha).toBeUndefined();
  });

  it("passes sha through when an existing file is being updated", async () => {
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({ data: {} });
    const client = makeFakeClient(createOrUpdateFileContents);

    await runWorklogCommit(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      pullNumber: 7,
      date: "2026-07-30",
      issues: [],
      postedComments: [],
      reactions: [],
      existingFileSha: "sha-abc",
    });

    const call = createOrUpdateFileContents.mock.calls[0][0];
    expect(call.sha).toBe("sha-abc");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/action && pnpm test -- runWorklogCommit`
Expected: FAIL with "Cannot find module './runWorklogCommit.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/action/src/runWorklogCommit.ts
import type { ReviewIssue } from "@worktrace/core";
import type { GithubClient, PostedComment, ReactionSummary } from "@worktrace/github";
import { commitWorklogFile } from "@worktrace/github";
import { buildWorktraceEntries, formatWorklogMarkdown, worklogFilePath } from "@worktrace/worklog";

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/action && pnpm test -- runWorklogCommit`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/action/src/runWorklogCommit.ts packages/action/src/runWorklogCommit.test.ts
git commit -m "feat(action): add runWorklogCommit"
```

---

### Task 8: Barrel export

**Files:**
- Modify: `packages/action/src/index.ts`

- [ ] **Step 1: Replace the placeholder barrel**

```ts
// packages/action/src/index.ts
export { loadConfig } from "./loadConfig.js";
export type { LoadConfigParams } from "./loadConfig.js";
export { runReview } from "./runReview.js";
export type { RunReviewParams, RunReviewResult } from "./runReview.js";
export { requestReasonForRejections } from "./requestReasonForRejections.js";
export type { RequestReasonForRejectionsParams } from "./requestReasonForRejections.js";
export { runWorklogCommit } from "./runWorklogCommit.js";
export type { RunWorklogCommitParams } from "./runWorklogCommit.js";
```

- [ ] **Step 2: Run the full package test suite**

Run: `cd packages/action && pnpm test`
Expected: PASS (13 tests: 5 loadConfig + 2 runReview + 4 requestReasonForRejections + 2 runWorklogCommit)

- [ ] **Step 3: Commit**

```bash
git add packages/action/src/index.ts
git commit -m "feat(action): add package barrel export"
```

---

### Task 9: `main.ts` entrypoint + `action.yml`

This is untested glue code that reads real GitHub Actions inputs and wires the orchestration functions together — same precedent as `packages/github/src/createGithubClient.ts`, which has no test file because it only constructs a real client from an env value.

Per the design spec's error-handling rules: an LLM/GitHub API failure during the review itself should not fail the whole Action (just a warning comment, so it never blocks a PR merge); a GitHub auth/permission failure should fail the Action loudly since it is a configuration problem the user must fix.

**Files:**
- Create: `packages/action/src/main.ts`
- Create: `packages/action/action.yml`

- [ ] **Step 1: Write main.ts**

```ts
// packages/action/src/main.ts
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
```

- [ ] **Step 2: Write action.yml**

```yaml
# packages/action/action.yml
name: "Worktrace Bot"
description: "AI PR review with human-judgment work-trace logging"
inputs:
  github_token:
    description: "GitHub token with repo scope"
    required: true
  llm_api_key:
    description: "API key for the configured LLM provider"
    required: true
  repository:
    description: "owner/repo"
    required: true
  pull_number:
    description: "Pull request number"
    required: true
  commit_id:
    description: "Head commit SHA of the PR"
    required: true
  config_path:
    description: "Path to worktrace.config.json"
    required: false
    default: "worktrace.config.json"
runs:
  using: "node20"
  main: "dist/main.js"
```

- [ ] **Step 3: Build to verify main.ts compiles**

Run: `cd packages/action && pnpm build`
Expected: succeeds, emits `dist/main.js` and `dist/index.js`

- [ ] **Step 4: Commit**

```bash
git add packages/action/src/main.ts packages/action/action.yml
git commit -m "feat(action): add main entrypoint and action.yml"
```

---

### Task 10: Full workspace verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm -r test`
Expected: all packages green (core, providers, github, worklog, action)

- [ ] **Step 2: Run the full build**

Run: `pnpm -r build`
Expected: succeeds with no TS errors across all 5 packages

- [ ] **Step 3: Confirm working tree is clean apart from expected build artifacts**

Run: `git status --short`
Expected: only `tsconfig.tsbuildinfo` cache files untracked (already gitignored/expected per prior sessions), no stray edits

---

## Explicitly out of scope for this plan

- OpenAI provider implementation (`packages/providers` `createProvider`'s `"openai"` branch still throws — tracked separately).
- Deploying `action.yml` + an example workflow file into `feed-flow` and `claude-context-auto-handoff` — requires first verifying both repos have GitHub remotes (unverified per design spec 적용 대상 section). Do this as a follow-up once this plan is merged.
- `poll` mode (reaction polling → `requestReasonForRejections` → `runWorklogCommit` wiring in `main.ts`) is intentionally left as a second entrypoint mode to add once `review` mode has been manually verified against a real PR — the design spec's test strategy explicitly scopes full Action E2E testing to manual integration testing against `feed-flow`, not automated TDD.
