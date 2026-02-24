# Plan: API Response Error Handling and Retry Logic (dd3fd73ffe9a)

Plan ID: PLAN-20250219-GMERGE021.R13
Generated: 2025-02-19
Total Phases: 8 (P0.5, P01–P06, P07)
Requirements: Upstream commit dd3fd73ffe9a — fix(core): improve API response error handling and retry logic (#14563)

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase 0.5)
2. Defined integration contracts for multi-component features
3. Written integration tests BEFORE unit tests
4. Verified all dependencies and types exist as assumed

---

# Phase 0.5: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R13.P0.5`

## Purpose

Verify ALL assumptions before writing any code.

## Dependency Verification

| Dependency | npm ls Output | Status |
|------------|---------------|--------|
| `retryWithBackoff` in `retry.ts` | `grep -n "retryWithBackoff" packages/core/src/utils/retry.ts` | Verify |
| `defaultShouldRetry` in `retry.ts` | `grep -n "defaultShouldRetry" packages/core/src/utils/retry.ts` | Verify |
| `RetryOptions.retryFetchErrors` | `grep -n "retryFetchErrors" packages/core/src/utils/retry.ts` | Verify |
| `FetchError` in `fetch.ts` | `grep -n "class FetchError" packages/core/src/utils/fetch.ts` | Verify |
| `Config.getRetryFetchErrors` | `grep -n "getRetryFetchErrors" packages/core/src/config/config.ts` | Expected: MISSING |

## Type/Interface Verification

| Type Name | Expected Definition | Actual Definition | Match? |
|-----------|---------------------|-------------------|--------|
| `HttpError` interface | `{ status?: number; code?: string; cause?: unknown }` | `grep -n "HttpError" packages/core/src/utils/retry.ts` | Verify |
| `RetryOptions` | Has `retryFetchErrors?: boolean` | `grep -n "retryFetchErrors" packages/core/src/utils/retry.ts` | Verify |
| `ErrorOptions` | Available via DOM lib | Check `packages/core/tsconfig.json` for `"DOM"` in lib | Verify |
| `ConfigParameters` | Does NOT yet have `retryFetchErrors` | `grep -n "retryFetchErrors" packages/core/src/config/config.ts` | Verify |

## Call Path Verification

| Function | Expected Caller | Actual Caller | Evidence |
|----------|-----------------|---------------|----------|
| `defaultShouldRetry` | Internal to `retryWithBackoff` only | `grep -rn "defaultShouldRetry" packages/` | File:line |
| `retryWithBackoff` in `geminiChat.ts` | Lines 931, 1341, 1768, 2398 | `grep -n "retryWithBackoff" packages/core/src/core/geminiChat.ts` | Verify |
| `fetch` in `direct-web-fetch.ts` | Line ~144, plain call | `grep -n "fetch(" packages/core/src/tools/direct-web-fetch.ts` | Verify |

## Test Infrastructure Verification

| Component | Test File Exists? | Test Patterns Work? |
|-----------|-------------------|---------------------|
| `retry.ts` tests | `packages/core/src/utils/retry.test.ts` | `npm test -- --testPathPattern=retry` |
| `geminiChat.ts` tests | Check `packages/core/src/core/` | YES/NO |
| `direct-web-fetch.ts` tests | Check `packages/core/src/tools/` | YES/NO |
| `fetch.ts` tests | Check `packages/core/src/utils/` | YES/NO |

## Blocking Issues to Verify Before Starting

1. `defaultShouldRetry` must have NO external callers (rename is safe only if internal-only).
2. `Config` class must NOT already have `getRetryFetchErrors()` (confirm MISSING).
3. `ErrorOptions` must be available — confirm `tsconfig.json` includes `"DOM"` lib.
4. `GeminiChat` must have access to a `Config` reference (check constructor/class fields).

## Verification Commands

```bash
# 1. Confirm defaultShouldRetry is not exported
grep -rn "defaultShouldRetry" packages/

# 2. Confirm getRetryFetchErrors does not exist
grep -rn "getRetryFetchErrors" packages/

# 3. Confirm tsconfig includes DOM
grep -n "DOM" packages/core/tsconfig.json

# 4. Confirm retryFetchErrors is already in RetryOptions
grep -n "retryFetchErrors" packages/core/src/utils/retry.ts

# 5. Find GeminiChat config access pattern
grep -n "this\.config" packages/core/src/core/geminiChat.ts | head -20

# 6. Confirm direct-web-fetch uses plain fetch (no retry wrapper yet)
grep -n "retryWithBackoff\|fetch(" packages/core/src/tools/direct-web-fetch.ts
```

