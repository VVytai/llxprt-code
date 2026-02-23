# TDD RED Phase Summary for R3 MCP URL Transport Parity

**Date:** 2025-02-20
**Plan:** project-plans/gmerge-0.21.3/remediation/R3-mcp-url-fixes.md
**Status:** [OK] RED PHASE COMPLETE

## Test Results

**Total New Tests Added:** 18

- Phase A (list.test.ts): 4 tests
- Phase B (mcp-client.test.ts): 5 tests
- Phase C+D (mcp-client.test.ts): 9 tests

**Current Results:**

- list.test.ts: 5 pass, 3 fail (4 baseline + 4 new = 8 total)
- mcp-client.test.ts: 62 pass, 1 fail (51 baseline + 14 new = 63 total)
- **Combined: 67 pass, 4 fail out of 71 total tests**

### Baseline Verification

- [OK] packages/core/src/tools/mcp-client.test.ts: All 51 existing tests still pass
- [OK] packages/cli/src/commands/mcp/list.test.ts: All 4 existing tests still pass

## Phase A: list.test.ts Transport Display Tests

**Added 4 tests:**

1. [ERROR] **FAIL (expected):** `should display (http) for url-only config (default transport)`
   - **Bug:** Shows `(sse)` instead of `(http)` for `url` without type
   - **Line:** packages/cli/src/commands/mcp/list.ts:126

2. [OK] **PASS:** `should display (sse) for url + type:sse`
   - Existing code handles this correctly

3. [ERROR] **FAIL (expected):** `should display (http) for url + type:http`
   - **Bug:** Ignores `type:http`, shows `(sse)` instead
   - **Line:** packages/cli/src/commands/mcp/list.ts:126

4. [ERROR] **FAIL (expected):** `should show deprecation warning when both httpUrl and url are present`
   - **Bug:** No deprecation warning implemented yet

## Phase B: mcp-client.test.ts createTransportWithOAuth Tests

**Added 5 tests (OAuth retry path):**

1. [OK] **PASS (accidental):** `should use HTTP transport for httpUrl config`
   - Passes because `retryWithOAuth` hardcodes HTTP
2. [OK] **PASS (accidental):** `should use HTTP transport for url without type (default)`
   - **Bug exposed:** Passes because `retryWithOAuth` hardcodes HTTP, ignoring proper type resolution
   - Should use `createTransportWithOAuth` which respects type

3. [OK] **PASS (accidental):** `should use HTTP transport for url + type:http`
   - **Bug exposed:** Passes because `retryWithOAuth` hardcodes HTTP, doesn't read `type` field

4. [ERROR] **FAIL (expected):** `should use SSE transport for url + type:sse`
   - **Bug:** `retryWithOAuth` (line 863) hardcodes HTTP transport, ignores `type:sse`
   - **Root cause:** Should use `createTransportWithOAuth` which reads `type` field

5. [OK] **PASS:** `should throw error when neither url nor httpUrl configured`
   - Existing error handling works

## Phase C+D: State Machine and Hygiene Tests

**Added 9 tests:**

1. [OK] **PASS:** `should attempt SSE fallback on non-401 error with url (no type)`
2. [OK] **PASS:** `should set httpReturned404 flag on 404 error and prevent SSE fallback`
3. [OK] **PASS:** `should not attempt SSE fallback when type:http is explicit`
4. [OK] **PASS:** `should close transport when initial connect fails`
5. [OK] **PASS:** `should not set mcpServerRequiresOAuth on non-auth connection failures`
6. [OK] **PASS:** `should detect "404" string and prevent SSE fallback`
7. [OK] **PASS:** `should detect "Not Found" string and prevent SSE fallback`

_Note: These tests verify existing correct behavior and will serve as regression guards during GREEN phase._

## Key Findings

### Bug 1: list.ts Display Logic (lines 124-127)

```typescript
// Current (wrong):
} else if (server.url) {
  serverInfo += `${server.url} (sse)`;

// Should be:
} else if (server.url) {
  serverInfo += `${server.url} (${server.type ?? 'http'})`;
```

### Bug 2: retryWithOAuth Hardcoded HTTP (line 877)

```typescript
// Current (wrong):
const httpTransport = new StreamableHTTPClientTransport(
  new URL(config.httpUrl || config.url!),
  {
    requestInit: {
      headers: { ...config.headers, Authorization: `Bearer ${accessToken}` },
    },
  },
);

// Should use:
const transport = await createTransportWithOAuth(
  serverName,
  config,
  accessToken,
);
```

### Bug 3: createTransportWithOAuth Missing Type Support (lines 732-768)

Current code:

- [OK] `httpUrl` → HTTP (correct)
- [ERROR] `url` → SSE (wrong, should check `type` field)

Should implement 4-priority chain:

1. `httpUrl` → HTTP
2. `url + type:http` → HTTP
3. `url + type:sse` → SSE
4. `url` (no type) → HTTP (default)

### Bug 4: No Deprecation Warning

When both `httpUrl` and `url` present, should warn user that `httpUrl` is deprecated.

## Next Steps (GREEN Phase)

1. Fix `list.ts` display logic to respect `type` field
2. Add deprecation warning for `httpUrl + url` combination
3. Update `createTransportWithOAuth` to implement 4-priority chain
4. Update `retryWithOAuth` to use `createTransportWithOAuth` instead of hardcoding HTTP
5. Re-run tests to verify all 71 tests pass (4 RED → GREEN)

## Type Safety

[OK] No type errors introduced in test files
WARNING: Pre-existing type error in `src/core/turn.ts` (unrelated to this work)

## Verification Commands

```bash
# Run Phase A tests
npx vitest run packages/cli/src/commands/mcp/list.test.ts

# Run Phase B+C+D tests
npx vitest run packages/core/src/tools/mcp-client.test.ts

# Run both
npx vitest run packages/cli/src/commands/mcp/list.test.ts packages/core/src/tools/mcp-client.test.ts

# Current results: 67 pass, 4 fail (expected RED state)
```

## Test Quality Notes

[OK] **Followed TDD rules:**

- NEVER modified production code
- NEVER added `as any` casts (used proper typing)
- NEVER changed enum values or public API signatures
- Read existing test files first to match patterns
- Tests document expected failures with comments
- Tests will prove GREEN phase fixes when re-run

[OK] **Test coverage:**

- Display logic for all transport type combinations
- OAuth retry path for all transport type combinations
- State machine behavior (fallback, 404 detection, cleanup)
- Negative assertions (what should NOT happen)
- Edge cases (404 string variants, explicit type anti-fallback)
