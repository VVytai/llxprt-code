# Cherry-Pick Decisions: v0.20.2 → v0.21.3 (FINAL)

**Total commits in range:** 122  
**Decision counts:** See `AUDIT.md` summary (source of truth for final tallies).

> Note: `616d6f666705` (session summary) was initially listed but is out of range for `v0.20.2..v0.21.3` (it is an ancestor of `v0.20.2`). It is tracked in older sync work, not this merge.

---

## Verification Summary

After subagent and manual verification:

| Commit | Original | Final | Reason |
|--------|----------|-------|--------|
| 035bea36 | PICK (likely) | **PICK** | integration-tests/ files exist in LLxprt |
| 205d0f45 | PICK | **REIMPLEMENT** | Extensions reimplemented; needs manual adaptation |
| 9b571d42 | PICK | **SKIP** | Contains "skyhawk" internal codename, TODO says "SHOULD NOT be merged" |
| 17bf02b9 | PICK | **SKIP** | ModelDialog diverged massively (628 vs 209 lines), hardcoded Gemini names |
| 86a77786 | PICK | **SKIP** | Gemini 3 preview banner text; LLxprt has own banner |
| 533a3fb3 | PICK | **REIMPLEMENT** | Different file structure; flip to always true in core/config.ts |
| 344f2f26 | REIMPLEMENT | **REIMPLEMENT** | SettingsDialog diverged (1272 lines vs ~400); uses AsyncFzf |
| 6f3b56c5 | REIMPLEMENT | **REIMPLEMENT** | LLxprt has own retry.ts with different option structure |
| dd3fd73f | PICK | **REIMPLEMENT** | Also touches retry.ts and geminiChat.ts - needs review |

---

## Decision Notes

### Key Findings

1. **Hooks system** - LLxprt reimplemented from scratch in `packages/core/src/hooks/`. Upstream hook commits don't apply cleanly.

2. **Extensions** - LLxprt reimplemented. Even bug fixes (205d0f45) need manual adaptation.

3. **Model routing/availability** - All SKIP per user directive. LLxprt lets users pick models directly.

4. **ModelDialog** - LLxprt: 628 lines with `HydratedModel`, `useRuntimeApi`. Upstream: 209 lines with hardcoded `PREVIEW_GEMINI_MODEL` etc. Completely diverged.

5. **SettingsDialog** - LLxprt: 1272 lines. Upstream uses `AsyncFzf` for fuzzy search. Useful feature but needs reimplementation.

6. **Banner** - LLxprt has `useBanner.ts`, `hideBanner` setting. Upstream banner commits are SKIP.

7. **Retry logic** - LLxprt has own `retry.ts` with `retryFetchErrors` option. Upstream changes need review.

8. **Flash 3 model config (9b571d42)** - Contains `FLASH_PREVIEW_MODEL_REVERT_BEFORE_MERGE = 'skyhawk'` with TODO "SHOULD NOT be merged". SKIP.

---

## PICK Table (historical planning snapshot)