## Verification Gate

- [ ] All dependencies verified present
- [ ] `defaultShouldRetry` confirmed internal-only (safe to rename)
- [ ] `getRetryFetchErrors` confirmed absent (safe to add)
- [ ] `ErrorOptions` available via DOM lib
- [ ] `Config` reference accessible from `GeminiChat`
- [ ] Test infrastructure confirmed for all four files

**IF ANY CHECKBOX IS UNCHECKED: STOP and update plan before proceeding.**

---

# Phase 01: Fix `retry.ts` — Export `isRetryableError` and Fix Precedence

## Phase ID

`PLAN-20250219-GMERGE021.R13.P01`

## Prerequisites

- Required: Phase 0.5 completed
- Verification: All Phase 0.5 checkboxes confirmed
- Expected files from previous phase: Preflight notes/evidence only
- Preflight verification: Phase 0.5 MUST be completed before this phase

## Requirements Implemented (Expanded)

### REQ-R13-001: Network Error Codes Retried Unconditionally

**Full Text**: Network error codes (e.g., ETIMEDOUT, ECONNRESET, UND_ERR_*) must be checked BEFORE the `retryFetchErrors` flag so they are ALWAYS retried, not gated behind an opt-in config.

**Behavior**:
- GIVEN: A fetch call fails with error code `ETIMEDOUT`
- WHEN: `isRetryableError` evaluates the error
- THEN: Returns `true` regardless of `retryFetchErrors` value

**Why This Matters**: Network timeouts are transient and always safe to retry; requiring opt-in for them silently drops legitimate retries and breaks reliability in degraded network conditions.

### REQ-R13-002: `isRetryableError` Exported for Reuse

**Full Text**: The retry predicate must be exported as `isRetryableError` so other modules (`geminiChat.ts`, `direct-web-fetch.ts`) can evaluate individual errors without duplicating logic.

**Behavior**:
- GIVEN: `geminiChat.ts` imports from `'../utils/retry.js'`
- WHEN: It calls `isRetryableError(error, retryFetchErrors)`
- THEN: The same precedence logic as `retryWithBackoff` is used

**Why This Matters**: Deduplication prevents divergence where the retry loop and external callers apply different retry rules to identical errors.

## Retry Decision Table (MUST implement exactly this precedence)

| Condition | Retry? | Notes |
|-----------|--------|-------|
| `error.name === 'AbortError'` | **Never** | Caught before `isRetryableError` in loop |
| Network error code in `.code` or `.cause` chain | **Always** | ETIMEDOUT, ECONNRESET, UND_ERR_* — regardless of `retryFetchErrors` |
| `retryFetchErrors === true` AND message matches `fetch failed` | Yes | Opt-in generic fetch failure |
| `error instanceof ApiError && status === 400` | **Never** | Deterministic bad request |
| `error instanceof ApiError` and status 429 or 5xx | Yes | Standard HTTP retry |
| Generic `status` property 429 or 5xx | Yes | Non-ApiError shapes |
| All other errors | No | |

## Implementation Tasks

### Files to Modify

- `packages/core/src/utils/retry.ts`
  - Rename `defaultShouldRetry` → `isRetryableError` and add `export`
  - Add `retryFetchErrors?: boolean` parameter to `isRetryableError`
  - Reorder checks per the Retry Decision Table above (network codes BEFORE `retryFetchErrors` gate)
  - In `retryWithBackoff`: pass `retryFetchErrors` from options into `isRetryableError` call
  - Remove the `void _retryFetchErrors` comment
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R13.P01`

### Required Code Markers

Every modified function/export MUST include:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R13.P01
 * @requirement REQ-R13-001
 * @requirement REQ-R13-002
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Confirm rename and export
grep -n "export.*isRetryableError" packages/core/src/utils/retry.ts
# Expected: 1 match

# Confirm old name is gone
grep -rn "defaultShouldRetry" packages/
# Expected: 0 matches

# Confirm plan marker
grep -n "@plan:PLAN-20250219-GMERGE021.R13.P01" packages/core/src/utils/retry.ts
# Expected: 1+ occurrences

# Run retry unit tests
npm test -- --testPathPattern=retry
# Expected: All pass
```

