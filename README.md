# pr-worktrace

[한국어](README.ko.md)

AI PR-review bot + work-trace logger, packaged as a GitHub Action. No database — GitHub itself (PR comments, reactions, reply threads) is the sole state store, so every run is a stateless, memoryless process that reconstructs its state by reading GitHub back.

## Why this exists

Most PR-review bots need a backend to remember what they've already said. pr-worktrace doesn't: it encodes its own state into the artifacts it posts (a hidden HTML-comment marker per review comment, a hidden marker on its own "leave a reason" reply) and re-derives everything on the next run by parsing those markers back out. Zero infra to operate, zero infra to go stale.

## Architecture

```
packages/core       shared types (ReviewIssue, Severity, ...)
packages/github      GitHub API primitives, DI-testable (GithubClient passed as first arg to every function)
packages/providers   LLM provider abstraction — Claude, and a generic OpenAI-compatible provider
packages/worklog     .worklog/*.md file formatting + classification logic
packages/action      orchestration + GitHub Action entrypoint (src/main.ts, action.yml)
```

Two Action modes, dispatched on the `mode` input in `main.ts`:

- **`mode: review`** — LLM-backed review. Posts inline PR comments tagged `<!-- worktrace-issue:{id} -->`. Needs `llm_api_key`.
- **`mode: poll`** — no LLM. Reconstructs review state from posted comments, requests a reason for any rejected suggestion (tagging its own reply with `<!-- worktrace-reason-request -->` so a later run can tell bot-reply from human-reply), and commits a `.worklog/*.md` summary when the PR closes. `createProvider` is only dynamically imported inside review mode, so poll mode never needs an API key at all.

## Provider abstraction

`packages/providers` dispatches on `config.provider`, which supports exactly two values:

- `claude` — Anthropic Messages API
- `openai` — generic OpenAI-compatible provider (`baseUrl` + `extraBody` passthrough)

There's no third `provider` value for "custom" — instead, any OpenAI-compatible backend (self-hosted, another vendor, whatever) just uses `provider: "openai"` with its own `baseUrl`, no code changes needed. The E2E validation below used this to run on **NVIDIA NIM**: it exposes an OpenAI-shaped API, so it goes through the `openai` provider unmodified — no NIM-specific branch anywhere in the codebase. NIM's reasoning/chain-of-thought is on by default and gets prepended to responses; it's turned off purely through config:

```json
{
  "provider": "openai",
  "model": "nvidia/nemotron-3-super-120b-a12b",
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "extraBody": { "chat_template_kwargs": { "enable_thinking": false } }
}
```

`extraBody` is merged straight into the request body, so any other provider-specific toggle works the same way without touching provider code.

## Installing in a consumer repo

1. Workflow (`.github/workflows/worktrace.yml`):
   ```yaml
   uses: Ethualo/pr-worktrace@v1
   ```
   (A root-level `action.yml` re-exports `packages/action/dist/index.js`, so the bare repo ref works despite this being a monorepo.)
2. `worktrace.config.json` in the consumer repo root — `provider`, `model`, `baseUrl`, `extraBody`.
3. `WORKTRACE_LLM_API_KEY` repo secret (per-repo; use GitHub Org-level secrets to share across repos).

Full workflow template (review on push, poll on close + scheduled sweep for reactions on still-open PRs): [`examples/worktrace.yml`](examples/worktrace.yml).

## Verified end-to-end

Validated in two independent, heterogeneous consumer repos (different LLM key, different default branch: `main` vs `master`):

| Repo | PR | What was proven |
|---|---|---|
| feed-flow | #21 | review mode: real inline comments posted (flagged a bare `except`, an unclosed file handle); poll mode: `.worklog/` committed on close |
| nextrain | #1 | review mode via NIM on a HEAD-branch-only workflow file (same-repo, non-fork PR resolves the workflow from the PR's head branch, not the base branch — confirmed empirically); flagged real issues (NPE risk in `MainActivity.kt`, missing notification-permission handling) |

Both test PRs and their scratch branches were closed and deleted after validation; nothing test-only was left in either repo.

## Commands

```bash
pnpm -r build   # build all packages — required before pnpm -r test after any workspace-package source change (dist/ is gitignored, resolved via node_modules)
pnpm -r test    # test all packages
cd packages/<name> && pnpm test -- <pattern>   # single package/file
```

## Status

Core review + poll modes, Claude provider, and generic OpenAI-compatible provider (incl. NVIDIA NIM) are implemented, tested, and E2E-verified. Not yet done: OpenAI provider is generic only (no OpenAI-specific extras beyond `extraBody`), and this repo hasn't been deployed as a persistent fixture in any production repo — the E2E runs above were deliberate, cleaned-up validation passes.
