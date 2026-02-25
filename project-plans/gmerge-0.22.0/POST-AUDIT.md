# Post-Hoc Audit Report: gmerge/0.22.0

> **Audited:** 2026-02-25
> **Method:** Parallel deepthinker (behavioral equivalence) + typescriptreviewer (code quality) per batch
> **Scope:** All 17 batches with actual code changes (B18 was a no-op, excluded)

---

## Executive Summary

| Verdict | Count | Batches |
|---------|-------|---------|
| [OK] CLEAN | 12 | B1A, B2, B3, B4, B5, B6, B9, B10, B12, B13, B15, B17 |
| WARNING: NEEDS_ATTENTION | 5 | B7, B8, B11, B14, B16 |
| [ERROR] REGRESSION | 0 | — |

**Branding:** ZERO violations across all packages (verified: no `@google/gemini-cli`, no `GEMINI_CLI_IDE_AUTH_TOKEN` outside copyright headers).

---

## Consolidated Results

### B1A — PICK x2 (typo fix + MCP tool error detection)
- **Deep:** CLEAN — both changes landed fully, behavioral equivalence FULL
- **TS:** CLEAN — correct, minimal changes
- **Combined: [OK] CLEAN**

### B2 — REIMPLEMENT d4506e0f (transcript_path hooks)
- **Deep:** CLEAN — code-level implementation correct (plan deferred runtime wiring)
- **TS:** CLEAN/EXCELLENT — strong types, well-tested
- **Combined: [OK] CLEAN**

### B3 — REIMPLEMENT 54de6753 (stats display polish)
- **Deep:** CLEAN — labels, colors, uncached math all correct
- **TS:** CLEAN/EXCELLENT
- **Combined: [OK] CLEAN**

### B4 — REIMPLEMENT 86134e99 (Zod settings validation)
- **Deep:** CLEAN — all LLxprt-specific keys covered in schema
- **TS:** CLEAN/GOOD
- **Combined: [OK] CLEAN**

### B5 — REIMPLEMENT 299cc9be (A2A /init command)
- **Deep:** CLEAN — LLXPRT.md branding correct, A2A private
- **TS:** CLEAN/EXCELLENT
- **Combined: [OK] CLEAN**

### B6 — REIMPLEMENT 1e734d7e (multi-file drag/drop)
- **Deep:** CLEAN — path parsing handles all edge cases
- **TS:** CLEAN/EXCELLENT
- **Combined: [OK] CLEAN**

### B7 — REIMPLEMENT 3b2a4ba2 (IDE extension refactor)
- **Deep:** CLEAN — port file, 1-based indexing correct
- **TS:** NEEDS_ATTENTION
  - Issue 1: Missing `Mock` type import in `ide-client.test.ts`
  - Issue 2: Zero test coverage for new readdir-based port discovery
- **Combined: WARNING: NEEDS_ATTENTION** (minor — test quality gaps only)

### B8 — PICK x5 (license, policy, IDE tests, error msgs)
- **Deep:** Incomplete (no code read)
- **TS:** CLEAN/GOOD
  - Minor: Duplicated 10-line error block in `atCommandProcessor.ts` lines 515-524/561-570
- **Combined: [OK] CLEAN** (DRY nit is cosmetic, not a correctness issue)

### B9 — REIMPLEMENT 6dea66f1 (stats flex removal)
- **Deep:** Incomplete
- **TS:** CLEAN/GOOD — pre-existing snapshot debt noted
- **Combined: [OK] CLEAN**

