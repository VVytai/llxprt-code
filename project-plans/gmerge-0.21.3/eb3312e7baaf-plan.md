# Plan: Support Extension Hooks with Security Warning (eb3312e7baaf)

Plan ID: `PLAN-20250219-GMERGE021.R7`
Generated: 2025-02-19
Total Phases: 6 (P00.5, P01, P02, P03, P04, P05)
Upstream Commit: `eb3312e7baaf`

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P00.5)
2. Confirmed integration contracts between `loadExtension()`, `extensionConsentString()`, and `HookRegistry`
3. Written failing tests BEFORE implementation (TDD mandatory per project rules)
4. Verified all assumed types/exports exist in actual codebase

---

## Execution Tracker

| Phase | ID | Status | Started | Completed | Verified | Semantic? | Notes |
|-------|-----|--------|---------|-----------|----------|-----------|-------|
| 0.5 | P00.5 | ⬜ | - | - | - | N/A | Preflight verification |
| 01 | P01 | ⬜ | - | - | - | N/A | Preflight / dependency check |
| 02 | P02 | ⬜ | - | - | - | ⬜ | Write all TDD tests (failing) |
| 03 | P03 | ⬜ | - | - | - | ⬜ | Add `loadExtensionHooks`, `mergeHooks`, `hasHooksInDirectory` |
| 04 | P04 | ⬜ | - | - | - | ⬜ | Wire hooks into `loadExtension()` |
| 05 | P05 | ⬜ | - | - | - | ⬜ | Update consent flow |

---

# Phase P00.5: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R7.P00.5`

## Purpose

Verify ALL assumptions before writing any code.

## Dependency Verification

| Dependency | Location | Status |
|------------|----------|--------|
| `HookDefinition` | `packages/core/src/hooks/types.ts` | Verify exists |
| `HookEventName` enum | `packages/core/src/hooks/types.ts` | Verify exists |
| `recursivelyHydrateStrings` | `packages/cli/src/config/extensions/variables.ts` | Verify exists |
| `GeminiCLIExtension.hooks` field | `packages/core/src/config/config.ts` line ~221 | Verify typed as `{ [K in HookEventName]?: HookDefinition[] }` |
| `extensionConsentString` | `packages/cli/src/config/extension.ts` | Verify signature |
| `maybeRequestConsentOrFail` | `packages/cli/src/config/extension.ts` | Verify signature |
| `HookRegistry.processHooksFromConfig` | `packages/core/src/hooks/hookRegistry.ts` | Verify already reads `extension.hooks` |

## Type/Interface Verification

| Type Name | Expected Definition | Actual Definition | Match? |
|-----------|---------------------|-------------------|--------|
| `GeminiCLIExtension.hooks` | `{ [K in HookEventName]?: HookDefinition[] }` | [grep output] | YES/NO |
| `ExtensionConfig` | Disk format — no `hooks` field expected | [grep output] | YES/NO |
| `HookEventName` | String enum of hook event names | [grep output] | YES/NO |

## Call Path Verification

| Function | Expected Caller | Actual Caller | Evidence |
|----------|-----------------|---------------|----------|
| `processHooksFromConfig` | `HookRegistry` init | [grep output] | [file:line] |
| `loadExtension` | Extension install/load paths | [grep output] | [file:line] |
| `maybeRequestConsentOrFail` | `installOrUpdateExtension` only | [grep output] | [file:line] |

## Verification Commands

```bash
# Confirm HookEventName and HookDefinition exports
grep -n "HookEventName\|HookDefinition" packages/core/src/hooks/types.ts | head -20
grep -n "HookEventName\|HookDefinition" packages/core/src/hooks/index.ts

# Confirm GeminiCLIExtension.hooks field
grep -n "hooks" packages/core/src/config/config.ts | head -20

# Confirm hydration utility
grep -n "recursivelyHydrateStrings" packages/cli/src/config/extensions/variables.ts

# Confirm HookRegistry reads extension.hooks
grep -n "processHooksFromConfig\|extension\.hooks" packages/core/src/hooks/hookRegistry.ts

# Confirm only one call site for maybeRequestConsentOrFail
grep -rn "maybeRequestConsentOrFail" packages/cli/src/config/extension.ts | wc -l
# Expected: exactly 1 call site (inside installOrUpdateExtension)

# Confirm test file exists
ls -la packages/cli/src/config/extension.test.ts
```

