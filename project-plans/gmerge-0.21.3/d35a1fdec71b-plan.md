# Plan: Reimplementation — d35a1fdec71b (handle missing local extension config)

Plan ID: PLAN-20250219-GMERGE021.R16
Generated: 2025-02-19
Total Phases: 5
Requirements: Upstream commit d35a1fdec71b41d4385ae1805986dd5d428bf15b

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P01)
2. Written failing tests BEFORE any implementation changes
3. Verified all dependencies and types exist as assumed
4. Confirmed hook-gating change (upstream Change 1) is N/A for LLxprt

---

## Upstream Commit

**Commit:** d35a1fdec71b41d4385ae1805986dd5d428bf15b  
**Title:** fix: handle missing local extension config and skip hooks when disabled (#14744)  
**Date:** Mon Dec 8 20:51:42 2025 -0500

### Upstream Changes Summary

**Change 1: Skip loading extension hooks when `enableHooks` is disabled**  
In `packages/cli/src/config/extension-manager.ts`: wraps `loadExtensionHooks()` in `if (this.settings.tools?.enableHooks)`.

**Change 2: Handle missing local extension config gracefully in update check**  
In `packages/cli/src/config/extensions/github.ts`: wraps `loadExtensionConfig()` in try-catch and returns `ExtensionUpdateState.NOT_UPDATABLE` (with a `debugLogger.warn`) when config cannot be loaded.

---

# Phase P01: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R16.P01`

## Purpose

Verify ALL assumptions before writing any code.

## Dependency Verification

| Dependency | Command | Status |
|------------|---------|--------|
| `loadExtension` in `extension.ts` | `grep -n "loadExtension" packages/cli/src/config/extension.ts` | Verify exists |
| `ExtensionUpdateState.NOT_UPDATABLE` | `grep -n "NOT_UPDATABLE" packages/cli/src/config/extensions/github.ts` | Verify enum value |
| `ExtensionUpdateState.ERROR` | `grep -n "ExtensionUpdateState.ERROR" packages/cli/src/config/extensions/github.ts` | Verify current usage |
| `installMetadata?.type === 'local'` branch | `grep -n "local" packages/cli/src/config/extensions/github.ts` | Verify branch exists |

## Change 1 N/A Verification

```bash
grep "hooks" packages/cli/src/config/extension.ts
# Expected: NO results — LLxprt has no hook-loading in extension.ts
# If results found: re-evaluate whether Change 1 applies
```

## Change 2 Scope Verification

```bash
# Confirm current ERROR usage in local branch
grep -n "ExtensionUpdateState.ERROR" packages/cli/src/config/extensions/github.ts
# Expected: 2 occurrences in the local-type branch

# Confirm console.error usage in local branch
grep -n "console.error" packages/cli/src/config/extensions/github.ts
# Expected: 2 occurrences to be replaced with console.warn

# Confirm loadExtension vs loadExtensionConfig difference
grep -n "loadExtension" packages/cli/src/config/extensions/github.ts
# Expected: loadExtension (not loadExtensionConfig) — heavier function
```

## Type/Interface Verification

| Type Name | Expected Definition | Verify Command |
|-----------|---------------------|----------------|
| `ExtensionUpdateState` | Enum with `NOT_UPDATABLE`, `ERROR`, `UPDATE_AVAILABLE`, `UP_TO_DATE` | `grep -n "ExtensionUpdateState" packages/cli/src/config/extensions/github.ts` |
| `GeminiCLIExtension.installMetadata` | Has `type` field with value `'local'` | `grep -n "installMetadata" packages/cli/src/config/` |

## Test Infrastructure Verification

```bash
# Confirm test file exists
ls packages/cli/src/config/extensions/github.test.ts
# Expected: file exists

# Confirm existing tests pass
npm run test -- packages/cli/src/config/extensions/github.test.ts
# Expected: All current tests pass before any changes
```

## Verification Gate

- [ ] `grep "hooks" packages/cli/src/config/extension.ts` returns no results (Change 1 N/A confirmed)
- [ ] `ExtensionUpdateState.ERROR` appears exactly twice in local branch of `github.ts`
- [ ] `console.error` appears exactly twice in local branch of `github.ts`
- [ ] Test file `github.test.ts` exists and passes
- [ ] `ExtensionUpdateState.NOT_UPDATABLE` is a valid enum value

**IF ANY CHECKBOX IS UNCHECKED: STOP and update plan before proceeding.**

## Success Criteria

All verification gate checkboxes are checked and confirmed.

---

# Phase P02: Write Failing Tests (TDD)

## Phase ID

`PLAN-20250219-GMERGE021.R16.P02`

## Prerequisites

- Required: Phase P01 completed and all gate checks passed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R16.P01" .`
- Expected: Preflight confirmed Change 1 N/A, Change 2 scope confirmed

## Requirements Implemented

### REQ-R16-001: Local extension null-load → NOT_UPDATABLE

**Full Text**: When `loadExtension` returns `null` for a local extension, `checkForExtensionUpdate` MUST set state to `NOT_UPDATABLE` (not `ERROR`).  
**Behavior**:
- GIVEN: An installed extension with `installMetadata.type === 'local'` and source path that exists but cannot be loaded
- WHEN: `checkForExtensionUpdate` is called and `loadExtension` returns `null`
- THEN: `setExtensionUpdateState` is called with `ExtensionUpdateState.NOT_UPDATABLE`

**Why This Matters**: A missing source directory is a structural condition, not a transient error. `NOT_UPDATABLE` correctly communicates that the extension cannot be updated through this mechanism.

### REQ-R16-002: Local extension throw → NOT_UPDATABLE

**Full Text**: When `loadExtension` throws for a local extension, `checkForExtensionUpdate` MUST set state to `NOT_UPDATABLE` (not `ERROR`).  
**Behavior**:
- GIVEN: An installed extension with `installMetadata.type === 'local'`
- WHEN: `checkForExtensionUpdate` is called and `loadExtension` throws (e.g., ENOENT)
- THEN: `setExtensionUpdateState` is called with `ExtensionUpdateState.NOT_UPDATABLE`

**Why This Matters**: Aligns LLxprt with upstream intent: structural failures in loading a local extension config do not constitute an error state requiring user action.

### REQ-R16-003: Local extension version match → UP_TO_DATE (regression)

**Full Text**: When `loadExtension` returns an extension with the same version, state MUST be `UP_TO_DATE`.  
**Behavior**:
- GIVEN: Installed local extension at version `1.0.0`
- WHEN: `loadExtension` returns `{ version: '1.0.0' }`
- THEN: State is `UP_TO_DATE`

**Why This Matters**: Regression test to ensure the happy path is not broken by the NOT_UPDATABLE changes.

### REQ-R16-004: Local extension version mismatch → UPDATE_AVAILABLE (regression)

**Full Text**: When `loadExtension` returns an extension with a different version, state MUST be `UPDATE_AVAILABLE`.  
**Behavior**:
- GIVEN: Installed local extension at version `1.0.0`
- WHEN: `loadExtension` returns `{ version: '2.0.0' }`
- THEN: State is `UPDATE_AVAILABLE`

**Why This Matters**: Regression test to ensure update detection still works after the NOT_UPDATABLE changes.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extensions/github.test.ts`
  - ADD: new `describe('local extension update check')` block inside the `checkForExtensionUpdate` describe
  - ADD: Test A — `loadExtension` returns `null` → `NOT_UPDATABLE` (REQ-R16-001)
  - ADD: Test B — `loadExtension` throws → `NOT_UPDATABLE` (REQ-R16-002)
  - ADD: Test C — version match → `UP_TO_DATE` (REQ-R16-003, regression)
  - ADD: Test D — version mismatch → `UPDATE_AVAILABLE` (REQ-R16-004, regression)

### Required Code Markers

Every test MUST include:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R16.P02
 * @requirement REQ-R16-001 (or REQ-R16-002, REQ-R16-003, REQ-R16-004)
 */
```

### Test Implementations

**Test A (REQ-R16-001):**
```typescript
it('should return NOT_UPDATABLE if local extension config cannot be loaded @plan:PLAN-20250219-GMERGE021.R16.P02 @requirement:REQ-R16-001', async () => {
  vi.mock('../extension.js', () => ({
    loadExtension: vi.fn().mockReturnValue(null),
  }));
  const extension: GeminiCLIExtension = {
    name: 'test-local',
    path: '/ext',
    version: '1.0.0',
    isActive: true,
    installMetadata: { type: 'local', source: '/missing/path' },
    contextFiles: [],
  };
  let result: ExtensionUpdateState | undefined;
  await checkForExtensionUpdate(extension, (state) => (result = state));
  expect(result).toBe(ExtensionUpdateState.NOT_UPDATABLE);
});
```

**Test B (REQ-R16-002):**
```typescript
it('should return NOT_UPDATABLE if loading local extension throws @plan:PLAN-20250219-GMERGE021.R16.P02 @requirement:REQ-R16-002', async () => {
  vi.mock('../extension.js', () => ({
    loadExtension: vi.fn().mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    }),
  }));
  const extension: GeminiCLIExtension = {
    name: 'test-local',
    path: '/ext',
    version: '1.0.0',
    isActive: true,
    installMetadata: { type: 'local', source: '/missing/path' },
    contextFiles: [],
  };
  let result: ExtensionUpdateState | undefined;
  await checkForExtensionUpdate(extension, (state) => (result = state));
  expect(result).toBe(ExtensionUpdateState.NOT_UPDATABLE);
});
```

**Test C (REQ-R16-003):**
```typescript
it('should return UP_TO_DATE if local extension version matches @plan:PLAN-20250219-GMERGE021.R16.P02 @requirement:REQ-R16-003', async () => {
  vi.mock('../extension.js', () => ({
    loadExtension: vi.fn().mockReturnValue({ version: '1.0.0' }),
  }));
  const extension: GeminiCLIExtension = {
    name: 'test-local',
    path: '/ext',
    version: '1.0.0',
    isActive: true,
    installMetadata: { type: 'local', source: '/some/path' },
    contextFiles: [],
  };
  let result: ExtensionUpdateState | undefined;
  await checkForExtensionUpdate(extension, (state) => (result = state));
  expect(result).toBe(ExtensionUpdateState.UP_TO_DATE);
});
```

**Test D (REQ-R16-004):**
```typescript
it('should return UPDATE_AVAILABLE if local extension version differs @plan:PLAN-20250219-GMERGE021.R16.P02 @requirement:REQ-R16-004', async () => {
  vi.mock('../extension.js', () => ({
    loadExtension: vi.fn().mockReturnValue({ version: '2.0.0' }),
  }));
  const extension: GeminiCLIExtension = {
    name: 'test-local',
    path: '/ext',
    version: '1.0.0',
    isActive: true,
    installMetadata: { type: 'local', source: '/some/path' },
    contextFiles: [],
  };
  let result: ExtensionUpdateState | undefined;
  await checkForExtensionUpdate(extension, (state) => (result = state));
  expect(result).toBe(ExtensionUpdateState.UPDATE_AVAILABLE);
});
```

## Verification Commands

```bash
# Confirm tests are added with plan markers
grep -r "@plan:PLAN-20250219-GMERGE021.R16.P02" packages/cli/src/config/extensions/ | wc -l
# Expected: 4 occurrences (one per test)

# Run the tests — Tests A and B MUST FAIL, C and D may pass
npm run test -- packages/cli/src/config/extensions/github.test.ts
# Expected: Tests A and B fail with ERROR vs NOT_UPDATABLE; C and D pass or describe naturally
```

### Structural Verification Checklist

- [ ] 4 new tests added to `github.test.ts`
- [ ] Each test tagged with `@plan:PLAN-20250219-GMERGE021.R16.P02`
- [ ] Each test tagged with appropriate `@requirement:REQ-R16-00X`
- [ ] Tests A and B fail (proving implementation is not yet correct)
- [ ] Tests C and D describe the existing happy-path behavior

## Success Criteria

- 4 tests added and visible in `github.test.ts`
- Tests A and B fail with `ERROR` vs `NOT_UPDATABLE` mismatch (TDD: red phase confirmed)
- Tests C and D pass or exist with natural behavior

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/config/extensions/github.test.ts`
2. Investigate test infrastructure (vitest mock behavior for this module)
3. Re-run Phase P02 with corrected test patterns

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

---

# Phase P03: Implement Change 2

## Phase ID

`PLAN-20250219-GMERGE021.R16.P03`

## Prerequisites

- Required: Phase P02 completed — 4 tests written, Tests A and B confirmed failing
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R16.P02" packages/cli/src/config/extensions/`
- Expected files from P02: Modified `github.test.ts` with 4 new tests

## Requirements Implemented

Implements REQ-R16-001 and REQ-R16-002 (see Phase P02 for full text).

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extensions/github.ts`
  - In the `installMetadata?.type === 'local'` branch:
  - CHANGE Path A: `setExtensionUpdateState(ExtensionUpdateState.ERROR)` → `setExtensionUpdateState(ExtensionUpdateState.NOT_UPDATABLE)`
  - CHANGE Path A: `console.error(...)` → `console.warn(...)` with updated message
  - CHANGE Path B (catch): `setExtensionUpdateState(ExtensionUpdateState.ERROR)` → `setExtensionUpdateState(ExtensionUpdateState.NOT_UPDATABLE)`
  - CHANGE Path B (catch): `console.error(...)` → `console.warn(...)` with updated message
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R16.P03`
  - Implements: `@requirement:REQ-R16-001`, `@requirement:REQ-R16-002`

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R16.P03
 * @requirement REQ-R16-001
 * @requirement REQ-R16-002
 */
```

### Before / After

**Before (Path A — null return):**
```typescript
if (!newExtension) {
  console.error(
    `Failed to check for update for local extension "${extension.name}". Could not load extension from source path: ${installMetadata.source}`,
  );
  setExtensionUpdateState(ExtensionUpdateState.ERROR);
  return;
}
```

**After (Path A — null return):**
```typescript
if (!newExtension) {
  console.warn(
    `Could not load local extension "${extension.name}" from source path: ${installMetadata.source}. Marking as not updatable.`,
  );
  setExtensionUpdateState(ExtensionUpdateState.NOT_UPDATABLE); // @plan:PLAN-20250219-GMERGE021.R16.P03 @requirement:REQ-R16-001
  return;
}
```

**Before (Path B — catch block):**
```typescript
} catch (error) {
  console.error(
    `Error checking for update for local extension "${extension.name}": ${getErrorMessage(error)}`,
  );
  setExtensionUpdateState(ExtensionUpdateState.ERROR);
  return;
}
```

**After (Path B — catch block):**
```typescript
} catch (error) {
  console.warn(
    `Could not check for update for local extension "${extension.name}": ${getErrorMessage(error)}. Marking as not updatable.`,
  );
  setExtensionUpdateState(ExtensionUpdateState.NOT_UPDATABLE); // @plan:PLAN-20250219-GMERGE021.R16.P03 @requirement:REQ-R16-002
  return;
}
```

## Verification Commands

```bash
# Confirm plan markers exist
grep -n "@plan:PLAN-20250219-GMERGE021.R16.P03" packages/cli/src/config/extensions/github.ts
# Expected: 2 occurrences

