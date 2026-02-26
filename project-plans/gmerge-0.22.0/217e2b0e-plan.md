# Reimplementation Plan: Non-Interactive Tool Confirmation Error (217e2b0e)

**Upstream Commit:** 217e2b0eb4fad36cb3fff33ac29f6b171ef244ce  
**Risk Level:** MEDIUM (Core tool execution flow)  
**Estimated Scope:** ~150-200 LoC across 4 files  
**Author:** Mayur Vaid  
**Approach:** Test-Driven Development (TDD) - RED → GREEN → REFACTOR

## Summary

Add error handling to throw when a tool requires user confirmation but execution mode is non-interactive. This prevents tools from hanging or failing silently in automated/server contexts.

The upstream change adds an explicit check: if `tool.shouldConfirmExecute()` returns confirmation details AND `config.isInteractive()` returns false, throw an error immediately with a clear message.

## Problem Statement

**Current Behavior:** When tools require confirmation (`shouldConfirmExecute` returns details) in non-interactive mode (servers, CI/CD, APIs), the system may hang waiting for user input or fail in unclear ways.

**Desired Behavior:** Immediate error with actionable message when confirmation is needed in non-interactive mode.

---

## Requirements

### R1: Error on Non-Interactive Confirmation Request
When a tool requires confirmation (`shouldConfirmExecute` returns non-false) AND `config.isInteractive()` returns `false`, the scheduler MUST throw an error before attempting to show confirmation UI.

**Error Message Format:**
```
Tool execution for "{displayName || name}" requires user confirmation, which is not supported in non-interactive mode.
```

### R2: Interactive Mode Default
Test mock configs MUST default to `isInteractive: () => true` to reflect normal CLI usage. Only tests specifically validating non-interactive behavior should override to `false`.

### R3: Parallel Batch Safety
The error check MUST occur during the validation phase (lines ~1000-1030 in coreToolScheduler.ts), BEFORE tools enter the scheduled state or parallel batch execution.

### R4: Policy Engine Precedence
The check MUST respect policy engine decisions:
- If policy returns `ALLOW`, skip confirmation (no error)
- If policy returns `DENY`, handle denial (no error from this check)
- Only if policy returns `ASK_USER` AND tool needs confirmation, check interactive mode

### R5: YOLO and Allowed-Tools Bypass
The check MUST respect approval mode:
- If `ApprovalMode.YOLO`, auto-approve (no error)
- If tool matches `getAllowedTools()`, auto-approve (no error)
- Only non-allowed tools in DEFAULT mode trigger the check

---

## Touchpoints

### 1. Core Scheduler Logic
**File:** `packages/core/src/core/coreToolScheduler.ts`  
**Lines:** ~1022-1036 (after `shouldConfirmExecute`, before showing confirmation)

**Current Code (lines 1022-1036):**
```typescript
const confirmationDetails =
  await invocation.shouldConfirmExecute(signal);

if (!confirmationDetails) {
  this.approveToolCall(reqInfo.callId);
  continue;
}

const allowedTools = this.config.getAllowedTools() || [];
if (
  this.config.getApprovalMode() === ApprovalMode.YOLO ||
  doesToolInvocationMatch(toolCall.tool, invocation, allowedTools)
) {
  this.approveToolCall(reqInfo.callId);
} else {
  // Allow IDE to resolve confirmation
  // ... confirmation UI logic
}
```

**Change Required:** Insert check after line 1028, before line 1036's `else` block.

**Divergence Note:** LLxprt's scheduler executes tools in parallel batches (see `currentBatchSize`, `executeInParallel` references). Upstream is more sequential. However, the confirmation check happens during validation phase BEFORE parallel execution, so the logic is identical.

### 2. Config Interface
**File:** `packages/core/src/config/config.ts`  
**Lines:** 1924-1930

**Current Implementation:**
```typescript
isInteractive(): boolean {
  return this.interactive;
}

getNonInteractive(): boolean {
  return !this.interactive;
}
```

**Status:** [OK] Already exists. No changes needed.