## Verification Gate

- [ ] All dependencies confirmed present with correct signatures
- [ ] `GeminiCLIExtension.hooks` field matches expected type
- [ ] `HookRegistry` already reads `extension.hooks` — no extra wiring needed
- [ ] `extensionConsentString` and `maybeRequestConsentOrFail` signatures understood
- [ ] Test file exists and is writable
- [ ] `recursivelyHydrateStrings` import path confirmed

**IF ANY CHECKBOX IS UNCHECKED: STOP and update plan before proceeding.**

---

# Phase P01: Preflight — No Upstream Dependencies

## Phase ID

`PLAN-20250219-GMERGE021.R7.P01`

## Prerequisites

- Required: Phase P00.5 completed and all gates passed
- Verification: All P00.5 checklist items checked

## Summary

`eb3312e7baaf` has **no required upstream dependency commits** in the LLxprt context. All scaffolding already exists:

- `recursivelyHydrateStrings` — already present and used in `extension.ts`
- `HookDefinition`, `HookEventName` — already exported from `@vybestack/llxprt-code-core`
- `HookRegistry.processHooksFromConfig()` — already reads `extension.hooks`
- Consent string infrastructure — already present

## Verification Commands

```bash
# Verify no missing upstream commits are needed
grep -rn "processHooksConfiguration\|processHooksFromConfig" packages/core/src/hooks/hookRegistry.ts
# Expected: function exists and iterates config.getExtensions()

# Verify hook types exported
grep -n "export" packages/core/src/hooks/index.ts
# Expected: HookDefinition and HookEventName in exports

# Confirm no circular dependency risk
grep -n "from '@vybestack/llxprt-code-core'" packages/cli/src/config/extension.ts | head -5
# Expected: import already present (or safe to add)
```

## Success Criteria

- Confirmed zero upstream dependency commits required
- All scaffolding verified present
- Ready to proceed to TDD phase

---

# Phase P02: TDD — Write All Failing Tests

## Phase ID

`PLAN-20250219-GMERGE021.R7.P02`

## Prerequisites

- Required: Phase P01 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R7.P01" packages/` (or P00.5 gate passed)
- Expected file: `packages/cli/src/config/extension.test.ts` (already exists)

## Requirements Implemented

### REQ-HOOKS-001: Load hooks from `hooks/hooks.json`

**Full Text**: When loading an extension, if a `hooks/hooks.json` file exists alongside the main config, its contents MUST be loaded, hydrated, and merged into `GeminiCLIExtension.hooks`.

**Behavior**:
- GIVEN: An extension directory contains `hooks/hooks.json` with valid hook definitions
- WHEN: `loadExtension()` is called for that extension
- THEN: The returned `GeminiCLIExtension` object has a populated `hooks` field

**Why This Matters**: Extensions cannot define lifecycle hooks unless the loader actually reads the hook file.

### REQ-HOOKS-002: Security consent warning for hooks

**Full Text**: When installing or updating an extension that contains hooks, the user MUST receive an explicit security warning in the consent prompt.

**Behavior**:
- GIVEN: An extension has non-empty hook definitions
- WHEN: `installOrUpdateExtension()` is called
- THEN: The consent string contains `WARNING: This extension contains Hooks which can automatically execute commands on your behalf.`

**Why This Matters**: Hooks execute commands on the user's behalf; users must be informed before granting consent.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extension.test.ts`
  - Add test groups A through G (see test matrix below)
  - Every test tagged: `@plan:PLAN-20250219-GMERGE021.R7.P02`
  - Relevant tests tagged: `@requirement:REQ-HOOKS-001` or `@requirement:REQ-HOOKS-002`

### Required Code Markers

Every test MUST include plan and requirement tags in the test description:

```typescript
it('returns undefined when hooks/hooks.json does not exist @plan:PLAN-20250219-GMERGE021.R7.P02 @requirement:REQ-HOOKS-001', () => {
  // test body
});
```

## TDD Test Matrix

### Group A: `loadExtensionHooks()` unit tests

