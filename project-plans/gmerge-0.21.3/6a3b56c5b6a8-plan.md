# Plan: Reimplementation of Upstream Commit 6f3b56c5b (v0.21.3) — Retry Logic

Plan ID: PLAN-20250219-GMERGE021.R12
Generated: 2025-02-19
Total Phases: 5
Requirements: REQ-R12-001 (ENOTFOUND retry), REQ-R12-002 (retryFetchErrors parity), REQ-R12-003 (case-insensitive fetch failed)

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P00 — Preflight)
2. Verified `TRANSIENT_ERROR_CODES` current contents against upstream `RETRYABLE_NETWORK_CODES`
3. Written failing tests BEFORE adding `ENOTFOUND` to the set
4. Verified all dependencies and types exist as assumed

---

## Commit Information

- **Upstream Commit**: 6f3b56c5b6a8
- **Title**: fix: improve retry logic for fetch errors and network codes (#14439)
- **Author**: Megha Bansal (Google)
- **Date**: December 4, 2025
- **Files Changed**: `packages/core/src/utils/retry.ts`, `packages/core/src/utils/retry.test.ts`

---

## Execution Tracker

| Phase  | ID   | Status | Started | Completed | Verified | Semantic? | Notes                            |
|--------|------|--------|---------|-----------|----------|-----------|----------------------------------|
| P00    | P00  | [ ]    | -       | -         | -        | N/A       | Preflight verification           |
| P01    | P01  | [ ]    | -       | -         | -        | N/A       | Failing tests (TDD red)          |
| P02    | P02  | [ ]    | -       | -         | [ ]      | [ ]       | Implementation (TDD green)       |
| P03    | P03  | [ ]    | -       | -         | [ ]      | [ ]       | Documentation comment            |
| P04    | P04  | [ ]    | -       | -         | [ ]      | [ ]       | Full verification suite          |

---

# Phase P00: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R12.P00`

## Purpose

Verify ALL assumptions in the analysis before writing any code.

## Dependency Verification

| Dependency | Check Command | Status |
|------------|---------------|--------|
| `retry.ts` exists at expected path | `ls packages/core/src/utils/retry.ts` | OK |
| `retry.test.ts` exists at expected path | `ls packages/core/src/utils/retry.test.ts` | OK |
| Vitest available | `npm ls vitest` | OK |

## Type/Interface Verification

| Symbol | Expected Location | Actual Location | Match? |
|--------|-------------------|-----------------|--------|
| `TRANSIENT_ERROR_CODES` | `retry.ts` lines ~60–74 | grep output | YES/NO |
| `retryFetchErrors` in `RetryOptions` | `retry.ts` line ~25 | grep output | YES/NO |
| `collectErrorDetails()` | `retry.ts` lines ~77–117 | grep output | YES/NO |
| `isNetworkTransientError()` | `retry.ts` | grep output | YES/NO |
| `defaultShouldRetry()` | `retry.ts` | grep output | YES/NO |

## TRANSIENT_ERROR_CODES Current Membership

Run: `grep -A 20 'TRANSIENT_ERROR_CODES' packages/core/src/utils/retry.ts`

Expected to contain: `ECONNRESET`, `ECONNREFUSED`, `ECONNABORTED`, `ENETUNREACH`, `EHOSTUNREACH`, `ETIMEDOUT`, `EPIPE`, `EAI_AGAIN`, `UND_ERR_SOCKET`, `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT`, `UND_ERR_BODY_TIMEOUT`

Expected to be **absent**: `ENOTFOUND` (this is the gap being fixed)

## Call Path Verification

| Function | Expected Caller | Check Command |
|----------|-----------------|---------------|
| `isNetworkTransientError()` | `defaultShouldRetry()` | `grep -n 'isNetworkTransientError' packages/core/src/utils/retry.ts` |
| `collectErrorDetails()` | `isNetworkTransientError()` | `grep -n 'collectErrorDetails' packages/core/src/utils/retry.ts` |
| `defaultShouldRetry()` | `retryWithBackoff()` | `grep -n 'defaultShouldRetry' packages/core/src/utils/retry.ts` |

## Existing Test Structure Verification

```bash
grep -n "describe\|it(" packages/core/src/utils/retry.test.ts | head -60
```

Expected: a `describe('network transient errors')` block (or equivalent) where new tests will be added.

## Blocking Issues Found

- [ ] If `ENOTFOUND` is already present in `TRANSIENT_ERROR_CODES` → no code change needed (tests only)
- [ ] If `collectErrorDetails()` does not traverse `.cause` → broader fix needed before tests
- [ ] If `retryFetchErrors` field does not exist in `RetryOptions` → type parity check needed

## Verification Gate

- [ ] All dependencies verified present
- [ ] `ENOTFOUND` confirmed absent from `TRANSIENT_ERROR_CODES`
- [ ] All call paths confirmed possible by grep evidence
- [ ] Test infrastructure (vitest fake timers) confirmed working in existing suite

**IF ANY CHECKBOX IS UNCHECKED: STOP and update plan before proceeding.**

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P00.md`

---

# Phase P01: Failing Tests (TDD Red)

## Phase ID

`PLAN-20250219-GMERGE021.R12.P01`

## Prerequisites

- Required: Phase P00 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P00.md` exists
- Expected from P00: confirmed `ENOTFOUND` absent from `TRANSIENT_ERROR_CODES`
- Preflight verification: Phase P00 MUST be completed before this phase

## Requirements Implemented (Expanded)

### REQ-R12-001: ENOTFOUND Retry Coverage

**Full Text**: DNS resolution failure (`ENOTFOUND`) MUST be treated as a retryable network error, matching upstream v0.21.3 behavior.

**Behavior**:
- GIVEN: A function throws an `Error` with `.code === 'ENOTFOUND'`
- WHEN: `retryWithBackoff` evaluates whether to retry
- THEN: The error is classified as transient and the call is retried

**Why This Matters**: DNS lookup failures can be transient (temporary DNS server unreachability); not retrying causes unnecessary failures that would succeed on the next attempt.

### REQ-R12-002: retryFetchErrors Intentional Divergence

**Full Text**: LLxprt MUST document and test that `retryFetchErrors` is accepted but has no functional effect — network errors are always retried regardless of this flag.

**Behavior**:
- GIVEN: A caller passes `retryFetchErrors: false` to `retryWithBackoff`
- WHEN: A `fetch failed` error is thrown
- THEN: The error is still retried (LLxprt multi-provider default)

**Why This Matters**: Upstream gates this behavior behind a flag for single-provider use; LLxprt serves multiple providers and must always retry network errors for resilience.

### REQ-R12-003: Case-Insensitive Fetch Failed Detection

**Full Text**: The phrase `"fetch failed"` in error messages MUST be matched case-insensitively, covering all casing variants.

**Behavior**:
- GIVEN: An error message is `"Fetch Failed"` or `"FETCH FAILED: network request aborted"`
- WHEN: `isNetworkTransientError` evaluates the error
- THEN: It returns `true` and the error is retried

**Why This Matters**: Different runtime environments (Node, Deno, browsers) may capitalise error messages differently.

## Implementation Tasks

### Files to Modify

- `packages/core/src/utils/retry.test.ts`
  - Add the following 7 tests inside the existing network transient errors describe block
  - ADD marker: `@plan:PLAN-20250219-GMERGE021.R12.P01`

### Tests to Add

All new tests go inside the existing `describe('network transient errors')` block (or equivalent).

#### Test 1 — ENOTFOUND direct code (will FAIL until P02)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-001
 */
it('should retry on ENOTFOUND error code', async () => {
  let attempts = 0;
  const mockFn = vi.fn(async () => {
    attempts++;
    if (attempts === 1) {
      const error = Object.assign(new Error('getaddrinfo ENOTFOUND api.example.com'), {
        code: 'ENOTFOUND',
      });
      throw error;
    }
    return 'success';
  });
  const promise = retryWithBackoff(mockFn, { maxAttempts: 3, initialDelayMs: 10 });
  await vi.runAllTimersAsync();
  await expect(promise).resolves.toBe('success');
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

#### Test 2 — ENOTFOUND in cause chain (will FAIL until P02)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-001
 */
it('should retry on ENOTFOUND in error cause chain', async () => {
  let attempts = 0;
  const mockFn = vi.fn(async () => {
    attempts++;
    if (attempts === 1) {
      const cause = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
      const error = new Error('fetch failed');
      (error as { cause?: unknown }).cause = cause;
      throw error;
    }
    return 'success';
  });
  const promise = retryWithBackoff(mockFn, { maxAttempts: 3, initialDelayMs: 10 });
  await vi.runAllTimersAsync();
  await expect(promise).resolves.toBe('success');
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

#### Test 3 — Mixed-case "Fetch Failed" (should PASS already; confirms existing behavior)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-003
 */
it('should retry on "Fetch Failed" (mixed case) error message', async () => {
  let attempts = 0;
  const mockFn = vi.fn(async () => {
    attempts++;
    if (attempts === 1) throw new Error('Fetch Failed');
    return 'success';
  });
  const promise = retryWithBackoff(mockFn, { maxAttempts: 3, initialDelayMs: 10 });
  await vi.runAllTimersAsync();
  await expect(promise).resolves.toBe('success');
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

#### Test 4 — Uppercase "FETCH FAILED" (should PASS already)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-003
 */
it('should retry on "FETCH FAILED" (uppercase) error message', async () => {
  let attempts = 0;
  const mockFn = vi.fn(async () => {
    attempts++;
    if (attempts === 1) throw new Error('FETCH FAILED: network request aborted');
    return 'success';
  });
  const promise = retryWithBackoff(mockFn, { maxAttempts: 3, initialDelayMs: 10 });
  await vi.runAllTimersAsync();
  await expect(promise).resolves.toBe('success');
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

#### Test 5 — retryFetchErrors is a no-op (should PASS already)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-002
 */
it('should retry network errors regardless of retryFetchErrors value', async () => {
  // LLxprt intentional divergence: retryFetchErrors is a no-op;
  // network errors are always retried.
  for (const retryFetchErrors of [false, true, undefined] as const) {
    let attempts = 0;
    const mockFn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) throw new Error('fetch failed');
      return 'success';
    });
    const promise = retryWithBackoff(mockFn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      retryFetchErrors,
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
    vi.clearAllMocks();
  }
});
```

#### Test 6 — Negative control: permanent errors should not retry (should PASS already)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-001
 */
it('should not retry on a plain non-network error message', async () => {
  const mockFn = vi.fn(async () => {
    throw new Error('invalid API key provided');
  });
  const promise = retryWithBackoff(mockFn, { maxAttempts: 3, initialDelayMs: 10 });
  await expect(promise).rejects.toThrow('invalid API key provided');
  expect(mockFn).toHaveBeenCalledTimes(1);
});
```

#### Test 7 — Deep cause chain (should PASS already)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-001
 */
it('should retry when ECONNRESET appears deep in a cause chain', async () => {
  let attempts = 0;
  const mockFn = vi.fn(async () => {
    attempts++;
    if (attempts === 1) {
      const root = Object.assign(new Error('root cause'), { code: 'ECONNRESET' });
      const mid = new Error('mid-level wrapper');
      (mid as { cause?: unknown }).cause = root;
      const top = new Error('top-level wrapper');
      (top as { cause?: unknown }).cause = mid;
      throw top;
    }
    return 'success';
  });
  const promise = retryWithBackoff(mockFn, { maxAttempts: 3, initialDelayMs: 10 });
  await vi.runAllTimersAsync();
  await expect(promise).resolves.toBe('success');
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

#### Test 8 — Cyclic cause chain (should PASS already)

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P01
 * @requirement REQ-R12-001
 */
it('should not hang on cyclic error causes', async () => {
  const mockFn = vi.fn(async () => {
    const a = new Error('error a') as Error & { cause?: unknown };
    const b = new Error('error b') as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a; // cycle
    throw a;
  });
  const promise = retryWithBackoff(mockFn, { maxAttempts: 2, initialDelayMs: 10 });
  await vi.runAllTimersAsync();
  // Neither error is transient — should throw without hanging
  await expect(promise).rejects.toThrow('error a');
  expect(mockFn).toHaveBeenCalledTimes(1);
});
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Confirm plan markers present in test file
grep -n "@plan:PLAN-20250219-GMERGE021.R12.P01" packages/core/src/utils/retry.test.ts | wc -l
# Expected: 8 occurrences (one per test)

# Confirm requirement markers present
grep -n "@requirement:REQ-R12-001" packages/core/src/utils/retry.test.ts | wc -l
# Expected: 6 occurrences

grep -n "@requirement:REQ-R12-002" packages/core/src/utils/retry.test.ts | wc -l
# Expected: 1 occurrence

grep -n "@requirement:REQ-R12-003" packages/core/src/utils/retry.test.ts | wc -l
# Expected: 2 occurrences
```

### Run Tests — Confirm Red for ENOTFOUND Tests

```bash
cd packages/core && npx vitest run src/utils/retry.test.ts 2>&1 | tail -30
```

Expected: Tests 1 and 2 (ENOTFOUND) **fail**. Tests 3–8 **pass**. This confirms TDD discipline.

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX)" packages/core/src/utils/retry.test.ts
# Expected: No matches
```

### Structural Verification Checklist

- [ ] 8 new tests added to existing describe block
- [ ] All 8 tagged with `@plan:PLAN-20250219-GMERGE021.R12.P01`
- [ ] Tests 1–2 (ENOTFOUND) fail — confirms gap is real
- [ ] Tests 3–8 pass — confirms existing coverage is correct
- [ ] No TODO/FIXME/STUB left in test file

## Semantic Verification Checklist

1. **Does the test DO what the requirement says?**
   - [ ] Test 1 throws an error with `code: 'ENOTFOUND'` and asserts retry happens
   - [ ] Test 2 nests ENOTFOUND in `.cause` and asserts retry happens
   - [ ] Test 5 exercises `retryFetchErrors: false` and confirms network errors are still retried

2. **Would the test FAIL if implementation was removed?**
   - [ ] Tests 1–2 fail right now (before P02) — confirmed by running the suite

3. **What's MISSING before P02?**
   - [ ] `ENOTFOUND` is not yet in `TRANSIENT_ERROR_CODES` — expected and intentional

## Success Criteria

- 8 tests added, tagged with correct plan/requirement markers
- Tests 1–2 fail (ENOTFOUND not yet retried) — TDD red confirmed
- Tests 3–8 pass (existing behavior verified)

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/core/src/utils/retry.test.ts`
2. Re-read existing test structure and re-insert tests in correct describe block
3. Cannot proceed to Phase P02 until TDD red is confirmed

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

```markdown
Phase: P01
Completed: YYYY-MM-DD HH:MM
Files Modified: packages/core/src/utils/retry.test.ts (+8 tests)
Tests Added: 8
Verification: [paste output of vitest run showing tests 1-2 failing]
```

---

# Phase P02: Implementation — Add ENOTFOUND (TDD Green)

## Phase ID

`PLAN-20250219-GMERGE021.R12.P02`

## Prerequisites

- Required: Phase P01 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P01.md` exists
- Expected from P01: 2 failing ENOTFOUND tests confirmed
- Preflight verification: Phase P00 MUST be completed

## Requirements Implemented

### REQ-R12-001: ENOTFOUND Retry Coverage (Implementation)

**Full Text**: `ENOTFOUND` MUST be present in `TRANSIENT_ERROR_CODES` so DNS resolution failures are retried by default.

**Behavior**:
- GIVEN: `TRANSIENT_ERROR_CODES` contains `'ENOTFOUND'`
- WHEN: An error with `code: 'ENOTFOUND'` is thrown inside `retryWithBackoff`
- THEN: `collectErrorDetails()` finds the code, `isNetworkTransientError()` returns `true`, and the call is retried

**Why This Matters**: Without this, DNS lookup failures that would succeed on retry propagate as fatal errors.

## Implementation Tasks

### Files to Modify

- `packages/core/src/utils/retry.ts`
  - Locate `TRANSIENT_ERROR_CODES` Set definition
  - Add `'ENOTFOUND'` to the set with inline comment
  - ADD marker: `@plan:PLAN-20250219-GMERGE021.R12.P02`

### Required Change

Find `TRANSIENT_ERROR_CODES` and add `'ENOTFOUND'`:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P02
 * @requirement REQ-R12-001
 */
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'ENOTFOUND',           // upstream 6f3b56c5b6a8 coverage — DNS failures can be transient
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  STREAM_INTERRUPTED_ERROR_CODE,
]);
```

**Note**: Do NOT port upstream's `getNetworkErrorCode()` or `RETRYABLE_NETWORK_CODES`. LLxprt's `collectErrorDetails()` is a strict superset. The only change needed is adding `'ENOTFOUND'` to the existing set.

## Verification Commands

### Automated Checks (Structural)

```bash
# Confirm ENOTFOUND is now in the set
grep -n "ENOTFOUND" packages/core/src/utils/retry.ts
# Expected: 1 match inside TRANSIENT_ERROR_CODES

# Confirm plan marker present
grep -n "@plan:PLAN-20250219-GMERGE021.R12.P02" packages/core/src/utils/retry.ts
# Expected: 1+ occurrences
```

### Run Tests — Confirm Green

```bash
cd packages/core && npx vitest run src/utils/retry.test.ts 2>&1 | tail -20
```

Expected: ALL tests pass including the previously failing ENOTFOUND tests.

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX)" packages/core/src/utils/retry.ts | grep -v ".test.ts"
# Expected: No new matches introduced by this change
```

### Structural Verification Checklist

- [ ] `ENOTFOUND` present in `TRANSIENT_ERROR_CODES`
- [ ] Plan marker added to the Set definition
- [ ] All 8 tests now pass (both ENOTFOUND tests green)
- [ ] No other logic changes to `retry.ts` (minimal diff)

## Semantic Verification Checklist

1. **Does the code DO what the requirement says?**
   - [ ] `ENOTFOUND` is inside `TRANSIENT_ERROR_CODES` (verified by grep)
   - [ ] `isNetworkTransientError()` calls `collectErrorDetails()` which checks codes in this set
   - [ ] I traced: `ENOTFOUND` error → `collectErrorDetails()` → code found in set → `isNetworkTransientError()` returns `true` → `defaultShouldRetry()` returns `true`

2. **Is this REAL implementation, not placeholder?**
   - [ ] The code is a single string addition to an existing Set — no placeholder possible
   - [ ] ENOTFOUND tests pass (not just "no error" but actual retry count verified)

3. **Would the test FAIL if implementation was removed?**
   - [ ] Confirmed: removing `'ENOTFOUND'` causes tests 1–2 to fail (verified in P01)

4. **Is the feature REACHABLE by users?**
   - [ ] `TRANSIENT_ERROR_CODES` is used by `isNetworkTransientError()` which is called by `defaultShouldRetry()` which is the default retry predicate in `retryWithBackoff()`
   - [ ] All Gemini/provider calls go through `retryWithBackoff()` — confirmed reachable

5. **What's MISSING?**
   - [ ] None — this is the complete and only code change needed for REQ-R12-001

#### Feature Actually Works

```bash
# Run the specific new tests:
cd packages/core && npx vitest run src/utils/retry.test.ts -t "ENOTFOUND" 2>&1
# Expected: 2 tests pass
```

## Success Criteria

- `ENOTFOUND` added to `TRANSIENT_ERROR_CODES` with plan marker
- All 8 new tests pass
- No other changes to `retry.ts`
- `npm run typecheck` passes (no type errors introduced)

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/core/src/utils/retry.ts`
2. Re-examine `TRANSIENT_ERROR_CODES` structure — ensure adding to correct set
3. Cannot proceed to Phase P03 until all tests are green

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

```markdown
Phase: P02
Completed: YYYY-MM-DD HH:MM
Files Modified: packages/core/src/utils/retry.ts (+1 line in TRANSIENT_ERROR_CODES)
Tests Added: 0 (added in P01)
Tests Now Passing: +2 (ENOTFOUND tests)
Verification: [paste of vitest output showing all tests green]
```

---

# Phase P03: Documentation — retryFetchErrors Divergence Comment

## Phase ID

`PLAN-20250219-GMERGE021.R12.P03`

## Prerequisites

- Required: Phase P02 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P02.md` exists
- Expected from P02: all 8 tests passing, `ENOTFOUND` in set

## Requirements Implemented

### REQ-R12-002: retryFetchErrors Divergence (Documentation)

**Full Text**: The intentional divergence from upstream's `retryFetchErrors` flag behavior MUST be explicitly documented at the discard site in `retry.ts`.

**Behavior**:
- GIVEN: A developer reads the `retryFetchErrors` handling code in `retry.ts`
- WHEN: They see the discard (`void _retryFetchErrors`)
- THEN: A clear comment explains WHY it's discarded and documents the intentional divergence

**Why This Matters**: Without this comment, future maintainers may mistakenly "fix" the no-op by adding a conditional, breaking LLxprt's always-on network resilience across providers.

## Implementation Tasks

### Files to Modify

- `packages/core/src/utils/retry.ts`
  - Locate the `retryFetchErrors` discard site inside `retryWithBackoff()`
  - Replace or augment the existing comment with the full divergence rationale
  - ADD marker: `@plan:PLAN-20250219-GMERGE021.R12.P03`

### Required Change

Find the existing discard comment near:
```typescript
void _retryFetchErrors;
```

Replace with:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R12.P03
 * @requirement REQ-R12-002
 * Intentional divergence from upstream (6f3b56c5b6a8):
 * Upstream gates fetch/network-error retry behind retryFetchErrors === true.
 * LLxprt always retries transient network errors regardless of this flag because
 * it serves multiple providers (Anthropic, OpenAI, Vercel, Gemini, etc.) and
 * callers should not need to opt in to basic network resilience.
 * The field is kept in RetryOptions for API compatibility with callers that pass it.
 */
void _retryFetchErrors;
```

## Verification Commands

```bash
# Confirm comment is present at discard site
grep -n -A 8 "retryFetchErrors" packages/core/src/utils/retry.ts | grep "Intentional divergence"
# Expected: 1 match

# Confirm plan marker
grep -n "@plan:PLAN-20250219-GMERGE021.R12.P03" packages/core/src/utils/retry.ts
# Expected: 1 occurrence
```

### Structural Verification Checklist

- [ ] Comment added at `void _retryFetchErrors` site
- [ ] Comment references upstream commit `6f3b56c5b6a8`
- [ ] Plan marker present
- [ ] All tests still pass after comment-only change
- [ ] No logic changes introduced (comment only)

### Semantic Verification Checklist

1. **Does the comment explain the WHY?**
   - [ ] Mentions multi-provider rationale
   - [ ] Mentions upstream commit reference
   - [ ] Mentions API compatibility reason for keeping the field

2. **Is this sufficient documentation?**
   - [ ] A developer reading this comment alone can understand the tradeoff without external context

## Success Criteria

- Comment present at discard site explaining intentional divergence
- Plan marker traceable
- All tests still passing (no behavior change)

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/core/src/utils/retry.ts`
2. Re-read existing comment structure and integrate new comment without disrupting indentation

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase P04: Full Verification Suite

## Phase ID

`PLAN-20250219-GMERGE021.R12.P04`

## Prerequisites

- Required: Phase P03 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P03.md` exists
- Expected from P03: divergence comment present, all tests passing

## Implementation Tasks

No new code. Run full verification and confirm all gates pass.

## Verification Commands

### Complete Suite

```bash
# 1. Unit tests
npm run test
# Expected: All pass, including 8 new retry tests

# 2. TypeScript type checking
npm run typecheck
# Expected: No errors

# 3. Linting
npm run lint
# Expected: No new lint errors

# 4. Formatting
npm run format
# Expected: No formatting changes (or commit any auto-fixes)

# 5. Build
npm run build
# Expected: Build succeeds

# 6. Smoke test
node scripts/start.js --profile-load synthetic "write me a haiku"
# Expected: Haiku generated successfully
```

### Plan Marker Coverage Audit

```bash
# Confirm all phase markers are traceable
grep -rn "@plan:PLAN-20250219-GMERGE021.R12" packages/core/src/utils/ | sort
# Expected:
#   retry.ts: P02 marker on TRANSIENT_ERROR_CODES
#   retry.ts: P03 marker on retryFetchErrors comment
#   retry.test.ts: P01 markers on 8 tests

# Confirm requirement markers
grep -rn "@requirement:REQ-R12-001\|@requirement:REQ-R12-002\|@requirement:REQ-R12-003" packages/core/src/utils/
# Expected: 9+ occurrences across test and source files
```

### Deferred Implementation Detection (Final)

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY|TEMP|WIP)" \
  packages/core/src/utils/retry.ts \
  packages/core/src/utils/retry.test.ts \
  | grep -v "// " | head -20
# Expected: No new matches from this PR's changes
```

### Structural Verification Checklist — Final

- [ ] `ENOTFOUND` present in `TRANSIENT_ERROR_CODES` in `retry.ts`
- [ ] 8 new tests present in `retry.test.ts`, all passing
- [ ] Divergence comment present at `void _retryFetchErrors`
- [ ] All plan markers (P01, P02, P03) traceable via grep
- [ ] All requirement markers (REQ-R12-001, REQ-R12-002, REQ-R12-003) traceable
- [ ] No skipped phases
- [ ] No deferred implementations

### Semantic Verification Checklist — Final

1. **Does the code DO what the requirements say?**
   - [ ] REQ-R12-001: ENOTFOUND errors are retried — verified by passing tests
   - [ ] REQ-R12-002: retryFetchErrors is accepted but no-op — verified by test 5 and comment
   - [ ] REQ-R12-003: fetch failed is case-insensitive — verified by tests 3–4

2. **Is this REAL implementation?**
   - [ ] Only one line added to production code (`'ENOTFOUND'` in the set)
   - [ ] One comment block added — no logic changes
   - [ ] 8 behavioral tests added — none are mock theater

3. **Would tests FAIL if implementation was removed?**
   - [ ] Confirmed in P01: removing ENOTFOUND causes 2 test failures

4. **Is the feature REACHABLE by users?**
   - [ ] All API calls through `retryWithBackoff` automatically get ENOTFOUND retry
   - [ ] No opt-in required

5. **Over-retry Risk Assessment (final)**

| Risk | Mitigation | Status |
|------|------------|--------|
| ENOTFOUND as permanent (bad hostname) | Max 5 retries + exponential backoff bounds cost | Acceptable |
| Phrase false positives | Only applies to Error.message during HTTP calls | Low |
| Retry storms | Bounded by `maxAttempts: 5`, `maxDelayMs: 30000` | Bounded |
| Masking failures | Debug logging on each retry | Observable |

#### Feature Actually Works

```bash
# Targeted smoke test for the specific behavior
cd packages/core && npx vitest run src/utils/retry.test.ts -t "ENOTFOUND" 2>&1
# Expected output: 2 tests pass
```

## Success Criteria

- All 6 verification steps pass (test, typecheck, lint, format, build, smoke)
- All plan markers traceable
- All requirement markers traceable
- No deferred implementations
- Semantic verification checklist fully checked

## Failure Recovery

If any verification step fails:

1. `git diff HEAD packages/core/src/utils/retry.ts packages/core/src/utils/retry.test.ts` to review changes
2. Fix the specific failing step
3. Re-run ALL verification steps from the top — never skip steps after a fix

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

```markdown
Phase: P04
Completed: YYYY-MM-DD HH:MM
Verification Results:
  npm run test: PASS
  npm run typecheck: PASS
  npm run lint: PASS
  npm run format: PASS
  npm run build: PASS
  haiku smoke test: PASS
Plan Markers Found: [paste grep output]
Requirement Markers Found: [paste grep output]
```

---

## Files Involved

| File | Phase | Action | Delta |
|------|-------|--------|-------|
| `packages/core/src/utils/retry.ts` | P02 | Add `'ENOTFOUND'` to `TRANSIENT_ERROR_CODES` | +1 line |
| `packages/core/src/utils/retry.ts` | P03 | Improve `retryFetchErrors` divergence comment | ~8 lines |
| `packages/core/src/utils/retry.test.ts` | P01 | Add 8 new behavioral tests | ~120 lines |

---

## Risk Assessment

| Change | Risk | Rationale |
|--------|------|-----------|
| Add `ENOTFOUND` to retry codes | Low | Same behavior as 5 other POSIX codes already in set; DNS can be transiently unavailable |
| New tests only | Negligible | Read-only effect on production behavior |
| `retryFetchErrors` comment update | Negligible | Documentation only, zero behavior change |

**Net behavioral delta**: `ENOTFOUND` errors will now be retried (up to `maxAttempts: 5`, capped at `maxDelayMs: 30000`). Aligns with upstream intent. Over-retry cost is bounded and observable via existing debug logging.

---

## Decision Record: retryFetchErrors Semantic Divergence

| Behavior | Upstream (6f3b56c5b6a8) | LLxprt |
|----------|------------------------|--------|
| Fetch-failed retry | Only when `retryFetchErrors === true` | Always |
| Network code retry | Only when `retryFetchErrors === true` | Always |
| `retryFetchErrors` option | Functional gate | Accepted, discarded (no-op) |

**Decision**: Intentional divergence. LLxprt serves multiple providers (Anthropic, OpenAI, Vercel, Gemini, etc.), not only Google's Gemini. Always-on network retry is safer for a multi-provider client where callers should not need to opt in to basic network resilience. The `retryFetchErrors` field is retained in `RetryOptions` to avoid breaking callers that pass it for cross-compatibility.

---

## Upstream Adjacency Check

- No prior refactors to `retry.ts` that this patch depends on were found that LLxprt hasn't already integrated
- Adjacent commits within `v0.21.3` do not alter retry option types or defaults
- The commit is self-contained relative to LLxprt's forked state
- LLxprt's `collectErrorDetails()` is a strict superset of upstream's `getNetworkErrorCode()` — no port needed

---

## Changelog Note

> **Internal**: `ENOTFOUND` (DNS resolution failure) added to retryable network error codes, matching upstream v0.21.3 behavior. `retryFetchErrors` option remains accepted for API compatibility but has no effect — LLxprt always retries transient network errors across all providers (intentional divergence from upstream's opt-in behavior).
