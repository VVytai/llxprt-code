# Reimplementation Plan: A2A /init Command (upstream 299cc9be)

**Upstream Commit:** `299cc9bebfbfb3ff051c406a5076a57487a13909`  
**Date:** 2025-12-12  
**Title:** feat(a2a): Introduce /init command for a2a server (#13419)  
**Author:** Coco Sheng <cocosheng@google.com>

---

## What Upstream Does

The upstream commit introduces a new `/init` command for the A2A (Agent-to-Agent) server that:

1. **Creates an init command** (`packages/a2a-server/src/commands/init.ts`):
   - Analyzes the project and creates a tailored `GEMINI.md` file
   - Uses `performInit()` from `@google/gemini-cli-core` to determine what action to take
   - Handles three outcomes from `performInit()`:
     - `info`: GEMINI.md already exists (log and return)
     - `error`: Something went wrong (log error and return)
     - `submit_prompt`: Create GEMINI.md and execute agent with auto-approval

2. **Adds autoExecute feature** to the A2A task system:
   - Adds `autoExecute` property to `Task` class
   - Adds `autoExecute` parameter to `Task.create()` and constructor
   - Modifies `_schedulerToolCallsUpdate()` to auto-approve tool calls when `autoExecute === true` OR when approval mode is `YOLO`
   - Passes `autoExecute` from `AgentSettings` through to task creation in executor

3. **Extends command infrastructure**:
   - Adds `streaming` property to `Command` interface
   - Adds `agentExecutor` and `eventBus` to `CommandContext`
   - Registers `InitCommand` in command registry
   - Updates `/executeCommand` endpoint to support streaming commands via SSE

4. **Adds comprehensive tests**:
   - `init.test.ts`: Tests for init command behavior
   - `task.test.ts`: Tests for auto-approval logic
   - `app.test.ts`: Tests for streaming command execution

---

## Why Can't We Cherry-Pick

1. **Missing `performInit()` function**: Upstream uses `performInit()` from `@google/gemini-cli-core`, which doesn't exist in LLxprt's `@vybestack/llxprt-code-core`. This function encapsulates the logic for deciding whether to create a new GEMINI.md file or return info/error messages.

2. **GEMINI.md vs LLXPRT.md branding**: The entire implementation references `GEMINI.md`, but LLxprt uses `LLXPRT.md` as its context file name. This includes:
   - File paths in init command
   - Command descriptions
   - Test expectations
   - Currently, A2A server extension loading returns `['GEMINI.md']` (in `packages/a2a-server/src/config/extension.ts:141`)

3. **A2A server architecture differences**: LLxprt's A2A server may have structural differences from upstream that require careful adaptation.

4. **Package privacy**: A2A server is PRIVATE and should not be made publishable (per task requirements).

---

## Exact Adaptations for LLxprt

### 1. Implement `performInit()` Equivalent

Since `performInit()` doesn't exist in core, we need to implement its logic directly in the init command:

```typescript
// In packages/a2a-server/src/commands/init.ts
private performInitLogic(llxprtMdExists: boolean): CommandActionReturn {
  if (llxprtMdExists) {
    return {
      type: 'message',
      messageType: 'info',
      content: 'LLXPRT.md already exists.',
    };
  }
  
  return {
    type: 'submit_prompt',
    content: 'Analyze this project and create a comprehensive LLXPRT.md file that captures the project structure, technologies used, coding patterns, and any important context that would help understand and work with this codebase.',
  };
}
```

**Return type:**
```typescript
type CommandActionReturn = 
  | { type: 'message'; messageType: 'info' | 'error'; content: string }
  | { type: 'submit_prompt'; content: string };
```

### 2. Branding Adaptations

Replace all references:
- `GEMINI.md` → `LLXPRT.md`
- Command description: "Analyzes the project and creates a tailored LLXPRT.md file"
- Event messages: "LLXPRT.md already exists", "Create a new LLXPRT.md file", etc.

Update `packages/a2a-server/src/config/extension.ts:141`:
```typescript
// Change from:
return ['GEMINI.md'];
// To:
return ['LLXPRT.md'];
```

### 3. Core Implementation Files

#### `packages/a2a-server/src/commands/init.ts` (NEW)
- Implement `InitCommand` class
- Use inline `performInitLogic()` instead of importing `performInit`
- All LLXPRT.md branding
- Handle streaming with `ExecutionEventBus`
- Create empty LLXPRT.md file
- Execute agent with `autoExecute: true` in `AgentSettings`

#### `packages/a2a-server/src/commands/types.ts` (MODIFY)
Add to `CommandContext`:
```typescript
agentExecutor?: AgentExecutor;
eventBus?: ExecutionEventBus;
```

Add to `Command`:
```typescript
readonly streaming?: boolean;
```

#### `packages/a2a-server/src/commands/command-registry.ts` (MODIFY)
Register the init command:
```typescript
import { InitCommand } from './init.js';
// In constructor:
this.register(new InitCommand());
```

#### `packages/a2a-server/src/agent/task.ts` (MODIFY)
1. Add `autoExecute: boolean` property to `Task` class
2. Update constructor to accept `autoExecute = false` parameter
3. Update `Task.create()` to accept and pass `autoExecute` parameter
4. Modify `_schedulerToolCallsUpdate()` to check `this.autoExecute` OR YOLO mode:
```typescript
if (
  this.autoExecute ||
  this.config.getApprovalMode() === ApprovalMode.YOLO
) {
  logger.info(
    '[Task] ' +
      (this.autoExecute ? '' : 'YOLO mode enabled. ') +
      'Auto-approving all tool calls.',
  );
  // ... auto-approve logic
}
```

#### `packages/a2a-server/src/agent/executor.ts` (MODIFY)
Update `createTask()` and `reconstruct()` to accept and pass `autoExecute` parameter:
```typescript
async createTask(
  taskId: string,
  contextId: string,
  agentSettingsInput?: AgentSettings,
  eventBus?: ExecutionEventBus,
): Promise<TaskWrapper> {
  const agentSettings = agentSettingsInput || ({} as AgentSettings);
  const config = await this.getConfig(agentSettings, taskId);
  const runtimeTask = await Task.create(
    taskId,
    contextId,
    config,
    eventBus,
    agentSettings.autoExecute,  // <-- ADD THIS
  );
  // ...
}
```

#### `packages/a2a-server/src/types.ts` (MODIFY)
Add `autoExecute` to `AgentSettings`:
```typescript
export interface AgentSettings {
  kind: CoderAgentEvent.StateAgentSettingsEvent;
  workspacePath: string;
  autoExecute?: boolean;  // <-- ADD THIS
}
```

#### `packages/a2a-server/src/http/app.ts` (MODIFY)
1. Import `DefaultExecutionEventBus` and `AgentExecutionEvent`
2. Update `/executeCommand` endpoint to:
   - Include `agentExecutor` and `eventBus` in context
   - Handle streaming commands with SSE (Server-Sent Events)
   - Check `command.streaming` flag
   - Create event bus and stream events to response

Reference implementation from upstream:
```typescript
if (commandToExecute.streaming) {
  const eventBus = new DefaultExecutionEventBus();
  res.setHeader('Content-Type', 'text/event-stream');
  const eventHandler = (event: AgentExecutionEvent) => {
    const jsonRpcResponse = {
      jsonrpc: '2.0',
      id: 'taskId' in event ? event.taskId : (event as Message).messageId,
      result: event,
    };
    res.write(`data: ${JSON.stringify(jsonRpcResponse)}\n`);
  };
  eventBus.on('event', eventHandler);
  
  await commandToExecute.execute(
    { ...context, agentExecutor, eventBus },
    args ?? [],
  );
  
  eventBus.off('event', eventHandler);
  res.end();
  return;
}
```

### 4. Tests to Write/Adapt

#### `packages/a2a-server/src/commands/init.test.ts` (NEW)
- Test init command with existing LLXPRT.md (returns info)
- Test init command creating new LLXPRT.md (submit_prompt path)
- Test that `autoExecute: true` is passed to agent executor
- Test error handling
- Mock the workspace path environment variable
- Verify file creation
- Verify agent execution with correct settings

**Key adaptations:**
- Mock `fs.existsSync` and `fs.writeFileSync`
- Check for LLXPRT.md path, not GEMINI.md
- Verify event messages contain "LLXPRT.md"

#### `packages/a2a-server/src/agent/task.test.ts` (MODIFY)
Add test suite for auto-approval:
```typescript
describe('auto-approval', () => {
  it('should auto-approve tool calls when autoExecute is true', () => {
    task.autoExecute = true;
    // ... verify onConfirm called with ProceedOnce
  });

  it('should auto-approve tool calls when approval mode is YOLO', () => {
    (mockConfig.getApprovalMode as Mock).mockReturnValue(ApprovalMode.YOLO);
    task.autoExecute = false;
    // ... verify onConfirm called with ProceedOnce
  });

  it('should NOT auto-approve when autoExecute is false and mode is not YOLO', () => {
    task.autoExecute = false;
    (mockConfig.getApprovalMode as Mock).mockReturnValue(ApprovalMode.DEFAULT);
    // ... verify onConfirm NOT called
  });
});
```

#### `packages/a2a-server/src/http/app.test.ts` (MODIFY)
Add test suite for streaming command execution:
- Test that `agentExecutor` is included in context
- Test SSE streaming for streaming commands
- Test non-streaming commands work as before
- Test event bus cleanup after streaming completes

**Key function:**
```typescript
function streamToSSEEvents(data: string): Array<{ result: AgentExecutionEvent }> {
  return data
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.substring(6)));
}
```

---

## Implementation Steps

1. **Add types and interfaces** (types.ts, commands/types.ts)
   - Add `autoExecute` to `AgentSettings`
   - Add `streaming`, `agentExecutor`, `eventBus` to command types

2. **Update Task class** (agent/task.ts)
   - Add `autoExecute` property
   - Update constructor and `create()` method
   - Modify auto-approval logic in `_schedulerToolCallsUpdate()`

3. **Update Executor** (agent/executor.ts)
   - Pass `autoExecute` from settings to task creation

4. **Create init command** (commands/init.ts)
   - Implement inline `performInitLogic()`
   - Handle LLXPRT.md file creation
   - Execute agent with auto-approval
   - All LLXPRT.md branding

5. **Register init command** (commands/command-registry.ts)

6. **Update HTTP app** (http/app.ts)
   - Add SSE streaming support
   - Update `/executeCommand` to include context fields
   - Handle streaming vs non-streaming commands

7. **Update extension config** (config/extension.ts)
   - Change GEMINI.md → LLXPRT.md

8. **Write tests**
   - init.test.ts (new)
   - task.test.ts (add auto-approval tests)
   - app.test.ts (add streaming tests)

9. **Run verification**
   - `pnpm test packages/a2a-server`
   - `pnpm lint packages/a2a-server`
   - `pnpm build packages/a2a-server`

---

## Important Notes

- **KEEP A2A SERVER PRIVATE**: Do not modify package.json to make it publishable
- **LLXPRT.md everywhere**: No references to GEMINI.md should remain
- **No emoji**: Follow LLxprt style (no emoji in logs/messages)
- **License headers**: Keep "Copyright 2025 Google LLC" (per upstream Apache 2.0)
- **Test all paths**: Ensure both auto-execute and YOLO mode work correctly
- **Event streaming**: SSE implementation must properly clean up event listeners
- **Error handling**: All error cases from upstream should be preserved

---

## Verification Checklist

- [ ] `autoExecute` property added to Task and flows through executor
- [ ] Init command creates LLXPRT.md (not GEMINI.md)
- [ ] Auto-approval works with both `autoExecute: true` and YOLO mode
- [ ] Streaming commands work via SSE
- [ ] Non-streaming commands still work
- [ ] Extension config returns `['LLXPRT.md']`
- [ ] All tests pass
- [ ] No lint errors
- [ ] Build succeeds
- [ ] No GEMINI.md references remain (except in upstream license comments)
- [ ] A2A server package remains private

---

## Commit Message

```
reimplement: A2A /init command (upstream 299cc9be)

Add /init command to A2A server that creates LLXPRT.md files.

Changes:
- Add autoExecute support to Task and CoderAgentExecutor
- Create InitCommand that analyzes projects and creates LLXPRT.md
- Add SSE streaming support for commands in HTTP app
- Extend command infrastructure with streaming flag
- Add agentExecutor and eventBus to command context

Adaptations from upstream:
- Implement performInit logic inline (not in core)
- Use LLXPRT.md instead of GEMINI.md branding
- Update extension config to return LLXPRT.md

Tests:
- Add init.test.ts for command behavior
- Add auto-approval tests to task.test.ts
- Add streaming command tests to app.test.ts

Upstream: 299cc9bebfbfb3ff051c406a5076a57487a13909
feat(a2a): Introduce /init command for a2a server (#13419)
```

---

## LOC Estimate

- `init.ts`: ~170 lines (similar to upstream)
- `init.test.ts`: ~180 lines (similar to upstream)
- `task.ts`: +~15 lines (autoExecute property and logic)
- `task.test.ts`: +~65 lines (auto-approval test suite)
- `executor.ts`: +~10 lines (autoExecute parameter passing)
- `types.ts`: +~3 lines (autoExecute in AgentSettings)
- `commands/types.ts`: +~5 lines (streaming, agentExecutor, eventBus)
- `command-registry.ts`: +~2 lines (register init command)
- `app.ts`: +~60 lines (SSE streaming support)
- `app.test.ts`: +~120 lines (streaming tests)
- `extension.ts`: ~1 line change (GEMINI.md → LLXPRT.md)

**Total estimate: ~630 lines added/modified**