| # | Scenario | Expected |
|---|----------|----------|
| A1 | `hooks/hooks.json` does not exist | Returns `undefined` |
| A2 | `hooks/hooks.json` is invalid JSON | Logs warning; returns `undefined` |
| A3 | `hooks/hooks.json` is a JSON array (not object) | Logs warning; returns `undefined` |
| A4 | `hooks/hooks.json` has unknown event name key | Logs warning for that key; other valid keys still loaded |
| A5 | `hooks/hooks.json` has non-array value for a key | Logs warning for that key; other valid keys still loaded |
| A6 | `hooks/hooks.json` has valid event key with empty array | Returns `undefined` (no hooks detected) |
| A7 | `hooks/hooks.json` has valid hooks with `${extensionPath}` | Path placeholder hydrated to actual extension path |
| A8 | `hooks/hooks.json` has valid hooks with `${workspacePath}` | Workspace path placeholder hydrated |
| A9 | `hooks/hooks.json` has `${UNKNOWN_VAR}` placeholder | Left verbatim in output (no error) |
| A10 | `hooks/hooks.json` has multiple valid event keys | All returned in merged result |

### Group B: `mergeHooks()` unit tests

| # | Scenario | Expected |
|---|----------|----------|
| B1 | Both inputs `undefined` | Returns `undefined` |
| B2 | Only inline hooks present | Returns inline hooks |
| B3 | Only file hooks present | Returns file hooks |
| B4 | Both present for different events | Both events present in result |
| B5 | Both present for same event | Arrays concatenated (inline first, file second) |

### Group C: `loadExtension()` integration tests

| # | Scenario | Expected |
|---|----------|----------|
| C1 | Extension with no `hooks/hooks.json` | Returned object has `hooks: undefined` |
| C2 | Extension with valid `hooks/hooks.json` | Returned object has populated `hooks` field |
| C3 | Extension with malformed `hooks/hooks.json` | Extension still loads; hooks absent; warning logged |
| C4 | Extension with `hooks/hooks.json` having empty arrays | `hooks` is `undefined` |

### Group D: `hasHooksInDirectory()` unit tests

| # | Scenario | Expected |
|---|----------|----------|
| D1 | No hooks file | Returns `false` |
| D2 | Valid hooks file with non-empty arrays | Returns `true` |
| D3 | Valid hooks file with only empty arrays | Returns `false` |
| D4 | Malformed hooks file | Returns `false` (no error thrown) |

### Group E: `extensionConsentString()` tests

| # | Scenario | Expected |
|---|----------|----------|
| E1 | `hasHooks = false` | Output does NOT contain "Hooks" warning |
| E2 | `hasHooks = true` | Output contains "WARNING" and "Hooks" line |
| E3 | Warning text placement | Warning appears after trust warning, before MCP servers section |

### Group F: `maybeRequestConsentOrFail()` / install transition tests

| # | Scenario | Expected |
|---|----------|----------|
| F1 | Fresh install, no hooks | Consent requested without hook warning |
| F2 | Fresh install, has hooks; consent granted | Consent with warning; succeeds |
| F3 | Fresh install, has hooks; consent denied | Throws install-cancelled error |
| F4 | Update, hooks unchanged | No consent requested (string unchanged) |
| F5 | Update, hooks added (none → some) | Consent requested with warning |
| F6 | Update, hooks removed (some → none) | Consent requested without warning (string changed) |
| F7 | Update, hooks present before and after, other config unchanged | No consent requested |
| F8 | Non-interactive consent path with hooks warning | `requestConsentNonInteractive` receives string containing warning |

### Group G: Backward compatibility

| # | Scenario | Expected |
|---|----------|----------|
| G1 | Extension with no hooks file: install/update behavior | No regression from current behavior |
| G2 | Extension config with hypothetical inline hooks field | Respected via `mergeHooks` |

## Verification Commands

```bash
# Confirm tests were added
grep -c "@plan:PLAN-20250219-GMERGE021.R7.P02" packages/cli/src/config/extension.test.ts
# Expected: 17+ occurrences

# Run new tests — they MUST fail (not "cannot find", but "not implemented" or equivalent)
npm test -- --grep "@plan:.*GMERGE021.*P02"
# Expected: Tests exist and fail (proving TDD gate)
```

## Structural Verification Checklist

