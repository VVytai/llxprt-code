# Notes: gmerge/0.22.0

## Phase 2 — Audit Notes

### Key findings from subagent investigations:
- **pathCorrector** never existed in LLxprt; `findFiles()` is dead code on the `FileSystemService` interface. Cleanup planned as Batch 18.
- **Hook system** has a silent correctness bug: extension hooks don't reload when extensions are dynamically loaded/unloaded because init guards block re-initialization. Fix: accept upstream approach (remove guards) + add disposal for memory leak prevention.
- **Settings V2** migration was deliberately removed in commit `356f76e54`. LLxprt uses hybrid flat/manual structure with `LEGACY_UI_KEYS`. Created #1613 for proper V2 support.
- **Tool output fragmentation** bug CONFIRMED in LLxprt: `convertToFunctionResponse()` sends multimodal content as separate sibling parts instead of encapsulated.
- **Safety checker** upstream uses pluggable `AllowedPathChecker`; LLxprt uses per-tool inline validation (18+ sites, inconsistent). Created #1612 for centralized approach.
- **Session summary** LLxprt's `readFirstUserMessage()` (JSONL, instant, zero-cost) is architecturally superior to upstream's AI-generated summaries.
- **Express revert** not needed — LLxprt already at 5.2.1 (includes the hotfix).

### Issues created:
- #1612 — Centralize path validation (milestone 0.10.0)
- #1613 — Support V2 hierarchical settings (milestone 0.10.0)

---

## Phase 3 — Execution Notes

### Batch 1A — PICK x2 (clean)
- **68ebf5d6** (typo fix): Cherry-picked cleanly as `fabaa7805`. Minor conflict resolved — structural differences in nonInteractiveCli.ts required manual typo fix application.
- **2d3db970** (MCP tool error detection): Cherry-picked cleanly as `6ff6ae665`. No conflicts.
- **Lint**: PASS
- **Typecheck**: Pre-existing failures in `BucketFailoverHandlerImpl.ts` / `.spec.ts` — missing exports `BucketFailureReason`, `FailoverContext` from `@vybestack/llxprt-code-core`. NOT caused by our changes. These files were not touched by B1A.
- **Branding**: Clean in changed files. Pre-existing `ClearcutLogger` references in telemetry test files (not from this batch).

### Batch 1B — PICK x3 (needs adaptation)
- **22e6af41** (error parsing): Cherry-picked as `0d359bd31`. Conflicts in googleErrors.test.ts (accepted deletion, already removed in HEAD) and googleQuotaErrors.ts (manually merged fallback parsing). No duplicate code.
- **bb33e281** (IDE auth env var): Cherry-picked as `6d0015557`. Conflicts in ide-server.test.ts (accepted deletion, removed in HEAD) and ide-server.ts. All `GEMINI_CLI_*` env vars replaced with `LLXPRT_CODE_*` variants. Branding grep confirms zero `GEMINI_CLI_IDE_AUTH_TOKEN` in codebase.
- **12cbe320** (policy codebase_investigator): Cherry-picked as `1824063ed`. Added codebase_investigator to read-only.toml while preserving all LLxprt-specific entries (exa_web_search, task, todo_read, todo_write, todo_pause, list_subagents).
- **Lint**: PASS (verified on core + cli packages individually)
- **Typecheck**: Same pre-existing failures as B1A
- **Branding**: CLEAN in all changed files

### Batch 9 — REIMPLEMENT 6dea66f1 (stats flex)
- Removed `width="100%"` from Section, renamed `tableWidth` → `totalWidth` in ModelUsageTable
- StatsDisplay tests have pre-existing rendering error (React/Ink component rendering, from B3 snapshot gap)
- Lint/typecheck: PASS

### Batch 10 — REIMPLEMENT 5f298c17 (always-allow) [HIGH RISK]
- Implemented persistent always-allow policies with local TOML storage (~/.llxprt/policies/auto-saved.toml)
- 16 new persistence tests covering TOML format, shell prefix matching, MCP granularity, error handling
- Zero telemetry verified (pre-existing ClearcutLogger comment in telemetry/sdk.ts NOT from this batch)
- Security: no denylist for dangerous commands — plan said "consider", upstream doesn't have it either
- Atomic writes (tmp + rename) prevent corruption

### Batch 11 — REIMPLEMENT a47af8e2 (commandPrefix safety) [SECURITY]
- Word boundary regex: `(?:[\s"]|$)` suffix prevents "git log" matching "git logout"
- Compound command splitting: recursive validation of &&, ||, ;, | sub-commands
- Remediation: added rm vs rmdir prefix confusion regression test (19 total security tests)
- Fail-safe: parse failure → ASK_USER (not fail-open)

