# Plan: Consolidate Remote MCP Servers to Use `url` in Config

Plan ID: `PLAN-20250219-GMERGE021.R3`
Generated: 2025-02-19
Total Phases: 7
Source Commit: `bdbbe9232d23`

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P01)
2. Defined integration contracts for transport-fallback and OAuth retry state machine
3. Written tests BEFORE implementation code (TDD)
4. Verified all MCP SDK error shapes exist as assumed in node_modules

---

# Phase P01: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R3.P01`

## Purpose

Verify ALL assumptions before writing any code. Block all subsequent phases until every gate is green.

## Dependency Verification

| Dependency | Verification Command | Status |
|------------|---------------------|--------|
| `@modelcontextprotocol/sdk` SseError shape | `grep -r "class SseError" node_modules/@modelcontextprotocol` | TBD |
| `@modelcontextprotocol/sdk` StreamableHTTPError shape | `grep -r "class StreamableHTTPError" node_modules/@modelcontextprotocol` | TBD |
| `StreamableHTTPClientTransport` | `grep -r "StreamableHTTPClientTransport" packages/core/src/tools/mcp-client.ts` | TBD |
| `SSEClientTransport` | `grep -r "SSEClientTransport" packages/core/src/tools/mcp-client.ts` | TBD |
| `mcpServerRequiresOAuth` Map | `grep -rn "mcpServerRequiresOAuth" packages/core/src/tools/mcp-client.ts` | TBD |
| OAuth token storage API | `grep -rn "getStoredOAuthToken\|OAuthToken" packages/` | TBD |

## Type/Interface Verification

| Type Name | Expected Shape | Verification Command |
|-----------|---------------|---------------------|
| `MCPServerConfig` | Has `url`, `httpUrl` fields; no `type` yet | `grep -n "type\?" packages/core/src/config/config.ts` |
| `UnauthorizedError` | Exists in `errors.ts` | `grep -n "UnauthorizedError" packages/core/src/utils/errors.ts` |
| `coreEvents.emitFeedback` | Available for info/error emission | `grep -n "emitFeedback" packages/core/src/` |

## Existing Test Inventory (run before writing any tests)

```bash
# Transport selection tests
grep -rn "createUrlTransport\|httpUrl\|SSEClient\|StreamableHTTP" \
  packages/core/src/tools/mcp-client.test.ts 2>/dev/null || echo "No test file found"

# Auth retry / OAuth tests
grep -rn "OAuth\|isAuthenticationError\|401" \
  packages/core/src/tools/mcp-client.test.ts 2>/dev/null

# CLI mcp add command tests
find packages/cli -name "*.test.ts" | xargs grep -l "mcp add\|mcp-add\|transport" 2>/dev/null

# Config schema tests
grep -rn "MCPServerConfig\|httpUrl" packages/core/src/config/
```

## Call Path Verification

| Symbol | Where Plan Expects It | Verification |
|--------|----------------------|-------------|
| `connectToMcpServer` | `packages/core/src/tools/mcp-client.ts` | `grep -n "connectToMcpServer" packages/core/src/tools/mcp-client.ts` |
| `createUrlTransport` | Same file | `grep -n "createUrlTransport" packages/core/src/tools/mcp-client.ts` |
| `mcpServerRequiresOAuth` export | `packages/core/src/tools/index.ts` | `grep -n "mcpServerRequiresOAuth" packages/core/src/tools/index.ts` |
| `mcp add` transport switch | `packages/cli/src/commands/mcp/add.ts` | `grep -n "httpUrl\|transport" packages/cli/src/commands/mcp/add.ts` |

## Blocking Issues Found

_Complete this section before proceeding:_

- [ ] `SseError` / `StreamableHTTPError` with `.code` property confirmed in installed SDK
- [ ] Existing OAuth token storage mechanism identified (do not invent a new one)
- [ ] `mcpServerRequiresOAuth` Map confirmed present or noted as missing
- [ ] Full list of existing tests that assert on old transport schema captured

## Verification Gate

- [ ] All dependencies verified
- [ ] All types match expectations
- [ ] All call paths are traceable
- [ ] Existing test blast-radius estimated
- [ ] No blocking issues remain unresolved

**IF ANY CHECKBOX IS UNCHECKED: STOP and resolve before P02.**

## Success Criteria

Every gate above is checked. Written summary of findings committed to `project-plans/gmerge-0.21.3/preflight-findings.md`.

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

---

# Phase P02: Test Authoring (TDD — Tests First, Red)

## Phase ID

`PLAN-20250219-GMERGE021.R3.P02`

## Prerequisites

- Required: Phase P01 completed and all gates green
- Verification: `project-plans/gmerge-0.21.3/.completed/P01.md` exists

## Requirements Implemented (Expanded)

### REQ-GMERGE021-R3-001: Transport Selection Priority

**Full Text**: `createUrlTransport()` MUST select transport via priority: `httpUrl` (deprecated) > `url+type` > `url` (default HTTP).

**Behavior**:
- GIVEN: An `MCPServerConfig` with only `httpUrl` set
- WHEN: `createUrlTransport()` is called
- THEN: Returns `StreamableHTTPClientTransport` using the `httpUrl` value

- GIVEN: An `MCPServerConfig` with both `httpUrl` and `url`
- WHEN: `createUrlTransport()` is called
- THEN: Uses `httpUrl`, emits exactly one deprecation warning

- GIVEN: `url` + `type: 'http'`
- WHEN: `createUrlTransport()` is called
- THEN: Returns `StreamableHTTPClientTransport`