- [ ] All 7 test groups (A–G) added to `extension.test.ts`
- [ ] All tests tagged with `@plan:PLAN-20250219-GMERGE021.R7.P02`
- [ ] All tests tagged with appropriate `@requirement:REQ-HOOKS-00x`
- [ ] Tests follow behavioral pattern: no mock theater, verify actual outputs
- [ ] Tests fail with meaningful errors (not "cannot find module")

## Success Criteria

- 17+ new tests exist in `extension.test.ts`
- All tests tagged with P02 marker
- All tests fail naturally (implementation not yet written)
- `npm test` reports failures, not compile errors

---

# Phase P03: Implementation — Hook Loader Helpers

## Phase ID

`PLAN-20250219-GMERGE021.R7.P03`

## Prerequisites

- Required: Phase P02 completed — all tests exist and fail
- Verification: `npm test -- --grep "@plan:.*GMERGE021.*P02"` returns failures (not "cannot find")

## Requirements Implemented

### REQ-HOOKS-001: Load hooks from `hooks/hooks.json`

(See full text in Phase P02)

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extension.ts`

**Step 1 — Add imports:**

```typescript
import { HookDefinition, HookEventName } from '@vybestack/llxprt-code-core';
```

**Step 2 — Define local type alias (after imports):**

```typescript
// @plan PLAN-20250219-GMERGE021.R7.P03
// @requirement REQ-HOOKS-001
type HookMap = { [K in HookEventName]?: HookDefinition[] };
```

**Step 3 — Implement `loadExtensionHooks()`:**

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R7.P03
 * @requirement REQ-HOOKS-001
 */
function loadExtensionHooks(
  extensionDir: string,
  context: { extensionPath: string; workspacePath: string },
): HookMap | undefined {
  const hooksFilePath = path.join(extensionDir, 'hooks', 'hooks.json');
  if (!fs.existsSync(hooksFilePath)) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(hooksFilePath, 'utf-8'));
  } catch (e) {
    console.warn(
      `Warning: Could not parse hooks file for extension at ${extensionDir}: ${getErrorMessage(e)}`,
    );
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    console.warn(
      `Warning: hooks/hooks.json in ${extensionDir} must be a JSON object. Skipping.`,
    );
    return undefined;
  }
  const hydrated = recursivelyHydrateStrings(raw as JsonObject, {
    extensionPath: context.extensionPath,
    workspacePath: context.workspacePath,
    '/': path.sep,
    pathSeparator: path.sep,
  }) as unknown as Record<string, unknown>;

  const result: HookMap = {};
  const validEventNames = new Set<string>(Object.values(HookEventName));
  let hasAny = false;
  for (const [key, val] of Object.entries(hydrated)) {
    if (!validEventNames.has(key)) {
      console.warn(
        `Warning: Unknown hook event name "${key}" in ${hooksFilePath}. Skipping.`,
      );
      continue;
    }
    if (!Array.isArray(val)) {
      console.warn(
        `Warning: Hook definitions for event "${key}" in ${hooksFilePath} must be an array. Skipping.`,
      );
      continue;
    }
    if (val.length > 0) {
      result[key as HookEventName] = val as HookDefinition[];
      hasAny = true;
    }
  }
  return hasAny ? result : undefined;
}
```

**Step 4 — Implement `mergeHooks()`:**

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R7.P03
 * @requirement REQ-HOOKS-001
 */
function mergeHooks(
  inlineHooks: HookMap | undefined,
  fileHooks: HookMap | undefined,
): HookMap | undefined {
  if (!inlineHooks && !fileHooks) return undefined;
  const merged: HookMap = { ...(inlineHooks ?? {}) };
  for (const [event, defs] of Object.entries(fileHooks ?? {})) {
    const key = event as HookEventName;
    merged[key] = [...(merged[key] ?? []), ...(defs ?? [])];
  }
  return merged;
}
```

**Step 5 — Implement `hasHooksInDirectory()`:**

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R7.P03
 * @requirement REQ-HOOKS-002
 */
function hasHooksInDirectory(extensionDir: string): boolean {
  const hooksFilePath = path.join(extensionDir, 'hooks', 'hooks.json');
  if (!fs.existsSync(hooksFilePath)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(hooksFilePath, 'utf-8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
    return Object.values(raw as Record<string, unknown>).some(
      (v) => Array.isArray(v) && v.length > 0,
    );
  } catch {
    return false;
  }
}
```

