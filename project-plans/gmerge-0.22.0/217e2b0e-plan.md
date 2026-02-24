# Reimplementation Plan: Non-Interactive Tool Confirmation Error (217e2b0e)

**Upstream Commit:** 217e2b0eb4fad36cb3fff33ac29f6b171ef244ce  
**Risk Level:** MEDIUM (Core tool execution flow)  
**Estimated Scope:** ~80-100 LoC across 3 files  
**Author:** Mayur Vaid

## Summary

Add error handling to throw when a tool requires user confirmation but the execution mode is non-interactive. This prevents tools from hanging or failing silently in automated/server contexts.

## The Problem

When tools require confirmation (e.g., `shouldConfirmExecute: true`) but are executed in non-interactive mode (servers, CI/CD, APIs), the current implementation doesn't explicitly fail - it may hang waiting for input or fail in unclear ways.

The fix adds an explicit check: if `tool.shouldConfirmExecute()` returns true and `config.isInteractive()` returns false, throw an error immediately.

## Current State Analysis

### Key Areas

1. **`coreToolScheduler.ts`** - Main scheduler logic that handles tool execution
2. **Test files** - Mock configs need `isInteractive()` method
3. **Policy engine** - Already has similar check (mentioned in upstream commit message)

### Expected Behavior

**Before fix:**
```typescript
// Tool requires confirmation
// isInteractive() = false
// Result: Unclear failure or hang
```

**After fix:**
```typescript
// Tool requires confirmation
// isInteractive() = false
// Result: Immediate error with clear message
```

## Implementation Steps

### 1. Add Check in CoreToolScheduler

**File:** `packages/core/src/core/coreToolScheduler.ts`

**Location:** In the tool validation/scheduling logic, around line 870 based on upstream.

Find the section that handles `shouldConfirmExecute()` check. It should be in a validation or scheduling method, possibly in a loop processing tool calls.

**Current code pattern:**
```typescript
const shouldConfirm = await tool.shouldConfirmExecute(/* ... */);
if (shouldConfirm) {
  // Show confirmation dialog
  this.setStatusInternal(reqInfo.callId, 'scheduled', signal);
} else {
  // Continue with execution
}
```

**Add check before showing confirmation:**
```typescript
const shouldConfirm = await tool.shouldConfirmExecute(/* ... */);
if (shouldConfirm) {
  // NEW: Check if interactive mode
  if (!this.config.isInteractive()) {
    throw new Error(
      `Tool execution for "${
        toolCall.tool.displayName || toolCall.tool.name
      }" requires user confirmation, which is not supported in non-interactive mode.`,
    );
  }
  
  // Fire Notification hook before showing confirmation to user
  const messageBus = this.config.getMessageBus();
  const hooksEnabled = this.config.getEnableHooks();
  // ... existing confirmation logic
  this.setStatusInternal(reqInfo.callId, 'scheduled', signal);
} else {
  // Continue with execution
}
```

**Note:** The upstream commit shows this is added in a section that also has hook notification logic and message bus code.

### 2. Update Mock Configs in Tests

**File:** `packages/core/src/core/coreToolScheduler.test.ts`

**Location:** `createMockConfig()` function around line 232-260

Add to mock config:
```typescript
function createMockConfig(overrides: Partial<Config> = {}): Config {
  const defaultConfig = {
    // ... existing config
    getDebugMode: () => false,
    isInteractive: () => true,  // ADD THIS LINE (default to true for most tests)
    getApprovalMode: () => ApprovalMode.DEFAULT,
    // ... rest of config
  };
  return { ...defaultConfig, ...overrides } as Config;
}
```

**Add new test case:**
```typescript
it('should error when tool requires confirmation in non-interactive mode', async () => {
  const mockTool = new MockTool({
    name: 'mockTool',
    shouldConfirmExecute: MOCK_TOOL_SHOULD_CONFIRM_EXECUTE,
  });
  const declarativeTool = mockTool;
  const mockToolRegistry = {
    getTool: () => declarativeTool,
    // ... other registry methods
  } as unknown as ToolRegistry;

  const onAllToolCallsComplete = vi.fn();
  const onToolCallsUpdate = vi.fn();

  const mockConfig = createMockConfig({
    getToolRegistry: () => mockToolRegistry,
    isInteractive: () => false,  // NON-INTERACTIVE
  });

  const scheduler = new CoreToolScheduler({
    config: mockConfig,
    onAllToolCallsComplete,
    onToolCallsUpdate,
    getPreferredEditor: () => 'vscode',
  });

  const abortController = new AbortController();
  const request = {
    callId: '1',
    name: 'mockTool',
    args: {},
    isClientInitiated: false,
    prompt_id: 'prompt-id-1',
  };

  await scheduler.schedule([request], abortController.signal);

  expect(onAllToolCallsComplete).toHaveBeenCalled();
  const completedCalls = onAllToolCallsComplete.mock.calls[0][0] as ToolCall[];
  expect(completedCalls[0].status).toBe('error');

  const erroredCall = completedCalls[0] as ErroredToolCall;
  const errorResponse = erroredCall.response;
  const errorParts = errorResponse.responseParts;
  // @ts-expect-error - accessing internal structure of FunctionResponsePart
  const errorMessage = errorParts[0].functionResponse.response.error;
  expect(errorMessage).toContain(
    'Tool execution for "mockTool" requires user confirmation, which is not supported in non-interactive mode.',
  );
});
```

**Remove `isInteractive: () => false` from other tests:**

Based on upstream commit, many tests had `isInteractive: () => false` explicitly set but don't actually test non-interactive behavior. Remove these lines so tests use the default (true):

- Around line 360 (basic tool execution test)
- Around line 460 (another execution test)
- Line ~707 (payload test)
- Line ~1013 (edit cancellation test)
- Line ~1430 (request queueing test)
- Multiple other locations

The pattern is:
```typescript
// Before
const mockConfig = createMockConfig({
  getToolRegistry: () => mockToolRegistry,
  isInteractive: () => false,  // REMOVE THIS LINE
});

