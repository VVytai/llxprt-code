# Plan: MessageBus Always-On — Remove `enableMessageBusIntegration` Conditional

Plan ID: PLAN-20250219-GMERGE021.R1
Generated: 2025-02-19
Total Phases: 4
Requirements: Upstream commit `533a3fb312ad` — enable MessageBus integration unconditionally

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (P01)
2. Written failing tests BEFORE implementation (P02)
3. Verified all assumptions about `Config`, `MessageBus`, and test mocks
4. Confirmed zero callers pass `enableMessageBusIntegration` in the monorepo

---

# Phase P01: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R1.P01`

## Prerequisites

- None — this is the first phase
- No code changes are permitted during this phase

## Purpose

Verify ALL assumptions in the current-state audit before writing any code.

## Dependency Verification

| Dependency | Verification Command | Expected Result |
|------------|----------------------|-----------------|
| `MessageBus` unconditionally instantiated at line 822 | `grep -n "new MessageBus" packages/core/src/config/config.ts` | Single occurrence, no conditional |
| `getMessageBus()` method exists on `Config` | `grep -n "getMessageBus" packages/core/src/config/config.ts` | Returns `this.messageBus` |
| `getEnableMessageBusIntegration` NOT on real `Config` | `grep -n "getEnableMessageBusIntegration" packages/core/src/config/config.ts` | Zero matches |
| Dead conditional block present | `grep -n "messageBusEnabled" packages/core/src/config/config.ts` | Lines 829–845 present |

## Type/Interface Verification

| Type/Field | Expected State | Verification Command |
|------------|----------------|----------------------|
| `ConfigParameters.enableMessageBusIntegration` | Optional boolean, present at line 450 | `grep -n "enableMessageBusIntegration" packages/core/src/config/config.ts` |
| No external callers pass this field | Zero monorepo usages outside config.ts | `grep -r "enableMessageBusIntegration" packages/ --include="*.ts"` |

## Call Path Verification

| Function | Verification Command | Expected |
|----------|----------------------|----------|
| `getEnableMessageBusIntegration` in test mocks only | `grep -rn "getEnableMessageBusIntegration" packages/ --include="*.ts"` | Only in `.test.ts` and `testing_utils.ts` |
| No CLI flag or env var | `grep -rn "enableMessageBus" packages/cli/src packages/ui/src` | Zero matches |
| No JSON schema entry | `grep -r "enableMessageBus" packages/ --include="*.json"` | Zero matches |

## Blocking Issues Checklist

- [ ] Confirm `this.messageBus` is always truthy before the dead conditional
- [ ] Confirm `getEnableMessageBusIntegration` never appears in non-test production code
- [ ] Confirm no file outside `config.ts` passes `enableMessageBusIntegration` as a named key
- [ ] Confirm `getMessageBus()` exists and returns `this.messageBus`
- [ ] Confirm the dead block's `!this.messageBus` guard is always `false` (i.e., `messageBus` constructed unconditionally above it)

## Verification Gate

- [ ] All dependency verifications returned expected results
- [ ] No external callers of `enableMessageBusIntegration` found
- [ ] Dead conditional logic confirmed unreachable
- [ ] Test mock locations catalogued (3 in `coreToolScheduler.test.ts`, 1 in `testing_utils.ts`)

IF ANY CHECKBOX IS UNCHECKED: STOP and update the plan before proceeding to P02.

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

```markdown
Phase: P01
Completed: YYYY-MM-DD HH:MM
Verification: [paste grep output confirming dead conditional and mock locations]
Blocking Issues Found: [none, or list]
Gate Passed: YES/NO
```

---

# Phase P02: Write Failing Tests (TDD)

## Phase ID

`PLAN-20250219-GMERGE021.R1.P02`

## Prerequisites

- Required: Phase P01 completed and gate passed
- Verification: `project-plans/gmerge-0.21.3/.completed/P01.md` exists
- Preflight verification confirmed all assumptions

## Requirements Implemented (Expanded)

### REQ-GMERGE021-001: MessageBus Always Constructed

**Full Text**: `messageBus` MUST be available on any `Config` instance regardless of parameters passed at construction time.

**Behavior**:
- GIVEN: A `Config` instance is constructed with any set of `ConfigParameters`
- WHEN: `config.getMessageBus()` is called
- THEN: A non-null, non-undefined `MessageBus` instance is returned

**Why This Matters**: The conditional `messageBusEnabled` guard previously allowed callers to suppress MessageBus initialization; removing this ensures hooks and A2A messaging always have a bus available.