### Validation and Error Policy

| Condition | Behavior |
|-----------|----------|
| File does not exist | No hooks; no warning; no change |
| File contains invalid JSON | Log user-visible warning; treat as no hooks; do NOT fail install |
| File is valid JSON but not an object | Log warning; skip |
| Top-level keys not valid `HookEventName` values | Log warning per key; skip that key |
| Values are not arrays | Log warning per key; skip that key |
| `HookDefinition` entries missing required fields | Pass through; `HookRegistry` discards at registration |
| Empty arrays `[]` for an event | No hooks detected; no security warning |

### Merge/Precedence Contract

- Hooks from `hooks/hooks.json` are **appended** to any inline hooks per event (additive)
- `HookRegistry` already appends all entries without deduplication — additive merge is consistent
- Precedence at execution time is `ConfigSource.Extensions` (lowest priority — already correct)

## Verification Commands

```bash
# Confirm plan markers added
grep -c "@plan:PLAN-20250219-GMERGE021.R7.P03" packages/cli/src/config/extension.ts
# Expected: 3+ occurrences (one per function)

# Run Group A and B tests — should now pass
npm test -- --grep "@plan:.*GMERGE021.*P02" 2>&1 | grep -E "passing|failing"
# Expected: Groups A, B, D tests passing; groups C, E, F, G may still fail

# TypeScript compile check
npm run typecheck
# Expected: No errors
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY|WIP)" packages/cli/src/config/extension.ts | grep -v ".test.ts"
# Expected: No matches related to this phase

grep -rn -E "(in a real|placeholder|not yet|will be implemented)" packages/cli/src/config/extension.ts | grep -v ".test.ts"
# Expected: No matches
```

## Structural Verification Checklist

- [ ] `loadExtensionHooks()` added with all validation branches
- [ ] `mergeHooks()` added with correct additive semantics
- [ ] `hasHooksInDirectory()` added
- [ ] `HookMap` type alias defined
- [ ] Imports for `HookDefinition` and `HookEventName` added
- [ ] All functions tagged with `@plan` and `@requirement` markers
- [ ] No TODO/STUB/placeholder code left

## Semantic Verification Checklist

**Does the code DO what the requirement says?**
- [ ] `loadExtensionHooks` reads `hooks/hooks.json` from the correct path
- [ ] `loadExtensionHooks` hydrates `${extensionPath}` and `${workspacePath}` placeholders
- [ ] `loadExtensionHooks` warns but does not throw on invalid JSON
- [ ] `loadExtensionHooks` skips unknown event names with a warning
- [ ] `loadExtensionHooks` returns `undefined` for empty hook sets
- [ ] `mergeHooks` produces `undefined` when both inputs are `undefined`
- [ ] `mergeHooks` concatenates arrays for the same event (inline first)
- [ ] `hasHooksInDirectory` returns `false` for empty arrays and parse errors

**Would tests FAIL if implementation was removed?**
- [ ] Yes — tests assert specific return values and warning log calls

## Success Criteria

- Groups A, B, D tests all pass
- TypeScript compiles without errors
- No deferred implementation markers left

## Failure Recovery

1. `git checkout -- packages/cli/src/config/extension.ts`
2. Re-run Phase P03 with corrected implementation
3. Cannot proceed to Phase P04 until Group A, B, D tests pass

---

# Phase P04: Wire Hook Loading into `loadExtension()`

## Phase ID

`PLAN-20250219-GMERGE021.R7.P04`

## Prerequisites

- Required: Phase P03 completed — helper functions exist and Groups A, B, D tests pass
- Verification: `npm test -- --grep "@plan:.*GMERGE021.*P02" 2>&1 | grep "Group [ABD]"`

## Requirements Implemented

### REQ-HOOKS-001: Load hooks from `hooks/hooks.json`

(See full text in Phase P02)

