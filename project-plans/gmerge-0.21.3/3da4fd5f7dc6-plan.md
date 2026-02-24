# Plan: fix(acp): prevent unnecessary credential cache clearing on re-authentication

Plan ID: PLAN-20250219-GMERGE021.R8
Generated: 2025-02-19
Total Phases: 5
Upstream Commit: `3da4fd5f7dc6` — Hirokazu Hata, Thu Dec 4 08:43:15 2025 +0900

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P01)
2. Read all analysis in P01 before writing any code
3. Written failing tests BEFORE implementation (P02 before P03)
4. Verified all dependencies and types exist as assumed in P01

---

# Phase P01: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R8.P01`

## Prerequisites

- Required: None (this is the first phase)
- Preflight verification: This IS the preflight phase — complete before any implementation

## Purpose

Verify ALL assumptions before writing any code. The upstream commit modifies the `authenticate` method
in `GeminiAgent` to skip credential cache clearing when re-authenticating with the same auth method.
LLxprt maps this to **profile identity** (profile name string) rather than `AuthType` enum.

## Upstream Change Summary

**Before (original behavior):**
```typescript
async authenticate({ methodId }: acp.AuthenticateRequest): Promise<void> {
  const method = z.nativeEnum(AuthType).parse(methodId);
  await clearCachedCredentialFile();  // Always clears credentials
  await this.config.refreshAuth(method);
}
```

**After (fixed behavior):**
```typescript
async authenticate({ methodId }: acp.AuthenticateRequest): Promise<void> {
  const method = z.nativeEnum(AuthType).parse(methodId);
  const selectedAuthType = this.settings.merged.security?.auth?.selectedType;
  if (selectedAuthType && selectedAuthType !== method) {
    await clearCachedCredentialFile();
  }
  await this.config.refreshAuth(method);
}
```

**Upstream invalidation policy:** Clear if and only if the requested auth type differs from the
currently persisted `selectedType`. Unit of comparison: auth method identity (e.g. `oauth`, `api-key`).

## LLxprt Structural Differences from Upstream

| Dimension | Upstream (gemini-cli) | LLxprt |
|---|---|---|
| Auth identity | `AuthType` enum (`oauth`, `api-key`, …) | Profile name (string) |
| Method parsing | `z.nativeEnum(AuthType).parse(methodId)` | `parseZedAuthMethodId(methodId, availableProfiles)` |
| Auth entry point | `this.config.refreshAuth(method)` | `loadProfileByName(profileName)` |
| Current-auth source | `this.settings.merged.security?.auth?.selectedType` | `getActiveProfileName()` from `runtimeSettings.ts` |
| Credential cache | Single `clearCachedCredentialFile()` | Same function, same file |

## Dependency Verification

| Dependency | Location | Status |
|------------|----------|--------|
| `clearCachedCredentialFile` | `@vybestack/llxprt-code-core` — already imported in `zedIntegration.ts` | OK |
| `loadProfileByName` | `../runtime/runtimeSettings.js` — already imported in `zedIntegration.ts` | OK |
| `getActiveProfileName` | `../runtime/runtimeSettings.ts` line 1323 — **NOT yet imported** | MUST ADD |
| `parseZedAuthMethodId` | `zedIntegration.ts` local or imported — already present | OK |

## Type/Interface Verification

| Type Name | Expected Definition | Status |
|-----------|---------------------|--------|
| `getActiveProfileName()` return | `string \| null` — reads from `settingsService.getCurrentProfileName()` or `settingsService.get('currentProfile')` | VERIFIED |
| `loadProfileByName(profileName)` | `async (profileName: string) => ProfileLoadResult`; calls `applyProfileSnapshot` which updates `settingsService` synchronously | VERIFIED |
| `profileManager.listProfiles()` | `Promise<string[]>` — used by `parseZedAuthMethodId` | VERIFIED |

## Call Path Verification