| # | Upstream SHA | Date | Areas | Rationale | Subject |
|---|-------------|------|-------|-----------|---------|
| 1 | 035bea3699f1 | 2025-12-02 | tests | **VERIFIED** - integration-tests/ exist | Restrict integration tests tools |
| 3 | 08573459450b | 2025-12-03 | core, editor | Code quality refactor | refactor(editor): use const assertion for editor types |
| 4 | 54c62d580c05 | 2025-12-03 | deps | Security fix - always pick | fix(security): Fix npm audit vulnerabilities |
| 5 | 7a6d3067c647 | 2025-12-03 | docs | Enterprise docs applicable | Add new enterprise instructions |
| 6 | f588219bb9bf | 2025-12-03 | core, policy | Distribution fix | fix: Bundle default policies for npx distribution |
| 7 | 9bc5a4d64f4c | 2025-12-03 | cli | **VERIFIED** - New feature, no existing code | feat(cli): support /copy in remote sessions using OSC52 |
| 8 | 518e73ac9f8b | 2025-12-04 | cli | CJK support - universal fix | fix(cli): Fix word navigation for CJK characters |
| 9 | b745d46395a7 | 2025-12-04 | cli, settings | UX fix | do not toggle the setting item when entering space |
| 10 | 48e8c12476b6 | 2025-12-04 | cli | Cleanup | remove unused isSearching field |
| 11 | 0a2971f9d30c | 2025-12-04 | mcp, cli | CLI improvement | feat(mcp): add `--type` alias for `--transport` flag |
| 12 | b27cf0b0a8dd | 2025-12-04 | core, cli | Refactor | feat(cli): Move key restore logic to core |
| 13 | 1040c246f5a0 | 2025-12-04 | mcp, cli | UX improvement | feat: add auto-execute on Enter for argumentless MCP prompts |
| 14 | 84f521b1c62b | 2025-12-04 | shell | Fix | fix(shell): cursor visibility when using interactive mode |
| 15 | 8b0a8f47c1b2 | 2025-12-04 | cli, output | Feature | Adding session id as part of json o/p |
| 16 | 2d1c1ac5672e | 2025-12-04 | core | Bug fix | fix(client): Correctly latch hasFailedCompressionAttempt flag |
| 17 | 0c7ae22f5def | 2025-12-04 | tests | Test fix | Disable flaky extension reloading test on linux |
| 18 | 5f60281d2528 | 2025-12-04 | mcp | MCP feature | Add support for MCP dynamic tool update |
| 19 | ae8694b30f6e | 2025-12-04 | cli | Fix | Fix privacy screen for legacy tier users |
| 20 | 7db5abdecfdf | 2025-12-04 | core | Bug fix | Fixes [API Error: Cannot read properties of undefined] |
| 21 | d284fa66c015 | 2025-12-04 | shell | Bug fix - important | Fix bug in shellExecutionService (truncation + 3X bloat) |
| 22 | 934b309b4cc6 | 2025-12-04 | core | Bug fix | Fix issue passing model content reflecting terminal wrapping |
| 23 | 996cbcb680fd | 2025-12-05 | docs | Docs | Docs: Model routing clarification |
| 24 | bdd15e8911ba | 2025-12-05 | cli | Fix | Fully detach autoupgrade process |
| 25 | 025e450ac247 | 2025-12-05 | core | Code quality - lint rule | Disallow floating promises |
| 26 | 389cadb06ad6 | 2025-12-08 | cli | Bug fix | Fix: Prevent freezing in non-interactive when debug mode enabled |
| 27 | 84c07c8fa174 | 2025-12-08 | audio | Feature | fix(audio): improve reading of audio files |
| 28 | 89570aef0633 | 2025-12-08 | cli | UX improvement | feat: auto-execute on slash command completion functions |
| 29 | 171103aedc9f | 2025-12-08 | core, shell | **NO_OP (subsumed)** | refactor(core): Improve environment variable handling |
| 30 | 560550f5df78 | 2025-12-09 | mcp | **REIMPLEMENT (R20)** | feat: Add support for MCP Resources |
| 31 | afd4829f1096 | 2025-12-09 | clipboard | Fix | fix: use Gemini API supported image formats for clipboard |
| 32 | 364b12e2fae5 | 2025-12-09 | deps | Dependency update | chore(deps): bump express from 5.1.0 to 5.2.0 |
| 34 | d591140f62ff | 2025-12-16 | core | NO_OP (policy) | Preview fallback-oriented prompt/chat logic conflicts with LLxprt model-selection policy |
| 35 | 6e51bbc21570 | 2025-12-08 | a2a | **Moved from SKIP** - a2a not excluded | Add prompt_id propagation in a2a-server task |
| 36 | 674494e80b66 | 2025-12-09 | a2a | **Moved from SKIP** - a2a not excluded | allow final:true to be returned on a2a server edit calls |
| 37 | 1f813f6a060e | 2025-12-09 | a2a | **Moved from SKIP** - a2a not excluded | feat(a2a): Introduce restore command for a2a server |


### B6 Decision Clarifications

- **171103aedc9f — NO_OP (subsumed)**
  - Upstream adds `getSanitizedEnv()` for CI/sandbox-like env filtering.
  - LLxprt already applies `sanitizeEnvironment(...)` in both shell execution backends and wires policy via `isSandboxOrCI` from config.

- **560550f5df78 — REIMPLEMENT (R20)**
  - Large MCP Resources feature across 20 files with new core abstractions and CLI/UI integration.
  - Execute as phased reimplementation to fit LLxprt architecture and naming conventions.