### Deferred Implementation Detection (MANDATORY)

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY|TEMP|WIP)" packages/core/src/utils/retry.ts | grep -v ".test.ts"
grep -rn -E "(in a real|in production|ideally|for now|placeholder|not yet|will be|should be)" packages/core/src/utils/retry.ts | grep -v ".test.ts"
```

### Semantic Verification Checklist

- [ ] I read the requirement text
- [ ] I read the implementation code (not just checked file exists)
- [ ] Network codes are checked BEFORE `retryFetchErrors` guard in the actual source
- [ ] `isRetryableError` is exported and callable from other modules
- [ ] `retryWithBackoff` passes `retryFetchErrors` to `isRetryableError`
- [ ] No `defaultShouldRetry` references remain anywhere

## Success Criteria

- `isRetryableError` exported from `retry.ts`
- Network error codes checked before `retryFetchErrors` in precedence order
- All existing retry tests pass
- `grep -rn "defaultShouldRetry" packages/` returns 0 matches

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/core/src/utils/retry.ts`
2. Re-run Phase 01 with corrected implementation

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

---

# Phase 02: Write TDD Tests for `retry.ts` Changes

## Phase ID

`PLAN-20250219-GMERGE021.R13.P02`

## Prerequisites

- Required: Phase 01 completed
- Verification: `grep -n "export.*isRetryableError" packages/core/src/utils/retry.ts`
- Expected files from previous phase: Modified `retry.ts` with `isRetryableError` exported

## Requirements Implemented (Expanded)

### REQ-R13-003: Unit Tests for Retry Precedence

**Full Text**: Unit tests must exhaustively cover the retry decision table to prevent regression from future precedence changes.

**Behavior**:
- GIVEN: `isRetryableError` is called with various error shapes
- WHEN: Each scenario from the Retry Decision Table is exercised
- THEN: Return value matches the table exactly for each row

**Why This Matters**: Without tests, a future refactor could silently revert network codes behind the `retryFetchErrors` gate, breaking unconditional retry for ETIMEDOUT.

## Implementation Tasks

### Files to Modify

- `packages/core/src/utils/retry.test.ts` (or equivalent test file)
  - ADD test suite: `isRetryableError` behavior
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R13.P02`
  - Implements: `@requirement:REQ-R13-003`

### Test Cases Required

```typescript
// @plan:PLAN-20250219-GMERGE021.R13.P02
// @requirement:REQ-R13-003

describe('isRetryableError', () => {
  it('retries network error code regardless of retryFetchErrors=false')
  it('retries network error code in nested .cause chain')
  it('does NOT retry generic "fetch failed" when retryFetchErrors=false')
  it('retries generic "fetch failed" when retryFetchErrors=true')
  it('never retries AbortError')
  it('never retries 400 ApiError')
  it('retries 503 ApiError')
  it('retries 429 ApiError')
  it('makes exactly maxAttempts attempts before giving up')
});
```

## Verification Commands

```bash
# Confirm new tests exist
grep -n "isRetryableError" packages/core/src/utils/retry.test.ts
# Expected: 9+ occurrences

# Run tests — all must pass
npm test -- --testPathPattern=retry
# Expected: All pass

# Check plan markers
grep -n "@plan:PLAN-20250219-GMERGE021.R13.P02" packages/core/src/utils/retry.test.ts
# Expected: 1+ occurrences
```

### Semantic Verification Checklist

- [ ] Each test asserts an actual return value, not just that the function was called
- [ ] Tests would fail if implementation was removed or logic inverted
- [ ] Cause-chain test constructs a real nested error (not a mock assertion)
- [ ] Max-attempt boundary test verifies actual call count

## Success Criteria

- 9+ test cases covering the retry decision table
- All tests pass
- No test uses mock return values to simulate `isRetryableError` itself (behavioral tests only)

## Failure Recovery

1. `git checkout -- packages/core/src/utils/retry.test.ts`
2. Re-run Phase 02

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

---

# Phase 03: Add Config Plumbing for `retryFetchErrors`

## Phase ID

`PLAN-20250219-GMERGE021.R13.P03`

## Prerequisites

- Required: Phase 01 completed
- Verification: `grep -n "export.*isRetryableError" packages/core/src/utils/retry.ts`
- Expected files from previous phase: `retry.ts` with `isRetryableError` exported

## Requirements Implemented (Expanded)

### REQ-R13-004: Config Accessor for `retryFetchErrors`

**Full Text**: The `Config` class must expose a `getRetryFetchErrors(): boolean` accessor so Phases 04 and 05 can thread the flag without ad hoc property access.

**Behavior**:
- GIVEN: A `Config` instance is created without `retryFetchErrors` in `ConfigParameters`
- WHEN: `config.getRetryFetchErrors()` is called
- THEN: Returns `false` (preserving all existing non-retrying behavior)

**Why This Matters**: A typed accessor with a safe default ensures zero behavioral change for existing callers while enabling opt-in retry for future users.

## Implementation Tasks

### Files to Modify

- `packages/core/src/config/config.ts`
  - Add `retryFetchErrors?: boolean` to `ConfigParameters` interface
  - Add private field `_retryFetchErrors: boolean` to `Config` class
  - Assign in constructor: `this._retryFetchErrors = parameters.retryFetchErrors ?? false`
  - Add: `getRetryFetchErrors(): boolean { return this._retryFetchErrors; }`
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R13.P03`