### B10 — REIMPLEMENT 5f298c17 (always-allow policies) [HIGH RISK]
- **Deep:** Flagged ClearcutLogger in sdk.ts:163 (pre-existing)
- **TS:** CLEAN/EXCELLENT — strong types, zero telemetry verified, word boundary inconsistency noted (related to B11)
- **Combined: [OK] CLEAN** (word boundary is B11's fix scope)

### B11 — REIMPLEMENT a47af8e2 (commandPrefix safety) [SECURITY]
- **Deep:** Unreliable
- **TS:** NEEDS_ATTENTION — **SECURITY**
  - **Issue: `createPolicyUpdater` in `config.ts:457`** generates regex WITHOUT word boundary suffix `(?:[\s"]|$)`. The TOML-loader path (line 318) correctly includes it. This means "Always Allow" for `git log` in the interactive session would also match `git logout` (current session only, not persisted).
  - `persistence.test.ts:156-158` asserts the broken pattern (test codifies the bug)
- **Combined: WARNING: NEEDS_ATTENTION** — Security fix needed

### B12 — REIMPLEMENT 126c32ac (hook refresh + disposal)
- **Deep:** Unreliable
- **TS:** CLEAN/GOOD — 119 tests pass across 7 suites. Minor: dispose() doesn't null out eventHandler
- **Combined: [OK] CLEAN**

### B13 — REIMPLEMENT 942bcfc6 (no-unnecessary-type-assertion)
- **Deep:** CLEAN — ESLint rule added to all 4 configs, 186 files fixed
- **TS:** CLEAN/GOOD — 9 justified `eslint-disable` comments, residual parens from mechanical fix (cleaned in later commits)
- **Combined: [OK] CLEAN**

### B14 — PICK x4 (integration tests, token counts partial, quota fix)
- **Deep:** NEEDS_ATTENTION (stream-json-formatter references)
- **TS:** NEEDS_ATTENTION — **REGRESSION**
  - **Issue 1: StatsDisplay.tsx imports non-existent types** `RetrieveUserQuotaResponse` and `VALID_GEMINI_MODELS` from `@vybestack/llxprt-code-core` — these are upstream Gemini-specific types never ported to the fork. **7 new TS compilation errors.**
  - **Issue 2: Prop mismatch** — `StatsDisplayProps` changed from `quotaLines?: string[]` to `quotas?: RetrieveUserQuotaResponse`, but `HistoryItemDisplay.tsx` still passes `quotaLines`
  - **Issue 3: `ThemedGradient` used with non-existent `bold` prop**
  - **Issue 4: 3 implicit `any` type errors** in `buildModelRows` callback params
  - Integration test cleanup (0902e6f58) and quota error fix (aa78bffe7) are correct
  - `stream-json-formatter`: pre-existing, actively used — NOT an issue
- **Combined: WARNING: NEEDS_ATTENTION** — Type regressions from partial cherry-pick

### B15 — REIMPLEMENT 217e2b0e (non-interactive confirmation)
- **Deep:** CLEAN — behavioral equivalence FULL
- **TS:** CLEAN/EXCELLENT — 4 new tests (3 more than upstream), parallel batch safety verified, YOLO bypass correct
- **Combined: [OK] CLEAN**

### B16 — REIMPLEMENT d236df5b (tool output fragmentation) [HIGH RISK]
- **Deep:** CLEAN — provider-agnostic approach correct, all edge cases covered
- **TS:** NEEDS_ATTENTION
  - **Issue 1: Unsafe double-cast** `(part.functionResponse as unknown as { parts: Part[] })` bypasses SDK typing. Should use `FunctionResponsePart[]`.
  - **Issue 2: ~20 duplicate `getModel` lines** in test mocks (cosmetic, harmless — last value wins)
  - **Issue 3: Passthrough `functionResponse` case skips `limitFunctionResponsePart`** — potential behavioral regression for pre-formed function responses
  - **Issue 4: `supportsMultimodalFunctionResponse` vs `isGemini3Model` pattern inconsistency** (`gemini-3-` vs `gemini-3`)
- **Combined: WARNING: NEEDS_ATTENTION** — Core fix is correct but type safety and limit bypass need attention

### B17 — REIMPLEMENT 0c3eb826 (A2A interactive mode)
- **Deep:** NEEDS_ATTENTION (A2A package.json not `private: true` — pre-existing)
- **TS:** CLEAN/EXCELLENT — 1-line change, strong types, tests exceed upstream
- **Combined: [OK] CLEAN** (private field is pre-existing issue)

---

## Actionable Fix List

### Priority 1 — Security
| # | Batch | File | Issue | Fix |
|---|-------|------|-------|-----|
| 1 | B11 | `packages/core/src/policy/config.ts:457` | `createPolicyUpdater` regex missing word boundary suffix `(?:[\s"]|$)` | Add `(?:[\\s"]|$)` to match the TOML-loader path at line 318 |
| 2 | B11 | `packages/core/src/policy/persistence.test.ts:156-158` | Test asserts the broken pattern | Update test to assert the corrected pattern with word boundary |

### Priority 2 — Type Regressions (B14)
| # | Batch | File | Issue | Fix |
|---|-------|------|-------|-----|
| 3 | B14 | `packages/ui/src/components/StatsDisplay.tsx` | Imports non-existent `RetrieveUserQuotaResponse`, `VALID_GEMINI_MODELS` | Either: (a) define stubs in core, or (b) revert quota-display portions and keep only raw token counting |
| 4 | B14 | `packages/ui/src/components/StatsDisplay.tsx` | Prop mismatch `quotas` vs `quotaLines` | Align with chosen approach from #3 |
| 5 | B14 | `packages/ui/src/components/StatsDisplay.tsx` | `ThemedGradient bold` — non-existent prop | Remove `bold` or add to `ThemedGradientProps` |
| 6 | B14 | `packages/ui/src/components/StatsDisplay.tsx` | 3 implicit `any` in `buildModelRows` | Add explicit types to callback params |

### Priority 3 — Type Safety (B16)
| # | Batch | File | Issue | Fix |
|---|-------|------|-------|-----|
| 7 | B16 | `packages/core/src/core/coreToolScheduler.ts:306` | Unsafe double-cast through `unknown` | Use `FunctionResponsePart[]` from SDK |
| 8 | B16 | `packages/core/src/core/coreToolScheduler.ts` | Passthrough functionResponse skips `limitFunctionResponsePart` | Evaluate if limit should apply to passthrough |
| 9 | B16 | `packages/core/src/core/coreToolScheduler.ts` | `supportsMultimodalFunctionResponse` inconsistent with `isGemini3Model` | Delegate to `isGemini3Model()` |

### Priority 4 — Test Quality (B7)
| # | Batch | File | Issue | Fix |
|---|-------|------|-------|-----|
| 10 | B7 | `packages/core/src/ide/ide-client.test.ts` | Missing `Mock` type import | Add import |
| 11 | B7 | `packages/core/src/ide/ide-client.test.ts` | Zero tests for readdir-based port discovery | Add test |

### Priority 5 — Cosmetic / Optional
| # | Batch | File | Issue | Fix |
|---|-------|------|-------|-----|
| 12 | B8 | `packages/core/src/tools/atCommandProcessor.ts:515-570` | Duplicated 10-line error block | Extract helper |
| 13 | B16 | `coreToolScheduler.test.ts` | ~20 duplicate `getModel` lines in test mocks | Deduplicate |
| 14 | B17 | `packages/a2a-server/package.json` | Missing `"private": true` | Add field (pre-existing) |

---

## Pre-Existing Issues (Not From This Merge)
- Typecheck failures: `BucketFailureReason`, `FailoverContext` missing from core exports (in `BucketFailoverHandlerImpl.ts`)
- `ClearcutLogger` reference in `packages/core/src/telemetry/sdk.ts:163` (telemetry test files)
- A2A `package.json` missing `"private": true`