# Confirm ERROR no longer used in local branch
grep -n "ExtensionUpdateState.ERROR" packages/cli/src/config/extensions/github.ts
# Expected: 0 occurrences in local branch (may appear elsewhere if used outside local block)

# Confirm console.error no longer used in local branch
grep -n "console.error" packages/cli/src/config/extensions/github.ts
# Expected: 0 occurrences in local branch

# Confirm console.warn added
grep -n "console.warn" packages/cli/src/config/extensions/github.ts
# Expected: 2 occurrences in local branch

# Run tests — all 4 should now pass
npm run test -- packages/cli/src/config/extensions/github.test.ts
# Expected: All 4 new tests pass (Tests A, B, C, D)
```

### Deferred Implementation Detection

```bash
grep -n -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY|TEMP|WIP)" packages/cli/src/config/extensions/github.ts | grep -v ".test.ts"
# Expected: No new markers

grep -n -E "(in a real|in production|ideally|for now|placeholder|not yet|will be|should be)" packages/cli/src/config/extensions/github.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

1. **Does the code DO what the requirement says?**
   - [ ] Read REQ-R16-001: null return → NOT_UPDATABLE
   - [ ] Read Path A in `github.ts` and confirm `NOT_UPDATABLE` is now set
   - [ ] Can explain: `loadExtension` returns null → `console.warn` + `NOT_UPDATABLE` + return
   - [ ] Read REQ-R16-002: throw → NOT_UPDATABLE
   - [ ] Read catch block in `github.ts` and confirm `NOT_UPDATABLE` is now set