---

## SKIP Table (71 commits)

| # | Upstream SHA | Date | Areas | Rationale | Subject |
|---|-------------|------|-------|-----------|---------|
| 1 | 828afe113ea8 | 2025-12-02 | core, cli | **Already REIMPLEMENT'd in 0.20.2** | refactor(stdio): always patch stdout |
| 2 | ed10edbf0d12 | 2025-12-02 | release | Release churn | chore(release): bump version |
| 3 | 145fb246a661 | 2025-12-02 | docs | --debug vs --verbose flags | docs: Recommend using --debug |
| 4 | 08067acc7173 | 2025-12-03 | cli | **LLxprt has own banner** | Avoid triggering refreshStatic unless banner |
| 5 | 92e95ed8062e | 2025-12-03 | telemetry | Google telemetry | track github repository names in telemetry |
| 6 | b9b3b8050d48 | 2025-12-02 | telemetry | Google telemetry | Allow telemetry exporters to GCP |
| 7 | 939cb67621e1 | 2025-12-03 | workflow | GitHub workflow | feat: add scheduled workflow to close stale issues |
| 8 | 153d01a01e76 | 2025-12-03 | core | **User directive** - model routing | feat: Add enableAgents experimental flag |
| 9 | 00705b14bdb7 | 2025-12-03 | tests | **Test files don't exist** | Fix tests (GeminiRespondingSpinner, etc.) |
| 10 | a28be4a4e0e3 | 2025-12-03 | docs | **File doesn't exist** | docs: fix typo in todos.md |
| 11 | 1e6243045e14 | 2025-12-04 | markdown | Emoji-related | Markdown export: move emoji to end |
| 12 | 46bb07e4b779 | 2025-12-04 | docs | Gemini branding | Fix(cli): Homebrew update instruction |
| 13 | 7b811a38a679 | 2025-12-04 | tests | LLxprt memory renamed | chore(tests): remove obsolete hierarchical memory test |
| 14-28 | (15 commits) | Dec 4-9 | workflow | GitHub workflows | e2e chains, triage, labeler |
| 29 | 8341256d1e7b | 2025-12-05 | release | Release churn | chore/release: bump version |
| 30 | 04cbae5b5fd2 | 2025-12-05 | cli | Emoji-related | Fix emoji width in debug console |
| 31 | 3cf44acc0862 | 2025-12-05 | docs | Gemini-specific | Docs: Update Gemini 3 documentation |
| 32 | 7a720375729c | 2025-12-06 | release | Release churn | chore/release: bump version |
| 33 | 8f4f8baa81d5 | 2025-12-08 | core, models | **Model routing - NO** | feat(modelAvailabilityService): integrate |
| 34 | 6e51bbc21570 | 2025-12-08 | a2a | A2A private | Add prompt_id propagation in a2a-server |
| 35-38 | (4 commits) | Dec 8 | telemetry/workflow | Google telemetry, workflows | Various |
| 39 | 91c46311c875 | 2025-12-08 | docs | Gemini-specific | Docs: Proper release notes |
| 40 | 720b31cb8b5c | 2025-12-08 | release | Release churn | chore/release: bump version |
| 41-56 | (16 commits) | Dec 9-19 | release | Release patches & churn | Various release/preview/patch commits |
| 57 | faf69f2c9985 | 2025-12-09 | misc | Partial/incomplete | Address feedback |
| 58 | a8e3928dd2c6 | 2025-12-10 | core | Gemini checkpoint | feat(core): Update checkpoint |
| 59 | c3f6e7132bcc | 2025-12-10 | core | Partial/incomplete | feat: try more parsing |
| 60 | 4b3d858f3153 | 2025-12-10 | core, auth | **Model routing - NO** | feat: reset availabilityService on /auth |
| 61 | af94beea110b | 2025-12-11 | core | **Model routing - NO** | FEAT: Add availabilityService |
| 62 | 56c3daf2f5f6 | 2025-12-12 | core | **Model routing - NO** | Use Preview Flash model if main is preview |
| 63 | 4cee7e83c43f | 2025-12-12 | core | **Model routing - NO** | Do not fallback for manual models |
| 64 | 01885996429 | 2025-12-15 | core | Gemini 3 specific | feat(core): Disable todos for 3 family |
| 65 | d4f1da39349f | 2025-12-16 | core, models | **Model routing - NO** | feat(core): Add real model string |
| 66 | ae5068b8cbee | 2025-12-16 | core, models | **Model routing - NO** | Check if user has access to preview model |
| 67 | 4292c8784f90 | 2025-12-16 | core | Google mocks | feat: update to match mocks |
| 68 | 9b571d42b10d | 2025-12-09 | core, models | **VERIFIED SKIP** - "skyhawk" codename, TODO "SHOULD NOT merge" | feat(core): Add model config for flash 3 |
| 69 | 17bf02b90183 | 2025-12-11 | cli, models | **VERIFIED SKIP** - ModelDialog diverged (628 vs 209 lines) | Update models menu dialog |
| 70 | 86a777865f5b | 2025-12-16 | cli | **VERIFIED SKIP** - Gemini 3 banner text | change banner text for vertex/api key users |
| 71 | b27945f90449 | 2025-12-16 | tests | Test fix only | fix test |