### 3. Test Infrastructure
**Files:**
- `packages/core/src/core/coreToolScheduler.test.ts` - Core scheduler tests
- `packages/cli/src/ui/hooks/useToolScheduler.test.ts` - React hook tests  
- `packages/a2a-server/src/utils/testing_utils.ts` - A2A test utilities

**Current State:** Mock configs are created inline without `isInteractive()` method, causing type errors.

**Required Changes:**
1. Add `isInteractive: () => true` to all mock configs
2. Create helper function for config overrides
3. Add new test case for non-interactive error
4. Update confirmation tests to explicitly set `isInteractive: true`

---

## Existing Tests to Adjust

### Tests Requiring `isInteractive: true` (Interactive Confirmation Tests)

**File:** `packages/core/src/core/coreToolScheduler.test.ts`

No changes needed - tests create mock configs inline. Each will add `isInteractive: () => true`.

**File:** `packages/cli/src/ui/hooks/useToolScheduler.test.ts`  
**Tests:**
- Line ~494: `'should handle tool requiring confirmation - approved'`
- Line ~547: `'should handle tool requiring confirmation - cancelled by user'`

**Change:** Add config override helper and wrap these tests with `isInteractive: true`.

**File:** `packages/a2a-server/src/utils/testing_utils.ts`  
**Function:** `createMockConfig()` (line ~32)

**Change:** Add `isInteractive: () => true` to default mock config.

---

## Test Plan (TDD Approach)

### Phase 1: RED - Write Failing Tests

#### Test 1: Non-Interactive Confirmation Error (NEW)
**File:** `packages/core/src/core/coreToolScheduler.test.ts`  
**Location:** After existing confirmation tests (~line 700)

```typescript
it('should error when tool requires confirmation in non-interactive mode', async () => {
  // ARRANGE
  const mockTool = new MockTool({ name: 'confirmTool' });
  mockTool.shouldConfirm = true; // Tool requires confirmation
  
  const mockToolRegistry = {
    getTool: () => mockTool,
    getFunctionDeclarations: () => [],
    tools: new Map(),
    discovery: {},
    registerTool: () => {},
    getToolByName: () => mockTool,
    getToolByDisplayName: () => mockTool,
    getTools: () => [],
    discoverTools: async () => {},
    getAllTools: () => [],
    getToolsByServer: () => [],
  } as unknown as ToolRegistry;

  const onAllToolCallsComplete = vi.fn();
  const onToolCallsUpdate = vi.fn();

  const mockPolicyEngine = createMockPolicyEngine();
  mockPolicyEngine.evaluate = vi.fn().mockReturnValue(PolicyDecision.ASK_USER);

  const mockConfig = {
    getSessionId: () => 'test-session-id',
    getUsageStatisticsEnabled: () => true,
    getDebugMode: () => false,
    isInteractive: () => false,  // NON-INTERACTIVE MODE
    getApprovalMode: () => ApprovalMode.DEFAULT,
    getEphemeralSettings: () => ({}),
    getAllowedTools: () => [],
    getContentGeneratorConfig: () => ({ model: 'test-model' }),
    getToolRegistry: () => mockToolRegistry,
    getMessageBus: vi.fn().mockReturnValue(createMockMessageBus()),
    getEnableHooks: () => false,
    getPolicyEngine: vi.fn().mockReturnValue(mockPolicyEngine),
  } as unknown as Config;

  const scheduler = new CoreToolScheduler({
    config: mockConfig,
    onAllToolCallsComplete,
    onToolCallsUpdate,
    getPreferredEditor: () => 'vscode',
  });

  const request = {
    callId: 'non-interactive-confirm',
    name: 'confirmTool',
    args: {},
    isClientInitiated: false,
    prompt_id: 'prompt-1',
  };

  // ACT
  await scheduler.schedule([request], new AbortController().signal);

  // ASSERT
  expect(onAllToolCallsComplete).toHaveBeenCalled();
  const completedCalls = onAllToolCallsComplete.mock.calls[0][0] as ToolCall[];
  expect(completedCalls).toHaveLength(1);
  expect(completedCalls[0].status).toBe('error');

  const erroredCall = completedCalls[0] as ErroredToolCall;
  const errorResponse = erroredCall.response;
  const errorParts = errorResponse.responseParts;
  // @ts-expect-error - accessing internal structure
  const errorMessage = errorParts[0].functionResponse.response.error;
  expect(errorMessage).toContain(
    'Tool execution for "confirmTool" requires user confirmation, which is not supported in non-interactive mode.'
  );
});
```