**Behavior**:
- GIVEN: `loadExtension()` is called for an extension directory that has `hooks/hooks.json`
- WHEN: The function constructs the `GeminiCLIExtension` return object
- THEN: The `.hooks` field is populated from the result of `loadExtensionHooks()` merged with any inline hooks

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extension.ts` — `loadExtension()` function

In `loadExtension()`, after resolving `effectiveExtensionPath`, add hook loading and include result in the returned object:

```typescript
// @plan PLAN-20250219-GMERGE021.R7.P04
// @requirement REQ-HOOKS-001
const fileHooks = loadExtensionHooks(effectiveExtensionPath, {
  extensionPath: effectiveExtensionPath,
  workspacePath: workspaceDir,
});

return {
  name: config.name,
  version: config.version,
  path: effectiveExtensionPath,
  contextFiles,
  installMetadata,
  mcpServers: config.mcpServers,
  excludeTools: config.excludeTools,
  isActive: true,
  hooks: mergeHooks(undefined, fileHooks),
};
```

> **Note on inline hooks**: `ExtensionConfig` (disk format) does not currently have a `hooks` field — only `GeminiCLIExtension` (runtime) does. Pass `undefined` as the first argument to `mergeHooks` until a future commit adds inline hook support to the disk format.

## All Load/Install Execution Paths

| Path | Hooks detected? | Behavior |
|------|----------------|----------|
| Extension, no `hooks/hooks.json` | No | `hooks: undefined` |
| Extension, valid `hooks/hooks.json` | Yes | `hooks` populated |
| Extension, malformed `hooks/hooks.json` | No (warning logged) | `hooks: undefined`; extension loads |
| Extension, empty `hooks/hooks.json` arrays | No | `hooks: undefined` |

## Verification Commands

```bash
# Group C tests should now pass
npm test -- --grep "@plan:.*GMERGE021.*P02" 2>&1 | grep -E "passing|failing"
# Expected: Groups A, B, C, D all passing

# Confirm return object includes hooks field
grep -n "hooks:" packages/cli/src/config/extension.ts | head -10

# TypeScript compile
npm run typecheck
```

## Structural Verification Checklist

- [ ] `loadExtension()` calls `loadExtensionHooks()` with correct arguments
- [ ] Return object includes `hooks: mergeHooks(undefined, fileHooks)`
- [ ] `@plan` marker added to the new lines in `loadExtension()`
- [ ] Group C tests pass

## Semantic Verification Checklist

**Is the feature REACHABLE by users?**
- [ ] `loadExtension()` is called from the extension loading path
- [ ] Returned object is passed to `HookRegistry.processHooksFromConfig()` (already wired)
- [ ] No extra wiring required — registry already reads `extension.hooks`

**Integration Points Verified:**
- [ ] `loadExtension()` passes `extensionPath` correctly as both dir and context value
- [ ] `workspaceDir` parameter passed correctly to `loadExtensionHooks`
- [ ] `mergeHooks(undefined, fileHooks)` result correctly typed as `HookMap | undefined`

## Success Criteria

- Groups A, B, C, D tests all pass
- TypeScript compiles without errors
- `loadExtension()` correctly populates `hooks` for extensions with `hooks/hooks.json`

## Failure Recovery

1. `git checkout -- packages/cli/src/config/extension.ts`
2. Re-examine `loadExtension()` signature and return type
3. Cannot proceed to Phase P05 until Group C tests pass

---

# Phase P05: Update Consent Flow

## Phase ID

`PLAN-20250219-GMERGE021.R7.P05`

## Prerequisites

- Required: Phase P04 completed — Groups A, B, C, D tests pass
- Verification: `npm test -- --grep "@plan:.*GMERGE021.*P02" 2>&1 | grep "failing"` shows only E, F, G failures

## Requirements Implemented

### REQ-HOOKS-002: Security consent warning for hooks

**Full Text**: When installing or updating an extension that contains hooks, the user MUST receive an explicit security warning in the consent prompt so they can make an informed decision.

**Behavior**:
- GIVEN: An extension source directory has non-empty hook definitions
- WHEN: `installOrUpdateExtension()` calls `maybeRequestConsentOrFail()`
- THEN: The consent string includes `WARNING: This extension contains Hooks which can automatically execute commands on your behalf.`

**Why This Matters**: Hooks execute arbitrary commands on the user's behalf. Consent without this warning would be uninformed.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extension.ts`

**Step 1 — Modify `extensionConsentString()` signature:**

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R7.P05
 * @requirement REQ-HOOKS-002
 */