- GIVEN: `url` + `type: 'sse'`
- WHEN: `createUrlTransport()` is called
- THEN: Returns `SSEClientTransport`

- GIVEN: `url` with no `type`
- WHEN: `createUrlTransport()` is called
- THEN: Returns `StreamableHTTPClientTransport` (default; SSE fallback happens at connection time)

- GIVEN: Neither `httpUrl` nor `url`
- WHEN: `createUrlTransport()` is called
- THEN: Throws `Error` with clear message

**Why This Matters**: Users migrating from `httpUrl` must not break, while new configs use the unified `url`+`type` shape.

### REQ-GMERGE021-R3-002: `isAuthenticationError()` Detection

**Full Text**: `isAuthenticationError()` MUST detect 401 errors from multiple error shapes without false positives.

**Behavior**:
- GIVEN: An object `{ code: 401 }`
- WHEN: `isAuthenticationError(error)` is called
- THEN: Returns `true`

- GIVEN: An `UnauthorizedError` instance
- WHEN: `isAuthenticationError(error)` is called
- THEN: Returns `true`

- GIVEN: An `Error` with message `"Error POSTing to endpoint (HTTP 401): ..."`
- WHEN: `isAuthenticationError(error)` is called
- THEN: Returns `true`

- GIVEN: An `Error` with message `"model gpt-4o-1401"` (false-positive candidate)
- WHEN: `isAuthenticationError(error)` is called
- THEN: Returns `false`

- GIVEN: `null` or `undefined`
- WHEN: `isAuthenticationError(error)` is called
- THEN: Returns `false` without throwing

**Why This Matters**: False positives suppress real error messages; false negatives cause duplicate/confusing error output.

### REQ-GMERGE021-R3-003: HTTP→SSE Fallback Behavior

**Full Text**: When `url` is used without `type` and HTTP fails, `connectToMcpServer` MUST fall back to SSE and emit a migration hint. When `type` is explicit, NO fallback occurs.

**Behavior**:
- GIVEN: Config with `url` (no type); HTTP returns non-auth failure
- WHEN: Connection attempt runs
- THEN: SSE fallback attempted; info log emitted with migration hint

- GIVEN: Config with `url` (no type); HTTP returns 404
- WHEN: Connection attempt runs
- THEN: `httpReturned404 = true`; SSE fallback attempted

- GIVEN: Config with `url` + `type: 'http'`; HTTP fails
- WHEN: Connection attempt runs
- THEN: No SSE fallback; error surfaced immediately

**Why This Matters**: Silent transport changes break existing SSE-only endpoints; explicit `type` prevents ambiguity.

### REQ-GMERGE021-R3-004: OAuth Retry and Manager Messaging Contract

**Full Text**: Auth errors must produce exactly one info-level message. `mcp-client-manager.ts` MUST NOT emit a red error for auth failures.

**Behavior**:
- GIVEN: A 401 error propagates from `mcp-client.ts` to `mcp-client-manager.ts`
- WHEN: Manager's catch block fires
- THEN: Zero `'error'` feedback events emitted; one `'info'` event emitted (from client)

- GIVEN: A non-auth error propagates to `mcp-client-manager.ts`
- WHEN: Manager's catch block fires
- THEN: Exactly one `'error'` feedback event emitted

**Why This Matters**: Duplicate error messages confuse users; suppressed errors hide real problems.

### REQ-GMERGE021-R3-005: CLI `mcp add` Config Output

**Full Text**: `mcp add --transport http <url>` MUST write `{ url, type: 'http' }` (not `httpUrl`). `mcp add --transport sse <url>` MUST write `{ url, type: 'sse' }`.

**Behavior**:
- GIVEN: User runs `mcp add --transport http https://example.com`
- WHEN: Config is written
- THEN: Config contains `{ url: "https://example.com", type: "http" }` with no `httpUrl` key

- GIVEN: Existing config with `httpUrl` key
- WHEN: Connection is established
- THEN: `httpUrl` still works (backward-compatible read path)

**Why This Matters**: New configs must use the forward-compatible shape while old configs must not break.

### REQ-GMERGE021-R3-006: Detected OAuth Server Listing in UI

**Full Text**: The MCP OAuth server list MUST include servers detected via 401 errors (`mcpServerRequiresOAuth` Map), not only those with `oauth.enabled` in config.

**Behavior**:
- GIVEN: Server S has no `oauth.enabled` in config but appears in `mcpServerRequiresOAuth`
- WHEN: OAuth server list is rendered
- THEN: Server S appears in the list, deduplicated with configured servers

**Why This Matters**: Users can't be told to authenticate with a server they can't see in the list.

## Implementation Tasks

### Files to Create / Modify for Tests

- `packages/core/src/tools/mcp-client.test.ts` (or create if absent)
  - Add test suite for `createUrlTransport` — test cases #1–6 from Test Matrix below
  - Add test suite for `connectToMcpServer` fallback — test cases #7–11
  - Add test suite for OAuth retry state machine — test cases #20–24
  - MUST include marker: `@plan:PLAN-20250219-GMERGE021.R3.P02`

- `packages/core/src/utils/errors.test.ts` (or create if absent)
  - Add `isAuthenticationError()` test suite — test cases #12–19
  - MUST include marker: `@plan:PLAN-20250219-GMERGE021.R3.P02`