**Expected Result:** [ERROR] Test fails - error not thrown, tool hangs or fails differently.

#### Test 2: Interactive Confirmation Works (ADJUST EXISTING)
**File:** `packages/cli/src/ui/hooks/useToolScheduler.test.ts`  
**Location:** ~line 494

Add helper:
```typescript
function createMockConfigOverride(overrides: Partial<Config> = {}): Config {
  return { ...mockConfig, ...overrides } as Config;
}
```

Update test:
```typescript
it('should handle tool requiring confirmation - approved', async () => {
  mockToolRegistry.getTool.mockReturnValue(mockToolRequiresConfirmation);
  
  const config = createMockConfigOverride({
    isInteractive: () => true,  // EXPLICIT: Interactive mode
  });
  
  const expectedOutput = 'Confirmed output';
  (mockToolRequiresConfirmation.execute as Mock).mockResolvedValue({
    llmContent: expectedOutput,
    returnDisplay: 'Confirmed display',
  } as ToolResult);

  const { result } = renderScheduler(config);  // Pass config
  // ... rest of test unchanged
});
```

Update `renderScheduler`:
```typescript
const renderScheduler = (config: Config = mockConfig) =>
  renderHook(() =>
    useReactToolScheduler(onComplete, config, () => undefined),
  );
```

**Expected Result:** [OK] Test passes (already works, but now explicit).

#### Test 3: YOLO Mode Bypasses Check (NEW)
**File:** `packages/core/src/core/coreToolScheduler.test.ts`

```typescript
it('should not error in non-interactive mode with YOLO approval', async () => {
  // ARRANGE
  const mockTool = new MockTool({ name: 'yoloTool' });
  mockTool.shouldConfirm = true;
  
  const mockToolRegistry = {
    getTool: () => mockTool,
    getFunctionDeclarations: () => [],
    tools: new Map(),
    discovery: {},
    registerTool: () => {},
    getToolByName: () => mockTool,
    getToolByDisplayName: () => mockTool,
    getTools: () => [],
    discoverTools: async () => {},
    getAllTools: () => [],
    getToolsByServer: () => [],
  } as unknown as ToolRegistry;

  const onAllToolCallsComplete = vi.fn();
  const onToolCallsUpdate = vi.fn();

  const mockPolicyEngine = createMockPolicyEngine();
  mockPolicyEngine.evaluate = vi.fn().mockReturnValue(PolicyDecision.ASK_USER);

  const mockConfig = {
    getSessionId: () => 'test-session-id',
    getUsageStatisticsEnabled: () => true,
    getDebugMode: () => false,
    isInteractive: () => false,  // Non-interactive
    getApprovalMode: () => ApprovalMode.YOLO,  // But YOLO mode
    getEphemeralSettings: () => ({}),
    getAllowedTools: () => [],
    getContentGeneratorConfig: () => ({ model: 'test-model' }),
    getToolRegistry: () => mockToolRegistry,
    getMessageBus: vi.fn().mockReturnValue(createMockMessageBus()),
    getEnableHooks: () => false,
    getPolicyEngine: vi.fn().mockReturnValue(mockPolicyEngine),
  } as unknown as Config;

  const scheduler = new CoreToolScheduler({
    config: mockConfig,
    onAllToolCallsComplete,
    onToolCallsUpdate,
    getPreferredEditor: () => 'vscode',
  });

  // ACT
  await scheduler.schedule(
    [{
      callId: 'yolo-1',
      name: 'yoloTool',
      args: {},
      isClientInitiated: false,
      prompt_id: 'prompt-1',
    }],
    new AbortController().signal
  );

  // ASSERT
  expect(onAllToolCallsComplete).toHaveBeenCalled();
  const completedCalls = onAllToolCallsComplete.mock.calls[0][0] as ToolCall[];
  expect(completedCalls[0].status).toBe('success');  // Not error
});
```