2. **Is this REAL implementation, not placeholder?**
   - [ ] No TODO/HACK/STUB in modified code
   - [ ] No empty returns added
   - [ ] Both paths fully implemented

3. **Would the tests FAIL if implementation was removed?**
   - [ ] Test A checks `NOT_UPDATABLE` — would fail if code still returns `ERROR`
   - [ ] Test B checks `NOT_UPDATABLE` — would fail if code still returns `ERROR`

4. **Is the feature REACHABLE by users?**
   - [ ] `checkForExtensionUpdate` is called from extension update check flow
   - [ ] Path requires `installMetadata.type === 'local'` which is set for local extensions

5. **What's MISSING?**
   - [ ] Review if any other error paths in `github.ts` also warrant downgrade (out of scope for this commit)

#### UX Impact Verified

- [ ] `ExtensionUpdateState.NOT_UPDATABLE` displays correctly in `ExtensionsList.tsx` (users see "not updatable" instead of error indicator — intended behavior per plan analysis)

## Success Criteria

- Both `setExtensionUpdateState(ExtensionUpdateState.ERROR)` calls in local branch changed to `NOT_UPDATABLE`
- Both `console.error` calls in local branch changed to `console.warn`
- All 4 TDD tests pass
- No deferred implementation markers

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/config/extensions/github.ts`
2. Re-examine the local branch structure in `github.ts`
3. Re-run Phase P03 with corrected before/after code

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase P04: Full Verification Suite

## Phase ID

`PLAN-20250219-GMERGE021.R16.P04`

## Prerequisites

- Required: Phase P03 completed — all 4 tests pass
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R16.P03" packages/cli/src/config/extensions/`
- Expected: `github.ts` modified with NOT_UPDATABLE + console.warn