| Function | Caller | Evidence |
|----------|--------|----------|
| `getActiveProfileName` | Must be called in `authenticate` BEFORE `loadProfileByName` | Reads pre-load state; `applyProfileSnapshot` inside `loadProfileByName` updates the value synchronously |
| `clearCachedCredentialFile` | Conditionally called in `authenticate` | Only clears OAuth2 Gemini credential cache file; provider SDK caches unaffected |

## LLxprt Invalidation Policy Decision

**Policy:** Clear `clearCachedCredentialFile()` if and only if:
1. There is an active profile (`getActiveProfileName()` returns non-null), AND
2. The active profile name differs from the requested profile name (`currentProfile !== profileName`).

**Mapping rationale:** Upstream keys on auth-method identity; LLxprt's closest analogue is profile
name identity. A distinct profile implies distinct auth method and/or account. The mapping is
conservative: may clear unnecessarily (two profiles, same account) but will never fail to clear
when needed (different profiles always get clean credential state).

## Credential Cache Scope

`clearCachedCredentialFile()` (defined in `packages/core/src/code_assist/oauth2.ts`) clears only
the single OAuth2 credential cache file used for Gemini/Google auth. Provider SDKs that manage
their own token stores (OpenAI, Anthropic) are unaffected — their credentials are held in
profile-level API key settings applied via `applyRuntimeProviderOverrides()`.

## Non-Zed Auth Path Audit

- `nonInteractiveCli.ts`: calls `config.refreshAuth()` directly — no `clearCachedCredentialFile` involved
- `ui/hooks/useProfileManagement.ts`: calls `loadProfileByName()` directly — no `clearCachedCredentialFile` involved
- `auth/oauth-manager.ts`: manages cache internally — not affected by this change

## Test Infrastructure Verification

| Component | Test File | Status |
|-----------|-----------|--------|
| `parseZedAuthMethodId` | `packages/cli/src/zed-integration/zedIntegration.test.ts` | EXISTS — 3 existing tests |
| `GeminiAgent.authenticate` | `packages/cli/src/zed-integration/zedIntegration.test.ts` | PARTIAL — mock scaffolding for `authenticate` must be added |

## Blocking Issues Found

1. `getActiveProfileName` not yet imported in `zedIntegration.ts` — must be added in P03
2. New mock scaffolding for `GeminiAgent.authenticate` required in P02 before behavioral tests can be written

## Verification Gate

- [ ] All dependencies verified (table above complete)
- [ ] All types match expectations
- [ ] All call paths are possible (read-before-write ordering confirmed)
- [ ] Test infrastructure status assessed

IF ANY CHECKBOX IS UNCHECKED: STOP and update plan before proceeding to P02.

## Success Criteria

- P01 checklist fully filled in with verified evidence
- No open questions about imports, types, or call ordering

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

---

# Phase P02: TDD — Write Failing Tests

## Phase ID

`PLAN-20250219-GMERGE021.R8.P02`

## Prerequisites

- Required: Phase P01 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R8.P01" packages/cli/src/zed-integration/`
- Expected from P01: Preflight checklist complete, no blocking issues unresolved

## Requirements Implemented (Expanded)

### REQ-3DA4-001: Conditional Credential Cache Clearing

**Full Text**: The `authenticate` ACP method MUST clear the credential cache only when the requested
profile differs from the currently active profile; it MUST NOT clear the cache when re-authenticating
with the already-active profile.

**Behavior**:
- GIVEN: An ACP client sends an `authenticate` request
- WHEN: The requested profile name equals the currently active profile name
- THEN: `clearCachedCredentialFile` is NOT called, and `loadProfileByName` IS called

- GIVEN: An ACP client sends an `authenticate` request
- WHEN: The requested profile name differs from the currently active profile name
- THEN: `clearCachedCredentialFile` IS called exactly once before `loadProfileByName`

- GIVEN: No profile is currently active (first authentication)
- WHEN: Any `authenticate` request arrives
- THEN: `clearCachedCredentialFile` is NOT called (cache is empty; no credentials to evict)

