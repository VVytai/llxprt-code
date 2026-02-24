# Reimplementation Plan: Mark A2A Requests as Interactive (0c3eb826)

**Upstream Commit:** 0c3eb826711d3d59f71f2a5f81c2ce9d5ce934c5  
**Risk Level:** LOW  
**Estimated Scope:** 1 line  
**Author:** Mayur Vaid

## Summary

Mark A2A (Agent-to-Agent) requests as interactive so tool confirmation mechanisms work properly. This is a simple one-line fix that enables proper tool governance in A2A contexts.

**IMPORTANT:** A2A package remains PRIVATE and is NOT part of public distribution.

## The Problem

After adding the non-interactive confirmation check (commit 217e2b0e), A2A requests would fail when tools require confirmation because A2A config didn't specify `interactive: true`.

Without this fix:
1. A2A request comes in
2. Tool requires confirmation
3. Scheduler checks `config.isInteractive()` → returns `false` (default)
4. Throws error: "requires user confirmation, which is not supported in non-interactive mode"
5. Tool execution fails

With this fix:
1. A2A request comes in with `interactive: true` in config
2. Tool requires confirmation
3. Scheduler checks `config.isInteractive()` → returns `true`
4. Shows confirmation dialog (via A2A protocol)
5. Tool execution succeeds after confirmation

## Current State Analysis

**File:** `packages/a2a-server/src/config/config.ts`

The `loadConfig()` function around line 40-80 creates a `ConfigParameters` object that's passed to the `Config` constructor.

Current config likely has properties like:
```typescript
const configParams: ConfigParameters = {
  sessionId: taskId,
  model: DEFAULT_GEMINI_MODEL,
  embeddingModel: DEFAULT_GEMINI_EMBEDDING_MODEL,
  sandbox: undefined,
  targetDir: workspaceDir,
  debugMode: process.env['DEBUG'] === 'true' || false,
  approvalMode: process.env['GEMINI_YOLO_MODE'] === 'true'
    ? ApprovalMode.YOLO
    : ApprovalMode.DEFAULT,
  mcpServers,
  cwd: workspaceDir,
  telemetry: { /* ... */ },
  fileFiltering: { /* ... */ },
  ideMode: false,
  folderTrust: settings.folderTrust === true,
  extensions,
  // MISSING: interactive: true
};
```

## Implementation Steps

### 1. Add Interactive Flag

**File:** `packages/a2a-server/src/config/config.ts`

**Location:** In the `loadConfig()` function, around line 75 (after `folderTrust`, before `extensions`)

**Change:**
```typescript
const configParams: ConfigParameters = {
  sessionId: taskId,
  model: DEFAULT_GEMINI_MODEL,
  embeddingModel: DEFAULT_GEMINI_EMBEDDING_MODEL,
  sandbox: undefined,
  targetDir: workspaceDir,
  debugMode: process.env['DEBUG'] === 'true' || false,
  question: '',
  coreTools: settings.coreTools || undefined,
  excludeTools: settings.excludeTools || undefined,
  showMemoryUsage: settings.showMemoryUsage || false,
  approvalMode:
    process.env['GEMINI_YOLO_MODE'] === 'true'
      ? ApprovalMode.YOLO
      : ApprovalMode.DEFAULT,
  mcpServers,
  cwd: workspaceDir,
  telemetry: {
    enabled: settings.telemetry?.enabled,
    target: settings.telemetry?.target as TelemetryTarget,
    otlpEndpoint:
      process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
      settings.telemetry?.otlpEndpoint,
    logPrompts: settings.telemetry?.logPrompts,
  },
  fileFiltering: {
    respectGitIgnore: settings.fileFiltering?.respectGitIgnore,
    enableRecursiveFileSearch:
      settings.fileFiltering?.enableRecursiveFileSearch,
  },
  ideMode: false,
  folderTrust: settings.folderTrust === true,
  interactive: true,  // ADD THIS LINE
  extensions,
};
```

### 2. Verify Configuration

The `Config` class should already support the `interactive` parameter since it's part of core. No changes needed in Config class itself.

### 3. Verification Steps

```bash
# 1. Type check
npm run typecheck

# 2. Build A2A package
cd packages/a2a-server
npm run build

# 3. Run A2A tests if any
npm test

# 4. Lint
npm run lint
```

### 4. Manual Testing (if possible)

If you have A2A server running:
1. Send request that triggers tool requiring confirmation
2. Verify confirmation dialog appears (via A2A protocol)
3. Confirm or reject
4. Verify tool executes or cancels appropriately
5. No "not supported in non-interactive mode" errors

## Context: Why A2A is Interactive

A2A (Agent-to-Agent) communication is interactive because:

1. **User in the loop:** A2A requests originate from user interactions with A2A clients
2. **Confirmation capability:** A2A protocol supports confirmation dialogs via message passing
3. **Not automated:** Unlike CI/CD or batch jobs, A2A has a user who can respond to prompts
4. **Same semantics as CLI:** A2A should have same tool capabilities as direct CLI use

## Relationship to Previous Commit

This commit **depends on** the previous commit (217e2b0e) which added the `isInteractive()` check. The sequence is:

1. **217e2b0e:** Add check: if tool needs confirmation AND not interactive, throw error
2. **0c3eb826:** Mark A2A as interactive so check passes

Without 0c3eb826, A2A would break after 217e2b0e.

## Files Modified

- `packages/a2a-server/src/config/config.ts` (+1 line)

**Total:** 1 LoC

## Testing Strategy

### Unit Tests
- No new tests needed (config parameter is trivial)
- Existing A2A tests should pass if run

### Integration Tests
- A2A server should start successfully
- Tools requiring confirmation should work in A2A context

### Regression Tests
- Run full test suite: `npm test`
- Verify no impact on other packages (A2A is isolated)

## Privacy & Distribution Note

**CRITICAL:** The A2A package is PRIVATE and must remain so:
- Not published to npm
- Not included in public distributions
- Internal use only
- May contain proprietary logic

When merging/cherry-picking upstream changes:
- [OK] Merge changes to `packages/a2a-server/` 
- [ERROR] Do NOT expose A2A in public docs
- [ERROR] Do NOT publish `@google/gemini-a2a-server`

## Success Criteria

- [ ] `interactive: true` added to A2A config
- [ ] Type checking passes
- [ ] A2A package builds successfully
- [ ] No regressions in other packages
- [ ] Tools requiring confirmation work in A2A context (if testable)

## Commit Message

```
reimplement: mark A2A requests as interactive (upstream 0c3eb826)

Set interactive: true in A2A config so tool confirmation mechanisms work
properly. A2A requests originate from user interactions and support
confirmation dialogs via the A2A protocol.

Note: A2A package remains PRIVATE and is not part of public distribution.

Upstream: 0c3eb826711d3d59f71f2a5f81c2ce9d5ce934c5
Author: Mayur Vaid <34806097+MayV@users.noreply.github.com>
```

## Additional Notes

### If A2A doesn't exist in our codebase

If `packages/a2a-server/` doesn't exist in our fork:
- **Skip this commit** - it's not needed
- Document why: "A2A package not present in our fork"
- The previous commit (217e2b0e) stands alone and works fine

### If A2A exists but is different

If the config structure differs significantly:
- Find equivalent location where Config is created
- Add `interactive: true` to the config parameters
- May need to adjust parameter name if Config API differs
- Test thoroughly

### Upstream Parity

This commit exists in upstream to fix A2A after the non-interactive check was added. If we maintain A2A, we need this fix. If we don't have A2A, we can skip it.