### REQ-GMERGE021-002: Legacy Field Silently Ignored at Runtime

**Full Text**: Passing the removed `enableMessageBusIntegration` field in a config object MUST NOT suppress MessageBus construction.

**Behavior**:
- GIVEN: A caller (e.g. stale external code) passes `enableMessageBusIntegration: false`
- WHEN: `Config` is constructed with that object cast to `unknown as ConfigParameters`
- THEN: `config.getMessageBus()` still returns a truthy `MessageBus` instance

**Why This Matters**: JavaScript silently ignores unknown object keys at runtime; TypeScript compile errors will surface this for typed callers, but runtime behavior must remain safe.

### REQ-GMERGE021-003: Behavior Independent of Hooks Configuration

**Full Text**: `MessageBus` availability MUST NOT depend on whether hooks are enabled or configured.

**Behavior**:
- GIVEN: Any combination of `enableHooks` (true/false) and `hooks` (present/absent)
- WHEN: `Config` is constructed
- THEN: `config.getMessageBus()` returns a truthy instance in all cases

**Why This Matters**: The prior dead code tied MessageBus to hooks config; the always-on semantics must hold for all hook matrix combinations.

## Implementation Tasks

### Files to Create / Modify

- `packages/core/src/config/config.test.ts`
  - ADD new `describe` block: `'MessageBus integration always-on @plan:PLAN-20250219-GMERGE021.R1.P02'`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R1.P02`
  - MUST include: `@requirement:REQ-GMERGE021-001`, `REQ-GMERGE021-002`, `REQ-GMERGE021-003`

### Required Code Markers

Every test MUST include:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R1.P02
 * @requirement REQ-GMERGE021-001
 */
```

### Tests to Add

```typescript
describe('MessageBus integration always-on @plan:PLAN-20250219-GMERGE021.R1.P02', () => {
  /**
   * @plan PLAN-20250219-GMERGE021.R1.P02
   * @requirement REQ-GMERGE021-001
   */
  it('should construct messageBus unconditionally regardless of parameters', () => {
    const config = new Config({ ...baseParams });
    expect(config.getMessageBus()).toBeTruthy();
  });

  /**
   * @plan PLAN-20250219-GMERGE021.R1.P02
   * @requirement REQ-GMERGE021-002
   */
  it('should ignore legacy enableMessageBusIntegration: false if passed by mistake', () => {
    const config = new Config({
      ...baseParams,
      enableMessageBusIntegration: false,
    } as unknown as ConfigParameters);
    expect(config.getMessageBus()).toBeTruthy();
  });

  /**
   * @plan PLAN-20250219-GMERGE021.R1.P02
   * @requirement REQ-GMERGE021-003
   */
  it('should provide messageBus regardless of hooks configuration', () => {
    const noHooks = new Config({ ...baseParams, enableHooks: false });
    expect(noHooks.getMessageBus()).toBeTruthy();

    const hooksOnNoConfig = new Config({ ...baseParams, enableHooks: true });
    expect(hooksOnNoConfig.getMessageBus()).toBeTruthy();

    const hooksOnWithConfig = new Config({
      ...baseParams,
      enableHooks: true,
      hooks: { BeforeToolCall: [{ command: 'echo test' }] },
    });
    expect(hooksOnWithConfig.getMessageBus()).toBeTruthy();
  });
});
```

## Verification Commands

### Automated Checks

```bash
# Confirm test markers exist
grep -r "@plan:PLAN-20250219-GMERGE021.R1.P02" packages/ --include="*.ts" | wc -l
# Expected: 3+ occurrences

# Run only the new tests — they should PASS even before P03 since messageBus is
# already unconditionally constructed. Confirm they pass to establish baseline.
npm test -- --grep "MessageBus integration always-on"
# Expected: All 3 tests pass (the always-on behavior already exists structurally;
#           the tests prove it and will catch regression if P03 breaks it)
```

### Structural Verification Checklist

- [ ] P01 completion marker present
- [ ] New `describe` block added to `config.test.ts`
- [ ] All 3 tests tagged with `@plan:PLAN-20250219-GMERGE021.R1.P02`
- [ ] Tests target actual behavior (`getMessageBus()` return value), not mocks

## Success Criteria