**Why This Matters**: Every re-authentication was unconditionally clearing the credential cache, even
when re-authenticating with the same method/profile. This forced a full re-authentication flow
unnecessarily when existing credentials were valid and reusable.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/zed-integration/zedIntegration.test.ts`
  - ADD unit tests T1–T8 for `GeminiAgent.authenticate` method behavior
  - ADD mock scaffolding for `getActiveProfileName`, `loadProfileByName`, `clearCachedCredentialFile`
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R8.P02`
  - Implements: `@requirement:REQ-3DA4-001`

### Required Code Markers

Every test MUST include:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R8.P02
 * @requirement REQ-3DA4-001
 */
```

### Test Matrix

| # | Scenario | Active profile | Requested profile | `clearCachedCredentialFile` called? | `loadProfileByName` called? |
|---|---|---|---|---|---|
| T1 | First auth — no active profile | `null` | `"alpha"` | No | Yes, with `"alpha"` |
| T2 | Same-profile re-auth | `"alpha"` | `"alpha"` | No | Yes, with `"alpha"` |
| T3 | Profile switch | `"alpha"` | `"beta"` | Yes, once | Yes, with `"beta"` |
| T4 | Empty-string active profile | `""` | `"alpha"` | Yes (`""` is non-null and `"" !== "alpha"`) | Yes, with `"alpha"` |
| T5 | Malformed methodId (parse failure) | `"alpha"` | _(invalid)_ | No | No |
| T6 | No profiles available (parse failure) | `"alpha"` | any | No | No |
| T7 | `clearCachedCredentialFile` throws | `"alpha"` | `"beta"` | Yes (throws) | No |
| T8 | `loadProfileByName` throws | `null` | `"alpha"` | No | Yes (throws) |

### Concrete Test Structure

```typescript
describe('GeminiAgent.authenticate — credential cache invalidation', () => {
  // Mock setup:
  // vi.mock('../runtime/runtimeSettings.js', ...) for getActiveProfileName, loadProfileByName
  // vi.mock('@vybestack/llxprt-code-core', ...) for clearCachedCredentialFile
  // Stub: profileManager.listProfiles() returns ['alpha', 'beta']

  it('T1: does not clear cache on first authentication (no active profile) @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockGetActiveProfileName.mockReturnValue(null);
    await agent.authenticate({ methodId: 'alpha' });
    expect(mockClearCachedCredentialFile).not.toHaveBeenCalled();
    expect(mockLoadProfileByName).toHaveBeenCalledWith('alpha');
  });

  it('T2: does not clear cache when re-authenticating with same profile @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockGetActiveProfileName.mockReturnValue('alpha');
    await agent.authenticate({ methodId: 'alpha' });
    expect(mockClearCachedCredentialFile).not.toHaveBeenCalled();
    expect(mockLoadProfileByName).toHaveBeenCalledWith('alpha');
  });

  it('T3: clears cache exactly once when switching profiles @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockGetActiveProfileName.mockReturnValue('alpha');
    await agent.authenticate({ methodId: 'beta' });
    expect(mockClearCachedCredentialFile).toHaveBeenCalledTimes(1);
    expect(mockLoadProfileByName).toHaveBeenCalledWith('beta');
  });

  it('T4: clears cache when active profile is empty string and differs from requested @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockGetActiveProfileName.mockReturnValue('');
    await agent.authenticate({ methodId: 'alpha' });
    expect(mockClearCachedCredentialFile).toHaveBeenCalledTimes(1);
    expect(mockLoadProfileByName).toHaveBeenCalledWith('alpha');
  });

  it('T5: does not clear cache when methodId is invalid (parse fails) @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockGetActiveProfileName.mockReturnValue('alpha');
    await expect(agent.authenticate({ methodId: 'nonexistent' })).rejects.toThrow();
    expect(mockClearCachedCredentialFile).not.toHaveBeenCalled();
    expect(mockLoadProfileByName).not.toHaveBeenCalled();
  });

  it('T6: does not clear cache when no profiles available and parse fails @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockListProfiles.mockResolvedValue([]);
    mockGetActiveProfileName.mockReturnValue('alpha');
    await expect(agent.authenticate({ methodId: 'alpha' })).rejects.toThrow();
    expect(mockClearCachedCredentialFile).not.toHaveBeenCalled();
  });

  it('T7: propagates error from clearCachedCredentialFile without calling loadProfileByName @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockGetActiveProfileName.mockReturnValue('alpha');
    mockClearCachedCredentialFile.mockRejectedValue(new Error('disk error'));
    await expect(agent.authenticate({ methodId: 'beta' })).rejects.toThrow('disk error');
    expect(mockLoadProfileByName).not.toHaveBeenCalled();
  });

  it('T8: propagates error from loadProfileByName @plan:PLAN-20250219-GMERGE021.R8.P02 @requirement:REQ-3DA4-001', async () => {
    mockGetActiveProfileName.mockReturnValue(null);
    mockLoadProfileByName.mockRejectedValue(new Error('profile not found'));
    await expect(agent.authenticate({ methodId: 'alpha' })).rejects.toThrow('profile not found');
  });
});
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Confirm plan markers added
grep -r "@plan:PLAN-20250219-GMERGE021.R8.P02" packages/cli/src/zed-integration/ | wc -l
# Expected: 8+ occurrences (one per test)

