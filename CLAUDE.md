# pr-worktrace

AI PR-review bot + work-trace logger, packaged as a GitHub Action. Portfolio piece; deployment target: feed-flow / claude-context-auto-handoff repos.

## Structure

pnpm workspace monorepo, TypeScript strict/NodeNext, Vitest, Node 20.

- `packages/core` — shared types (`ReviewIssue`, `Severity`, ...)
- `packages/github` — GitHub API primitives, DI-testable (`GithubClient` passed as first arg to every function)
- `packages/providers` — LLM provider abstraction (Claude and OpenAI-compatible implemented; OpenAI-compatible covers NVIDIA NIM etc. via `baseUrl` override)
- `packages/worklog` — `.worklog/*.md` file formatting and classification logic
- `packages/action` — orchestration + GitHub Action entrypoint (`src/main.ts`, `action.yml`)

> Note: package-level "implemented/not yet" status here can drift from code. If a status line looks stale, grep `packages/*/src` before trusting it.

Every package has its own `package.json` (test/build scripts) and `tsconfig.json` (`composite: true` if referenced by another package).

## Commands

```bash
pnpm -r build   # build all packages (must run before pnpm -r test after a workspace-package source change — dist/ is gitignored and resolved via node_modules)
pnpm -r test    # test all packages
cd packages/<name> && pnpm test -- <pattern>   # single package/file
```

## Architecture / key decisions

- **No database.** GitHub comment bodies + reactions + reply threads are the sole state store — a hard design constraint. Each Action run is a fresh, memoryless process; poll mode reconstructs everything by reading GitHub back.
- **Wire format:** bot-posted review comments are tagged `<!-- worktrace-issue:{id} -->\n**[severity]** summary\n\nsuggestion` (`postReviewComments.ts::formatCommentBody`). Any parser reading this back (`reconstructReviewState.ts`) must match the format exactly — the two are coupled but not type-linked.
- **Reason recovery:** the bot's own "leave a reason" reply is tagged with a hidden `<!-- worktrace-reason-request -->` marker (`REASON_REQUEST_MARKER` in `requestReasonForRejections.ts`) so a later poll run can tell the bot's own reply apart from the human's actual reason text (`extractReasons.ts`).
- **DI pattern:** every cross-boundary function takes `client: GithubClient` (or provider) as the first argument. `GithubClient` interface methods are all optional (`?:`) so adding a new primitive never breaks existing test fakes. Tests use plain `vi.fn()` fakes — no mocking libraries.
- **Two Action modes:** `mode: review` (LLM-backed PR review, needs `llm_api_key`) and `mode: poll` (reconstruct + reason-request + close-time worklog commit, no LLM). `main.ts` dispatches on the `mode` input; `createProvider` is dynamically imported only inside review mode so poll mode never requires an API key.

## Conventions

- One feature = one file = one commit. Commit format: `feat(<package>): <what>`.
- Strict TDD: RED → GREEN → commit, per function/file.
- Design spec SSOT: `docs/superpowers/specs/2026-07-30-worktrace-bot-design.md` (Korean).
- Implementation plans: `docs/superpowers/plans/*.md`, written and executed via superpowers skills (`writing-plans`, `subagent-driven-development`).
- **Releases:** consumers pin `Ethualo/pr-worktrace@v1` (floating major tag). To ship a new version: publish a GitHub Release with a full semver tag (`v1.2.3`) — `.github/workflows/update-major-tag.yml` then force-moves `v1` to that commit automatically. Never move `v1` by hand; that workflow is the only path.

## Known gotchas

- After merging/pulling changes to a workspace package's source, run `pnpm -r build` before `pnpm -r test` — packages resolve each other via `node_modules → dist/` (gitignored), not source.
- On Windows, `git worktree remove --force` can fail with "Directory not empty" due to file locks; fall back to `rm -rf <path>` (best-effort) + `git worktree prune`.

## Outstanding (see docs/superpowers/plans/2026-07-30-poll-mode.md "out of scope")

- Generic workflow template lives at `examples/worktrace.yml` (review on push, poll on close + scheduled sweep for open PRs). Actually deploying it into the feed-flow repo (dropping it in as `.github/workflows/worktrace.yml`, wiring `worktrace.config.json` + secret there) — not started.
- OpenAI provider native extras (beyond generic `extraBody` passthrough) — implemented provider is intentionally generic OpenAI-compatible (works with NIM etc. via `baseUrl`), no OpenAI-specific feature support yet.
- Long-running production validation of the stateless architecture (large PRs, complex comment threads) as a persistent fixture repo, not just one-off E2E passes.