- `packages/cli/src/commands/mcp/add.test.ts` (or locate existing)
  - Add / update transport config-write assertions — test cases #25–26
  - MUST include marker: `@plan:PLAN-20250219-GMERGE021.R3.P02`

- `packages/cli/src/ui/commands/mcpCommand.test.ts` (or locate existing)
  - Add OAuth server listing tests — test cases #27–29
  - MUST include marker: `@plan:PLAN-20250219-GMERGE021.R3.P02`

### Required Code Markers

Every test MUST include:

```typescript
it('description @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-00X', () => {
  // behavioral assertion
});
```

## Full Test Matrix

### Transport Selection — `createUrlTransport` Unit Tests

| # | Config | Expected transport | Notes |
|---|--------|--------------------|-------|
| 1 | `httpUrl` only | `StreamableHTTPClientTransport` | |
| 2 | `url` + `type: 'http'` | `StreamableHTTPClientTransport` | |
| 3 | `url` + `type: 'sse'` | `SSEClientTransport` | |
| 4 | `url` only | `StreamableHTTPClientTransport` | default |
| 5 | `httpUrl` + `url` | `StreamableHTTPClientTransport` + deprecation warning emitted once | |
| 6 | neither `httpUrl` nor `url` | throws `Error` | |

### Fallback Behavior — `connectToMcpServer` Integration Tests

| # | Scenario | Expected outcome |
|---|----------|-----------------|
| 7 | `url` only; HTTP non-auth failure → SSE succeeds | connected via SSE; fallback info log + migration hint emitted |
| 8 | `url` only; HTTP 404 → SSE succeeds | connected via SSE; `httpReturned404` flag set |
| 9 | `url` only; HTTP 404 → SSE fails | error surfaced; clear error message |
| 10 | `url` + explicit `type: 'http'`; HTTP fails | no SSE fallback; error surfaced immediately |
| 11 | `url` + explicit `type: 'sse'`; SSE fails | no HTTP attempt; error surfaced immediately |

### Auth Detection — `isAuthenticationError` Unit Tests

| # | Error input | Expected result |
|---|-------------|----------------|
| 12 | `{ code: 401 }` | `true` |
| 13 | `UnauthorizedError` instance | `true` |
| 14 | Error with `constructor.name === 'UnauthorizedError'` | `true` |
| 15 | Error message `"Error POSTing to endpoint (HTTP 401): ..."` | `true` |
| 16 | Error message `"status 401 Unauthorized"` | `true` |
| 17 | Error message `"model gpt-4o-1401"` | `false` (no false positive) |
| 18 | Error message `"resource id 9401"` | `false` (no false positive) |
| 19 | `null` / `undefined` | `false` (no throw) |

### Auth Retry and OAuth Flow

| # | Scenario | Expected outcome |
|---|----------|-----------------|
| 20 | 401 on HTTP; token retrieved; OAuth retry succeeds | connected; `mcpServerRequiresOAuth` updated |
| 21 | 401 on HTTP; `url` no type; OAuth fails; SSE fallback; SSE OAuth succeeds | connected via SSE |
| 22 | All paths fail; `showAuthRequiredMessage` called | exactly one info feedback event; no red error from manager |
| 23 | Auth error propagates to manager | zero `'error'` feedback events from manager |
| 24 | Non-auth error propagates to manager | exactly one `'error'` feedback event from manager |

### CLI/UI Behavior

| # | Scenario | Expected outcome |
|---|----------|-----------------|
| 25 | `mcp add --transport http <url>` | Config written as `{ url, type: 'http' }` (no `httpUrl`) |
| 26 | `mcp add --transport sse <url>` | Config written as `{ url, type: 'sse' }` |
| 27 | OAuth list with `oauth.enabled` servers only | only configured servers shown |
| 28 | OAuth list with detected OAuth servers (from Map) | detected servers included, deduplicated |
| 29 | Auth status check for detected-only server | correctly identified as requiring auth |

### Backward Compatibility

| # | Scenario | Expected outcome |
|---|----------|-----------------|
| 30 | Existing config with `httpUrl` | transport works (no regression) |
| 31 | Existing config with `url` targeting an SSE-only endpoint | HTTP probe fails; SSE fallback succeeds; migration warning emitted |

## Verification Commands

```bash
# Confirm test markers exist
grep -r "@plan:PLAN-20250219-GMERGE021.R3.P02" packages/ | wc -l
# Expected: 20+ occurrences

# Run tests — they MUST fail at this stage (red)
npm test -- --grep "@plan:.*GMERGE021.R3"
# Expected: Tests exist but fail (implementation not yet written)
```

### Structural Verification Checklist

- [ ] Phase P01 markers present (preflight complete)
- [ ] All test files created/located
- [ ] Tests tagged with plan + requirement markers
- [ ] Tests verify behavior (outputs), not structure (mock calls)
- [ ] Tests fail naturally at this phase (implementations not yet written)
- [ ] No test uses `expect(fn).toBeCalled()` as its sole assertion

## Success Criteria

- All 31 test cases authored
- All tests tagged with `@plan:PLAN-20250219-GMERGE021.R3.P02`
- `npm test -- --grep "@plan:.*GMERGE021.R3"` shows tests existing and failing (red)

## Failure Recovery

1. `git checkout -- packages/core/src/tools/mcp-client.test.ts`
2. `git checkout -- packages/core/src/utils/errors.test.ts`
3. Revise test authoring and retry

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

---

# Phase P03: Config and Error Utilities Implementation

## Phase ID

`PLAN-20250219-GMERGE021.R3.P03`