# Confirm requirement markers
grep -r "@requirement:REQ-3DA4-001" packages/cli/src/zed-integration/ | wc -l
# Expected: 8+ occurrences

# Run new tests — they MUST FAIL (implementation not yet changed)
npm run test -- --testPathPattern=zedIntegration
# Expected: T1, T2 FAIL (unconditional clear); T3 PASS; T5, T7, T8 may pass already
```

### Structural Verification Checklist

- [ ] All 8 tests (T1–T8) added to `zedIntegration.test.ts`
- [ ] Mock scaffolding for `getActiveProfileName`, `loadProfileByName`, `clearCachedCredentialFile` in place
- [ ] Plan markers present on all tests
- [ ] Tests FAIL (not error on "cannot find") — confirms test infrastructure works
- [ ] Existing 3 `parseZedAuthMethodId` tests still pass

## Success Criteria

- 8 new tests created and tagged with P02 marker
- Tests for T1 and T2 fail (proving the current code is wrong)
- Test T3 passes already (existing code clears on switch — but now conditionally asserted)
- No compilation errors in test file

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/zed-integration/zedIntegration.test.ts`
2. Re-examine mock scaffolding setup against existing test patterns in the file
3. Cannot proceed to P03 until at least T1 and T2 fail for the right reason

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

---

# Phase P03: Implementation

## Phase ID

`PLAN-20250219-GMERGE021.R8.P03`

## Prerequisites

- Required: Phase P02 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R8.P02" packages/cli/src/zed-integration/`
- Expected from P02: Tests T1–T8 exist; T1 and T2 failing with wrong (unconditional) behavior
- Preflight verification: Phase P01 MUST be completed before this phase

## Requirements Implemented (Expanded)

### REQ-3DA4-001: Conditional Credential Cache Clearing

**Full Text**: See P02. Implementation phase.

**Behavior**:
- GIVEN: Any `authenticate` call
- WHEN: Checking whether to clear credentials
- THEN: Apply the condition: `currentProfile !== null && currentProfile !== profileName`

## Implementation Tasks

### Files to Modify

- `packages/cli/src/zed-integration/zedIntegration.ts`
  - ADD `getActiveProfileName` to import from `../runtime/runtimeSettings.js`
  - REPLACE unconditional `await clearCachedCredentialFile()` with conditional block
  - ADD plan marker comment
  - Implements: `@requirement:REQ-3DA4-001`

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R8.P03
 * @requirement REQ-3DA4-001
 */