## Implementation Tasks

No code changes in this phase. This is a verification-only phase.

## Verification Commands

```bash
# Step 1: Run targeted tests
npm run test -- packages/cli/src/config/extensions/github.test.ts
# Expected: All tests pass, including the 4 new ones

# Step 2: Run full test suite
npm run test
# Expected: All tests pass

# Step 3: TypeScript type checking
npm run typecheck
# Expected: No type errors

# Step 4: Lint
npm run lint
# Expected: No lint errors

# Step 5: Format check
npm run format
# Expected: No formatting errors (or auto-fix applied)

# Step 6: Build
npm run build
# Expected: Build succeeds with no errors

# Step 7: Integration smoke test
node scripts/start.js --profile-load synthetic "write me a haiku"
# Expected: Produces a haiku; no crashes
```

### Structural Verification Checklist

- [ ] Phase P01 markers confirmed: preflight gate checked
- [ ] Phase P02 markers present: `@plan:PLAN-20250219-GMERGE021.R16.P02` in `github.test.ts`
- [ ] Phase P03 markers present: `@plan:PLAN-20250219-GMERGE021.R16.P03` in `github.ts`
- [ ] All 4 new tests pass
- [ ] No `ExtensionUpdateState.ERROR` in local branch of `github.ts`
- [ ] No `console.error` in local branch of `github.ts`
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Build succeeds

