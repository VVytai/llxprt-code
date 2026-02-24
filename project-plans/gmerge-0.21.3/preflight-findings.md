# Preflight Verification Findings

## Phase P01 Completion Status: [OK] PASS

Date: 2025-02-19
Plan: PLAN-20250219-GMERGE021.R3.P01

## Dependency Verification

### MCP SDK Error Shapes

[OK] **SseError** - Confirmed present with `.code` property
- Location: `node_modules/@modelcontextprotocol/sdk/dist/esm/client/sse.d.ts`
- Shape: `readonly code: number | undefined`
- Constructor: `constructor(code: number | undefined, message: string | undefined, event: ErrorEvent)`

[OK] **StreamableHTTPError** - Confirmed present with `.code` property
- Location: `node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.d.ts`
- Shape: `readonly code: number | undefined`
- Constructor: `constructor(code: number | undefined, message: string | undefined)`

### Transport Classes

[OK] **StreamableHTTPClientTransport** - Imported correctly
- Import: `packages/core/src/tools/mcp-client.ts:18`
- Usage: Present in `createUrlTransport` and `createTransportWithOAuth`

[OK] **SSEClientTransport** - Imported correctly
- Import: `packages/core/src/tools/mcp-client.ts:15`
- Usage: Present in `createUrlTransport` and `createTransportWithOAuth`

### OAuth and State Management

[OK] **mcpServerRequiresOAuth** - Confirmed exported
- Location: `packages/core/src/tools/mcp-client.ts:252`
- Type: `Map<string, boolean>`
- Export: `export const mcpServerRequiresOAuth`

[OK] **OAuth Token Storage** - MCPOAuthTokenStorage pattern confirmed
- Class: `MCPOAuthTokenStorage` in `packages/core/src/mcp/oauth-token-storage.ts`
- Usage pattern: `new MCPOAuthTokenStorage()` followed by `getCredentials(serverName)`
- Access token retrieval: `MCPOAuthProvider.getValidToken(serverName, { clientId })`
- Current implementation uses this pattern in lines 1052, 1136, 1210, 1277, 1431

## Type/Interface Verification

[OK] **MCPServerConfig** - Current shape confirmed
- Location: `packages/core/src/config/config.ts:282`
- Has: `url`, `httpUrl` fields
- Missing: `type` field (to be added in P03)

[OK] **UnauthorizedError** - Confirmed exists
- Location: `packages/core/src/utils/errors.ts:74`
- Type: `export class UnauthorizedError extends Error {}`

[OK] **coreEvents.emitFeedback** - Available for messaging
- Import pattern verified in existing codebase
- Used in multiple error handling paths

## Call Path Verification

[OK] **connectToMcpServer** - Located at line 963 in `mcp-client.ts`
[OK] **createUrlTransport** - Located at line 463 in `mcp-client.ts`
[OK] **mcpServerRequiresOAuth export** - Needs to be re-exported from public API (action item for P05)
[OK] **mcp add command** - Located in `packages/cli/src/commands/mcp/add.ts`

## Current Implementation Analysis

### Transport Selection Logic (Current State)
```typescript
// Current implementation (line 463-482):
function createUrlTransport(...) {
  if (mcpServerConfig.httpUrl) {
    return new StreamableHTTPClientTransport(...);
  }
  if (mcpServerConfig.url) {
    return new SSEClientTransport(...);  // WARNING: Will change to HTTP default
  }
  throw new Error('No URL configured for MCP Server');
}
```

**Key Finding:** Current implementation treats `url` as SSE-only. This is a **semantic breaking change** when we switch to HTTP-first with SSE fallback.

### Auth Handling (Current State)
- Line 1042-1323: Complex 401 handling with automatic OAuth discovery
- Pattern: Check for 401 in error string, attempt OAuth discovery, retry with token
- No structured `isAuthenticationError()` helper - uses string matching

### Existing Tests

[OK] **Test files located:**
- `packages/core/src/tools/mcp-client.test.ts` - Exists
- `packages/core/src/tools/mcp-client-manager.test.ts` - Exists
- No `packages/core/src/utils/errors.test.ts` - Will need to create
- CLI tests to be located in P02

## Blocking Issues

**None identified** - All dependencies verified, ready to proceed to P02.

## Risks and Mitigation

### High Risk: Semantic Breaking Change
**Issue:** `url` field currently means SSE, will change to HTTP-first
**Affected:** Any existing config with `url` pointing to SSE-only endpoints
**Mitigation Plan:**
1. Deprecation warning when fallback occurs (implemented in P04)
2. Migration hint directing users to add `type: 'sse'` explicitly
3. Tests (#30-31) verify backward compatibility with httpUrl

### Medium Risk: False Positive Auth Detection
**Issue:** Current implementation uses `errorString.includes('401')`
**Mitigation:** Use structured error detection with anchored patterns (P03)

### Low Risk: Export Surface Changes
**Issue:** `mcpServerRequiresOAuth` needs public export for CLI
**Mitigation:** Explicit export verification in P05

## Action Items for Next Phases

- [ ] P02: Create `errors.test.ts` for `isAuthenticationError` tests
- [ ] P03: Add `type?: 'sse' | 'http'` to MCPServerConfig
- [ ] P04: Implement deprecation warnings for dual-field configs
- [ ] P05: Export `mcpServerRequiresOAuth` from core package public API
- [ ] P06: Update any documentation promising `url` = SSE semantics

## Verification Gate Status

- [x] All dependencies verified
- [x] All types match expectations
- [x] All call paths are traceable
- [x] Existing test blast-radius estimated
- [x] No blocking issues remain unresolved

**[OK] CLEARED TO PROCEED TO PHASE P02**
