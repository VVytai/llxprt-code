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
