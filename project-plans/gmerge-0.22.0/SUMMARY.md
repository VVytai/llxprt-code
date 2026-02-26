# Cherry-Pick Summary: v0.21.3 → v0.22.0

## Overview

Syncing LLxprt Code from upstream gemini-cli **v0.21.3** to **v0.22.0**.

- **Date range:** 2025-12-09 to 2025-12-22 (13 days)
- **Total commits:** 74
- **Branch:** `gmerge/0.22.0`

## Decision Counts

| Decision | Count | % |
|----------|-------|---|
| **PICK** | 14 | 19% |
| **SKIP** | 46 | 62% |
| **REIMPLEMENT** | 14 | 19% |

## Why So Many SKIPs?

This release was dominated by the **Gemini 3 launch** — 16 commits adding model availability, routing, fallback, and configuration infrastructure that is entirely Gemini-specific and doesn't exist in LLxprt's multi-provider architecture. Combined with 7 release version bumps, 3 ClearcutLogger/telemetry commits, 2 CI workflow changes, and 3 Gemini-specific docs updates, 46 of 74 commits are not applicable.

## What We're Picking (14 commits)

Valuable cross-cutting improvements:
- **Bug fixes:** MCP tool error detection, quota error parsing, typo fix
- **Error handling:** Better error parsing, clearer error messages
- **IDE:** Auth token env var write, license generation, detection test robustness
- **Policy:** codebase_investigator in read-only, subagent delegation fix
- **Infrastructure:** License fields in package.json, integration test cleanup
- **Stats:** Raw token counts in JSON output

## What We're Reimplementing (14 commits)

Features we want but can't cherry-pick cleanly due to divergence:

### High Risk (2)
- **`5f298c17` — Persistent "Always Allow" policies**: Granular shell/MCP always-allow with local TOML persistence. Must ensure zero Google telemetry. Touches confirmation-bus types, UI components, policy engine.
- **`d236df5b` — Tool output fragmentation fix**: Confirmed LLxprt has this bug — multimodal tool output sent as separate sibling parts instead of encapsulated in functionResponse. ~150 LoC core fix.

### Medium Risk (8)
- **`54de6753` / `6dea66f1` — Stats display polish**: Two related commits; theme/table structure divergence.
- **`86134e99` — Settings validation**: 730+ line Zod-based validation; adapt to LLxprt's settings structure.
- **`299cc9be` — A2A /init command**: Missing `performInit`, branding differences.
- **`1e734d7e` — Multi-file drag/drop images**: text-buffer/clipboardUtils structural differences.
- **`3b2a4ba2` — IDE extension refactor**: Missing schema, architecture changes.
- **`a47af8e2` — commandPrefix safety**: Security fix; coreToolScheduler diverged.
- **`126c32ac` — Hook refresh**: LLxprt has silent bug (extension hooks don't reload); accept upstream + add disposal.
- **`217e2b0e` — Non-interactive confirmation**: coreToolScheduler diverged.

### Low Risk (4)
- **`d4506e0f` — transcript_path hooks**: ~30 LoC addition.
- **`942bcfc6` — Redundant typecasts**: eslint rule + linter run.
- **`0c3eb826` — A2A interactive**: Config structure adaptation.

## Bonus Cleanup

- **Remove dead `findFiles()`** from `FileSystemService` interface — never called, pathCorrector never adopted. 5 files affected.

## Issues Created During Audit

| Issue | Title | Milestone |
|-------|-------|-----------|
| [#1612](https://github.com/vybestack/llxprt-code/issues/1612) | Centralize path validation into PathValidator service | 0.10.0 |
| [#1613](https://github.com/vybestack/llxprt-code/issues/1613) | Support V2 hierarchical settings format | 0.10.0 |

## Batch Structure

- **3 PICK batches** (5 + 5 + 4 commits)
- **14 REIMPLEMENT solo batches**
- **1 CLEANUP batch** (findFiles removal)
- **Total: 18 batches**
- Full verification on even batches (2, 4, 6, 8, 10, 12, 14, 16, 18)