**Expected Result:** [ERROR] Test fails initially (may error), [OK] passes after implementation.

#### Test 4: Allowed Tools Bypass Check (NEW)
**File:** `packages/core/src/core/coreToolScheduler.test.ts`

```typescript
it('should not error in non-interactive mode for allowed tools', async () => {
  // ARRANGE
  const mockTool = new MockTool({ name: 'allowedTool' });
  mockTool.shouldConfirm = true;
  
  const mockToolRegistry = {
    getTool: () => mockTool,
    getFunctionDeclarations: () => [],
    tools: new Map(),
    discovery: {},
    registerTool: () => {},
    getToolByName: () => mockTool,
    getToolByDisplayName: () => mockTool,
    getTools: () => [],
    discoverTools: async () => {},
    getAllTools: () => [],
    getToolsByServer: () => [],
  } as unknown as ToolRegistry;

  const onAllToolCallsComplete = vi.fn();
  const onToolCallsUpdate = vi.fn();

  const mockPolicyEngine = createMockPolicyEngine();
  mockPolicyEngine.evaluate = vi.fn().mockReturnValue(PolicyDecision.ASK_USER);

  const mockConfig = {
    getSessionId: () => 'test-session-id',
    getUsageStatisticsEnabled: () => true,
    getDebugMode: () => false,
    isInteractive: () => false,  // Non-interactive
    getApprovalMode: () => ApprovalMode.DEFAULT,
    getEphemeralSettings: () => ({}),
    getAllowedTools: () => ['allowedTool'],  // Tool is in allowed list
    getContentGeneratorConfig: () => ({ model: 'test-model' }),
    getToolRegistry: () => mockToolRegistry,
    getMessageBus: vi.fn().mockReturnValue(createMockMessageBus()),
    getEnableHooks: () => false,
    getPolicyEngine: vi.fn().mockReturnValue(mockPolicyEngine),
  } as unknown as Config;

  const scheduler = new CoreToolScheduler({
    config: mockConfig,
    onAllToolCallsComplete,
    onToolCallsUpdate,
    getPreferredEditor: () => 'vscode',
  });

  // ACT
  await scheduler.schedule(
    [{
      callId: 'allowed-1',
      name: 'allowedTool',
      args: {},
      isClientInitiated: false,
      prompt_id: 'prompt-1',
    }],
    new AbortController().signal
  );

  // ASSERT
  expect(onAllToolCallsComplete).toHaveBeenCalled();
  const completedCalls = onAllToolCallsComplete.mock.calls[0][0] as ToolCall[];
  expect(completedCalls[0].status).toBe('success');  // Not error
});
```

**Expected Result:** [ERROR] Test fails initially, [OK] passes after implementation.

#### Test 5: Mixed Batch with Dangerous + Safe Tools (NEW - LLxprt Specific)
**File:** `packages/core/src/core/coreToolScheduler.test.ts`