## Prerequisites

- Required: Phase P02 completed (tests authored, failing)
- Verification: `project-plans/gmerge-0.21.3/.completed/P02.md` exists
- `npm test -- --grep "@plan:.*GMERGE021.R3"` shows tests failing, not erroring on missing files

## Requirements Implemented

Implements REQ-GMERGE021-R3-001 (partial: config shape) and REQ-GMERGE021-R3-002 (error detection).

## Implementation Tasks

### Files to Modify

#### `packages/core/src/config/config.ts`

Add `type` field to `MCPServerConfig`:

```typescript
// After: readonly tcp?: string,
// Add (with inline JSDoc):
    /** Transport type. When set, disables automatic HTTP→SSE fallback.
     *  'http' → StreamableHTTPClientTransport
     *  'sse'  → SSEClientTransport
     *  omitted → defaults to HTTP with SSE fallback (deprecated; add type explicitly)
     *  Note: 'httpUrl' is deprecated; use 'url' + 'type: "http"' instead.
     */
    readonly type?: 'sse' | 'http',
```

**Before adding**: Check for runtime schema validation (Zod, JSON Schema, custom validator). If found, update the schema there too.

- MUST include marker: `@plan:PLAN-20250219-GMERGE021.R3.P03`

#### `packages/core/src/utils/errors.ts`

Add `isAuthenticationError()` at end of file:

```typescript
/**
 * Checks if an error is a 401 authentication error.
 * Uses structured error properties from MCP SDK errors first.
 *
 * @plan PLAN-20250219-GMERGE021.R3.P03
 * @requirement REQ-GMERGE021-R3-002
 */
export function isAuthenticationError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }

  // MCP SDK errors (SseError, StreamableHTTPError) carry numeric 'code'
  if ('code' in error) {
    const errorCode = (error as { code: unknown }).code;
    if (errorCode === 401) {
      return true;
    }
  }

  // Class identity check
  if (error instanceof UnauthorizedError) {
    return true;
  }

  // Cross-realm duck-typing
  if (
    error instanceof Error &&
    error.constructor.name === 'UnauthorizedError'
  ) {
    return true;
  }

  // Anchored message pattern — must not match '401' appearing in model names, IDs, etc.
  const message = getErrorMessage(error);
  if (/\bHTTP 401\b/.test(message) || /\bstatus 401\b/i.test(message)) {
    return true;
  }

  return false;
}
```

**Why anchored patterns**: MCP SDK throws `"Error POSTing to endpoint (HTTP 401): ..."`. Bare `includes('401')` would match unrelated strings like model names or resource IDs.

## Verification Commands

```bash
# Structural: markers present
grep -rn "@plan:PLAN-20250219-GMERGE021.R3.P03" packages/ | wc -l
# Expected: 2+ occurrences

# Tests for isAuthenticationError now pass (cases 12–19)
npm test -- --grep "isAuthenticationError"
# Expected: All pass

# TypeScript compiles cleanly
npm run typecheck
# Expected: 0 errors
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX|TEMPORARY)" \
  packages/core/src/config/config.ts \
  packages/core/src/utils/errors.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] `MCPServerConfig.type` field added and TypeScript accepts `'sse' | 'http' | undefined`
- [ ] Runtime schema validator updated if one exists (confirmed by search)
- [ ] `isAuthenticationError(null)` returns `false` (no throw)
- [ ] `isAuthenticationError({ code: 401 })` returns `true`
- [ ] `isAuthenticationError(new Error('model gpt-4o-1401'))` returns `false`
- [ ] Tests #12–19 all pass

## Success Criteria

- Tests #12–19 pass
- TypeScript compiles cleanly
- No deferred implementations

## Failure Recovery

1. `git checkout -- packages/core/src/config/config.ts`
2. `git checkout -- packages/core/src/utils/errors.ts`

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase P04: MCP Client Transport Logic Implementation

## Phase ID

`PLAN-20250219-GMERGE021.R3.P04`

## Prerequisites

- Required: Phase P03 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P03.md` exists
- `npm run typecheck` passes

## Requirements Implemented

Implements REQ-GMERGE021-R3-001 (transport selection), REQ-GMERGE021-R3-003 (fallback), REQ-GMERGE021-R3-004 (OAuth/messaging).

## Fallback and OAuth Retry State Machine

The implementation MUST follow this state machine precisely:

```
start → try HTTP transport
  ├─ success                      → done
  ├─ auth error (401)
  │     AND url has no type      → retryWithOAuth on HTTP
  │           ├─ OAuth success   → done
  │           └─ OAuth failure   → try SSE fallback → retryWithOAuth on SSE → done/error
  ├─ 404 or non-auth HTTP failure
  │     AND url has no type      → try SSE fallback
  │           ├─ success         → done
  │           ├─ auth error (401)→ retryWithOAuth on SSE → done/error
  │           └─ failure         → surface error (SSE failed)
  └─ any failure
        AND url HAS explicit type → no fallback; surface error immediately
```

**Rules:**
- Each transport is tried at most once per session (no retry loops without OAuth token change)
- `httpReturned404` boolean flag gates SSE fallback and influences user messaging
- No fallback when `type` is explicit
- One OAuth retry per transport; if it fails, move to next branch or surface final error
- `showAuthRequiredMessage()` is called only after all paths exhausted (terminal step only)

## Implementation Tasks

### File: `packages/core/src/tools/mcp-client.ts`