### Final Plan Marker Audit

```bash
grep -r "@plan:PLAN-20250219-GMERGE021.R16" . | wc -l
# Expected: 6+ occurrences total (P02: 4 tests, P03: 2 impl markers)

grep -r "@requirement:REQ-R16-001" . | wc -l
# Expected: 2+ occurrences (test + impl)

grep -r "@requirement:REQ-R16-002" . | wc -l
# Expected: 2+ occurrences (test + impl)
```

## Success Criteria

All verification commands return expected results. No phases skipped. Plan markers traceable.

## Failure Recovery

If any step fails:

1. Do NOT proceed to Phase P05
2. Return to Phase P03 for implementation fixes
3. Re-run all P04 verification after each fix

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

---

# Phase P05: Completion and Documentation

## Phase ID

`PLAN-20250219-GMERGE021.R16.P05`

## Prerequisites

- Required: Phase P04 completed — all verification commands pass
- Verification: All boxes in Phase P04 checklist checked

## Implementation Tasks

### Files to Confirm Final State

**`packages/cli/src/config/extensions/github.ts`** — local extension branch:
- `setExtensionUpdateState(ExtensionUpdateState.NOT_UPDATABLE)` (×2, was ERROR)
- `console.warn(...)` (×2, was console.error)
- Plan marker `@plan:PLAN-20250219-GMERGE021.R16.P03` present