// After
const mockConfig = createMockConfig({
  getToolRegistry: () => mockToolRegistry,
  // isInteractive defaults to true from createMockConfig
});
```

**Keep `isInteractive: () => false` ONLY in tests that:**
1. Specifically test non-interactive behavior
2. The new test case added above

### 3. Update A2A Server Test Utils

**File:** `packages/a2a-server/src/utils/testing_utils.ts`

Around line 32-48 in `createMockConfig()`:

Add:
```typescript
export function createMockConfig(
  overrides: Partial<Config> = {},
): Config {
  return {
    // ... existing mocks
    getApprovalMode: vi.fn().mockReturnValue(ApprovalMode.DEFAULT),
    getIdeMode: vi.fn().mockReturnValue(false),
    isInteractive: () => true,  // ADD THIS LINE
    getAllowedTools: vi.fn().mockReturnValue([]),
    // ... rest of config
  } as Config;
}
```

### 4. Update CLI Tool Scheduler Tests

**File:** `packages/cli/src/ui/hooks/useToolScheduler.test.ts`

Around line 88-96, update the mock config factory:

```typescript
const mockConfig = {
  // ... existing config
  getDebugMode: () => false,
  // ... other config
};
mockConfig.getMessageBus = vi.fn().mockReturnValue(createMockMessageBus());
mockConfig.getHookSystem = vi.fn().mockReturnValue(new HookSystem(mockConfig));

// ADD helper function for overrides
function createMockConfigOverride(overrides: Partial<Config> = {}): Config {
  return { ...mockConfig, ...overrides } as Config;
}
```

**Update existing tests that test confirmation:**

Around line 494 and 547, wrap existing confirmation tests to be interactive:

```typescript
it('should handle tool requiring confirmation - approved', async () => {
  mockToolRegistry.getTool.mockReturnValue(mockToolRequiresConfirmation);
  const config = createMockConfigOverride({
    isInteractive: () => true,  // ADD THIS
  });
  // ... rest of test
  const { result } = renderScheduler(config);  // Pass config
  // ... rest of test
});

it('should handle tool requiring confirmation - cancelled by user', async () => {
  mockToolRegistry.getTool.mockReturnValue(mockToolRequiresConfirmation);
  const config = createMockConfigOverride({
    isInteractive: () => true,  // ADD THIS
  });
  const { result } = renderScheduler(config);  // Pass config
  // ... rest of test
});
```

**Update renderScheduler helper:**
```typescript
const renderScheduler = (config: Config = mockConfig) =>
  renderHook(() =>
    useReactToolScheduler(onComplete, config, () => undefined),
  );
```

### 5. Verification Steps

```bash
# 1. Type check
npm run typecheck

# 2. Run core scheduler tests
npm test -- coreToolScheduler.test.ts

# 3. Run tool scheduler hook tests
npm test -- useToolScheduler.test.ts

# 4. Run A2A utils tests
npm test -- testing_utils.test.ts

# 5. Run full test suite
npm test

# 6. Lint
npm run lint
```

## Divergences from Upstream

Our scheduler implementation has evolved with **parallel batch execution** while upstream remains more sequential. The check location might differ slightly, but the logic is identical:

1. Check if tool requires confirmation
2. If yes AND not interactive, throw error
3. Otherwise proceed with confirmation flow

The error message should be identical to upstream for consistency.

## Files Modified

- `packages/core/src/core/coreToolScheduler.ts` (~10 lines added, one location)
- `packages/core/src/core/coreToolScheduler.test.ts` (~60 lines: new test + cleanup)
- `packages/cli/src/ui/hooks/useToolScheduler.test.ts` (~15 lines: overrides + updates)
- `packages/a2a-server/src/utils/testing_utils.ts` (~1 line)

**Total:** ~80-100 LoC

## Testing Strategy

### Unit Tests
1. **New test:** Tool requiring confirmation in non-interactive mode throws error
2. **Existing tests:** Confirmation flows work in interactive mode
3. **Regression:** All existing tests still pass with `isInteractive: true` default

### Integration Tests
- Run full test suites for all affected packages
- Verify server-side A2A execution properly configured as interactive (next commit)

### Manual Testing
1. Create tool with `shouldConfirmExecute: true`
2. Run in CLI (interactive) - should prompt
3. Run in server mode with `isInteractive: false` - should error
4. Verify error message is clear and actionable

## Success Criteria

- [ ] Check added in scheduler before showing confirmation
- [ ] All mock configs updated with `isInteractive()`
- [ ] New test case added and passing
- [ ] Existing tests cleaned up (unnecessary `isInteractive: false` removed)
- [ ] All tests passing
- [ ] Type checking passes
- [ ] Clear error message when tool requires confirmation in non-interactive mode

## Follow-up

Next commit (0c3eb826) will mark A2A requests as interactive so confirmation works properly in A2A context.

## Commit Message

```
reimplement: non-interactive tool confirmation error (upstream 217e2b0e)

Throw explicit error when tool requires confirmation in non-interactive mode
instead of hanging or failing silently.

Add isInteractive() checks to all mock configs and clean up tests to properly
distinguish interactive vs non-interactive execution contexts.

Our scheduler has diverged with parallel batch execution, but the core logic
remains the same: validate interactive capability before showing confirmation.

Upstream: 217e2b0eb4fad36cb3fff33ac29f6b171ef244ce
Author: Mayur Vaid <34806097+MayV@users.noreply.github.com>
Co-authored-by: gemini-code-assist[bot]
```