## Verification Commands

```bash
# Confirm accessor exists
grep -n "getRetryFetchErrors" packages/core/src/config/config.ts
# Expected: 1 definition

# Confirm ConfigParameters updated
grep -n "retryFetchErrors" packages/core/src/config/config.ts
# Expected: 2+ occurrences (interface + field assignment)

# Type check passes
npm run typecheck
# Expected: No errors

# Confirm plan marker
grep -n "@plan:PLAN-20250219-GMERGE021.R13.P03" packages/core/src/config/config.ts
# Expected: 1+ occurrences
```

### Semantic Verification Checklist

- [ ] Default returns `false` (verified by reading constructor logic)
- [ ] `ConfigParameters` interface updated (not just the class field)
- [ ] Accessor is callable externally (not private or protected)
- [ ] TypeScript compiles without errors after change

## Success Criteria

- `getRetryFetchErrors()` added to `Config` class
- Default is `false`
- `npm run typecheck` passes

## Failure Recovery

1. `git checkout -- packages/core/src/config/config.ts`

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase 04: Update `geminiChat.ts` — Streaming Retry Enhancement

## Phase ID

`PLAN-20250219-GMERGE021.R13.P04`

## Prerequisites

- Required: Phases 01 and 03 completed
- Verification:
  - `grep -n "export.*isRetryableError" packages/core/src/utils/retry.ts`
  - `grep -n "getRetryFetchErrors" packages/core/src/config/config.ts`
- Expected files from previous phases: `retry.ts` with export, `config.ts` with accessor

## Requirements Implemented (Expanded)

### REQ-R13-005: Connection-Phase Errors Throw Immediately

**Full Text**: Errors thrown during the connection phase of a streaming API call must propagate immediately without retry. Only mid-stream errors (after the connection is established) are eligible for retry.

**Behavior**:
- GIVEN: `makeApiCallAndProcessStream` throws before returning a stream
- WHEN: The catch block evaluates the error
- THEN: The error is rethrown immediately; no retry attempt is made

**Why This Matters**: Retrying connection failures can mask configuration errors (wrong API key, bad endpoint) and delay user-visible error messages.

### REQ-R13-006: Mid-Stream Network Errors Retried When `retryFetchErrors` Enabled

**Full Text**: Network errors occurring after the connection is established (during `for await` iteration) must be retried when `retryFetchErrors === true`.

**Behavior**:
- GIVEN: A stream is established and `retryFetchErrors === true`
- WHEN: A network error code (ETIMEDOUT, ECONNRESET) occurs during iteration
- THEN: The retry loop attempts again up to `INVALID_CONTENT_RETRY_OPTIONS.maxAttempts`

**Why This Matters**: Mid-stream network interruptions are transient; silent retry gives the user a seamless experience.

## Implementation Tasks

### Files to Modify