function extensionConsentString(
  extensionConfig: ExtensionConfig,
  hasHooks: boolean = false,
): string {
```

Add warning line to the output array (after the existing trust warning, before MCP servers):

```typescript
if (hasHooks) {
  output.push(
    'WARNING: This extension contains Hooks which can automatically execute commands on your behalf.',
  );
}
```

**Step 2 — Modify `maybeRequestConsentOrFail()` signature:**

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R7.P05
 * @requirement REQ-HOOKS-002
 */
async function maybeRequestConsentOrFail(
  extensionConfig: ExtensionConfig,
  requestConsent: (consent: string) => Promise<boolean>,
  hasHooks: boolean,
  previousExtensionConfig?: ExtensionConfig,
  previousHasHooks?: boolean,
): Promise<void> {
  const extensionConsent = extensionConsentString(extensionConfig, hasHooks);
  if (previousExtensionConfig !== undefined) {
    const previousConsent = extensionConsentString(
      previousExtensionConfig,
      previousHasHooks ?? false,
    );
    if (previousConsent === extensionConsent) return;
  }
  // ... rest of existing logic unchanged
}
```

**Step 3 — Update call site in `installOrUpdateExtension()`:**

```typescript
// @plan PLAN-20250219-GMERGE021.R7.P05
// @requirement REQ-HOOKS-002
const newHasHooks = hasHooksInDirectory(localSourcePath);
const previousHasHooks = previousExtensionConfig
  ? hasHooksInDirectory(installedExtensionDir)  // reads already-installed dir
  : undefined;
await maybeRequestConsentOrFail(
  newExtensionConfig,
  requestConsent,
  newHasHooks,
  previousExtensionConfig,
  previousHasHooks,
);
```

> **Important**: `previousHasHooks` reads from the **already-installed** extension directory, not the new source. This compares what the user previously consented to vs. what they are about to install.

## Consent Logic: Risk-Relevant Diffing

The existing mechanism uses **string equality on the full consent string**. This phase extends it:

- `extensionConsentString()` includes warning when `hasHooks = true`
- The consent string changes when hooks are added → user is prompted [OK]
- The consent string changes when hooks are removed → user is prompted (conservative but safe) [OK]
- The consent string is identical when nothing changes → no prompt [OK]
- **Hook content changes** (command strings change): hook command details are NOT included in the consent string — only presence is surfaced. This is an accepted limitation consistent with the upstream behavior and the existing MCP server consent model.

### Install/Update Transition Table

| Previous | Current | Behavior |
|----------|---------|----------|
| No hooks | No hooks | No prompt (unchanged) |
| No hooks | Has hooks | Prompt shown with WARNING |
| Has hooks | No hooks | Prompt shown (warning removed — string changed) |
| Has hooks | Has hooks | No prompt if consent string otherwise unchanged |
| Invalid hooks file | Valid hooks file with hooks | Prompt shown (hooks now detected) |
| No hooks (file absent) | Empty `hooks.json` | No prompt; no warning (empty = absent) |

## Security Considerations

1. **Warning placement**: Hook warning appears immediately after the general trust warning — cannot be missed
2. **Empty hooks detection**: Extension with only empty hook arrays is NOT considered to "have hooks" — no false positives
3. **Hydration safety**: String interpolation only; no shell evaluation; unknown placeholders left verbatim
4. **Malformed files**: Parse errors produce visible warning but do not silently allow invalid hooks or fail the install
5. **Consent persistence**: String-equality mechanism correctly gates re-consent on meaningful changes

## Verification Commands

```bash
# All test groups should now pass
npm test -- --grep "@plan:.*GMERGE021.*P02"
# Expected: All 17+ tests passing, 0 failing

# Full test suite
npm test
# Expected: No regressions

# TypeScript compile
npm run typecheck
# Expected: No errors

# Lint and format
npm run lint
npm run format

# Build
npm run build

# Smoke test
node scripts/start.js --profile-load synthetic "write me a haiku"
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY|WIP)" packages/cli/src/config/extension.ts | grep -v ".test.ts"
# Expected: No matches from this feature

grep -rn -E "(in a real|placeholder|not yet|will be implemented)" packages/cli/src/config/extension.ts | grep -v ".test.ts"
# Expected: No matches
```

## Structural Verification Checklist

- [ ] `extensionConsentString()` accepts `hasHooks` parameter with default `false`
- [ ] Warning line added to consent output when `hasHooks = true`
- [ ] `maybeRequestConsentOrFail()` accepts `hasHooks` and `previousHasHooks` parameters
- [ ] String comparison uses both `hasHooks` values
- [ ] Call site in `installOrUpdateExtension()` updated with `newHasHooks` and `previousHasHooks`
- [ ] `previousHasHooks` reads from installed directory, not new source
- [ ] All `@plan` and `@requirement` markers added

## Semantic Verification Checklist

**Does the code DO what the requirement says?**
- [ ] Warning text is exactly: `WARNING: This extension contains Hooks which can automatically execute commands on your behalf.`
- [ ] Warning appears in consent string when `hasHooks = true`
- [ ] Warning does NOT appear when `hasHooks = false`
- [ ] Consent re-triggered when hooks added to an existing extension
- [ ] Consent NOT re-triggered when hooks presence unchanged

**Would tests FAIL if implementation was removed?**
- [ ] Group E tests assert specific presence/absence of warning text
- [ ] Group F tests assert consent callback called or not called based on transitions

**Is the feature REACHABLE by users?**
- [ ] `installOrUpdateExtension()` calls `hasHooksInDirectory()` with correct source path
- [ ] Consent callback receives the warning-containing string
- [ ] Non-interactive install path also receives warning (via callback)

**Lifecycle Verified:**
- [ ] `previousHasHooks` uses installed extension path (not new source path)
- [ ] `hasHooksInDirectory()` is called BEFORE copying files (uses source path for new install)
- [ ] No async race conditions (all calls sequential/awaited)

**Edge Cases Verified:**
- [ ] Extension with no hooks file: no regression
- [ ] Extension with only empty arrays: no warning
- [ ] Malformed hooks file at install source: `hasHooksInDirectory` returns `false`, no warning
- [ ] Workspace migration path (`performWorkspaceExtensionMigration`) uses `installOrUpdateExtension` — same path, no special handling needed

#### Feature Actually Works

```bash
# Manual test: install an extension with a hooks file
# (create temp extension dir with hooks/hooks.json and verify consent string)
# Expected: consent output contains the WARNING line
# Actual behavior: [paste output when executing]
```

#### Integration Points Verified

- [ ] `hasHooksInDirectory(localSourcePath)` uses the pre-copy source path
- [ ] `hasHooksInDirectory(installedExtensionDir)` uses the already-installed path for updates
- [ ] `extensionConsentString(config, hasHooks)` correctly propagates the boolean
- [ ] `maybeRequestConsentOrFail()` correctly compares old and new consent strings
- [ ] `HookRegistry` already reads `extension.hooks` set by `loadExtension()` — no extra wiring

## Success Criteria

- All 17+ tests in Groups A–G pass
- Full test suite passes with no regressions
- `npm run typecheck`, `npm run lint`, `npm run format`, `npm run build` all clean
- Smoke test (`haiku`) succeeds
- No deferred implementation markers in modified files

## Failure Recovery

If this phase fails:

1. Rollback commands:
   ```bash
   git checkout -- packages/cli/src/config/extension.ts
   git checkout -- packages/cli/src/config/extension.test.ts
   ```
2. Files to revert: `extension.ts`, `extension.test.ts`
3. Cannot proceed to commit until all groups pass

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

```markdown
Phase: P05
Completed: YYYY-MM-DD HH:MM
Files Created: none
Files Modified:
  - packages/cli/src/config/extension.ts (+N lines)
  - packages/cli/src/config/extension.test.ts (+N lines)
Tests Added: [count]
Verification: [paste of `npm test` output showing all passing]
```

---

## Files to Modify (Summary)

| File | Phases | Changes |
|------|--------|---------|
| `packages/cli/src/config/extension.ts` | P03, P04, P05 | Add `loadExtensionHooks`, `mergeHooks`, `hasHooksInDirectory`; wire into `loadExtension()`; update consent functions and call site |
| `packages/cli/src/config/extension.test.ts` | P02 | Add Groups A–G (17+ behavioral tests) |

**No other files require modification.** The `HookRegistry` already reads `extension.hooks`; no changes needed in `packages/core`.
