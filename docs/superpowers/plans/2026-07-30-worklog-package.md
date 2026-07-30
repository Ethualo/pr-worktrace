# packages/worklog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a PR's posted review comments + their 👍/👎 reaction counts (+ optional one-line rejection reasons) into the `.worklog/<date>-pr<number>.md` markdown content that `commitWorklogFile` (from `packages/github`) commits to the repo.

**Architecture:** Pure, framework-agnostic transforms — no GitHub or LLM calls in this package. `classifyDecision` turns a `ReactionSummary` into `"accepted" | "rejected" | "unclear"`. `buildWorktraceEntries` joins `ReviewIssue[]` + `PostedComment[]` + `ReactionSummary[]` (+ optional reply reasons) into `WorkTraceEntry[]`. `formatWorklogMarkdown` renders those entries to the final markdown string. `worklogFilePath` derives the standard file path.

**Tech Stack:** TypeScript 5, Node 20, pnpm workspaces, Vitest. Depends on `@worktrace/core` (`ReviewIssue`) and `@worktrace/github` (`PostedComment`, `ReactionSummary`).

---

## Task 0: Package scaffold

**Files:**
- Create: `packages/worklog/package.json`
- Create: `packages/worklog/tsconfig.json`

- [ ] **Step 1: Create `packages/worklog/package.json`**

```json
{
  "name": "@worktrace/worklog",
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
    "@worktrace/github": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/worklog/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "composite": true },
  "references": [{ "path": "../core" }, { "path": "../github" }]
}
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`
Expected: lockfile updated, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/worklog/package.json packages/worklog/tsconfig.json pnpm-lock.yaml
git commit -m "chore(worklog): scaffold packages/worklog"
```

---

## Task 1: `WorkTraceEntry` type

**Files:**
- Create: `packages/worklog/src/types.ts`
- Test: `packages/worklog/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/worklog/src/types.test.ts
import { describe, it, expect } from "vitest";
import type { Decision, WorkTraceEntry } from "./types.js";