- `packages/core/src/core/geminiChat.ts`
  - Import `isRetryableError` from `'../utils/retry.js'`
  - Introduce `isConnectionPhase: boolean` — set `true` at loop start, `false` after `makeApiCallAndProcessStream` resolves
  - In catch block (after existing `isContentError` check), add connection-phase guard and `isRetryableError` check
  - Access `this.config.getRetryFetchErrors()` for the `retryFetchErrors` flag
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R13.P04`

### Connection Phase Boundary (EXACT)

```typescript
// @plan:PLAN-20250219-GMERGE021.R13.P04
isConnectionPhase = true;
const stream = await makeApiCallAndProcessStream(...);
isConnectionPhase = false;
for await (const chunk of stream) { ... }
```

### Catch Block Addition (EXACT LOGIC)

```typescript
if (!isContentError) {
  if (isConnectionPhase) {
    break; // connection-phase: do not retry
  }
  const retryFetchErrors = this.config?.getRetryFetchErrors?.() ?? false;
  if (
    isRetryableError(error, retryFetchErrors) &&
    attempt < INVALID_CONTENT_RETRY_OPTIONS.maxAttempts - 1
  ) {
    // log retry: NETWORK_ERROR
    continue;
  }
  break;
}
```

## Verification Commands

```bash
# Confirm isRetryableError import
grep -n "isRetryableError" packages/core/src/core/geminiChat.ts
# Expected: 1+ occurrences (import + usage)

# Confirm isConnectionPhase
grep -n "isConnectionPhase" packages/core/src/core/geminiChat.ts
# Expected: 3 occurrences (declaration, set true, set false)

# Confirm plan marker
grep -n "@plan:PLAN-20250219-GMERGE021.R13.P04" packages/core/src/core/geminiChat.ts
# Expected: 1+ occurrences

# Type check
npm run typecheck
# Expected: No errors
```

### Deferred Implementation Detection (MANDATORY)

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/core/src/core/geminiChat.ts | grep -v ".test.ts"
# Expected: No new markers introduced
```

### Semantic Verification Checklist

- [ ] `isConnectionPhase = false` is set BEFORE `for await` (not inside it)
- [ ] `isConnectionPhase = true` is set at the START of each retry loop iteration
- [ ] Connection-phase errors do NOT continue the loop (they `break`)
- [ ] Mid-stream errors with matching `isRetryableError` DO continue
- [ ] 400 ApiError mid-stream does NOT continue (covered by `isRetryableError` returning false)
- [ ] `getRetryFetchErrors()` accessed via optional chain (safe if config is undefined)

## Success Criteria

- `isConnectionPhase` boundary correctly placed
- `isRetryableError` used in catch block
- `npm run typecheck` passes
- No existing streaming tests broken

## Failure Recovery

1. `git checkout -- packages/core/src/core/geminiChat.ts`

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

---

# Phase 05: Add Retry to `direct-web-fetch.ts`

## Phase ID

`PLAN-20250219-GMERGE021.R13.P05`

## Prerequisites

- Required: Phases 01 and 03 completed
- Verification:
  - `grep -n "export.*isRetryableError" packages/core/src/utils/retry.ts`
  - `grep -n "getRetryFetchErrors" packages/core/src/config/config.ts`

## Requirements Implemented (Expanded)

### REQ-R13-007: `DirectWebFetchTool` Uses `retryWithBackoff`

**Full Text**: The plain `fetch` call in `direct-web-fetch.ts` must be wrapped with `retryWithBackoff` so transient network errors are retried automatically.

**Behavior**:
- GIVEN: A web fetch tool call encounters a transient error on first attempt
- WHEN: `retryWithBackoff` is configured with `retryFetchErrors` from config
- THEN: The fetch is retried; success on second attempt returns content normally

**Why This Matters**: Without retry, a single flaky network response causes tool failure, degrading agent reliability.

### REQ-R13-008: Errors Carry `status` Property

**Full Text**: Errors thrown by `direct-web-fetch.ts` must carry a `status` property matching the HTTP response code so `isRetryableError` can correctly classify 4xx vs 5xx responses.

**Behavior**:
- GIVEN: A fetch returns HTTP 503
- WHEN: The error is thrown
- THEN: `error.status === 503` and `isRetryableError` returns `true`

**Why This Matters**: Without `status`, all HTTP errors are treated identically and `isRetryableError` cannot distinguish retryable 5xx from non-retryable 4xx.

## Implementation Tasks

### Files to Modify

- `packages/core/src/tools/direct-web-fetch.ts`
  - Import `retryWithBackoff` from `'../utils/retry.js'`
  - Replace plain `fetch` + manual error throw with a `retryWithBackoff` wrapper
  - Attach `status` to thrown errors using `HttpError` interface from `retry.ts`
  - Pass `retryFetchErrors: this.config?.getRetryFetchErrors?.() ?? false`
  - ADD comment noting GET-only idempotency assumption
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R13.P05`

### Timeout Budget Note (MUST document in code)

The existing `AbortController` + `setTimeout` is a **per-request** (not per-attempt) timeout. Retries share the original timeout budget. If the timeout fires, `AbortError` propagates and the retry loop exits immediately. Document this in a code comment.

## Verification Commands

```bash
# Confirm retryWithBackoff used
grep -n "retryWithBackoff" packages/core/src/tools/direct-web-fetch.ts
# Expected: 1 occurrence