**Pre-implementation requirement**: Read the current LLxprt implementation of `connectToMcpServer()` carefully to identify any local customizations to OAuth token acquisition, event/feedback infrastructure, or auth retry paths. Do not assume it is identical to upstream.

#### Step 1 — Update imports

```typescript
import {
  getErrorMessage,
  isAuthenticationError,
  UnauthorizedError,
} from '../utils/errors.js';
```

Add marker: `@plan:PLAN-20250219-GMERGE021.R3.P04`

#### Step 2 — Replace `createUrlTransport()`

```typescript
/**
 * Creates the appropriate transport based on config priority rules.
 * Priority: httpUrl (deprecated) > url+type > url (default HTTP).
 *
 * @plan PLAN-20250219-GMERGE021.R3.P04
 * @requirement REQ-GMERGE021-R3-001
 */
function createUrlTransport(
  mcpServerName: string,
  mcpServerConfig: MCPServerConfig,
  transportOptions:
    | StreamableHTTPClientTransportOptions
    | SSEClientTransportOptions,
): StreamableHTTPClientTransport | SSEClientTransport {
  // Priority 1: httpUrl (deprecated)
  if (mcpServerConfig.httpUrl) {
    if (mcpServerConfig.url) {
      debugLogger.warn(
        `MCP server '${mcpServerName}': Both 'httpUrl' and 'url' are configured. ` +
          `Using deprecated 'httpUrl'. Migrate to 'url' with 'type: "http"'.`,
      );
    }
    return new StreamableHTTPClientTransport(
      new URL(mcpServerConfig.httpUrl),
      transportOptions,
    );
  }

  // Priority 2 & 3: url with explicit type — no fallback will occur
  if (mcpServerConfig.url && mcpServerConfig.type) {
    if (mcpServerConfig.type === 'http') {
      return new StreamableHTTPClientTransport(
        new URL(mcpServerConfig.url),
        transportOptions,
      );
    }
    return new SSEClientTransport(
      new URL(mcpServerConfig.url),
      transportOptions,
    );
  }

  // Priority 4: url without type — defaults to HTTP; SSE fallback handled in connectToMcpServer
  if (mcpServerConfig.url) {
    return new StreamableHTTPClientTransport(
      new URL(mcpServerConfig.url),
      transportOptions,
    );
  }

  throw new Error(`No URL configured for MCP server '${mcpServerName}'`);
}
```

#### Step 3 — Add helper functions (dependency order: lowest-level first)

```typescript
/**
 * Retrieves a stored OAuth access token for the given server, or null if none.
 * @plan PLAN-20250219-GMERGE021.R3.P04
 */
async function getStoredOAuthToken(serverName: string): Promise<string | null> {
  // Use the existing LLxprt OAuth token storage mechanism identified in P01 preflight.
  // Do NOT invent a new token store.
}

/**
 * Creates an SSE transport configured with an optional Bearer auth token.
 * @plan PLAN-20250219-GMERGE021.R3.P04
 */
function createSSETransportWithAuth(
  config: MCPServerConfig,
  accessToken?: string | null,
): SSEClientTransport {
  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return new SSEClientTransport(new URL(config.url!), { requestInit: { headers } });
}

/**
 * Connects the MCP client using SSE transport.
 * @plan PLAN-20250219-GMERGE021.R3.P04
 */
async function connectWithSSETransport(
  client: Client,
  config: MCPServerConfig,
  accessToken?: string | null,
): Promise<void> {
  const transport = createSSETransportWithAuth(config, accessToken);
  await client.connect(transport);
}

/**
 * Terminal auth failure message. Called only after all transport/OAuth paths exhausted.
 * @plan PLAN-20250219-GMERGE021.R3.P04
 */
async function showAuthRequiredMessage(serverName: string): Promise<never> {
  coreEvents.emitFeedback(
    'info',
    `MCP server '${serverName}' requires authentication. ` +
      `Run 'mcp auth ${serverName}' to configure OAuth.`,
  );
  throw new UnauthorizedError(`Authentication required for '${serverName}'`);
}

/**
 * Retries MCP connection with OAuth token after a 401.
 * @plan PLAN-20250219-GMERGE021.R3.P04
 */
async function retryWithOAuth(
  client: Client,
  serverName: string,
  config: MCPServerConfig,
  accessToken: string,
  httpFailed404: boolean,
): Promise<void> {
  if (httpFailed404) {
    // HTTP proved unsupported; go directly to SSE with token
    await connectWithSSETransport(client, config, accessToken);
    return;
  }
  // Try HTTP with token first, then SSE fallback on failure
  try {
    const transport = new StreamableHTTPClientTransport(new URL(config.url!), {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    await client.connect(transport);
  } catch {
    await connectWithSSETransport(client, config, accessToken);
  }
}
```

#### Step 4 — Rewrite `connectToMcpServer()` transport/fallback/auth section

Following the state machine exactly:

- Set `httpReturned404 = false` before HTTP attempt
- Catch HTTP errors; set `httpReturned404 = true` for 404-class errors
- Only enter SSE fallback branch when `config.type` is `undefined`/`null`
- On SSE fallback: emit `debugLogger.info('HTTP transport failed, retrying with SSE transport...')`
- Also emit user-facing info for deprecated `url`-without-type:
  ```
  `MCP server '${name}': HTTP transport failed. Falling back to SSE. ` +
  `Add 'type: "sse"' to your config to suppress this message and avoid the probe attempt.`
  ```
- Call `showAuthRequiredMessage()` only as terminal step after all paths exhausted