```

### Change 1 — Add import

```typescript
// In packages/cli/src/zed-integration/zedIntegration.ts
// Existing import block from runtimeSettings.js — add getActiveProfileName:
import {
  setCliRuntimeContext,
  switchActiveProvider,
  setActiveModelParam,
  clearActiveModelParam,
  getActiveModelParams,
  loadProfileByName,
  getActiveProfileName,          // ADD THIS
} from '../runtime/runtimeSettings.js';
```

### Change 2 — Modify `authenticate` method

```typescript
async authenticate({ methodId }: acp.AuthenticateRequest): Promise<void> {
  const profileManager = this.config.getProfileManager();
  const availableProfiles = profileManager
    ? await profileManager.listProfiles()
    : [];
  const profileName = parseZedAuthMethodId(methodId, availableProfiles);

  /**
   * Only clear cached credentials when switching to a different profile.
   * Re-authenticating with the already-active profile reuses existing credentials.
   * @plan PLAN-20250219-GMERGE021.R8.P03
   * @requirement REQ-3DA4-001
   */
  const currentProfile = getActiveProfileName();
  if (currentProfile !== null && currentProfile !== profileName) {
    await clearCachedCredentialFile();
  }

  await loadProfileByName(profileName);
  await this.applyRuntimeProviderOverrides();
}
```

### Observability Addition (Optional but Recommended)

```typescript
this.logger.debug(() =>
  `[authenticate] currentProfile=${currentProfile}, requestedProfile=${profileName}, clearing=${currentProfile !== null && currentProfile !== profileName}`
);
```

### Implementation Rationale for Each Condition

| Condition | Behavior | Reason |
|---|---|---|
| No active profile — `null` (first auth) | Do NOT clear | Cache is already empty; no credentials to evict |
| Same profile re-auth | Do NOT clear | Matches upstream intent: reuse valid credentials |
| Different profile | CLEAR | Different profile implies different identity; credential cache must be reset |
| Parse failure (throws before guard) | No state mutation | Exception propagates; safe path |

### No Circular Dependency Risk

`runtimeSettings.ts` already exports `loadProfileByName` which is already imported.
`getActiveProfileName` is in the same file; adding it to the import list introduces no new module dependency.

## Verification Commands

### Automated Checks

```bash
# Confirm import added
grep "getActiveProfileName" packages/cli/src/zed-integration/zedIntegration.ts
# Expected: appears in both import and usage

# Confirm plan markers
grep -r "@plan:PLAN-20250219-GMERGE021.R8.P03" packages/cli/src/zed-integration/ | wc -l
# Expected: 1+ occurrences

# Run tests — ALL T1–T8 MUST NOW PASS
npm run test -- --testPathPattern=zedIntegration
# Expected: All pass, including T1 and T2
```

### Deferred Implementation Detection (MANDATORY)

```bash
# Check for TODO/FIXME left in implementation
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY|TEMP|WIP)" packages/cli/src/zed-integration/zedIntegration.ts | grep -v ".test.ts"
# Expected: No matches