```typescript
it('should handle mixed batch: safe tool executes, dangerous tool errors in non-interactive', async () => {
  // ARRANGE
  const safeTool = new MockTool({ name: 'safeTool' });
  safeTool.shouldConfirm = false;  // No confirmation needed
  
  const dangerousTool = new MockTool({ name: 'dangerousTool' });
  dangerousTool.shouldConfirm = true;  // Requires confirmation
  
  const mockToolRegistry = {
    getTool: (name: string) => name === 'safeTool' ? safeTool : dangerousTool,
    getFunctionDeclarations: () => [],
    tools: new Map([['safeTool', safeTool], ['dangerousTool', dangerousTool]]),
    discovery: {},
    registerTool: () => {},
    getToolByName: (name: string) => name === 'safeTool' ? safeTool : dangerousTool,
    getToolByDisplayName: (name: string) => name === 'safeTool' ? safeTool : dangerousTool,
    getTools: () => [safeTool, dangerousTool],
    discoverTools: async () => {},
    getAllTools: () => [safeTool, dangerousTool],
    getToolsByServer: () => [],
  } as unknown as ToolRegistry;

  const onAllToolCallsComplete = vi.fn();
  const onToolCallsUpdate = vi.fn();

  const mockPolicyEngine = createMockPolicyEngine();
  mockPolicyEngine.evaluate = vi.fn().mockReturnValue(PolicyDecision.ASK_USER);

  const mockConfig = {
    getSessionId: () => 'test-session-id',
    getUsageStatisticsEnabled: () => true,
    getDebugMode: () => false,
    isInteractive: () => false,  // Non-interactive
    getApprovalMode: () => ApprovalMode.DEFAULT,
    getEphemeralSettings: () => ({}),
    getAllowedTools: () => [],
    getContentGeneratorConfig: () => ({ model: 'test-model' }),
    getToolRegistry: () => mockToolRegistry,
    getMessageBus: vi.fn().mockReturnValue(createMockMessageBus()),
    getEnableHooks: () => false,
    getPolicyEngine: vi.fn().mockReturnValue(mockPolicyEngine),
  } as unknown as Config;

  const scheduler = new CoreToolScheduler({
    config: mockConfig,
    onAllToolCallsComplete,
    onToolCallsUpdate,
    getPreferredEditor: () => 'vscode',
  });

  // ACT - Schedule both tools in a batch
  await scheduler.schedule(
    [
      {
        callId: 'safe-call',
        name: 'safeTool',
        args: {},
        isClientInitiated: false,
        prompt_id: 'prompt-1',
      },
      {
        callId: 'dangerous-call',
        name: 'dangerousTool',
        args: {},
        isClientInitiated: false,
        prompt_id: 'prompt-1',
      },
    ],
    new AbortController().signal
  );

  // ASSERT
  expect(onAllToolCallsComplete).toHaveBeenCalled();
  const completedCalls = onAllToolCallsComplete.mock.calls[0][0] as ToolCall[];
  expect(completedCalls).toHaveLength(2);
  
  const safeCall = completedCalls.find(c => c.request.callId === 'safe-call');
  const dangerousCall = completedCalls.find(c => c.request.callId === 'dangerous-call');
  
  expect(safeCall?.status).toBe('success');
  expect(dangerousCall?.status).toBe('error');
  
  const erroredCall = dangerousCall as ErroredToolCall;
  const errorParts = erroredCall.response.responseParts;
  // @ts-expect-error - accessing internal structure
  const errorMessage = errorParts[0].functionResponse.response.error;
  expect(errorMessage).toContain('requires user confirmation');
  expect(errorMessage).toContain('non-interactive mode');
});
```

**Expected Result:** [ERROR] Test fails initially, [OK] passes after implementation.

#### Test 6: A2A Mock Config Update
**File:** `packages/a2a-server/src/utils/testing_utils.ts`  
**Location:** `createMockConfig()` function

```typescript
export function createMockConfig(
  overrides: Partial<Config> = {},
): Config {
  return {
    getProvider: vi.fn().mockReturnValue({
      name: 'test-provider',
      currentUser: async () => ({ email: 'test@example.com' }),
    }),
    getProviderManager: vi.fn().mockReturnValue({
      getProvider: vi.fn().mockReturnValue({
        name: 'test-provider',
      }),
    }),
    getApprovalMode: vi.fn().mockReturnValue(ApprovalMode.DEFAULT),
    getIdeMode: vi.fn().mockReturnValue(false),
    isInteractive: () => true,  // ADD THIS LINE
    getAllowedTools: vi.fn().mockReturnValue([]),
    getWorkspaceContext: vi.fn().mockReturnValue({
      isPathWithinWorkspace: () => true,
      workspaceRoot: '/test/workspace',
    }),
    // ... rest of config
    ...overrides,
  } as Config;
}
```

**Expected Result:** [OK] Type errors fixed, tests pass.

### Phase 2: GREEN - Minimal Implementation

#### Implementation 1: Core Scheduler Check
**File:** `packages/core/src/core/coreToolScheduler.ts`  
**Location:** After line 1028 (after checking `confirmationDetails`), before line 1036 (`else` block)