### Batch 12 — REIMPLEMENT 126c32ac (hook refresh)
- Removed HookRegistryNotInitializedError and initialization guards
- Added HookEventHandler disposal before re-init (LLxprt-specific memory leak fix — upstream doesn't have MessageBus subscriptions)
- ExtensionLoader now calls hookSystem.initialize() after refreshMemory()
- 4 new hook-reinit tests + updated existing tests

### Batch 13 — REIMPLEMENT 942bcfc6 (redundant typecasts)
- Added @typescript-eslint/no-unnecessary-type-assertion to all 4 eslint configs (root, ui, lsp, vscode-ide-companion)
- ~623 unnecessary type assertions removed via eslint --fix
- 3 legitimate assertions preserved with eslint-disable-next-line comments

### Batch 14 — PICK x4 (late)
- ec665ef4: Integration test cleanup — added _interactiveRuns tracking and cleanup
- bb0c0d8e: TestRig.run() simplified to options object signature
- 79f664d5 (PARTIAL): Raw token counts in StatsDisplay; skipped stream-json-formatter (doesn't exist in LLxprt)
- ed4b440b: Quota error fix applied cleanly
- Remediation needed: @google/gemini-cli-core branding in json-output.test.ts and StatsDisplay.tsx; syntax error and unused vars in mcp_server_cyclic_schema.test.ts

### Batch 15 — REIMPLEMENT 217e2b0e (non-interactive confirmation)
- Added isInteractive() check in coreToolScheduler after YOLO/allowed-tools bypass
- Mixed-batch test: safe tool executes while dangerous tool errors (parallel execution safety)
- 4 new tests + 17 existing mock configs updated with isInteractive: () => true

### Batch 16 — REIMPLEMENT d236df5b (tool fragmentation) [HIGH RISK]
- Fixed convertToFunctionResponse() to use supportsMultimodalFunctionResponse(model) gating
- Gemini 3: nested multimodal in functionResponse.parts
- Gemini 2/Claude/GPT: backward-compatible sibling/default path
- Edge cases covered: text-only, image-only, mixed, empty, single-part
- Provider-agnostic: non-Gemini models safely get default behavior

### Batch 17 — REIMPLEMENT 0c3eb826 (A2A interactive)
- Added `interactive: true` to A2A ConfigParameters (1 line)
- Behavioral test verifies isInteractive() returns true, getNonInteractive() returns false
- A2A package not marked private (pre-existing)

### Batch 18 — CLEANUP: findFiles removal
- SKIP: findFiles() already removed from FileSystemService interface, implementation, and tests in prior sync (v0.21.3)
- Verified: zero findFiles references in packages/ (only FindFiles tool alias in glob.ts and OpenAI tests — different thing)

---

## Phase 4 — Post-Audit Remediation (commit 2076a2699)

### Issues found by deepthinker post-hoc audit, fixed in single remediation commit:

#### B7 (IDE extension refactor)
- Missing `Mock` import in ide-client.test.ts — added to vitest imports
- Missing readdir port discovery tests — added 4 behavioral tests (46 total pass)

#### B8 (atCommandProcessor DRY)
- Duplicated error handling blocks at lines ~507 and ~553 — extracted `handleResourceReadError()` helper

#### B11 (commandPrefix safety)
- Word boundary regex `(?:\s|$)` didn't handle quoted commands — fixed to `(?:[\s"]|$)`
- Updated persistence.test.ts assertion to match corrected regex

#### B14 (StatsDisplay)
- Imported non-existent `RetrieveUserQuotaResponse` and `VALID_GEMINI_MODELS` from upstream — removed
- Reverted `StatsDisplayProps.quotas` back to `quotaLines?: string[]`
- Removed non-existent `bold` prop from `<ThemedGradient>`
- Added explicit types to `buildModelRows` callbacks (fix implicit any)
- Updated snapshots and theme tests

#### B16 (coreToolScheduler)
- Unsafe double-cast `as unknown as FunctionResponsePart[]` — replaced with proper conversion
- Passthrough case missing `limitFunctionResponsePart` — applied consistently
- `supportsMultimodalFunctionResponse` duplicated logic — delegated to `isGemini3Model()`
- Removed 20 duplicate `getModel` lines in test file

#### Pre-existing issues
- ClearcutLogger comment in sdk.ts line 163 — removed
- A2A server package.json missing `"private": true` — added

### Verification results
- Lint: PASS (zero warnings)
- Typecheck: 10 pre-existing errors remain (tree-sitter wasm, zed-integration, config tests) — none introduced by our changes, 8 fixed
- All changed-file tests pass: ide-client (46), atCommandProcessor (41), persistence (16), StatsDisplay (18), coreToolScheduler (56)
- interactiveMode.test.ts failure confirmed pre-existing (same failure without our changes)
