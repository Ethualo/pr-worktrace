# packages/github Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GitHub REST API wrapper package: fetch a PR's diff, post tagged inline review comments, poll 👍/👎 reactions on those comments, and commit a `.worklog/` markdown file to the PR branch.

**Architecture:** `packages/github` is a thin, dependency-injected wrapper around `@octokit/rest`. Every exported function takes a `GithubClient` (a minimal duck-typed interface, not the full Octokit type) as its first argument, so tests inject a fake client object — same pattern as `createClaudeProvider` in `packages/providers`. No network calls, no mocking library (nock etc.) needed. A `createGithubClient(token)` factory wraps the real `@octokit/rest` `Octokit` instance for production use.

**Tech Stack:** TypeScript 5, Node 20, pnpm workspaces, Vitest, `@octokit/rest`.

---

## Task 0: Package scaffold

**Files:**
- Create: `packages/github/package.json`
- Create: `packages/github/tsconfig.json`

- [ ] **Step 1: Create `packages/github/package.json`**

```json
{
  "name": "@worktrace/github",
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
    "@octokit/rest": "^21.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/github/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "composite": true },
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`
Expected: lockfile updated, `@octokit/rest` added, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/github/package.json packages/github/tsconfig.json pnpm-lock.yaml
git commit -m "chore(github): scaffold packages/github"
```

---

## Task 1: `GithubClient` type + posted-comment/reaction types

**Files:**
- Create: `packages/github/src/types.ts`
- Test: `packages/github/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/github/src/types.test.ts
import { describe, it, expect } from "vitest";
import type { GithubClient, PostedComment, ReactionSummary } from "./types.js";

describe("GithubClient contract", () => {
  it("a conforming fake client satisfies the shape used by this package", async () => {
    const fakeClient: GithubClient = {
      pulls: {
        get: async () => ({ data: "diff text" }),
        createReviewComment: async () => ({ data: { id: 1 } }),
      },
      reactions: {
        listForPullRequestReviewComment: async () => ({ data: [] }),
      },
      repos: {
        createOrUpdateFileContents: async () => ({ data: {} }),
      },
    };
    const diffResult = await fakeClient.pulls.get({
      owner: "o",
      repo: "r",
      pull_number: 1,
    });
    expect(diffResult.data).toBe("diff text");
  });
});

