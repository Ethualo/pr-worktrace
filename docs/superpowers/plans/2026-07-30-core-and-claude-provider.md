# worktrace-bot v1 — Core + Claude Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the vertical slice that can take a PR diff, get a structured review from Claude, and produce a review-issue list — no GitHub integration yet (that's a follow-up plan).

**Architecture:** pnpm monorepo. `packages/core` holds framework-agnostic diff parsing and the `ReviewIssue`/`LLMProvider` types. `packages/providers` implements `LLMProvider` for Claude. Both are pure TypeScript with no network calls in tests (mocked).

**Tech Stack:** TypeScript 5, Node 20, pnpm workspaces, Vitest, `@anthropic-ai/sdk`.

---

## Task 0: Repo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "worktrace-bot",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.log
.worklog/.cache
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo"
```

---

## Task 1: Core types (`ReviewIssue`, `LLMProvider`)

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Test: `packages/core/src/types.test.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@worktrace/core",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist", "rootDir": "src" }
}
```

- [ ] **Step 3: Write the failing test**

```typescript
// packages/core/src/types.test.ts
import { describe, it, expect } from "vitest";
import type { ReviewIssue, LLMProvider } from "./types.js";

describe("ReviewIssue shape", () => {
  it("accepts a well-formed issue object", () => {
    const issue: ReviewIssue = {
      id: "issue-1",
      severity: "medium",
      file: "src/geo.ts",
      line: 42,
      summary: "haversine 계산 부동소수점 오차 미고려",
      suggestion: "반경 상수를 별도로 추출하세요",
    };
    expect(issue.severity).toBe("medium");
  });
});

describe("LLMProvider contract", () => {
  it("a conforming provider implements review()", async () => {
    const fakeProvider: LLMProvider = {
      name: "fake",
      review: async (diff: string) => ({ issues: [] }),
    };
    const result = await fakeProvider.review("diff text");
    expect(result.issues).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test`
Expected: FAIL — `Cannot find module './types.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/core/src/types.ts
export type Severity = "low" | "medium" | "high" | "critical";

export interface ReviewIssue {
  id: string;
  severity: Severity;
  file: string;
  line: number;
  summary: string;
  suggestion: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
}

export interface LLMProvider {
  name: string;
  review(diff: string): Promise<ReviewResult>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add ReviewIssue and LLMProvider types"
```

---

## Task 2: Diff parser

**Files:**
- Create: `packages/core/src/parseDiff.ts`
- Test: `packages/core/src/parseDiff.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/parseDiff.test.ts
import { describe, it, expect } from "vitest";
import { parseDiff } from "./parseDiff.js";

const sampleDiff = `diff --git a/src/geo.ts b/src/geo.ts
index 1234567..89abcde 100644
--- a/src/geo.ts
+++ b/src/geo.ts
@@ -10,3 +10,4 @@ export function haversine(a, b) {
   const dLat = toRad(b.lat - a.lat);
   const dLon = toRad(b.lon - a.lon);
+  const R = 6371;
   return R * c;
 }
`;

describe("parseDiff", () => {
  it("extracts touched files with their added-line ranges", () => {
    const files = parseDiff(sampleDiff);
    expect(files).toEqual([
      {
        path: "src/geo.ts",
        addedLines: [{ line: 13, content: "  const R = 6371;" }],
      },
    ]);
  });

  it("returns empty array for empty diff", () => {
    expect(parseDiff("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test`
Expected: FAIL — `Cannot find module './parseDiff.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/core/src/parseDiff.ts
export interface AddedLine {
  line: number;
  content: string;
}

export interface DiffFile {
  path: string;
  addedLines: AddedLine[];
}

export function parseDiff(diffText: string): DiffFile[] {
  if (!diffText.trim()) return [];

  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let newLineNo = 0;

  for (const rawLine of diffText.split("\n")) {
    const fileHeaderMatch = rawLine.match(/^\+\+\+ b\/(.+)$/);
    if (fileHeaderMatch) {
      currentFile = { path: fileHeaderMatch[1], addedLines: [] };
      files.push(currentFile);
      continue;
    }

    const hunkMatch = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      newLineNo = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (!currentFile) continue;

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      currentFile.addedLines.push({ line: newLineNo, content: rawLine.slice(1) });
      newLineNo++;
    } else if (!rawLine.startsWith("-") && !rawLine.startsWith("---") && !rawLine.startsWith("diff") && !rawLine.startsWith("index")) {
      newLineNo++;
    }
  }

  return files;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/parseDiff.ts packages/core/src/parseDiff.test.ts
git commit -m "feat(core): add unified diff parser"
```

---

## Task 3: Claude provider

**Files:**
- Create: `packages/providers/package.json`
- Create: `packages/providers/tsconfig.json`
- Create: `packages/providers/src/claudeProvider.ts`
- Test: `packages/providers/src/claudeProvider.test.ts`

- [ ] **Step 1: Create `packages/providers/package.json`**

```json
{
  "name": "@worktrace/providers",
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
    "@anthropic-ai/sdk": "^0.30.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/providers/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Write the failing test**

```typescript
// packages/providers/src/claudeProvider.test.ts
import { describe, it, expect, vi } from "vitest";
import { createClaudeProvider } from "./claudeProvider.js";

describe("createClaudeProvider", () => {
  it("parses the model's JSON response into ReviewIssue[]", async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                issues: [
                  {
                    id: "issue-1",
                    severity: "medium",
                    file: "src/geo.ts",
                    line: 13,
                    summary: "부동소수점 오차",
                    suggestion: "상수 추출",
                  },
                ],
              }),
            },
          ],
        }),
      },
    };

    const provider = createClaudeProvider({ client: fakeClient as any, model: "claude-sonnet-5" });
    const result = await provider.review("diff text");

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe("src/geo.ts");
    expect(fakeClient.messages.create).toHaveBeenCalledOnce();
  });

  it("returns empty issues when the model returns malformed JSON", async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "not json" }],
        }),
      },
    };

    const provider = createClaudeProvider({ client: fakeClient as any, model: "claude-sonnet-5" });
    const result = await provider.review("diff text");

    expect(result.issues).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/providers && pnpm test`
Expected: FAIL — `Cannot find module './claudeProvider.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/providers/src/claudeProvider.ts
import type Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, ReviewResult } from "@worktrace/core";