```typescript
const confirmationDetails =
  await invocation.shouldConfirmExecute(signal);

if (!confirmationDetails) {
  this.approveToolCall(reqInfo.callId);
  continue;
}

const allowedTools = this.config.getAllowedTools() || [];
if (
  this.config.getApprovalMode() === ApprovalMode.YOLO ||
  doesToolInvocationMatch(toolCall.tool, invocation, allowedTools)
) {
  this.approveToolCall(reqInfo.callId);
} else {
  // NEW: Check if non-interactive mode
  if (!this.config.isInteractive()) {
    throw new Error(
      `Tool execution for "${
        toolCall.tool.displayName || toolCall.tool.name
      }" requires user confirmation, which is not supported in non-interactive mode.`,
    );
  }
  
  // Allow IDE to resolve confirmation
  if (
    confirmationDetails.type === 'edit' &&
    confirmationDetails.ideConfirmation
  ) {
    // ... existing IDE confirmation logic
  }
  
  // ... rest of confirmation UI setup
}
```

**Key Points:**
- Check happens AFTER policy/YOLO/allowed-tools checks (R4, R5)
- Check happens BEFORE confirmation UI setup (R1)
- Check happens during validation, before parallel execution (R3)
- Error message matches upstream exactly (R1)

**Expected Result:** [OK] All new tests pass.

#### Implementation 2: Update All Inline Mock Configs
**File:** `packages/core/src/core/coreToolScheduler.test.ts`

For each test creating a mock config inline (there are many), add:
```typescript
isInteractive: () => true,  // Default to interactive
```

**Locations (examples):**
- Line ~177 (abort before confirmation test)
- Line ~245 (skip confirmation when policy allows)
- Line ~642 (abort during confirmation error test)
- And ~20 more throughout the file

**Pattern:**
```typescript
const mockConfig = {
  getSessionId: () => 'test-session-id',
  getUsageStatisticsEnabled: () => true,
  getDebugMode: () => false,
  isInteractive: () => true,  // ADD THIS
  getApprovalMode: () => ApprovalMode.DEFAULT,
  // ... rest
} as unknown as Config;
```

**Expected Result:** [OK] Type errors resolved, all tests pass.

#### Implementation 3: CLI Test Helper
**File:** `packages/cli/src/ui/hooks/useToolScheduler.test.ts`  
**Location:** After mockConfig setup (~line 88)

Add helper:
```typescript
function createMockConfigOverride(overrides: Partial<Config> = {}): Config {
  return { ...mockConfig, ...overrides } as Config;
}
```

Update `renderScheduler`:
```typescript
const renderScheduler = (config: Config = mockConfig) =>
  renderHook(() =>
    useReactToolScheduler(onComplete, config, () => undefined),
  );
```

Update confirmation tests to use helper:
```typescript
// Line ~494
it('should handle tool requiring confirmation - approved', async () => {
  mockToolRegistry.getTool.mockReturnValue(mockToolRequiresConfirmation);
  const config = createMockConfigOverride({
    isInteractive: () => true,
  });
  // ... rest
  const { result } = renderScheduler(config);
  // ... rest
});

// Line ~547
it('should handle tool requiring confirmation - cancelled by user', async () => {
  mockToolRegistry.getTool.mockReturnValue(mockToolRequiresConfirmation);
  const config = createMockConfigOverride({
    isInteractive: () => true,
  });
  const { result } = renderScheduler(config);
  // ... rest
});
```

**Expected Result:** [OK] Tests pass with explicit interactive mode.

### Phase 3: REFACTOR - Code Quality

#### Refactor 1: Extract Error Message Constant (Optional)
**File:** `packages/core/src/core/coreToolScheduler.ts`

If there's a constants section, could extract:
```typescript
const NON_INTERACTIVE_CONFIRMATION_ERROR = (toolName: string) =>
  `Tool execution for "${toolName}" requires user confirmation, which is not supported in non-interactive mode.`;
