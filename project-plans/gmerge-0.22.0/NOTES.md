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

(Append per-batch notes below during execution)