const SYSTEM_PROMPT = `You review code diffs. Respond ONLY with JSON matching:
{"issues": [{"id": string, "severity": "low"|"medium"|"high"|"critical", "file": string, "line": number, "summary": string, "suggestion": string}]}
No prose, no markdown fences.`;

export interface ClaudeProviderOptions {
  client: Anthropic;
  model: string;
}

export function createClaudeProvider(options: ClaudeProviderOptions): LLMProvider {
  return {
    name: "claude",
    async review(diff: string): Promise<ReviewResult> {
      const response = await options.client.messages.create({
        model: options.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: diff }],
      });

      const textBlock = response.content.find((block: any) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") return { issues: [] };

      try {
        const parsed = JSON.parse(textBlock.text);
        return { issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
      } catch {
        return { issues: [] };
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/providers && pnpm test`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/providers
git commit -m "feat(providers): add Claude provider with JSON-mode review"
```

---

## Task 4: Provider factory (config-driven selection)

**Files:**
- Create: `packages/providers/src/index.ts`
- Test: `packages/providers/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/providers/src/index.test.ts
import { describe, it, expect } from "vitest";
import { createProvider } from "./index.js";

describe("createProvider", () => {
  it("returns a claude provider when config.provider is 'claude'", () => {
    const provider = createProvider({ provider: "claude", apiKey: "fake-key", model: "claude-sonnet-5" });
    expect(provider.name).toBe("claude");
  });

  it("throws on unknown provider name", () => {
    expect(() =>
      createProvider({ provider: "unknown" as any, apiKey: "x", model: "x" })
    ).toThrow("Unknown provider: unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/providers && pnpm test`
Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/providers/src/index.ts
import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "@worktrace/core";
import { createClaudeProvider } from "./claudeProvider.js";

export interface ProviderConfig {
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  if (config.provider === "claude") {
    const client = new Anthropic({ apiKey: config.apiKey });
    return createClaudeProvider({ client, model: config.model });
  }
  throw new Error(`Unknown provider: ${config.provider}`);
}

export { createClaudeProvider } from "./claudeProvider.js";
export type { ClaudeProviderOptions } from "./claudeProvider.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/providers && pnpm test`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/providers/src/index.ts packages/providers/src/index.test.ts
git commit -m "feat(providers): add config-driven provider factory"
```

---

## Task 5: Core package exports

**Files:**
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Write barrel export**

```typescript
// packages/core/src/index.ts
export type { ReviewIssue, ReviewResult, LLMProvider, Severity } from "./types.js";
export { parseDiff } from "./parseDiff.js";
export type { DiffFile, AddedLine } from "./parseDiff.js";
```

- [ ] **Step 2: Verify the whole workspace builds**

Run: `pnpm -r build`
Expected: no TypeScript errors, `dist/` generated in both packages.

- [ ] **Step 3: Verify the whole workspace tests still pass**

Run: `pnpm test`
Expected: PASS (8 tests total across both packages)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): add package barrel export"
```

---

## Out of Scope (next plan)

- `packages/github`: PR diff fetch, inline comment post, reaction polling, `.worklog/` commit.
- `action/`: GitHub Action entrypoint + `action.yml` + example workflow.
- OpenAI provider implementation (factory already has the branch reserved).
- Deployment to `feed-flow` and `claude-context-auto-handoff`.