```

Then use:
```typescript
throw new Error(
  NON_INTERACTIVE_CONFIRMATION_ERROR(
    toolCall.tool.displayName || toolCall.tool.name
  )
);
```

**Decision:** Only if it improves readability. Current inline version is clear.

#### Refactor 2: Test Helper for Mock Tool Registry (Optional)
**File:** `packages/core/src/core/coreToolScheduler.test.ts`

Current tests duplicate 12 lines for registry setup. Could extract:
```typescript
function createMockToolRegistry(tool: DeclarativeTool): ToolRegistry {
  return {
    getTool: () => tool,
    getFunctionDeclarations: () => [],
    tools: new Map(),
    discovery: {},
    registerTool: () => {},
    getToolByName: () => tool,
    getToolByDisplayName: () => tool,
    getTools: () => [],
    discoverTools: async () => {},
    getAllTools: () => [],
    getToolsByServer: () => [],
  } as unknown as ToolRegistry;
}
```

**Decision:** Good refactor, but separate commit. Not required for this feature.

---

## Verification Steps

### 1. Type Checking
```bash
npm run typecheck
```
**Expected:** [OK] No errors

### 2. Core Scheduler Tests
```bash
npm test -- packages/core/src/core/coreToolScheduler.test.ts
```
**Expected:** [OK] All tests pass, including 5 new tests

### 3. CLI Tests
```bash
npm test -- packages/cli/src/ui/hooks/useToolScheduler.test.ts
```
**Expected:** [OK] All tests pass

### 4. A2A Tests
```bash
npm test -- packages/a2a-server/src/utils/testing_utils
```
**Expected:** [OK] All tests pass

### 5. Full Test Suite
```bash
npm test
```
**Expected:** [OK] All tests pass

### 6. Lint
```bash
npm run lint
```
**Expected:** [OK] No warnings

### 7. Manual Verification
Create a test tool requiring confirmation:
```typescript
const testTool = new MockTool({ name: 'testConfirm' });
testTool.shouldConfirm = true;
```

**Test Case 1:** Interactive mode
```bash
llxprt-code --prompt "use testConfirm"
```
**Expected:** Confirmation dialog appears

**Test Case 2:** Non-interactive mode
```bash
llxprt-code --prompt "use testConfirm" --approval-mode default
# With config.isInteractive = false
```
**Expected:** Clear error message:
```
Tool execution for "testConfirm" requires user confirmation, which is not supported in non-interactive mode.
```

---

## Divergences from Upstream

### 1. Parallel Batch Execution
**Upstream:** Sequential tool execution with simple confirmation flow.

**LLxprt:** Parallel batch execution (see `currentBatchSize`, lines 1947-1957).

**Impact:** None. The check occurs during validation phase (lines ~1000-1030) BEFORE tools enter parallel execution. Each tool in a batch is validated individually, so a non-interactive confirmation error will be caught and buffered as an error result, while other tools in the batch continue.

**Test Coverage:** Test 5 (mixed batch) explicitly validates this behavior.

### 2. Error Handling
**Upstream:** Throws error synchronously during validation.

**LLxprt:** Also throws during validation, but error is caught and converted to `ErroredToolCall` by try-catch wrapper in `_schedule` (lines ~999-1100).

**Impact:** Consistent with LLxprt's error handling patterns. Error becomes a proper tool call result.

### 3. Mock Config Patterns
**Upstream:** Uses `createMockConfig()` helper function.

**LLxprt:** Inline mock configs in most tests.

**Impact:** More verbose but explicit. We add `isInteractive` to each inline mock rather than centralizing in a helper.

---

## Files Modified

### Production Code
1. **`packages/core/src/core/coreToolScheduler.ts`**  
   - ~8 lines added: isInteractive check + error throw
   - Location: ~line 1037 (after YOLO/allowed-tools check, before confirmation UI)

### Test Code
2. **`packages/core/src/core/coreToolScheduler.test.ts`**  
   - ~150 lines:
     - 5 new test cases (~100 lines)
     - 20+ inline mock configs updated (~50 lines: add `isInteractive: () => true`)

3. **`packages/cli/src/ui/hooks/useToolScheduler.test.ts`**  
   - ~20 lines:
     - Helper function for config overrides (~5 lines)
     - Update `renderScheduler` signature (~3 lines)
     - Update 2 confirmation tests (~12 lines)

4. **`packages/a2a-server/src/utils/testing_utils.ts`**  
   - ~1 line: Add `isInteractive: () => true` to createMockConfig

**Total:** ~180 LoC

---

## Success Criteria

- [x] **R1:** Error thrown when confirmation needed in non-interactive mode
- [x] **R2:** Mock configs default to interactive mode
- [x] **R3:** Check occurs before parallel batch execution
- [x] **R4:** Policy engine decisions respected
- [x] **R5:** YOLO and allowed-tools bypass the check
- [x] All new tests pass
- [x] All existing tests pass
- [x] Type checking passes
- [x] Linting passes
- [x] Clear, actionable error message
- [x] Manual verification successful

---

## Commit Message

```
reimplement: non-interactive tool confirmation error (upstream 217e2b0e)