- 3 new behavioral tests added and tagged
- Tests pass (existing always-on behavior confirmed by test)
- No structural/mock-theater tests introduced

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/core/src/config/config.test.ts`
2. Re-read `config.test.ts` to find correct `baseParams` shape before retrying

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

```markdown
Phase: P02
Completed: YYYY-MM-DD HH:MM
Files Modified: packages/core/src/config/config.test.ts (+N lines)
Tests Added: 3
Verification: [paste npm test output showing 3 tests pass]
```

---

# Phase P03: Implementation

## Phase ID

`PLAN-20250219-GMERGE021.R1.P03`

## Prerequisites

- Required: Phase P02 completed — tests passing
- Verification: `project-plans/gmerge-0.21.3/.completed/P02.md` exists
- All 3 new tests confirmed passing before touching implementation

## Requirements Implemented

Implements REQ-GMERGE021-001, REQ-GMERGE021-002, REQ-GMERGE021-003 by removing the dead conditional and the interface field that guarded it.

## Implementation Tasks

### Files to Modify

#### 1. `packages/core/src/config/config.ts`

**Change A — Remove `enableMessageBusIntegration` from `ConfigParameters` interface**

- Location: Line ~450
- `@plan PLAN-20250219-GMERGE021.R1.P03`
- `@requirement REQ-GMERGE021-001`

**Old:**
```typescript
  disableYoloMode?: boolean;
  enableMessageBusIntegration?: boolean;
  enableHooks?: boolean;
```

**New:**
```typescript
  disableYoloMode?: boolean;
  enableHooks?: boolean;
```

**Change B — Remove the dead conditional block (lines ~829–845)**

- `@plan PLAN-20250219-GMERGE021.R1.P03`
- `@requirement REQ-GMERGE021-001`

**Old:**
```typescript
    // Enable MessageBus integration if:
    // 1. Explicitly enabled via setting, OR
    // 2. Hooks are enabled and hooks are configured
    const hasHooks = params.hooks && Object.keys(params.hooks).length > 0;
    const hooksNeedMessageBus = this.enableHooks && hasHooks;
    const messageBusEnabled =
      params.enableMessageBusIntegration ??
      (hooksNeedMessageBus ? true : false);
    // Update messageBus initialization to consider hooks
    if (messageBusEnabled && !this.messageBus) {
      // MessageBus is already initialized in constructor, just log that hooks may use it
      const debugLogger = new DebugLogger('llxprt:config');
      debugLogger.debug(
        () =>
          `MessageBus enabled for hooks (enableHooks=${this.enableHooks}, hasHooks=${hasHooks})`,
      );
    }
```

**New:**
```typescript
    // MessageBus is always enabled; constructed unconditionally above.
    // @plan PLAN-20250219-GMERGE021.R1.P03 @requirement REQ-GMERGE021-001
```

#### 2. `packages/core/src/core/coreToolScheduler.test.ts`

**Change — Remove stale `getEnableMessageBusIntegration` mock property (3 locations: lines ~552, ~1119, ~2148)**

- `@plan PLAN-20250219-GMERGE021.R1.P03`

**Old (each occurrence):**
```typescript
      getEnableMessageBusIntegration: () => false,
```

**New (each occurrence):**
*(line deleted — method never existed on real `Config`; see P01 audit)*

**Rationale:** Flipping to `() => true` would be "mock theater" — it tests a non-existent API surface. The correct fix is removal.

#### 3. `packages/a2a-server/src/utils/testing_utils.ts`

**Change — Remove stale `getEnableMessageBusIntegration` mock property (line ~67)**

- `@plan PLAN-20250219-GMERGE021.R1.P03`

**Old:**
```typescript
    getEnableMessageBusIntegration: vi.fn().mockReturnValue(false),
```

**New:**
*(line deleted — same rationale as above)*

### What NOT to Change

- Do **not** add a `getEnableMessageBusIntegration()` method to `Config` — it was never part of the real API
- Do **not** add replacement logging unless explicitly requested
- Do **not** modify any profile/settings schema files — no schema entry for this key exists
- Do **not** touch `DebugLogger` import unless confirmed unused elsewhere in `config.ts`

## Verification Commands

### Automated Checks

```bash
# 1. Confirm field completely removed from codebase
grep -r "enableMessageBusIntegration" packages/ --include="*.ts"
# Expected: zero results

# 2. Confirm plan markers present
grep -r "@plan:PLAN-20250219-GMERGE021.R1.P03" packages/ --include="*.ts" | wc -l
# Expected: 2+ occurrences (config.ts comment + any tests)

# 3. Confirm mock method removed from all test files
grep -rn "getEnableMessageBusIntegration" packages/ --include="*.ts"
# Expected: zero results