## Logging and Messaging Contract

| Condition | Log level | Where |
|-----------|-----------|-------|
| `httpUrl` + `url` both set | `debugLogger.warn` | `createUrlTransport` |
| HTTP→SSE fallback (debug) | `debugLogger.info` | `connectToMcpServer` |
| HTTP→SSE fallback (user) | `coreEvents.emitFeedback('info', ...)` | `connectToMcpServer` |
| OAuth required (terminal) | `coreEvents.emitFeedback('info', ...)` | `showAuthRequiredMessage` |
| All other auth messages | `info` level | `connectToMcpServer` |
| `debugLogger.warn` | Only for unexpected conditions | (as above) |

## Verification Commands

```bash
# Structural markers
grep -rn "@plan:PLAN-20250219-GMERGE021.R3.P04" packages/core/src/tools/mcp-client.ts | wc -l
# Expected: 6+ occurrences

# Transport selection tests pass (#1–6)
npm test -- --grep "createUrlTransport"
# Expected: All pass

# Fallback tests pass (#7–11)
npm test -- --grep "fallback\|connectToMcpServer"
# Expected: All pass

# OAuth tests pass (#20–24)
npm test -- --grep "OAuth\|retryWithOAuth"
# Expected: All pass

npm run typecheck
# Expected: 0 errors
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|in a real|for now|placeholder)" \
  packages/core/src/tools/mcp-client.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] `createUrlTransport` follows priority: `httpUrl` > `url+type` > `url`
- [ ] SSE fallback only fires when `type` is absent
- [ ] `httpReturned404` correctly gates fallback behavior
- [ ] `showAuthRequiredMessage()` only called as terminal step
- [ ] Deprecation warning logged when both `httpUrl` and `url` present
- [ ] Migration hint emitted to user (not just debug log) when SSE fallback occurs
- [ ] Tests #1–11 and #20–24 all pass
- [ ] No `getStoredOAuthToken` stub — actual storage mechanism from P01 is used

## Success Criteria

- Tests #1–11 and #20–24 pass
- TypeScript compiles cleanly
- No deferred implementations in `mcp-client.ts`

## Failure Recovery

1. `git checkout -- packages/core/src/tools/mcp-client.ts`

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

---

# Phase P05: Manager, CLI, and UI Implementation

## Phase ID

`PLAN-20250219-GMERGE021.R3.P05`

## Prerequisites

- Required: Phase P04 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P04.md` exists
- Tests #1–24 passing

## Requirements Implemented

Implements REQ-GMERGE021-R3-004 (manager messaging), REQ-GMERGE021-R3-005 (CLI output), REQ-GMERGE021-R3-006 (OAuth UI listing).

## Implementation Tasks

### File: `packages/core/src/tools/mcp-client-manager.ts`

Add import:

```typescript
import { getErrorMessage, isAuthenticationError } from '../utils/errors.js';
```

Update the catch block in discovery (check line numbers via `grep -n "catch" mcp-client-manager.ts`):

```typescript
} catch (error) {
  this.eventEmitter?.emit('mcp-client-update', this.clients);
  // Auth errors produce user messaging inside mcp-client.ts (info level).
  // Emitting a red error here would create duplicate/conflicting output.
  // @plan PLAN-20250219-GMERGE021.R3.P05
  if (!isAuthenticationError(error)) {
    const errorMessage = getErrorMessage(error);
    coreEvents.emitFeedback(
      'error',
      `Error during discovery for MCP server '${name}': ${errorMessage}`,
      error,
    );
  }
}
```

**Messaging contract enforced:**
- `mcp-client.ts` owns all user-facing output for auth failures
- `mcp-client-manager.ts` suppresses red error only for auth errors
- Non-auth errors still get exactly one red error from the manager

### File: `packages/cli/src/commands/mcp/add.ts`

Update transport switch cases to use `url` + `type` instead of `httpUrl`:

```typescript
case 'sse':
  newServer = {
    url: commandOrUrl,
    type: 'sse',
    headers,
    timeout,
    trust,
    description,
    includeTools,
    excludeTools,
  };
  break;
case 'http':
  newServer = {
    url: commandOrUrl,
    type: 'http',
    headers,
    timeout,
    trust,
    description,
    includeTools,
    excludeTools,
  };
  break;
```

Add marker: `@plan:PLAN-20250219-GMERGE021.R3.P05`

Note: Existing configs with `httpUrl` remain supported (backward-compatible read path in `mcp-client.ts`). The CLI just stops writing new `httpUrl` entries.

### File: `packages/cli/src/ui/commands/mcpCommand.ts`

#### Step 1 — Verify export surface before importing

```bash
grep -n "mcpServerRequiresOAuth" packages/core/src/tools/index.ts
grep -n "mcpServerRequiresOAuth" packages/core/src/index.ts
```

If not exported, add to `packages/core/src/tools/index.ts`:

```typescript
export { mcpServerRequiresOAuth } from './mcp-client.js';
```

Also verify `packages/core/package.json` `exports` field permits this path. Check for circular dependency risk (low for a module-level Map, but confirm).

#### Step 2 — Add import

```typescript
import { mcpServerRequiresOAuth } from '@vybestack/llxprt-code-core';
```

#### Step 3 — Update OAuth server listing