Throw explicit error when tool requires confirmation in non-interactive mode
instead of hanging or failing silently.

Changes:
- Add isInteractive() check in CoreToolScheduler before showing confirmation UI
- Respect policy engine (ALLOW/DENY) and approval mode (YOLO) decisions
- Add isInteractive() to all test mock configs (default: true)
- Add 5 new tests: basic error, YOLO bypass, allowed-tools bypass, mixed batch,
  and interactive confirmation

Our scheduler diverges with parallel batch execution, but the check occurs
during validation phase before parallel execution begins. Mixed-batch test
validates that one tool can error while others in the batch succeed.

Test approach: TDD (RED → GREEN → REFACTOR)
- RED: 5 failing tests for requirements + edge cases
- GREEN: Minimal implementation (8 lines in scheduler, 1 line in test utils)
- REFACTOR: Update all mock configs for type safety

Upstream: 217e2b0eb4fad36cb3fff33ac29f6b171ef244ce
Author: Mayur Vaid <34806097+MayV@users.noreply.github.com>
Co-authored-by: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>
```

---

## Follow-up

**Next commit (0c3eb826):** Will mark A2A requests as interactive so confirmation works properly in A2A context. This may involve setting `config.isInteractive()` based on A2A request context.

**Future consideration:** Centralize mock config creation in test utilities to reduce duplication.

---

## Appendix: Code Snippets

### Exact Location in coreToolScheduler.ts

```typescript
// Lines 1022-1100 (approximate)
const confirmationDetails =
  await invocation.shouldConfirmExecute(signal);

if (!confirmationDetails) {
  this.approveToolCall(reqInfo.callId);
  continue;
}

const allowedTools = this.config.getAllowedTools() || [];
if (
  this.config.getApprovalMode() === ApprovalMode.YOLO ||
  doesToolInvocationMatch(toolCall.tool, invocation, allowedTools)
) {
  this.approveToolCall(reqInfo.callId);
} else {
  // ==================== INSERT CHECK HERE ====================
  if (!this.config.isInteractive()) {
    throw new Error(
      `Tool execution for "${
        toolCall.tool.displayName || toolCall.tool.name
      }" requires user confirmation, which is not supported in non-interactive mode.`,
    );
  }
  // ===========================================================
  
  // Allow IDE to resolve confirmation
  if (
    confirmationDetails.type === 'edit' &&
    confirmationDetails.ideConfirmation
  ) {
    void confirmationDetails.ideConfirmation.then((resolution) => {
      // ... existing IDE confirmation logic
    });
  }

  const originalOnConfirm = confirmationDetails.onConfirm;
  const wrappedConfirmationDetails: ToolCallConfirmationDetails = {
    // ... existing confirmation UI setup
  };
  // ... rest of confirmation flow
}
```

### Error Type Import (if needed)

The error will be caught by the existing try-catch wrapper in `_schedule` (lines ~999-1100) and converted to an `ErroredToolCall` with `ToolErrorType`. Based on upstream, this should be a generic error, not a specific `ToolErrorType` enum value. The error message itself is sufficient for debugging.

---

## End of Plan