# 4. Full suite
npm run test
npm run typecheck
npm run lint
npm run format
npm run build
```

### Deferred Implementation Detection (MANDATORY)

```bash
# No TODOs left in modified files
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY|WIP)" \
  packages/core/src/config/config.ts \
  packages/core/src/core/coreToolScheduler.test.ts \
  packages/a2a-server/src/utils/testing_utils.ts | grep -v ".test.ts"
# Expected: No matches

# No cop-out comments
grep -rn -E "(in a real|placeholder|not yet|will be|should be)" \
  packages/core/src/config/config.ts
# Expected: No matches
```

### Structural Verification Checklist

- [ ] `enableMessageBusIntegration` removed from `ConfigParameters` interface
- [ ] Dead conditional block (lines 829–845) removed and replaced with single comment
- [ ] All 3 mock properties removed from `coreToolScheduler.test.ts`
- [ ] Mock property removed from `testing_utils.ts`
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run test` passes with all existing tests green

### Semantic Verification Checklist

1. **Does the code DO what the requirement says?**
   - [ ] `ConfigParameters` no longer has `enableMessageBusIntegration` field
   - [ ] The dead conditional block is gone; `config.ts` constructor has no `messageBusEnabled` variable
   - [ ] `this.messageBus` is still constructed unconditionally (line 822 untouched)

2. **Is this REAL implementation, not placeholder?**
   - [ ] Deferred implementation detection passed
   - [ ] The removal is complete — no shim, stub, or feature flag remains

3. **Would the P02 tests FAIL if implementation was removed?**
   - [ ] Tests verify `getMessageBus()` returns a truthy value — they would fail if `messageBus` were not constructed

4. **Is the feature REACHABLE?**
   - [ ] `getMessageBus()` is accessible on any `Config` instance with no preconditions

5. **What's MISSING?**
   - [ ] Release notes must document compile-time breaking change for external TypeScript integrators

#### Feature Actually Works

```bash
# Smoke test
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
# Expected: Normal response with no MessageBus-related errors
```

#### Integration Points Verified

- [ ] `coreToolScheduler.ts` does NOT call `getEnableMessageBusIntegration` (confirmed in P01)
- [ ] `a2a-server` tests compile and pass after mock removal
- [ ] No TypeScript errors from removed interface field (no callers pass it by name)

## Success Criteria

- `grep -r "enableMessageBusIntegration" packages/ --include="*.ts"` returns zero results
- `grep -rn "getEnableMessageBusIntegration" packages/ --include="*.ts"` returns zero results
- All P02 tests continue to pass
- Full verification suite (`test`, `typecheck`, `lint`, `format`, `build`) passes
- Smoke test succeeds

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/core/src/config/config.ts`
2. `git checkout -- packages/core/src/core/coreToolScheduler.test.ts`
3. `git checkout -- packages/a2a-server/src/utils/testing_utils.ts`
4. Re-read P01 audit to re-verify exact line numbers before retrying

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

```markdown
Phase: P03
Completed: YYYY-MM-DD HH:MM
Files Modified:
  - packages/core/src/config/config.ts (removed interface field + dead block, ~15 lines deleted)
  - packages/core/src/core/coreToolScheduler.test.ts (3 mock lines deleted)
  - packages/a2a-server/src/utils/testing_utils.ts (1 mock line deleted)
Tests Added: 0 (tests added in P02)
Verification:
  grep -r "enableMessageBusIntegration" → 0 results
  grep -rn "getEnableMessageBusIntegration" → 0 results
  npm run test → [paste pass output]
  npm run typecheck → [paste pass output]