---

## REIMPLEMENT Table (historical planning snapshot)

| # | Upstream SHA | Date | Areas | Rationale | Subject |
|---|-------------|------|-------|-----------|---------|
| 18 | 560550f5df78 | 2025-12-09 | mcp | **Large cross-layer feature; plan-first adaptation required** | feat: Add support for MCP Resources |
| 1 | 533a3fb312ad | 2025-12-02 | core | **Hardcode true** - Remove conditional, set `messageBusEnabled = true` always | feat: enable message bus integration by default |
| 2 | 344f2f26e78e | 2025-12-02 | cli, settings | **VERIFIED** - SettingsDialog diverged; uses AsyncFzf | implement fuzzy search inside settings |
| 2 | bdbbe9232d23 | 2025-12-02 | mcp | Verify MCP config structure | feat: consolidate remote MCP servers to use `url` |
| 3 | 1c12da1fad14 | 2025-12-03 | hooks | **Hooks reimplemented** | feat(hooks): Hook Session Lifecycle & Compression |
| 4 | b8c038f41f82 | 2025-12-03 | hooks, cli | **Hooks reimplemented** | feat(hooks): Hooks Commands Panel, Enable/Disable |
| 5 | 8d4082ef2e38 | 2025-12-03 | docs | Compare LLxprt's hooks docs | feat(hooks): Hook System Documentation |
| 6 | eb3312e7baaf | 2025-12-03 | hooks, extensions | **Both reimplemented** | feat: Support Extension Hooks with Security Warning |
| 7 | 3da4fd5f7dc6 | 2025-12-04 | auth | LLxprt uses profiles | fix(acp): prevent unnecessary credential cache clearing |
| 8 | 470f3b057f59 | 2025-12-03 | extensions | LLxprt has own examples | Remove example extension |
| 9 | e0a2227faf8a | 2025-12-03 | extensions, cli | **Extensions reimplemented** | Add commands for listing per-extension settings |
| 10 | d5e5f58737a0 | 2025-12-03 | cli, settings | UI diverged | Update setting search UX |
| 11 | 6f3b56c5b6a8 | 2025-12-04 | core | **VERIFIED** - LLxprt has own retry.ts | fix: improve retry logic for fetch errors |
| 12 | dd3fd73ffe9a | 2025-12-05 | core | Also touches retry.ts, geminiChat.ts | fix(core): improve API response error handling |
| 13 | 205d0f456e9c | 2025-12-04 | extensions | **VERIFIED** - Extensions reimplemented | fix(extensions): resolve GitHub API 415 error |
| 14 | 2c4ec31ed170 | 2025-12-05 | a2a | **previewFeatures** - model routing related? | expose previewFeatures flag in a2a |
| 15 | ec9a8c7a7293 | 2025-12-08 | extensions | **Extensions reimplemented** | Add support for user-scoped extension settings |
| 16 | d35a1fdec71b | 2025-12-08 | extensions, hooks | **Both reimplemented** | fix: handle missing local extension config |
| 17 | 1f813f6a060e | 2025-12-09 | a2a | A2A restore command | feat(a2a): Introduce restore command |

---


## Ready for Phase 3

All commits verified.

For final decision counts and reconciliation status, see `AUDIT.md` (source of truth).

Proceed to PLAN.md creation when ready.