# Check for empty/trivial implementations
grep -rn -E "return \[\]|return \{\}|return null|return undefined" packages/cli/src/zed-integration/zedIntegration.ts | grep -v ".test.ts"
# Expected: No matches in authenticate method
```

### Structural Verification Checklist

- [ ] `getActiveProfileName` added to import from `../runtime/runtimeSettings.js`
- [ ] Unconditional `await clearCachedCredentialFile()` replaced with conditional block
- [ ] Plan and requirement markers present
- [ ] No `TODO` or `FIXME` left in modified code
- [ ] TypeScript compilation succeeds (`npm run typecheck`)

### Semantic Verification Checklist (MANDATORY)

#### Behavioral Verification Questions

1. **Does the code DO what the requirement says?**
   - [ ] I read REQ-3DA4-001 in full
   - [ ] I read the `authenticate` method implementation after the change
   - [ ] I can trace: `null` active profile → no clear → `loadProfileByName` called
   - [ ] I can trace: same profile → no clear → `loadProfileByName` called
   - [ ] I can trace: different profile → `clearCachedCredentialFile` called → `loadProfileByName` called

2. **Is this REAL implementation, not placeholder?**
   - [ ] Deferred implementation detection passed
   - [ ] No empty returns in authenticate
   - [ ] No "will be implemented" comments

3. **Would the test FAIL if implementation was removed?**
   - [ ] T1 verifies `clearCachedCredentialFile` NOT called when `currentProfile === null`
   - [ ] T2 verifies `clearCachedCredentialFile` NOT called when `currentProfile === profileName`
   - [ ] T3 verifies `clearCachedCredentialFile` called once when profiles differ

4. **Is the feature REACHABLE by users?**
   - [ ] Zed ACP clients send `authenticate` requests which invoke this method
   - [ ] `setCliRuntimeContext` is called at startup before any `authenticate` call

5. **What's MISSING?** (fill before proceeding)
   - [ ] [gap 1]
   - [ ] [gap 2]

#### Edge Cases Verified

- [ ] `getActiveProfileName()` returns `null` on first auth (no active profile): cache NOT cleared [OK]
- [ ] `getActiveProfileName()` returns `""` (empty string, non-null): cache cleared when `"" !== profileName` [OK]
- [ ] `parseZedAuthMethodId` throws before the guard: no state mutation [OK]
- [ ] `clearCachedCredentialFile` throws: exception propagates; `loadProfileByName` not called [OK]
- [ ] `loadProfileByName` throws: profile state may be partially updated (pre-existing behavior, no regression) [OK]

#### Lifecycle Verified

- [ ] `getActiveProfileName()` is read BEFORE `loadProfileByName()` (reads pre-load state)
- [ ] `applyProfileSnapshot` inside `loadProfileByName` updates `settingsService` synchronously after the guard
- [ ] No race conditions within single async function execution (Node.js single-threaded)

#### Concurrent / Overlapping Calls

Two concurrent ACP `authenticate` requests could interleave at `await` boundaries (pre-existing
concern; not introduced by this change). No locking added — matches upstream fix approach. Risk
is low: Zed sends authenticate calls sequentially before creating sessions.

## Success Criteria

- All T1–T8 tests pass
- `npm run typecheck` passes
- Conditional block replaces unconditional clear
- `getActiveProfileName` correctly imported

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/zed-integration/zedIntegration.ts`
2. Re-examine the import block for syntax errors
3. Re-examine the conditional logic against the test matrix
4. Cannot proceed to P04 until all T1–T8 pass

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase P04: Full Verification Suite

## Phase ID

`PLAN-20250219-GMERGE021.R8.P04`

## Prerequisites

- Required: Phase P03 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R8.P03" packages/cli/src/zed-integration/`
- Expected from P03: All T1–T8 pass; `zedIntegration.ts` conditionally clears credential cache

## Implementation Tasks

No new code changes in this phase. Run the full project verification suite and fix any issues found.

## Verification Commands

```bash
# 1. Full test suite
npm run test
# Expected: All tests pass (zero failures)

# 2. TypeScript type checking
npm run typecheck
# Expected: Zero errors

# 3. Linting
npm run lint
# Expected: Zero warnings/errors

# 4. Formatting
npm run format
# Expected: No formatting changes required (or apply and re-verify)

# 5. Build
npm run build
# Expected: Successful build output

# 6. Smoke test
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
# Expected: Haiku produced; no errors related to zedIntegration or auth
```

### Structural Verification Checklist