```

---

# Phase P04: Final Verification

## Phase ID

`PLAN-20250219-GMERGE021.R1.P04`

## Prerequisites

- Required: Phase P03 completed — all changes in and all tests passing
- Verification: `project-plans/gmerge-0.21.3/.completed/P03.md` exists

## Purpose

End-to-end confirmation that the entire change set is coherent, the monorepo is clean, and external integrators are warned via release notes.

## Implementation Tasks

### 1. Cross-Package Compile Verification

```bash
grep -r "enableMessageBusIntegration" packages/ --include="*.ts"
# Expected: zero results — confirms no external callers were silently broken
```

### 2. Full Verification Suite

```bash
npm run test
npm run typecheck
npm run lint
npm run format
npm run build
```

### 3. Smoke Test

```bash
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
# Expected: Successful response, no errors
```

### 4. Release Notes (Documentation)

Add a note to the relevant CHANGELOG or release notes file documenting:

> **Breaking change (compile-time):** `ConfigParameters.enableMessageBusIntegration` has been removed. MessageBus is now always enabled. External TypeScript integrators referencing this field by name will receive a TypeScript compile error and must remove the key from their config objects.

> **Runtime behavior:** Passing the removed key in a plain JavaScript object has no effect — it is silently ignored. No migration is needed for runtime-only integrators.

### 5. Plan Markers Audit

```bash
# Confirm all phases are traceable
grep -r "@plan:PLAN-20250219-GMERGE021.R1.P02" packages/ --include="*.ts" | wc -l
grep -r "@plan:PLAN-20250219-GMERGE021.R1.P03" packages/ --include="*.ts" | wc -l
# Expected: 3+ for P02, 2+ for P03
```

## Semantic Verification Checklist

1. **Does the code DO what the requirement says?**
   - [ ] `ConfigParameters` has no `enableMessageBusIntegration` field
   - [ ] Constructor has no `messageBusEnabled` variable or conditional block
   - [ ] `getMessageBus()` returns a non-null instance on every `Config` constructed

2. **Is this REAL implementation, not placeholder?**
   - [ ] No TODO, FIXME, STUB, or cop-out comments in modified files
   - [ ] No feature flag or env var re-introducing conditionality

3. **Would the tests FAIL if implementation was removed?**
   - [ ] P02 tests verify actual `getMessageBus()` return value — yes, they would fail

4. **Is the feature REACHABLE?**
   - [ ] MessageBus is always available; hooks and A2A components can rely on it unconditionally

5. **What's MISSING before closing?**
   - [ ] Release notes entry written
   - [ ] PR description references compile-time breaking change

#### Integration Points Verified

- [ ] `coreToolScheduler` tests pass without `getEnableMessageBusIntegration` mock
- [ ] `a2a-server` tests pass without `getEnableMessageBusIntegration` mock
- [ ] No remaining references to the removed interface field anywhere in `packages/`

#### Edge Cases Verified

- [ ] Config constructed with `enableHooks: false` → `getMessageBus()` truthy
- [ ] Config constructed with `enableHooks: true, hooks: {}` → `getMessageBus()` truthy
- [ ] Config constructed with full hooks config → `getMessageBus()` truthy
- [ ] Cast with `enableMessageBusIntegration: false` → `getMessageBus()` truthy (P02 test)

## Success Criteria

- `grep -r "enableMessageBusIntegration" packages/ --include="*.ts"` → zero results
- `grep -rn "getEnableMessageBusIntegration" packages/ --include="*.ts"` → zero results
- All `npm run *` verification commands pass
- Smoke test succeeds
- Release notes updated

## Failure Recovery

If verification fails:

1. Identify which verification command failed and which file introduced the regression
2. `git diff HEAD` to review all changes
3. Fix the specific failure; do not proceed to commit until all checks pass

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

```markdown
Phase: P04
Completed: YYYY-MM-DD HH:MM
Verification Results:
  npm run test      → PASS
  npm run typecheck → PASS
  npm run lint      → PASS
  npm run format    → PASS
  npm run build     → PASS
  smoke test        → PASS
  enableMessageBusIntegration grep → 0 results
  getEnableMessageBusIntegration grep → 0 results
Release Notes Updated: YES/NO
Plan Markers Audited: YES
```

---

## Execution Tracker

| Phase | ID | Status | Started | Completed | Verified | Semantic? | Notes |
|-------|-----|--------|---------|-----------|----------|-----------|-------|
| P01 | PLAN-20250219-GMERGE021.R1.P01 | [ ] | - | - | - | N/A | Preflight verification |
| P02 | PLAN-20250219-GMERGE021.R1.P02 | [ ] | - | - | - | [ ] | Write failing tests (TDD) |
| P03 | PLAN-20250219-GMERGE021.R1.P03 | [ ] | - | - | - | [ ] | Implementation |
| P04 | PLAN-20250219-GMERGE021.R1.P04 | [ ] | - | - | - | [ ] | Final verification |

## Completion Markers

- [ ] All phases have `@plan` markers in code
- [ ] All requirements have `@requirement` markers in tests
- [ ] `enableMessageBusIntegration` grep returns zero results
- [ ] `getEnableMessageBusIntegration` grep returns zero results
- [ ] Full verification suite passes
- [ ] Release notes updated