```typescript
const configuredOAuthServers = Object.entries(mcpServers)
  .filter(([_, server]) => server.oauth?.enabled)
  .map(([name]) => name);

const detectedOAuthServers = Array.from(mcpServerRequiresOAuth.keys())
  .filter((name) => name in mcpServers); // Only include known configured servers

const allOAuthServers = [...new Set([...configuredOAuthServers, ...detectedOAuthServers])];
```

#### Step 4 — Update auth status check

```typescript
if (server.oauth?.enabled || mcpServerRequiresOAuth.has(serverName)) {
```

Add marker: `@plan:PLAN-20250219-GMERGE021.R3.P05`

### File: `packages/core/src/tools/index.ts`

Verify and fix `mcpServerRequiresOAuth` export (see Step 1 above). Add marker: `@plan:PLAN-20250219-GMERGE021.R3.P05`

## Verification Commands

```bash
# Structural markers
grep -rn "@plan:PLAN-20250219-GMERGE021.R3.P05" packages/ | wc -l
# Expected: 4+ occurrences

# Manager messaging tests pass (#23–24)
npm test -- --grep "manager.*error\|auth.*manager\|emitFeedback"
# Expected: All pass

# CLI config-write tests pass (#25–26)
npm test -- --grep "mcp add\|transport.*config"
# Expected: All pass

# UI OAuth listing tests pass (#27–29)
npm test -- --grep "OAuth.*list\|mcpServerRequiresOAuth"
# Expected: All pass

npm run typecheck
# Expected: 0 errors
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|in a real|for now|placeholder)" \
  packages/core/src/tools/mcp-client-manager.ts \
  packages/cli/src/commands/mcp/add.ts \
  packages/cli/src/ui/commands/mcpCommand.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] Manager emits zero `'error'` events for a 401 connection failure
- [ ] Manager emits exactly one `'error'` event for non-auth failures
- [ ] `mcp add --transport http` writes `{ url, type: 'http' }` (verified by reading written config)
- [ ] `mcp add --transport sse` writes `{ url, type: 'sse' }` (verified by reading written config)
- [ ] `mcpServerRequiresOAuth` exported from core package (verified by import resolving)
- [ ] Detected OAuth servers appear in UI listing alongside configured ones
- [ ] No `httpUrl` key written by CLI for new entries
- [ ] Tests #23–29 all pass

## Success Criteria

- Tests #23–29 pass
- TypeScript compiles cleanly
- No deferred implementations

## Failure Recovery

1. `git checkout -- packages/core/src/tools/mcp-client-manager.ts`
2. `git checkout -- packages/cli/src/commands/mcp/add.ts`
3. `git checkout -- packages/cli/src/ui/commands/mcpCommand.ts`

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

---

# Phase P06: Backward Compatibility and Warning Validation

## Phase ID

`PLAN-20250219-GMERGE021.R3.P06`

## Prerequisites

- Required: Phase P05 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P05.md` exists
- All tests #1–29 passing

## Requirements Implemented

Addresses the compatibility break risk documented in §3 of the original plan. Implements backward compatibility test cases #30–31.

## Compatibility Break Warning

**This is the highest-risk part of this commit.** Currently LLxprt interprets `url` as SSE. After this change, `url` without `type` defaults to HTTP with automatic HTTP→SSE fallback.

**Implications:**
1. Existing configs with `url` pointing to SSE-only endpoints will incur a failed HTTP probe before falling back to SSE — adding latency and potentially noisy logs
2. Servers that reject HTTP aggressively (non-404 failure) may not fall back to SSE, causing previously working configs to break
3. Any documentation promising "url = SSE" is invalidated

**Required mitigation (verify in this phase):**
- Deprecation-style migration hint is emitted when `url` without `type` falls back to SSE
- Hint instructs users to add `type: 'sse'` explicitly

## Implementation Tasks

### Audit Documentation

```bash
# Find documentation describing 'url' field semantics
grep -rn "\"url\".*SSE\|url.*field\|url.*transport" docs/ README.md packages/*/README.md 2>/dev/null

# Find CHANGELOG or migration guide
find . -name "CHANGELOG*" -o -name "MIGRATION*" | head -10
```

Update any documentation that promises `url` = SSE transport. Add a note to CHANGELOG/migration guide if found.

### Verify Migration Warning Implementation

Confirm the warning added in P04 is present and correctly worded:

```bash
grep -n "Add 'type: .sse'" packages/core/src/tools/mcp-client.ts
grep -n "emitFeedback.*info.*Falling back to SSE" packages/core/src/tools/mcp-client.ts
```

### Verify Backward Compatibility Test Cases

Tests #30 and #31 must pass:

```bash
npm test -- --grep "backward.*compat\|httpUrl.*legacy\|SSE.*fallback.*migration"
# Expected: Tests #30 and #31 pass
```

## Verification Commands

```bash
# All 31 tests pass
npm test -- --grep "@plan:.*GMERGE021.R3"
# Expected: 31 tests pass, 0 failing

# Full test suite passes (no regressions)
npm test
# Expected: All pass

npm run typecheck && npm run lint
# Expected: 0 errors
```

### Semantic Verification Checklist

- [ ] Test #30: Existing config with `httpUrl` still connects (no regression)
- [ ] Test #31: `url`-without-type targeting SSE-only endpoint falls back and emits migration hint
- [ ] Documentation updated where `url` = SSE was promised
- [ ] CHANGELOG updated if file exists
- [ ] No regressions in full test suite
- [ ] `npm run lint` passes

## Success Criteria

- All 31 tests pass
- Full test suite shows no regressions
- TypeScript and lint clean

## Failure Recovery