# Confirm status attached to errors
grep -n "\.status" packages/core/src/tools/direct-web-fetch.ts
# Expected: 1+ occurrences

# Confirm plan marker
grep -n "@plan:PLAN-20250219-GMERGE021.R13.P05" packages/core/src/tools/direct-web-fetch.ts
# Expected: 1+ occurrences

# Type check
npm run typecheck
# Expected: No errors
```

### Semantic Verification Checklist

- [ ] `HttpError` interface (not plain `Error` cast) used for error shapes
- [ ] `status` property populated from `response.status`
- [ ] Idempotency assumption (GET-only) documented in comment
- [ ] Timeout envelope behavior documented in comment
- [ ] `AbortError` propagation tested (loop exits on abort)

## Success Criteria

- `retryWithBackoff` wraps the fetch call
- `status` attached to HTTP errors
- `npm run typecheck` passes

## Failure Recovery

1. `git checkout -- packages/core/src/tools/direct-web-fetch.ts`

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

---

# Phase 06: Fix `fetch.ts` — Preserve Error Cause

## Phase ID

`PLAN-20250219-GMERGE021.R13.P06`

## Prerequisites

- Required: Phase 0.5 completed (confirms `ErrorOptions` available via DOM lib)
- Verification: `grep -n "DOM" packages/core/tsconfig.json`

## Requirements Implemented (Expanded)

### REQ-R13-009: `FetchError` Preserves Cause Chain

**Full Text**: The `FetchError` constructor must accept an optional `ErrorOptions` parameter and pass `cause` to `super()` so error chains are preserved for debugging and cause-chain traversal in `isRetryableError`.

**Behavior**:
- GIVEN: A fetch operation fails with an underlying OS-level error
- WHEN: `FetchError` is constructed wrapping the original error
- THEN: `fetchError.cause === originalError` is true

**Why This Matters**: `isRetryableError` traverses the `.cause` chain to detect network error codes. Without `cause` preservation, errors wrapped in `FetchError` lose their retry classification.

## Implementation Tasks

### Files to Modify

- `packages/core/src/utils/fetch.ts`
  - Add optional `options?: ErrorOptions` to `FetchError` constructor
  - Pass `options` to `super(message, options)`
  - In `fetchWithTimeout`, wrap catch-all rethrow to pass `{ cause: error }`
  - Leave `ABORT_ERR` and `ETIMEDOUT` cases unchanged (synthetic errors, no cause)
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R13.P06`

## Verification Commands

```bash
# Confirm ErrorOptions parameter added
grep -n "ErrorOptions" packages/core/src/utils/fetch.ts
# Expected: 1+ occurrences

# Confirm cause passed to super
grep -n "super(message" packages/core/src/utils/fetch.ts
# Expected: super call with options

# Confirm ABORT_ERR and ETIMEDOUT cases unchanged
grep -n "ABORT_ERR\|ETIMEDOUT" packages/core/src/utils/fetch.ts
# Expected: Same as before (no cause added to these)

# Type check
npm run typecheck
# Expected: No errors
```

### Semantic Verification Checklist

- [ ] `FetchError` constructed in catch-all path includes `{ cause: error }`
- [ ] `ABORT_ERR` and `ETIMEDOUT` synthetic cases do NOT include cause
- [ ] `error.cause` traversal in `isRetryableError` now reaches underlying network codes
- [ ] No change to the number of constructor arguments in existing call sites (options is optional)

## Success Criteria

- `ErrorOptions` parameter added to `FetchError`
- Cause chain preserved for wrapped errors
- Synthetic error cases (ABORT_ERR, ETIMEDOUT) unchanged
- `npm run typecheck` passes

## Failure Recovery