describe("PostedComment / ReactionSummary shape", () => {
  it("accepts well-formed objects", () => {
    const comment: PostedComment = { issueId: "issue-1", commentId: 42 };
    const summary: ReactionSummary = { commentId: 42, thumbsUp: 1, thumbsDown: 0 };
    expect(comment.commentId).toBe(summary.commentId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/github && pnpm test`
Expected: FAIL — `Cannot find module './types.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/github/src/types.ts
export interface GithubClient {
  pulls: {
    get(params: {
      owner: string;
      repo: string;
      pull_number: number;
      mediaType?: { format: string };
    }): Promise<{ data: unknown }>;
    createReviewComment(params: {
      owner: string;
      repo: string;
      pull_number: number;
      commit_id: string;
      path: string;
      line: number;
      body: string;
    }): Promise<{ data: { id: number } }>;
  };
  reactions: {
    listForPullRequestReviewComment(params: {
      owner: string;
      repo: string;
      comment_id: number;
    }): Promise<{ data: Array<{ content: string }> }>;
  };
  repos: {
    createOrUpdateFileContents(params: {
      owner: string;
      repo: string;
      path: string;
      message: string;
      content: string;
      branch: string;
      sha?: string;
    }): Promise<{ data: unknown }>;
  };
}

export interface PostedComment {
  issueId: string;
  commentId: number;
}

export interface ReactionSummary {
  commentId: number;
  thumbsUp: number;
  thumbsDown: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/github && pnpm test`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/github/src/types.ts packages/github/src/types.test.ts
git commit -m "feat(github): add GithubClient and result types"
```

---

## Task 2: `fetchPrDiff`

**Files:**
- Create: `packages/github/src/fetchPrDiff.ts`
- Test: `packages/github/src/fetchPrDiff.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/github/src/fetchPrDiff.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchPrDiff } from "./fetchPrDiff.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(diffData: unknown): GithubClient {
  return {
    pulls: {
      get: vi.fn().mockResolvedValue({ data: diffData }),
      createReviewComment: vi.fn(),
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("fetchPrDiff", () => {
  it("requests the diff media type and returns the raw diff text", async () => {
    const client = makeFakeClient("diff --git a/x b/x\n+added line\n");

    const diff = await fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 });

    expect(diff).toBe("diff --git a/x b/x\n+added line\n");
    expect(client.pulls.get).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      pull_number: 7,
      mediaType: { format: "diff" },
    });
  });

  it("throws if the client does not return a string", async () => {
    const client = makeFakeClient({ not: "a string" });

    await expect(
      fetchPrDiff(client, { owner: "acme", repo: "widgets", pullNumber: 7 })
    ).rejects.toThrow("Expected diff response to be a string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/github && pnpm test`
Expected: FAIL — `Cannot find module './fetchPrDiff.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/github/src/fetchPrDiff.ts
import type { GithubClient } from "./types.js";

export interface FetchPrDiffParams {
  owner: string;
  repo: string;
  pullNumber: number;
}

export async function fetchPrDiff(client: GithubClient, params: FetchPrDiffParams): Promise<string> {
  const response = await client.pulls.get({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    mediaType: { format: "diff" },
  });

  if (typeof response.data !== "string") {
    throw new Error("Expected diff response to be a string");
  }

  return response.data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/github && pnpm test`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/github/src/fetchPrDiff.ts packages/github/src/fetchPrDiff.test.ts
git commit -m "feat(github): add fetchPrDiff"
```

---

## Task 3: `postReviewComments`

**Files:**
- Create: `packages/github/src/postReviewComments.ts`
- Test: `packages/github/src/postReviewComments.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/github/src/postReviewComments.test.ts
import { describe, it, expect, vi } from "vitest";
import { postReviewComments } from "./postReviewComments.js";
import type { GithubClient } from "./types.js";
import type { ReviewIssue } from "@worktrace/core";

const issues: ReviewIssue[] = [
  {
    id: "issue-1",
    severity: "medium",
    file: "src/geo.ts",
    line: 12,
    summary: "부동소수점 오차",
    suggestion: "상수 추출",
  },
  {
    id: "issue-2",
    severity: "high",
    file: "src/geo.ts",
    line: 20,
    summary: "널 체크 누락",
    suggestion: "옵셔널 체이닝 사용",
  },
];

function makeFakeClient(): GithubClient {
  let nextId = 100;
  return {
    pulls: {
      get: vi.fn(),
      createReviewComment: vi.fn().mockImplementation(async () => ({ data: { id: nextId++ } })),
    },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("postReviewComments", () => {
  it("posts one tagged inline comment per issue and returns issueId/commentId pairs", async () => {
    const client = makeFakeClient();

    const posted = await postReviewComments(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
      issues,
    });

    expect(posted).toEqual([
      { issueId: "issue-1", commentId: 100 },
      { issueId: "issue-2", commentId: 101 },
    ]);
    expect(client.pulls.createReviewComment).toHaveBeenCalledTimes(2);
    expect(client.pulls.createReviewComment).toHaveBeenNthCalledWith(1, {
      owner: "acme",
      repo: "widgets",
      pull_number: 7,
      commit_id: "abc123",
      path: "src/geo.ts",
      line: 12,
      body: "<!-- worktrace-issue:issue-1 -->\n**[medium]** 부동소수점 오차\n\n상수 추출",
    });
  });

  it("returns an empty array when there are no issues", async () => {
    const client = makeFakeClient();

    const posted = await postReviewComments(client, {
      owner: "acme",
      repo: "widgets",
      pullNumber: 7,
      commitId: "abc123",
      issues: [],
    });

    expect(posted).toEqual([]);
    expect(client.pulls.createReviewComment).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/github && pnpm test`
Expected: FAIL — `Cannot find module './postReviewComments.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/github/src/postReviewComments.ts
import type { ReviewIssue } from "@worktrace/core";
import type { GithubClient, PostedComment } from "./types.js";

export interface PostReviewCommentsParams {
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
  issues: ReviewIssue[];
}

export function formatCommentBody(issue: ReviewIssue): string {
  return `<!-- worktrace-issue:${issue.id} -->\n**[${issue.severity}]** ${issue.summary}\n\n${issue.suggestion}`;
}

export async function postReviewComments(
  client: GithubClient,
  params: PostReviewCommentsParams
): Promise<PostedComment[]> {
  const posted: PostedComment[] = [];

  for (const issue of params.issues) {
    const response = await client.pulls.createReviewComment({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
      commit_id: params.commitId,
      path: issue.file,
      line: issue.line,
      body: formatCommentBody(issue),
    });
    posted.push({ issueId: issue.id, commentId: response.data.id });
  }

  return posted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/github && pnpm test`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/github/src/postReviewComments.ts packages/github/src/postReviewComments.test.ts
git commit -m "feat(github): add postReviewComments"
```

---

## Task 4: `pollReactions`

**Files:**
- Create: `packages/github/src/pollReactions.ts`
- Test: `packages/github/src/pollReactions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/github/src/pollReactions.test.ts
import { describe, it, expect, vi } from "vitest";
import { pollReactions } from "./pollReactions.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(reactionsByCommentId: Record<number, Array<{ content: string }>>): GithubClient {
  return {
    pulls: { get: vi.fn(), createReviewComment: vi.fn() },
    reactions: {
      listForPullRequestReviewComment: vi.fn().mockImplementation(async ({ comment_id }: { comment_id: number }) => ({
        data: reactionsByCommentId[comment_id] ?? [],
      })),
    },
    repos: { createOrUpdateFileContents: vi.fn() },
  };
}

describe("pollReactions", () => {
  it("summarizes thumbs up/down counts per comment id", async () => {
    const client = makeFakeClient({
      100: [{ content: "+1" }, { content: "+1" }, { content: "heart" }],
      101: [{ content: "-1" }],
    });

    const summaries = await pollReactions(client, { owner: "acme", repo: "widgets" }, [100, 101]);

    expect(summaries).toEqual([
      { commentId: 100, thumbsUp: 2, thumbsDown: 0 },
      { commentId: 101, thumbsUp: 0, thumbsDown: 1 },
    ]);
  });

  it("returns zero counts for a comment with no reactions", async () => {
    const client = makeFakeClient({});

    const summaries = await pollReactions(client, { owner: "acme", repo: "widgets" }, [200]);

    expect(summaries).toEqual([{ commentId: 200, thumbsUp: 0, thumbsDown: 0 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/github && pnpm test`
Expected: FAIL — `Cannot find module './pollReactions.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/github/src/pollReactions.ts
import type { GithubClient, ReactionSummary } from "./types.js";

export interface PollReactionsRepo {
  owner: string;
  repo: string;
}

export async function pollReactions(
  client: GithubClient,
  repo: PollReactionsRepo,
  commentIds: number[]
): Promise<ReactionSummary[]> {
  const summaries: ReactionSummary[] = [];

  for (const commentId of commentIds) {
    const response = await client.reactions.listForPullRequestReviewComment({
      owner: repo.owner,
      repo: repo.repo,
      comment_id: commentId,
    });

    let thumbsUp = 0;
    let thumbsDown = 0;
    for (const reaction of response.data) {
      if (reaction.content === "+1") thumbsUp++;
      if (reaction.content === "-1") thumbsDown++;
    }

    summaries.push({ commentId, thumbsUp, thumbsDown });
  }

  return summaries;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/github && pnpm test`
Expected: PASS (8 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/github/src/pollReactions.ts packages/github/src/pollReactions.test.ts
git commit -m "feat(github): add pollReactions"
```

---

## Task 5: `commitWorklogFile`

**Files:**
- Create: `packages/github/src/commitWorklogFile.ts`
- Test: `packages/github/src/commitWorklogFile.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/github/src/commitWorklogFile.test.ts
import { describe, it, expect, vi } from "vitest";
import { commitWorklogFile } from "./commitWorklogFile.js";
import type { GithubClient } from "./types.js";

function makeFakeClient(): GithubClient {
  return {
    pulls: { get: vi.fn(), createReviewComment: vi.fn() },
    reactions: { listForPullRequestReviewComment: vi.fn() },
    repos: { createOrUpdateFileContents: vi.fn().mockResolvedValue({ data: {} }) },
  };
}

describe("commitWorklogFile", () => {
  it("base64-encodes the content and commits it to the given branch/path", async () => {
    const client = makeFakeClient();

    await commitWorklogFile(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      path: ".worklog/2026-07-30-pr7.md",
      content: "# work trace\n\nissue-1: accepted\n",
      message: "chore(worklog): record PR #7 decisions",
    });

    expect(client.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: "acme",
      repo: "widgets",
      path: ".worklog/2026-07-30-pr7.md",
      message: "chore(worklog): record PR #7 decisions",
      content: Buffer.from("# work trace\n\nissue-1: accepted\n", "utf-8").toString("base64"),
      branch: "feature/pr-7",
    });
  });

  it("forwards an existing file sha when provided, to update rather than create", async () => {
    const client = makeFakeClient();

    await commitWorklogFile(client, {
      owner: "acme",
      repo: "widgets",
      branch: "feature/pr-7",
      path: ".worklog/2026-07-30-pr7.md",
      content: "updated content",
      message: "chore(worklog): update PR #7 decisions",
      sha: "existing-sha",
    });

    expect(client.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: "existing-sha" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/github && pnpm test`
Expected: FAIL — `Cannot find module './commitWorklogFile.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/github/src/commitWorklogFile.ts
import type { GithubClient } from "./types.js";

export interface CommitWorklogFileParams {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  sha?: string;
}

export async function commitWorklogFile(client: GithubClient, params: CommitWorklogFileParams): Promise<void> {
  await client.repos.createOrUpdateFileContents({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    message: params.message,
    content: Buffer.from(params.content, "utf-8").toString("base64"),
    branch: params.branch,
    ...(params.sha ? { sha: params.sha } : {}),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/github && pnpm test`
Expected: PASS (10 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/github/src/commitWorklogFile.ts packages/github/src/commitWorklogFile.test.ts
git commit -m "feat(github): add commitWorklogFile"
```

---

## Task 6: `createGithubClient` factory + barrel export

**Files:**
- Create: `packages/github/src/createGithubClient.ts`
- Create: `packages/github/src/index.ts`

- [ ] **Step 1: Write `createGithubClient`**

```typescript
// packages/github/src/createGithubClient.ts
import { Octokit } from "@octokit/rest";
import type { GithubClient } from "./types.js";

export function createGithubClient(token: string): GithubClient {
  return new Octokit({ auth: token }) as unknown as GithubClient;
}
```

- [ ] **Step 2: Write barrel export**

```typescript
// packages/github/src/index.ts
export type { GithubClient, PostedComment, ReactionSummary } from "./types.js";
export { fetchPrDiff } from "./fetchPrDiff.js";
export type { FetchPrDiffParams } from "./fetchPrDiff.js";
export { postReviewComments, formatCommentBody } from "./postReviewComments.js";
export type { PostReviewCommentsParams } from "./postReviewComments.js";
export { pollReactions } from "./pollReactions.js";
export type { PollReactionsRepo } from "./pollReactions.js";
export { commitWorklogFile } from "./commitWorklogFile.js";
export type { CommitWorklogFileParams } from "./commitWorklogFile.js";
export { createGithubClient } from "./createGithubClient.js";
```

- [ ] **Step 3: Verify the whole workspace builds**

Run: `pnpm -r build`
Expected: no TypeScript errors, `dist/` generated in `core`, `providers`, and `github`.

- [ ] **Step 4: Verify the whole workspace tests still pass**

Run: `pnpm test`
Expected: PASS (18 tests total across all three packages)

- [ ] **Step 5: Commit**

```bash
git add packages/github/src/createGithubClient.ts packages/github/src/index.ts
git commit -m "feat(github): add createGithubClient factory and barrel export"
```

---

## Out of Scope (next plan)

- `packages/worklog`: turn `PostedComment[]` + `ReactionSummary[]` + reply threads into `.worklog/*.md` markdown content (this plan only commits whatever content string it's given).
- `action/`: GitHub Action entrypoint + `action.yml` + example workflow wiring `core` → `providers` → `github` together.
- The "이유 한 줄만" request-comment-on-👎 behavior described in the design spec — belongs in the Action orchestration layer, not this low-level wrapper.
- OpenAI provider implementation.
- Deployment to `feed-flow` and `claude-context-auto-handoff`.
