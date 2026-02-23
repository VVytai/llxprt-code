# Remediation Plan: R3 — MCP URL Transport Parity + OAuth/Fallback State Machine Coverage

**Priority:** P0 (display correctness) + P1 (state-machine coverage)
**Estimated Effort:** 14-20 hours
**Root Cause:** Transport consolidation landed, but parity gaps remain: `/mcp list` mislabels `url` transport as SSE, `createTransportWithOAuth` does not mirror `createUrlTransport` semantics, and `connectToMcpServer` fallback/OAuth branches are under-tested.

---

## Review Status

Round 1 (deepthinker): APPROVE_WITH_CHANGES — applied.
Round 2 (deepthinker + typescriptexpert): APPROVE_WITH_CHANGES — applied below.

---

## Scope

1. Fix `/mcp list` transport display for `url` config.
2. Implement full 4-priority transport chain in `createTransportWithOAuth` to match `createUrlTransport`.
3. Add error throw for invalid config (no url/httpUrl) matching `createUrlTransport` pattern.
4. Add deprecation warning when both `httpUrl` and `url` are present.
5. Add robust test coverage for HTTP/SSE fallback and OAuth retry behavior.
6. Add behavioral coverage for branch ordering, cleanup/state consistency, and explicit-type anti-fallback.

---

## Known Baseline (RED state for Phase B)

Current `createTransportWithOAuth` behavior (lines 734-768):
- `httpUrl` -> HTTP transport (correct)
- `url` (any type or no type) -> SSE transport (**WRONG** for type:http and no-type cases)

This must be fixed to match `createUrlTransport` 4-priority chain:
1. `httpUrl` -> HTTP
2. `url + type:http` -> HTTP
3. `url + type:sse` -> SSE
4. `url` (no type) -> HTTP (default)

Phase B tests will be RED against current code, then GREEN after fix.

---

## TDD Sequence

### Phase A: Display parity (RED then GREEN)

**File:** `packages/cli/src/commands/mcp/list.test.ts`

1. `url only` displays `(http)` — not `(sse)`
2. `url + type:sse` displays `(sse)`
3. `url + type:http` displays `(http)`
4. `httpUrl` displays `(http)`
5. `httpUrl + url both present` emits deprecation warning

### Phase B: OAuth transport parity (RED then GREEN)

**File:** `packages/core/src/tools/mcp-client.test.ts`

1. `createTransportWithOAuth` uses HTTP for `httpUrl`
2. `createTransportWithOAuth` uses HTTP for `url + type:http`
3. `createTransportWithOAuth` uses SSE for `url + type:sse`
4. `createTransportWithOAuth` defaults `url` (no type) to HTTP **(currently fails — SSE bug)**
5. `createTransportWithOAuth` throws when neither `url` nor `httpUrl` configured

### Phase C: connectToMcpServer state-machine behavior (RED then GREEN)

1. initial 401 + stored token -> retry path succeeds
2. initial 401 + no token -> auth-required error path
3. non-401 error + `url` + no type + `httpReturned404=false` -> SSE fallback attempted
4. 404/Not Found string variants set `httpReturned404=true` and suppress SSE fallback
5. fallback SSE then 401 + stored token -> OAuth SSE retry succeeds
6. repeated 401 after token retry -> auth-required path is deterministic
7. explicit `type:http` prevents SSE fallback even on 404

### Phase D: Branch-hardening and hygiene (RED then GREEN)

1. transport close called when initial connect fails
2. fallback failure preserves meaningful error propagation
3. `mcpServerRequiresOAuth` set on auth failures, NOT set on non-auth failures (negative assertion)
4. no spurious fallback when explicit `type` is provided

---

## Implementation Steps

### Step 1: Fix list output label

**File:** `packages/cli/src/commands/mcp/list.ts`

- Replace hardcoded `server.url (sse)` with `server.url (${server.type ?? 'http'})`.
- Add deprecation warning when both `httpUrl` and `url` are present.

### Step 2: Implement full 4-priority chain in createTransportWithOAuth

**File:** `packages/core/src/tools/mcp-client.ts`

Update `createTransportWithOAuth` to implement same priority chain as `createUrlTransport`:
1. `httpUrl` -> `StreamableHTTPClientTransport`
2. `url + type:http` -> `StreamableHTTPClientTransport`
3. `url + type:sse` -> `SSEClientTransport`
4. `url` (no type) -> `StreamableHTTPClientTransport`
5. No url/httpUrl -> throw Error (matching `createUrlTransport` line 721)

### Step 3: Consider refactoring createSSETransportWithAuth

**File:** `packages/core/src/tools/mcp-client.ts`

After fixing `createTransportWithOAuth`, evaluate whether `createSSETransportWithAuth` can reuse the new logic to avoid duplication.

### Step 4: Add state-machine and hygiene tests

**File:** `packages/core/src/tools/mcp-client.test.ts`

- Add targeted tests for:
  - 401-first branch behavior
  - 404 string-detection variants (`'404'`, `'Not Found'`)
  - Explicit type anti-fallback
  - OAuth state map negative assertions
  - Transport close on failure
  - Fallback chaining

---

## Verification

```bash
npm run test -- packages/cli/src/commands/mcp/list.test.ts
npm run test -- packages/core/src/tools/mcp-client.test.ts
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
| Complex branch interactions in tests | Focused fixtures per branch with explicit call-order assertions |
| Brittle string-based 404 detection | Lock current behavior with explicit tests; add TODO for structured errors |
| OAuth fallback flakiness in mocks | Reuse existing token/auth mocks from `mcp-client.test.ts` |
| Regressing explicit `type` semantics | Include explicit `type:http` and `type:sse` anti-fallback tests |
| createTransportWithOAuth return type confusion | Remove `null` return; throw error for invalid config instead |

---

## Done Criteria

- [ ] `/mcp list` transport labels correct for `httpUrl`, `url`, and explicit `type`
- [ ] Deprecation warning emitted when both `httpUrl` and `url` present
- [ ] `createTransportWithOAuth` implements full 4-priority chain matching `createUrlTransport`
- [ ] `createTransportWithOAuth` throws for invalid config (no url/httpUrl)
- [ ] 401-first branch behavior covered and deterministic
- [ ] Non-401 fallback behavior covered for eligible and ineligible configs
- [ ] 404 string-detection behavior explicitly tested with variants
- [ ] Explicit type prevents fallback (anti-fallback tested)
- [ ] `mcpServerRequiresOAuth` state transitions tested (positive and negative)
- [ ] Transport close hygiene covered
- [ ] Full verification sequence passes