**`packages/cli/src/config/extensions/github.test.ts`** — local extension tests:
- 4 tests in `describe('local extension update check')` block
- Tests tagged with `@plan:PLAN-20250219-GMERGE021.R16.P02`

**`packages/cli/src/config/extension.ts`** — UNCHANGED (Change 1 N/A)

### Files NOT Modified (Confirmed N/A)

- `packages/cli/src/config/extension.ts` — No hooks loading in LLxprt; Change 1 N/A
- `packages/cli/src/config/extension.test.ts` — No corresponding test change needed

## Notes for Future Reference

- **enableHooks path**: The `enableHooks` setting is at `tools.enableHooks` in `settingsSchema.ts` (nested inside the `tools` object). Config reads it as `effectiveSettings.tools?.enableHooks ?? false`. Same path as upstream (`settings.tools?.enableHooks`). Not at top level.
- **Hook gating is N/A**: LLxprt does not load hooks during extension initialization; no code exists to gate. Confirmed by `grep "hooks" packages/cli/src/config/extension.ts` returning no results.
- **`loadExtension()` vs `loadExtensionConfig()`**: LLxprt's heavier `loadExtension()` covers more failure modes than upstream's `loadExtensionConfig()`. All failure modes (null return and exception) correctly map to `NOT_UPDATABLE`.
- **Log level**: `console.warn` used (not `debugLogger.warn` as in upstream) because LLxprt does not have a `debugLogger` instance in `github.ts`.
- **UX tradeoff**: Users with misconfigured local extensions will see "not updatable" instead of an error indicator. This is intentional — the condition is structural, not transient.

## Verification Commands

```bash
# Final state check
grep -n "ExtensionUpdateState" packages/cli/src/config/extensions/github.ts
# Expected: NOT_UPDATABLE appears (×2 in local branch), ERROR does NOT appear in local branch

grep -n "console\." packages/cli/src/config/extensions/github.ts
# Expected: console.warn appears (×2 in local branch), console.error does NOT appear in local branch

# Final test run
npm run test -- packages/cli/src/config/extensions/github.test.ts
# Expected: All tests pass

# Full suite
npm run test && npm run typecheck && npm run lint && npm run build
# Expected: All pass
```

## Success Criteria

- All verification commands pass
- Plan is fully traceable via `@plan:PLAN-20250219-GMERGE021.R16` markers
- Both files documented as changed or confirmed N/A
- Phase completion markers created for P01–P05

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

Contents:
```markdown
Phase: P05
Completed: YYYY-MM-DD HH:MM
Plan ID: PLAN-20250219-GMERGE021.R16
Files Modified:
  - packages/cli/src/config/extensions/github.ts (2 ERROR→NOT_UPDATABLE, 2 console.error→warn)
  - packages/cli/src/config/extensions/github.test.ts (4 tests added)
Files Confirmed N/A:
  - packages/cli/src/config/extension.ts (Change 1 N/A — no hooks loading)
Tests Added: 4
Verification: All npm run test/typecheck/lint/format/build pass
```

---

## Execution Tracker

| Phase | ID | Description | Status | Semantic? | Notes |
|-------|-----|-------------|--------|-----------|-------|
| P01 | P01 | Preflight verification | [ ] | N/A | Confirm Change 1 N/A, Change 2 scope |
| P02 | P02 | Write failing tests (TDD red) | [ ] | N/A | 4 tests; A+B must fail |
| P03 | P03 | Implement Change 2 | [ ] | [ ] | NOT_UPDATABLE + console.warn |
| P04 | P04 | Full verification suite | [ ] | [ ] | All npm checks + smoke test |
| P05 | P05 | Completion and documentation | [ ] | N/A | Final state confirmed |

Note: "Semantic?" tracks whether behavioral verification (feature actually works) was performed, not just structural (files exist). N/A for preflight, TDD, and documentation phases.

## Completion Markers

- [ ] All phases have `@plan:PLAN-20250219-GMERGE021.R16.PXX` markers in code
- [ ] REQ-R16-001 through REQ-R16-004 have `@requirement` markers
- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run format` passes
- [ ] `npm run build` passes
- [ ] `node scripts/start.js --profile-load synthetic "write me a haiku"` succeeds
- [ ] No phases skipped