1. `git checkout -- packages/core/src/utils/fetch.ts`

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P06.md`

---

# Phase 07: Integration Tests and Full Verification

## Phase ID

`PLAN-20250219-GMERGE021.R13.P07`

## Prerequisites

- Required: Phases 01–06 all completed
- Verification:
  - `grep -rn "@plan:PLAN-20250219-GMERGE021.R13" packages/ | wc -l` (Expected: 10+)
  - All previous `.completed/P0N.md` files exist

## Requirements Implemented (Expanded)

### REQ-R13-010: Integration Tests for Streaming Retry

**Full Text**: Integration tests must cover the `geminiChat.ts` streaming retry scenarios from upstream: 503 retry, network error retry (on/off), 400 non-retry, connection-phase non-retry, and retry exhaustion.

**Behavior**:
- GIVEN: A mocked `makeApiCallAndProcessStream` that throws on first call and succeeds on second
- WHEN: `sendMessageStream` processes the error
- THEN: The stream yields content on the second attempt (503 and network error cases)

### REQ-R13-011: Integration Tests for `direct-web-fetch.ts` Retry

**Full Text**: Integration tests must cover transient failure recovery, HTTP 400 non-retry, abort during retry, and timeout envelope behavior.

**Behavior**:
- GIVEN: A mocked `fetch` that fails transiently then succeeds
- WHEN: `DirectWebFetchTool` executes
- THEN: Content is returned from the successful second attempt

## Implementation Tasks

### Files to Create

- `packages/core/src/core/geminiChat_network_retry.test.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R13.P07`
  - Test: 503 ApiError during stream → retried, succeeds on second attempt
  - Test: Network error during stream + `retryFetchErrors=true` → retried
  - Test: Network error during stream + `retryFetchErrors=false` → not retried
  - Test: 400 ApiError during stream → not retried
  - Test: Connection-phase error → not retried (thrown immediately)
  - Test: Retry exhaustion → original error surfaced with intact cause chain

### Files to Modify

- `packages/core/src/tools/direct-web-fetch.test.ts` (or create if absent)
  - ADD: Transient error on first attempt, success on second → returns content
  - ADD: 400 response → not retried, error surfaced
  - ADD: `AbortSignal` fires during retry loop → stops immediately
  - ADD: Timeout envelope (≤1 total timeout registered across attempts)
  - ADD comment: `@plan:PLAN-20250219-GMERGE021.R13.P07`

## Verification Commands

### Automated Checks

```bash
# Run all new tests
npm test -- --testPathPattern="geminiChat_network_retry|direct-web-fetch"
# Expected: All pass

# Check all plan markers across codebase
grep -rn "@plan:PLAN-20250219-GMERGE021.R13" packages/ | wc -l
# Expected: 15+ occurrences

# Full verification suite
npm run test && npm run typecheck && npm run lint && npm run format && npm run build
# Expected: All pass

# Smoke test
node scripts/start.js --profile-load synthetic "write me a haiku"
# Expected: Haiku output, no errors
```

### Deferred Implementation Detection (MANDATORY)

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX)" \
  packages/core/src/utils/retry.ts \
  packages/core/src/core/geminiChat.ts \
  packages/core/src/tools/direct-web-fetch.ts \
  packages/core/src/utils/fetch.ts \
  packages/core/src/config/config.ts \
  | grep -v ".test.ts"
# Expected: No new markers
```

### Semantic Verification Checklist

1. **Does the code DO what the requirement says?**
   - [ ] `isRetryableError` exported and network codes checked before `retryFetchErrors` gate
   - [ ] `geminiChat.ts` connection-phase errors throw immediately
   - [ ] `geminiChat.ts` mid-stream network errors retry when enabled
   - [ ] `direct-web-fetch.ts` wraps fetch with `retryWithBackoff`
   - [ ] `FetchError` preserves cause chain
   - [ ] `Config.getRetryFetchErrors()` exists and defaults to `false`

2. **Is this REAL implementation, not placeholder?**
   - [ ] Deferred implementation detection passed
   - [ ] No empty returns in implementation
   - [ ] No "will be implemented" comments

3. **Would tests FAIL if implementation was removed?**
   - [ ] Streaming retry tests assert actual chunks received on second attempt
   - [ ] direct-web-fetch tests assert actual content returned
   - [ ] Cause-chain test asserts `error.cause` identity

4. **Is the feature REACHABLE by users?**
   - [ ] `retryFetchErrors` can be set via `ConfigParameters` at construction time
   - [ ] `direct-web-fetch.ts` reads config from `this.config`

5. **What's MISSING?** (list gaps before proceeding)
   - [ ] CLI flag / env var wiring for `retryFetchErrors` (deferred — out of scope for this commit)

#### Feature Actually Works