1. Identify which test(s) regressed via `npm test` output
2. `git log --oneline -10` to locate the introducing commit
3. `git diff HEAD~1` to narrow the regression

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P06.md`

---

# Phase P07: Final Verification and Integration Check

## Phase ID

`PLAN-20250219-GMERGE021.R3.P07`

## Prerequisites

- Required: Phase P06 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P06.md` exists
- All 31 tests passing, full suite clean

## Purpose

End-to-end integration verification. Confirm the feature is reachable from CLI through to transport selection.

## Implementation Tasks

No new code. Verification only.

## Verification Commands

### Full Verification Suite

```bash
npm run test
npm run typecheck
npm run lint
npm run format
npm run build
```

### Smoke Test

```bash
node scripts/start.js --profile-load synthetic "write me a haiku"
# Expected: Haiku produced; no MCP transport errors in output
```

### Plan Marker Completeness

```bash
# All phases have markers
for phase in P01 P02 P03 P04 P05; do
  count=$(grep -r "@plan:PLAN-20250219-GMERGE021.R3.$phase" packages/ | wc -l)
  echo "Phase $phase: $count markers"
done
# Expected: Each phase shows 1+ markers

# All requirement IDs are covered
for req in REQ-GMERGE021-R3-001 REQ-GMERGE021-R3-002 REQ-GMERGE021-R3-003 REQ-GMERGE021-R3-004 REQ-GMERGE021-R3-005 REQ-GMERGE021-R3-006; do
  count=$(grep -r "@requirement:$req" packages/ | wc -l)
  echo "$req: $count markers"
done
# Expected: Each requirement shows 1+ markers

# Completion markers exist for all phases
ls project-plans/gmerge-0.21.3/.completed/
# Expected: P01.md P02.md P03.md P04.md P05.md P06.md present
```

### Deferred Implementation Final Check

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|in a real|for now|placeholder|not yet|will be)" \
  packages/core/src/config/config.ts \
  packages/core/src/utils/errors.ts \
  packages/core/src/tools/mcp-client.ts \
  packages/core/src/tools/mcp-client-manager.ts \
  packages/cli/src/commands/mcp/add.ts \
  packages/cli/src/ui/commands/mcpCommand.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] All 6 phases have completion markers in `project-plans/gmerge-0.21.3/.completed/`
- [ ] All 31 test cases pass
- [ ] All 6 requirement IDs have `@requirement:` markers in implementation
- [ ] `npm run build` succeeds
- [ ] Haiku smoke test produces output with no errors
- [ ] No deferred implementations anywhere in modified files
- [ ] Backward compatibility verified (tests #30–31 pass)

#### Integration Points Verified

- [ ] `MCPServerConfig.type` field flows from config parsing → `createUrlTransport()` → transport selection
- [ ] `isAuthenticationError()` called correctly in `connectToMcpServer()` and `mcp-client-manager.ts`
- [ ] `mcpServerRequiresOAuth` Map exported from core and imported in CLI UI
- [ ] `showAuthRequiredMessage()` is the sole source of terminal auth user messages
- [ ] Manager's catch block suppresses red error exactly and only for auth failures

#### Feature Reachability Verified

- [ ] `mcp add --transport http <url>` → config has `{ url, type: 'http' }` (no `httpUrl`)
- [ ] `mcp add --transport sse <url>` → config has `{ url, type: 'sse' }`
- [ ] Connection with `url`+`type: 'sse'` → SSEClientTransport selected, no HTTP probe
- [ ] Connection with `url` only and HTTP failing → SSE fallback, migration warning emitted

## Success Criteria

- `npm run test && npm run typecheck && npm run lint && npm run format && npm run build` all pass
- Haiku smoke test succeeds
- Plan marker completeness verified
- No deferred implementations

## Failure Recovery

1. Identify failing step from verification suite output
2. Trace back to introducing phase via `git log --oneline`
3. Return to appropriate phase and fix; re-run full verification cycle from that phase forward

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P07.md`

---

# Execution Tracker

## Execution Status

| Phase | ID | Status | Started | Completed | Verified | Semantic? | Notes |
|-------|-----|--------|---------|-----------|----------|-----------|-------|
| Preflight | P01 | ⬜ | - | - | - | N/A | Preflight verification |
| TDD Tests | P02 | ⬜ | - | - | - | ⬜ | Write all 31 tests (red) |
| Config + Errors | P03 | ⬜ | - | - | - | ⬜ | `MCPServerConfig.type` + `isAuthenticationError` |
| Transport Logic | P04 | ⬜ | - | - | - | ⬜ | `mcp-client.ts` rewrite |
| Manager + CLI + UI | P05 | ⬜ | - | - | - | ⬜ | Manager, `mcp add`, OAuth UI |
| Compat + Warnings | P06 | ⬜ | - | - | - | ⬜ | Backward compat validation |
| Final Verify | P07 | ⬜ | - | - | - | ⬜ | Full suite + smoke test |

**Note**: "Semantic?" column tracks whether semantic verification (feature actually works) was performed, not just structural verification (files exist and markers are present). A phase is only truly complete when both structural and semantic checks pass.

## Completion Markers

- [ ] All phases have `@plan` markers in code
- [ ] All requirements have `@requirement` markers
- [ ] Verification suite (`test`, `typecheck`, `lint`, `format`, `build`) passes
- [ ] No phases skipped
- [ ] Haiku smoke test passes
- [ ] `project-plans/gmerge-0.21.3/.completed/P07.md` created
