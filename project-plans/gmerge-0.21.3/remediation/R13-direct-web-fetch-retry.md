# Remediation Plan: R13 — direct-web-fetch Retry Wiring + Pre-Stream Retry Guard

**Priority:** P0 (fix before production)
**Estimated Effort:** 4-6 hours
**Root Cause:** Retry primitives in `packages/core/src/utils/retry.ts` are stronger now, but `packages/core/src/tools/direct-web-fetch.ts` still calls `fetch()` directly. Transient network failures still fail immediately in this tool path.

**Scope note:** geminiChat.ts stream retry guard was removed from this plan. That's a separate concern about the Gemini API streaming loop, not direct-web-fetch. It can be addressed independently if needed.

---

## Review Status

Round 1 (deepthinker): APPROVE_WITH_CHANGES — applied.
Round 2 (deepthinker + typescriptexpert): APPROVE_WITH_CHANGES — applied below.

---

## Scope

1. Wire `retryWithBackoff` into `direct-web-fetch.ts` around network call.
2. Preserve HTTP status on non-OK responses using existing `HttpError` interface so status-based retry classification works.
3. Add missing retry/abort/timeout tests for `direct-web-fetch` and `retry.ts`.

---

## TDD Sequence

### Test Group A: direct-web-fetch behavior (RED then GREEN)

**File:** `packages/core/src/tools/direct-web-fetch.test.ts`

1. `retries ENOTFOUND once and succeeds`
   - first fetch throws `{ code: 'ENOTFOUND' }`, second succeeds
   - assert fetch called twice and tool returns success

2. `does not retry non-retryable 4xx`
   - fetch returns 400
   - assert single attempt and tool returns `ToolResult.error`

3. `retries retryable 5xx when status is preserved`
   - first fetch returns 503, second returns 200
   - assert two attempts and success

4. `pre-aborted signal returns ToolResult.error and does not call fetch`
   - abort parent signal before invocation
   - assert error result and **zero** network attempts (deterministic — retryWithBackoff checks signal first)

5. `timeout abort returns ToolResult.error and cancels retries`
   - tiny timeout, mocked delayed fetch
   - assert abort error result and bounded attempts

6. `format conversion remains intact with retry wrapper`
   - retain/extend existing text + markdown + html assertions to ensure no regression

### Test Group B: retry.ts unit coverage (RED then GREEN)

**File:** `packages/core/src/utils/retry.test.ts`

1. `ENOTFOUND is retryable` — explicit network code check (confirms existing behavior)
2. `pre-aborted signal does not call fn` — deterministic: fn never called, AbortError rejected

---

## Implementation Steps

### Step 1: Preserve HTTP status on non-OK responses

**File:** `packages/core/src/tools/direct-web-fetch.ts`

```typescript
import type { HttpError } from '../utils/retry.js';

// Replace plain Error throw for non-OK:
if (!response.ok) {
  const error = new Error(
    `Request failed with status code: ${response.status}`
  ) as HttpError;
  error.status = response.status;
  throw error;
}
```

This allows `isRetryableError` to classify 5xx/429 as retryable via its existing status-based branch.

### Step 2: Wire retry around fetch

**File:** `packages/core/src/tools/direct-web-fetch.ts`

```typescript
import { retryWithBackoff } from '../utils/retry.js';

const response = await retryWithBackoff(
  () => fetch(url, { signal: controller.signal }),
  {
    maxAttempts: 3,
    initialDelayMs: 500,
    retryFetchErrors: true,
    signal: controller.signal,
  },
);
```

Note: Timeout is per-attempt. With retries the total wall time can exceed timeout by retry delay sum. Document this in a code comment.

---

## Verification

```bash
npm run test -- packages/core/src/tools/direct-web-fetch.test.ts
npm run test -- packages/core/src/utils/retry.test.ts
npm run typecheck
npm run lint
npm run format
npm run build
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Retry increases latency | Keep bounded attempts and short initial delay |
| 5xx retries silently fail due to missing status | Use `HttpError` cast with `.status` property |
| Mid-stream duplicate output | Out of scope for this plan (geminiChat concern) |
| Abort races during delay | Use `controller.signal` in retry options and existing abort guards |
| Timeout budget grows with retries | Document per-attempt timeout semantics |

---

## Done Criteria

- [ ] `direct-web-fetch` retries transient network errors (including ENOTFOUND)
- [ ] Non-OK responses throw with `HttpError.status` so 5xx/429 retry works
- [ ] 4xx behavior remains single-attempt and returns tool error
- [ ] Abort + timeout behavior tested and returns `ToolResult.error` deterministically
- [ ] `retry.ts` has ENOTFOUND + pre-aborted signal coverage
- [ ] Format conversions (text/markdown/html) intact after retry wrapping
- [ ] Full verification sequence passes
