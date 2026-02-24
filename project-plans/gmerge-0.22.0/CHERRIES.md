# Cherry-Pick Decisions: v0.21.3 → v0.22.0 (FINAL)

**Total commits in range:** 74
**Decision counts:** PICK 14 (19%) · SKIP 46 (62%) · REIMPLEMENT 14 (19%)

**Related issues created during audit:**
- [#1612](https://github.com/vybestack/llxprt-code/issues/1612) — Centralize path validation (milestone 0.10.0)
- [#1613](https://github.com/vybestack/llxprt-code/issues/1613) — Support V2 hierarchical settings (milestone 0.10.0)

---

## Decision Notes

### Gemini 3 Launch (16 SKIP)
The v0.22.0 release was primarily the Gemini 3 launch. 16 commits add model availability, routing, fallback, and configuration infrastructure (`defaultModelConfigs.ts`, `availabilityService`, `policyCatalog`, model dialogs). LLxprt has none of this Gemini-specific infrastructure — all SKIPped.

### Release / CI / Docs (12 SKIP)
Release version bumps (7), GitHub workflow changes (2), Gemini-specific docs (3).

### Already Implemented / Removed in LLxprt (6 SKIP)
- `3f5f030d` IDE auth token — already `LLXPRT_CODE_IDE_AUTH_TOKEN`
- `ee6556cb` session summary — LLxprt's `readFirstUserMessage()` (JSONL) is superior
- `aced4010` codebase investigator — removed from LLxprt registry
- `1954f45c` pathCorrector depth — pathCorrector never adopted; `findFiles()` is dead code
- `a02abcf5` express revert — LLxprt already has 5.2.1
- `5ea5107d` settings V2 merging — V2 migration removed (commit 356f76e54)

### ClearcutLogger / Telemetry (3 SKIP)
- `d2a6b303` user agent telemetry
- `d030a1f6` hashed extension name telemetry
- `57c7b9cc` GEMINI_API_KEY prioritization (auth, not telemetry, but Gemini-specific)

### Safety Checker (1 SKIP → issue)
- `fc2a5a42` — path validation framework. LLxprt uses built-in per-tool validation + containers. Created #1612 to centralize.

### High-Risk REIMPLEMENTs
- `5f298c17` always-allow policies — confirmed zero Google telemetry, 100% local TOML
- `d236df5b` tool output fragmentation — confirmed LLxprt HAS this bug (~150 LoC fix)
- `126c32ac` hook refresh — LLxprt has silent bug; accept upstream approach + add disposal

### Bonus Cleanup
- Remove dead `findFiles()` from `FileSystemService` interface (dead code, 5 files)

---

## PICK Table (14 commits, chronological)

| # | Upstream SHA | Date | Areas | Rationale | Subject |
|---|-------------|------|-------|-----------|---------|
| 1 | `68ebf5d6` | 2025-12-11 | cli | Clean apply, trivial | Fix: Correct typo in code comment |
| 2 | `22e6af41` | 2025-12-10 | core | Error parsing improvements, provider-agnostic | feat: attempt more error parsing |
| 3 | `2d3db970` | 2025-12-11 | core/tools | MCP error detection bug fix | Fix: Correctly detect MCP tool errors |
| 4 | `bb33e281` | 2025-12-12 | ide | IDE auth env var write (adapt var name) | fix(ide): Update IDE extension to write auth token in env var |
| 5 | `12cbe320` | 2025-12-12 | policy | Add codebase_investigator to read-only TOML | fix(policy): allow codebase_investigator by default in read-only policy |
| 6 | `e84c4bfb` | 2025-12-12 | ide | License generation fix | fix(vscode-ide-companion): correct license generation for workspace dependencies |
| 7 | `edbe5480` | 2025-12-12 | policy | Subagent delegation policy fix | fix: temp fix for subagent invocation until subagent delegation is merged to stable |
| 8 | `20164ebc` | 2025-12-12 | core/ide | IDE detection test robustness (SKIP clearcut test file) | test: update ide detection tests to make them more robust when run in an ide |
| 9 | `d2a1a456` | 2025-12-12 | cli, core | Add license field to package.json | Add license field into package.json |
| 10 | `d9f94103` | 2025-12-13 | cli | Clearer error messages for non-interactive and @ commands | Add clarity to error messages |
| 11 | `ec665ef4` | 2025-12-15 | integration-tests | Process cleanup in integration tests | Clean up processes in integration tests |
| 12 | `bb0c0d8e` | 2025-12-15 | integration-tests | Simplify integration test helper | Simplify method signature |
| 13 | `79f664d5` | 2025-12-15 | cli, core | Raw token counts in JSON output (PARTIAL: skip stream-json-formatter changes) | Show raw input token counts in json output |
| 14 | `ed4b440b` | 2025-12-18 | core | Quota error parsing fix, scoped to Google-only | fix: quota error fix (cherry-pick of 9e6914d) |

### PICK Notes
- **#4 (`bb33e281`)**: Need to verify env var name is `LLXPRT_CODE_IDE_AUTH_TOKEN` not `GEMINI_CLI_IDE_AUTH_TOKEN`
- **#8 (`20164ebc`)**: Skip the `clearcut-logger.test.ts` changes; only pick `detect-ide.test.ts`
- **#13 (`79f664d5`)**: Large commit; skip `stream-json-formatter` parts if they reference Gemini-specific model stats infrastructure

---

## SKIP Table (46 commits, chronological)

| # | Upstream SHA | Date | Areas | Rationale | Subject |
|---|-------------|------|-------|-----------|---------|
| 1 | `3f5f030d` | 2025-12-09 | core/ide | Already implemented as LLXPRT_CODE_IDE_AUTH_TOKEN | feat(ide): fallback to GEMINI_CLI_IDE_AUTH_TOKEN env var |
| 2 | `28001873` | 2025-12-09 | cli, core | Gemini-specific RetrieveUserQuotaResponse, multi-provider incompatible | feat: display quota stats for unused models in /stats |
| 3 | `aced4010` | 2025-12-09 | core, docs | CodebaseInvestigatorAgent removed from LLxprt registry | feat: ensure codebase investigator uses preview model |
| 4 | `d90356e8` | 2025-12-09 | ci | GitHub workflow specific to gemini-cli | chore: add closing reason to stale bug workflow |
| 5 | `d2a6b303` | 2025-12-09 | cli | ClearcutLogger telemetry (removed from LLxprt) | Send the model and CLI version with the user agent |
| 6 | `ee6556cb` | 2025-12-09 | cli, core | LLxprt readFirstUserMessage() (JSONL, instant) is superior | refactor(sessions): move session summary generation to startup |
| 7 | `1954f45c` | 2025-12-09 | core, cli | pathCorrector never adopted; findFiles() dead code; bfsFileSearch already superior | Limit search depth in path corrector |
| 8 | `c8b68865` | 2025-12-10 | core, docs | Gemini 3 model config infrastructure (defaultModelConfigs.ts) | feat(core): Plumbing for late resolution of model configs |
| 9 | `648041c6` | 2025-12-10 | cli | extensionSettings.ts completely refactored (64 vs 400 lines) | Add missing await |
| 10 | `91b15fc9` | 2025-12-10 | core, docs | Gemini-specific DelegateToAgentTool | refactor: implement DelegateToAgentTool with discriminated union |
| 11 | `8c83e1ea` | 2025-12-10 | core | availabilityService doesn't exist in LLxprt | feat: reset availabilityService on /auth |
| 12 | `24fca1b7` | 2025-12-10 | release | Nightly version bump | chore/release: bump version to 0.21.0-nightly |
| 13 | `927102ea` | 2025-12-11 | ci | GitHub workflow specific | increase labeler timeout |
| 14 | `d818fb1d` | 2025-12-11 | ci | Gemini .gemini/ frontend command | tool(cli): tweak the frontend tool |
| 15 | `a02abcf5` | 2025-12-12 | release | LLxprt already has express 5.2.1 | Revert "chore(deps): bump express from 5.1.0 to 5.2.0" |
| 16 | `5b56920f` | 2025-12-12 | release | Nightly version bump | chore/release: bump version to nightly |
| 17 | `977248e0` | 2025-12-12 | docs | Gemini contributing docs | chore(docs): add 'Maintainers only' label info to CONTRIBUTING.md |
| 18 | `ad60cbfc` | 2025-12-13 | cli | Gemini UI tips | chore: remove a redundant tip |
| 19 | `fcc3b2b5` | 2025-12-12 | release | Nightly version bump | chore/release: bump version to nightly |
| 20 | `57c7b9cc` | 2025-12-12 | cli | Gemini-specific auth (GEMINI_API_KEY) | fix(auth): prioritize GEMINI_API_KEY env var |
| 21 | `fc2a5a42` | 2025-12-14 | core/safety | Path validation framework; see #1612 for centralized approach | fix: use zod for safety check result validation |
| 22 | `d030a1f6` | 2025-12-15 | cli, core | ClearcutLogger telemetry | update(telemetry): add hashed_extension_name |
| 23 | `13944b9b` | 2025-12-15 | docs | Policy docs files don't exist in LLxprt | docs: update policy engine getting started and defaults |
| 24 | `2995af6a` | 2025-12-15 | a2a | Gemini 3 model routing | use previewFeatures to determine which pro model |
| 25 | `5ea5107d` | 2025-12-15 | cli | V2 migration removed from LLxprt; see #1613 | refactor: fix settings merging V1/V2 priority |
| 26 | `06dcf216` | 2025-12-16 | release | Release commit | chore(release): v0.22.0-preview.0 |
| 27 | `562d8454` | 2025-12-09 | core, docs | Gemini 3 Flash model config | feat(core): Add model config for flash 3 |
| 28 | `5eb817c4` | 2025-12-10 | core, docs | Gemini 3 checkpoint | feat(core): Update checkpoint |
| 29 | `ad994cfe` | 2025-12-11 | cli, core, docs | Gemini 3 model dialog (628 vs 209 lines) | Update models menu dialog |
| 30 | `48ad6983` | 2025-12-11 | cli, core | Gemini 3 availabilityService | FEAT: Add availabilityService |
| 31 | `16e06adb` | 2025-12-12 | core, docs | Gemini 3 preview Flash routing | Use Preview Flash model for preview models |
| 32 | `9ab79b71` | 2025-12-12 | cli, core | Gemini 3 fallback logic | Do not fallback for manual models |
| 33 | `20e67c7b` | 2025-12-15 | core | Gemini 3 model-specific | feat(core): Disable todos for 3 family |
| 34 | `4a83eb24` | 2025-12-16 | core, docs | Gemini 3 model config | feat(core): Add real model string |
| 35 | `f25944bd` | 2025-12-16 | core | Gemini 3 prompt/chat routing | Fix prompt and chat code |
| 36 | `4c0a2411` | 2025-12-16 | cli | Gemini 3 access check | Check if user has access to preview model |
| 37 | `dbeda91e` | 2025-12-16 | cli | Gemini 3 test mocks | feat: update to match mocks |
| 38 | `c5109d75` | 2025-12-16 | cli | Gemini branding | change banner text for vertex and api key users |
| 39 | `ce2eba28` | 2025-12-16 | docs | Gemini 3 documentation | Docs: Update Gemini 3 Documentation |
| 40 | `d1e040aa` | 2025-12-17 | config | Gemini 3 settings schema | Fix settings.schema |
| 41 | `76414c1c` | 2025-12-17 | core | Gemini 3 test goldens | fix goldens |
| 42 | `c1554715` | 2025-12-17 | release | Release commit | chore(release): v0.22.0-preview.1 |
| 43 | `a585bfa9` | 2025-12-17 | core | Gemini release patch | fix(patch): cherry-pick for preview.2 |
| 44 | `a6841f41` | 2025-12-17 | release | Release commit | chore(release): v0.22.0-preview.2 |
| 45 | `f9331b16` | 2025-12-19 | release | Release commit | chore(release): v0.22.0-preview.3 |
| 46 | `994edeb9` | 2025-12-22 | release | Release commit | chore(release): v0.22.0 |

---

## REIMPLEMENT Table (14 commits, chronological)

| # | Upstream SHA | Date | Areas | Risk | Rationale | Subject |
|---|-------------|------|-------|------|-----------|---------|
| 1 | `d4506e0f` | 2025-12-10 | core/hooks | LOW | ~30 LoC; add transcript_path getter/setter to Config + hookEventHandler | feat(core): Add support for transcript_path in hooks |
| 2 | `54de6753` | 2025-12-11 | cli/ui | MED | Theme system divergence; ModelStatsDisplay different | feat(cli): polish cached token stats and simplify stats display |
| 3 | `86134e99` | 2025-12-12 | cli/config | MED | 730+ lines new Zod infra; adapt to LLxprt settings structure | feat(settings-validation): add validation for settings schema |
| 4 | `299cc9be` | 2025-12-12 | a2a | MED | Missing performInit, GEMINI.md→LLXPRT.md branding | feat(a2a): Introduce /init command for a2a server |
| 5 | `1e734d7e` | 2025-12-12 | cli/ui | MED | text-buffer/clipboardUtils structural differences | feat: support multi-file drag and drop of images |
| 6 | `3b2a4ba2` | 2025-12-12 | ide | MED | Missing schema, architecture refactor | refactor(ide ext): Update port file name + 1-based index |
| 7 | `6dea66f1` | 2025-12-12 | cli/ui | LOW | StatsDisplay table structure diverged | Remove flex from stats display |
| 8 | `5f298c17` | 2025-12-12 | core, cli | HIGH | Persistent always-allow policies; must be zero telemetry, local TOML only | feat: Persistent "Always Allow" policies |
| 9 | `a47af8e2` | 2025-12-12 | core | MED | Security fix; coreToolScheduler diverged (parallel batching) | fix(core): commandPrefix word boundary and compound command safety |
| 10 | `126c32ac` | 2025-12-12 | core/hooks, cli | MED | Accept upstream approach + add disposal; silent bug in current LLxprt | Refresh hooks when refreshing extensions |
| 11 | `942bcfc6` | 2025-12-12 | eslint, a2a, core | LOW | Add eslint rule + run linter; mechanical fixes | Disallow redundant typecasts |
| 12 | `d236df5b` | 2025-12-15 | core, a2a, cli | HIGH | Confirmed LLxprt has this bug; multimodal tool output fragmented | Fix tool output fragmentation |
| 13 | `217e2b0e` | 2025-12-16 | core, a2a | MED | coreToolScheduler diverged (parallel batching) | fix: throw error for tool confirmation in non-interactive mode |
| 14 | `0c3eb826` | 2025-12-16 | a2a | LOW | A2A config structure fundamentally different | fix: Mark A2A requests as interactive |