```bash
# Verify retry logic is active (manual inspection)
grep -n "isRetryableError\|retryFetchErrors" \
  packages/core/src/utils/retry.ts \
  packages/core/src/core/geminiChat.ts \
  packages/core/src/tools/direct-web-fetch.ts
# Expected: Each file shows the integration points
```

#### Integration Points Verified

- [ ] `geminiChat.ts` imports `isRetryableError` from `retry.ts` (read both files)
- [ ] `direct-web-fetch.ts` imports `retryWithBackoff` from `retry.ts` (read both files)
- [ ] `Config.getRetryFetchErrors()` called via optional chain (safe if undefined)
- [ ] `FetchError.cause` reaches `isRetryableError`'s cause-chain traversal

#### Edge Cases Verified

- [ ] `AbortError` during retry loop exits immediately (verified in test)
- [ ] Timeout budget shared across attempts (documented in comment)
- [ ] Retry exhaustion surfaces last error with cause chain intact
- [ ] Default `retryFetchErrors=false` preserves all existing non-retrying behavior

## Success Criteria

- All six test scenarios in `geminiChat_network_retry.test.ts` pass
- All four scenarios in `direct-web-fetch.test.ts` additions pass
- Full suite: `npm run test && npm run typecheck && npm run lint && npm run format && npm run build` — all green
- Smoke test produces haiku output

## Failure Recovery

If this phase fails:

1. Identify failing test from `npm test` output
2. Trace failure to implementation phase (P01–P06)
3. `git checkout -- [failing file]`
4. Rerun the relevant implementation phase

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P07.md`

---

## Execution Tracker

`project-plans/gmerge-0.21.3/execution-tracker.md`

| Phase | ID | Status | Started | Completed | Verified | Semantic? | Notes |
|-------|----|--------|---------|-----------|----------|-----------|-------|
| 0.5 | P0.5 | ⬜ | - | - | - | N/A | Preflight verification |
| 01 | P01 | ⬜ | - | - | - | ⬜ | Export `isRetryableError`, fix precedence |
| 02 | P02 | ⬜ | - | - | - | ⬜ | TDD tests for `retry.ts` |
| 03 | P03 | ⬜ | - | - | - | ⬜ | Config plumbing `retryFetchErrors` |
| 04 | P04 | ⬜ | - | - | - | ⬜ | `geminiChat.ts` streaming retry |
| 05 | P05 | ⬜ | - | - | - | ⬜ | `direct-web-fetch.ts` retry wrapper |
| 06 | P06 | ⬜ | - | - | - | ⬜ | `fetch.ts` cause chain |
| 07 | P07 | ⬜ | - | - | - | ⬜ | Integration tests + full verification |

**Note:** "Semantic?" column tracks whether semantic verification (feature actually works) was performed, not just structural verification (files exist).

## Completion Markers

- [ ] All phases have `@plan` markers in code
- [ ] All requirements have `@requirement` markers
- [ ] `grep -rn "@plan:PLAN-20250219-GMERGE021.R13" packages/ | wc -l` ≥ 15
- [ ] Full verification suite passes
- [ ] No phases skipped

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| P01 | Low — no behavioral change at existing call sites | Confirm `defaultShouldRetry` has no external callers; add unit tests before and after |
| P02 | Low — tests only | Follow behavioral test pattern; no mock theater |
| P03 | Low — additive plumbing | Default `false` ensures zero behavior change for existing users |
| P04 | Medium — changes streaming error-handling contract | Add `isConnectionPhase` precisely at `makeApiCallAndProcessStream`; cover all retry paths in tests |
| P05 | Low — additive; GET-only tool | Document idempotency assumption; verify timeout behavior |
| P06 | Low — error chain improvement | `ErrorOptions` confirmed available via DOM lib; preserve ABORT/ETIMEDOUT cases unchanged |
| P07 | Low | Follow upstream test patterns; do not use structural/mock-theater tests |

## Estimated Effort

| Phase | Estimate |
|-------|---------|
| P0.5: Preflight | 30 min |
| P01: `retry.ts` fix + export | 1–2 h |
| P02: `retry.ts` TDD tests | 1 h |
| P03: Config plumbing | 30 min |
| P04: `geminiChat.ts` streaming | 2–3 h |
| P05: `direct-web-fetch.ts` retry | 1 h |
| P06: `fetch.ts` cause | 30 min |
| P07: Integration tests + verification | 2–3 h |
| **Total** | **~9–12 h** |