describe("WorkTraceEntry shape", () => {
  it("accepts a well-formed entry with each decision value", () => {
    const decisions: Decision[] = ["accepted", "rejected", "unclear"];
    const entry: WorkTraceEntry = {
      issueId: "issue-1",
      file: "src/geo.ts",
      line: 12,
      severity: "medium",
      summary: "부동소수점 오차",
      suggestion: "상수 추출",
      decision: "accepted",
    };
    expect(decisions).toContain(entry.decision);
  });

  it("allows an optional reason field for rejected entries", () => {
    const entry: WorkTraceEntry = {
      issueId: "issue-2",
      file: "src/geo.ts",
      line: 20,
      severity: "high",
      summary: "널 체크 누락",
      suggestion: "옵셔널 체이닝 사용",
      decision: "rejected",
      reason: "이미 상위에서 체크함",
    };
    expect(entry.reason).toBe("이미 상위에서 체크함");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worklog && pnpm test`
Expected: FAIL — `Cannot find module './types.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/worklog/src/types.ts
import type { Severity } from "@worktrace/core";

export type Decision = "accepted" | "rejected" | "unclear";

export interface WorkTraceEntry {
  issueId: string;
  file: string;
  line: number;
  severity: Severity;
  summary: string;
  suggestion: string;
  decision: Decision;
  reason?: string;
  commitId?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worklog && pnpm test`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/worklog/src/types.ts packages/worklog/src/types.test.ts
git commit -m "feat(worklog): add WorkTraceEntry and Decision types"
```

---

## Task 2: `classifyDecision`

**Files:**
- Create: `packages/worklog/src/classifyDecision.ts`
- Test: `packages/worklog/src/classifyDecision.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/worklog/src/classifyDecision.test.ts
import { describe, it, expect } from "vitest";
import { classifyDecision } from "./classifyDecision.js";

describe("classifyDecision", () => {
  it("returns 'accepted' when thumbsUp outnumbers thumbsDown", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 2, thumbsDown: 0 })).toBe("accepted");
  });

  it("returns 'rejected' when thumbsDown outnumbers thumbsUp", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 0, thumbsDown: 1 })).toBe("rejected");
  });

  it("returns 'unclear' when there are no reactions", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 0, thumbsDown: 0 })).toBe("unclear");
  });

  it("returns 'unclear' on a tie", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 1, thumbsDown: 1 })).toBe("unclear");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worklog && pnpm test`
Expected: FAIL — `Cannot find module './classifyDecision.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/worklog/src/classifyDecision.ts
import type { ReactionSummary } from "@worktrace/github";
import type { Decision } from "./types.js";

export function classifyDecision(reactions: ReactionSummary): Decision {
  if (reactions.thumbsUp > reactions.thumbsDown) return "accepted";
  if (reactions.thumbsDown > reactions.thumbsUp) return "rejected";
  return "unclear";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worklog && pnpm test`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/worklog/src/classifyDecision.ts packages/worklog/src/classifyDecision.test.ts
git commit -m "feat(worklog): add classifyDecision"
```

---

## Task 3: `buildWorktraceEntries`

**Files:**
- Create: `packages/worklog/src/buildWorktraceEntries.ts`
- Test: `packages/worklog/src/buildWorktraceEntries.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/worklog/src/buildWorktraceEntries.test.ts
import { describe, it, expect } from "vitest";
import { buildWorktraceEntries } from "./buildWorktraceEntries.js";
import type { ReviewIssue } from "@worktrace/core";
import type { PostedComment, ReactionSummary } from "@worktrace/github";

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

const postedComments: PostedComment[] = [
  { issueId: "issue-1", commentId: 100 },
  { issueId: "issue-2", commentId: 101 },
];

const reactions: ReactionSummary[] = [
  { commentId: 100, thumbsUp: 1, thumbsDown: 0 },
  { commentId: 101, thumbsUp: 0, thumbsDown: 1 },
];

describe("buildWorktraceEntries", () => {
  it("joins issues + posted comments + reactions into classified entries", () => {
    const entries = buildWorktraceEntries({ issues, postedComments, reactions });

    expect(entries).toEqual([
      {
        issueId: "issue-1",
        file: "src/geo.ts",
        line: 12,
        severity: "medium",
        summary: "부동소수점 오차",
        suggestion: "상수 추출",
        decision: "accepted",
      },
      {
        issueId: "issue-2",
        file: "src/geo.ts",
        line: 20,
        severity: "high",
        summary: "널 체크 누락",
        suggestion: "옵셔널 체이닝 사용",
        decision: "rejected",
      },
    ]);
  });

  it("attaches an optional reason when a reply reason is provided for the issue", () => {
    const entries = buildWorktraceEntries({
      issues,
      postedComments,
      reactions,
      reasons: { "issue-2": "이미 상위에서 체크함" },
    });

    expect(entries[1].reason).toBe("이미 상위에서 체크함");
    expect(entries[0].reason).toBeUndefined();
  });

  it("attaches the commit id the issue was reviewed against, when provided", () => {
    const entries = buildWorktraceEntries({ issues, postedComments, reactions, commitId: "abc123" });

    expect(entries[0].commitId).toBe("abc123");
    expect(entries[1].commitId).toBe("abc123");
  });

  it("defaults to 'unclear' when a posted comment has no matching reaction summary", () => {
    const entries = buildWorktraceEntries({
      issues: [issues[0]],
      postedComments: [postedComments[0]],
      reactions: [],
    });

    expect(entries[0].decision).toBe("unclear");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worklog && pnpm test`
Expected: FAIL — `Cannot find module './buildWorktraceEntries.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/worklog/src/buildWorktraceEntries.ts
import type { ReviewIssue } from "@worktrace/core";
import type { PostedComment, ReactionSummary } from "@worktrace/github";
import { classifyDecision } from "./classifyDecision.js";
import type { WorkTraceEntry } from "./types.js";

export interface BuildWorktraceEntriesParams {
  issues: ReviewIssue[];
  postedComments: PostedComment[];
  reactions: ReactionSummary[];
  reasons?: Record<string, string>;
  commitId?: string;
}

export function buildWorktraceEntries(params: BuildWorktraceEntriesParams): WorkTraceEntry[] {
  const commentIdByIssueId = new Map(params.postedComments.map((c) => [c.issueId, c.commentId]));
  const reactionsByCommentId = new Map(params.reactions.map((r) => [r.commentId, r]));

  return params.issues.map((issue) => {
    const commentId = commentIdByIssueId.get(issue.id);
    const reaction = commentId !== undefined ? reactionsByCommentId.get(commentId) : undefined;
    const decision = reaction ? classifyDecision(reaction) : "unclear";
    const reason = params.reasons?.[issue.id];

    return {
      issueId: issue.id,
      file: issue.file,
      line: issue.line,
      severity: issue.severity,
      summary: issue.summary,
      suggestion: issue.suggestion,
      decision,
      ...(reason ? { reason } : {}),
      ...(params.commitId ? { commitId: params.commitId } : {}),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worklog && pnpm test`
Expected: PASS (10 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/worklog/src/buildWorktraceEntries.ts packages/worklog/src/buildWorktraceEntries.test.ts
git commit -m "feat(worklog): add buildWorktraceEntries"
```

---

## Task 4: `worklogFilePath`

**Files:**
- Create: `packages/worklog/src/worklogFilePath.ts`
- Test: `packages/worklog/src/worklogFilePath.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/worklog/src/worklogFilePath.test.ts
import { describe, it, expect } from "vitest";
import { worklogFilePath } from "./worklogFilePath.js";

describe("worklogFilePath", () => {
  it("builds the standard .worklog/<date>-pr<number>.md path", () => {
    expect(worklogFilePath({ date: "2026-07-30", prNumber: 7 })).toBe(".worklog/2026-07-30-pr7.md");
  });

  it("does not zero-pad the PR number", () => {
    expect(worklogFilePath({ date: "2026-01-05", prNumber: 142 })).toBe(".worklog/2026-01-05-pr142.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worklog && pnpm test`
Expected: FAIL — `Cannot find module './worklogFilePath.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/worklog/src/worklogFilePath.ts
export interface WorklogFilePathParams {
  date: string;
  prNumber: number;
}

export function worklogFilePath(params: WorklogFilePathParams): string {
  return `.worklog/${params.date}-pr${params.prNumber}.md`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worklog && pnpm test`
Expected: PASS (12 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/worklog/src/worklogFilePath.ts packages/worklog/src/worklogFilePath.test.ts
git commit -m "feat(worklog): add worklogFilePath"
```

---

## Task 5: `formatWorklogMarkdown`

**Files:**
- Create: `packages/worklog/src/formatWorklogMarkdown.ts`
- Test: `packages/worklog/src/formatWorklogMarkdown.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/worklog/src/formatWorklogMarkdown.test.ts
import { describe, it, expect } from "vitest";
import { formatWorklogMarkdown } from "./formatWorklogMarkdown.js";
import type { WorkTraceEntry } from "./types.js";

const entries: WorkTraceEntry[] = [
  {
    issueId: "issue-1",
    file: "src/geo.ts",
    line: 12,
    severity: "medium",
    summary: "부동소수점 오차",
    suggestion: "상수 추출",
    decision: "accepted",
  },
  {
    issueId: "issue-2",
    file: "src/geo.ts",
    line: 20,
    severity: "high",
    summary: "널 체크 누락",
    suggestion: "옵셔널 체이닝 사용",
    decision: "rejected",
    reason: "이미 상위에서 체크함",
    commitId: "abc123",
  },
];

describe("formatWorklogMarkdown", () => {
  it("renders a heading plus one section per entry, with reason/commit only when present", () => {
    const markdown = formatWorklogMarkdown(entries, { prNumber: 7, date: "2026-07-30", repo: "acme/widgets" });

    expect(markdown).toBe(
      `# Work Trace — acme/widgets PR #7 (2026-07-30)

## issue-1 — accepted
- **File**: \`src/geo.ts:12\`
- **Severity**: medium
- **AI Suggestion**: 부동소수점 오차 → 상수 추출

## issue-2 — rejected
- **File**: \`src/geo.ts:20\`
- **Severity**: high
- **AI Suggestion**: 널 체크 누락 → 옵셔널 체이닝 사용
- **Reason**: 이미 상위에서 체크함
- **Commit**: \`abc123\`
`
    );
  });

  it("renders just the heading when there are no entries", () => {
    const markdown = formatWorklogMarkdown([], { prNumber: 7, date: "2026-07-30", repo: "acme/widgets" });

    expect(markdown).toBe("# Work Trace — acme/widgets PR #7 (2026-07-30)\n");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/worklog && pnpm test`
Expected: FAIL — `Cannot find module './formatWorklogMarkdown.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/worklog/src/formatWorklogMarkdown.ts
import type { WorkTraceEntry } from "./types.js";

export interface FormatWorklogMarkdownMeta {
  prNumber: number;
  date: string;
  repo: string;
}

function formatEntry(entry: WorkTraceEntry): string {
  const lines = [
    `## ${entry.issueId} — ${entry.decision}`,
    `- **File**: \`${entry.file}:${entry.line}\``,
    `- **Severity**: ${entry.severity}`,
    `- **AI Suggestion**: ${entry.summary} → ${entry.suggestion}`,
  ];
  if (entry.reason) {
    lines.push(`- **Reason**: ${entry.reason}`);
  }
  if (entry.commitId) {
    lines.push(`- **Commit**: \`${entry.commitId}\``);
  }
  return lines.join("\n");
}

export function formatWorklogMarkdown(entries: WorkTraceEntry[], meta: FormatWorklogMarkdownMeta): string {
  const heading = `# Work Trace — ${meta.repo} PR #${meta.prNumber} (${meta.date})`;

  if (entries.length === 0) {
    return `${heading}\n`;
  }

  const sections = entries.map(formatEntry).join("\n\n");
  return `${heading}\n\n${sections}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/worklog && pnpm test`
Expected: PASS (14 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/worklog/src/formatWorklogMarkdown.ts packages/worklog/src/formatWorklogMarkdown.test.ts
git commit -m "feat(worklog): add formatWorklogMarkdown"
```

---

## Task 6: Barrel export + workspace verify

**Files:**
- Create: `packages/worklog/src/index.ts`

- [ ] **Step 1: Write barrel export**

```typescript
// packages/worklog/src/index.ts
export type { Decision, WorkTraceEntry } from "./types.js";
export { classifyDecision } from "./classifyDecision.js";
export { buildWorktraceEntries } from "./buildWorktraceEntries.js";
export type { BuildWorktraceEntriesParams } from "./buildWorktraceEntries.js";
export { worklogFilePath } from "./worklogFilePath.js";
export type { WorklogFilePathParams } from "./worklogFilePath.js";
export { formatWorklogMarkdown } from "./formatWorklogMarkdown.js";
export type { FormatWorklogMarkdownMeta } from "./formatWorklogMarkdown.js";
```

- [ ] **Step 2: Verify the whole workspace builds**

Run: `pnpm -r build`
Expected: no TypeScript errors, `dist/` generated in `core`, `providers`, `github`, and `worklog`.

- [ ] **Step 3: Verify the whole workspace tests still pass**

Run: `pnpm test`
Expected: PASS (32 tests total across all four packages).

- [ ] **Step 4: Commit**

```bash
git add packages/worklog/src/index.ts
git commit -m "feat(worklog): add package barrel export"
```

---

## Out of Scope (next plan)

- `action/`: GitHub Action entrypoint wiring `core` → `providers` → `github` → `worklog` together, including the "이유 한 줄만" reply-request-on-👎 orchestration.
- OpenAI provider implementation.
- Deployment to `feed-flow` and `claude-context-auto-handoff`.