- [ ] `npm run test` — zero failures
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run format` — no uncommitted changes after running
- [ ] `npm run build` — succeeds
- [ ] Haiku smoke test — succeeds

### Semantic Verification Checklist

- [ ] No test failures introduced by the P03 change
- [ ] `getActiveProfileName` import does not cause circular dependency (build succeeds)
- [ ] Conditional guard does not affect existing `parseZedAuthMethodId` tests (they still pass)

## Success Criteria

- All six verification commands pass without errors
- No regressions in existing test suite
- Build artifacts produced successfully

## Failure Recovery

If any verification command fails:

1. Identify the failing command output
2. Return to P03 and fix the implementation or test
3. Re-run ALL six verification commands before marking P04 complete

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

---

# Phase P05: File Changes Summary and Rollback Notes

## Phase ID

`PLAN-20250219-GMERGE021.R8.P05`

## Prerequisites

- Required: Phase P04 completed
- Verification: All six verification commands from P04 pass

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/zed-integration/zedIntegration.ts` | Modify | Add `getActiveProfileName` import; replace unconditional `clearCachedCredentialFile()` with profile-identity conditional |
| `packages/cli/src/zed-integration/zedIntegration.test.ts` | Modify | Add unit tests T1–T8 for `authenticate` method behavior |

## Prerequisite Assessment (Final)

| Dependency | Status | Reason |
|---|---|---|
| `getActiveProfileName()` correctness | [OK] Verified | Reads from `settingsService` registered at startup; updated synchronously by `loadProfileByName` |
| `parseZedAuthMethodId` stability | [OK] Verified | Throws on invalid input before any state mutation; parse-failure path is safe |
| Test infrastructure for Zed auth path | [OK] Added in P02 | Mock scaffolding for `GeminiAgent.authenticate` added |
| `clearCachedCredentialFile` scope | [OK] Verified | Only affects OAuth2 Gemini cache; provider SDK caches unaffected |
| Prior commits intentionally making clear unconditional | Not found | No prior LLxprt commit found that intentionally reverted conditional clearing; the unconditional clear appears to be a carry-over |

## Backward Compatibility Note

Existing code always cleared credentials. Some Zed/ACP workflows may have relied on unconditional
clearing to force re-authentication on every `authenticate` call. The behavioral contract is
changing: same-profile repeated auth calls will now reuse credentials instead of prompting re-auth.
This is the intended fix per upstream intent. Callers that expected forced re-auth will get
silently different behavior — this is acceptable and expected per the upstream fix.

## Rollback Instructions

Rollback is trivial — the change is a single conditional guard:

```bash
git revert HEAD  # if committed as a single commit
# or:
git checkout -- packages/cli/src/zed-integration/zedIntegration.ts
# Restores unconditional: await clearCachedCredentialFile();
```

If Zed users report repeated re-auth prompts after this change (suggesting the fix is not working):
1. Check that `setCliRuntimeContext` is being called before `authenticate`
2. Check that `settingsService` correctly exposes `getCurrentProfileName`
3. Enable debug logging to trace the `[authenticate]` decision line

## Observability Note

Debug logging added in P03 (optional) allows production diagnosis:
```typescript
this.logger.debug(() =>
  `[authenticate] currentProfile=${currentProfile}, requestedProfile=${profileName}, clearing=${currentProfile !== null && currentProfile !== profileName}`
);
```

## Execution Tracker

| Phase | ID | Status | Description |
|-------|----|--------|-------------|
| P01 | P01 | ⬜ | Preflight verification |
| P02 | P02 | ⬜ | Write failing tests (T1–T8) |
| P03 | P03 | ⬜ | Implement conditional credential clearing |
| P04 | P04 | ⬜ | Full verification suite |
| P05 | P05 | ⬜ | Summary and rollback notes |

## Success Criteria

- All phases P01–P04 have `.completed/P0N.md` marker files
- `@plan:PLAN-20250219-GMERGE021.R8.P02` markers present in test file (8+ occurrences)
- `@plan:PLAN-20250219-GMERGE021.R8.P03` markers present in implementation file
- Full verification suite passes (confirmed in P04)

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

Contents:
```markdown
Phase: P05
Completed: YYYY-MM-DD HH:MM
Files Modified:
  - packages/cli/src/zed-integration/zedIntegration.ts (import + 5-line conditional)
  - packages/cli/src/zed-integration/zedIntegration.test.ts (8 new tests)
Tests Added: 8 (T1–T8 for authenticate method)
Verification: All six commands in P04 pass
```
