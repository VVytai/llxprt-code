# COMPLETE REIMPLEMENTATION PLAN: A2A /init Command (upstream 299cc9be)

**Target Subagent:** Context-wiped implementer with NO prior knowledge
**Upstream Commit:** `299cc9bebfbfb3ff051c406a5076a57487a13909`
**Date:** 2025-12-12
**Title:** feat(a2a): Introduce /init command for a2a server (#13419)

---

## REQUIREMENTS

### R1: Auto-Execute Support
**What:** Add `autoExecute` flag to Task that auto-approves tool calls (bypassing confirmation UI).
**Why:** The /init command needs to run fully automated without user intervention.
**Where:** 
- `packages/a2a-server/src/agent/task.ts`: Add `autoExecute: boolean` property
- `packages/a2a-server/src/agent/executor.ts`: Pass `autoExecute` from `AgentSettings`
- `packages/a2a-server/src/types.ts`: Add `autoExecute?: boolean` to `AgentSettings`

### R2: Init Command
**What:** Create `/init` command that analyzes projects and creates `LLXPRT.md` files.
**Why:** Users need a way to bootstrap project context files for LLxprt.
**Where:** `packages/a2a-server/src/commands/init.ts` (NEW FILE)
**Behavior:**
- If `LLXPRT.md` exists → return info message
- If `LLXPRT.md` doesn't exist → create empty file, execute agent with auto-approval to populate it

### R3: Streaming Commands
**What:** Add Server-Sent Events (SSE) support for streaming command execution.
**Why:** Long-running commands like /init need to stream progress updates.
**Where:**
- `packages/a2a-server/src/commands/types.ts`: Add `streaming?: boolean` flag
- `packages/a2a-server/src/http/app.ts`: Handle SSE for streaming commands

### R4: LLXPRT.md Branding
**What:** Use `LLXPRT.md` instead of `GEMINI.md` everywhere.
**Why:** LLxprt is a fork with different branding.
**Where:**
- `packages/a2a-server/src/commands/init.ts`: All references
- `packages/a2a-server/src/config/extension.ts:141`: Change default context file name

### R5: Command Context Extension
**What:** Add `agentExecutor` and `eventBus` to `CommandContext`.
**Why:** Commands need access to agent execution and event streaming.
**Where:** `packages/a2a-server/src/commands/types.ts`

---

## LLXPRT TOUCHPOINTS

### File: `packages/a2a-server/src/types.ts`
**Line 46-48:** Current `AgentSettings` interface
```typescript
export interface AgentSettings {
  kind: CoderAgentEvent.StateAgentSettingsEvent;
  workspacePath: string;
}
```
**Change:** Add `autoExecute?: boolean;` after line 48

---

### File: `packages/a2a-server/src/agent/task.ts`
**Lines 66-78:** Task class properties
**Change:** Add after line 78: `autoExecute: boolean;`

**Lines 89-113:** Task constructor
**Change:** 
- Add parameter: `autoExecute = false,` after line 93 `eventBus?: ExecutionEventBus,`
- Add after line 112: `this.autoExecute = autoExecute;`

**Lines 115-124:** `Task.create()` static method
**Change:**
- Add parameter: `autoExecute?: boolean,` after line 119 `eventBus?: ExecutionEventBus,`
- Change line 121: `const task = new Task(id, contextId, config, eventBus, autoExecute);`

**Lines 408-419:** Auto-approval logic in `_schedulerToolCallsUpdate()`
**Current code (line 408):**
```typescript
if (this.config.getApprovalMode() === ApprovalMode.YOLO) {
  logger.info('[Task] YOLO mode enabled. Auto-approving all tool calls.');
```
**Change to:**
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
```

---

### File: `packages/a2a-server/src/agent/executor.ts`
**Lines 121-126:** `reconstruct()` method - Task.create call
**Change:** Add `agentSettings.autoExecute` parameter:
```typescript
const runtimeTask = await Task.create(
  sdkTask.id,
  contextId,
  config,
  eventBus,
  agentSettings.autoExecute,  // ADD THIS LINE
);
```

**Lines 140-159:** `createTask()` method - Task.create call
**Change:** Add `agentSettings.autoExecute` parameter after line 148:
```typescript
const runtimeTask = await Task.create(
  taskId,
  contextId,
  config,
  eventBus,
  agentSettings.autoExecute,  // ADD THIS LINE
);
```

---

### File: `packages/a2a-server/src/commands/types.ts`
**Lines 15-17:** Current `CommandContext` interface
```typescript
export interface CommandContext {
  config: Config;
  git?: GitService;
}
```
**Change:** Add after line 17:
```typescript
  agentExecutor?: AgentExecutor;
  eventBus?: ExecutionEventBus;
```

**Lines 19-32:** `Command` interface
**Change:** Add after line 27 `readonly requiresWorkspace?: boolean;`:
```typescript
  readonly streaming?: boolean;
```

---

### File: `packages/a2a-server/src/commands/command-registry.ts`
**Lines 1-5:** License header
**Lines 7-8:** Current imports
```typescript
import { ExtensionsCommand } from './extensions.js';
import { RestoreCommand } from './restore.js';
```
**Change:** Add after line 8:
```typescript
import { InitCommand } from './init.js';
```

**Lines 13-16:** Constructor
**Change:** Add after line 15 `this.register(new RestoreCommand());`:
```typescript
    this.register(new InitCommand());
```

---

### File: `packages/a2a-server/src/http/app.ts`
**Lines 7-11:** Current imports
**Change:** Update line 9-11 to:
```typescript
import type { AgentCard, Message } from '@a2a-js/sdk';
import type { TaskStore } from '@a2a-js/sdk/server';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  DefaultExecutionEventBus,
  type AgentExecutionEvent,
} from '@a2a-js/sdk/server';
```

**Lines 141-185:** Current `/executeCommand` endpoint
**Replace entire section** with:
```typescript
    async function handleExecuteCommand(
      req: express.Request,
      res: express.Response,
      context: {
        config: Awaited<ReturnType<typeof loadConfig>>;
        git: GitService | undefined;
        agentExecutor: CoderAgentExecutor;
      },
    ) {
      logger.info('[CoreAgent] Received /executeCommand request: ', req.body);
      const { command, args } = req.body;
      try {
        if (typeof command !== 'string') {
          return res.status(400).json({ error: 'Invalid "command" field.' });
        }

        if (args && !Array.isArray(args)) {
          return res.status(400).json({ error: '"args" field must be an array.' });
        }

        const commandToExecute = commandRegistry.get(command);

        if (commandToExecute?.requiresWorkspace) {
          if (!process.env['CODER_AGENT_WORKSPACE_PATH']) {
            return res.status(400).json({
              error: `Command "${command}" requires a workspace, but CODER_AGENT_WORKSPACE_PATH is not set.`,
            });
          }
        }

        if (!commandToExecute) {
          return res.status(404).json({ error: `Command not found: ${command}` });
        }

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

          await commandToExecute.execute({ ...context, eventBus }, args ?? []);

          eventBus.off('event', eventHandler);
          eventBus.finished();
          return res.end();
        } else {
          const result = await commandToExecute.execute(context, args ?? []);
          logger.info('[CoreAgent] Sending /executeCommand response: ', result);
          return res.status(200).json(result);
        }
      } catch (e) {
        logger.error(
          `Error executing /executeCommand: ${command} with args: ${JSON.stringify(
            args,
          )}`,
          e,
        );
        const errorMessage =
          e instanceof Error ? e.message : 'Unknown error executing command';
        return res.status(500).json({ error: errorMessage });
      }
    }

    expressApp.post('/executeCommand', (req, res) => {
      void handleExecuteCommand(req, res, { config, git, agentExecutor });
    });
```

**Lines 74-100:** Current `createApp()` function setup
**Change:** Update line 175 context creation to include `agentExecutor`:
```typescript
    const context = { config, git, agentExecutor };
```

---

### File: `packages/a2a-server/src/config/extension.ts`
**Line 141:** Current `getContextFileNames()` function
```typescript
    return ['GEMINI.md'];
```
**Change to:**
```typescript
    return ['LLXPRT.md'];
```

---

## EXISTING TESTS TO ADJUST

### File: `packages/a2a-server/src/agent/task.test.ts`
**Location:** After line 469 (end of existing test suite)
**Add:** New test suite for auto-approval (see NEW TESTS section below)

### File: `packages/a2a-server/src/http/app.test.ts`
**Location:** After line 1063 (end of existing /executeCommand tests)
**Add:** Tests for streaming commands and context (see NEW TESTS section below)

---

## NEW TESTS (RED)

### Test File 1: `packages/a2a-server/src/commands/init.test.ts` (NEW)

```typescript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InitCommand } from './init.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoderAgentExecutor } from '../agent/executor.js';
import { CoderAgentEvent } from '../types.js';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';
import { createMockConfig } from '../utils/testing_utils.js';
import type { CommandContext } from './types.js';
import type { Config } from '@vybestack/llxprt-code-core';
import { logger } from '../utils/logger.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('../agent/executor.js', () => ({
  CoderAgentExecutor: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('InitCommand', () => {
  let eventBus: ExecutionEventBus;
  let command: InitCommand;
  let context: CommandContext;
  let publishSpy: ReturnType<typeof vi.spyOn>;
  let mockExecute: ReturnType<typeof vi.fn>;
  const mockWorkspacePath = path.resolve('/tmp');

  beforeEach(() => {
    process.env['CODER_AGENT_WORKSPACE_PATH'] = mockWorkspacePath;
    eventBus = {
      publish: vi.fn(),
    } as unknown as ExecutionEventBus;
    command = new InitCommand();
    const mockConfig = createMockConfig({
      getModel: () => 'gemini-pro',
    });
    const mockExecutorInstance = new CoderAgentExecutor();
    context = {
      config: mockConfig as unknown as Config,
      agentExecutor: mockExecutorInstance,
      eventBus,
    } as CommandContext;
    publishSpy = vi.spyOn(eventBus, 'publish');
    mockExecute = vi.fn();
    vi.spyOn(mockExecutorInstance, 'execute').mockImplementation(mockExecute);
    vi.clearAllMocks();
  });

  it('has requiresWorkspace set to true', () => {
    expect(command.requiresWorkspace).toBe(true);
  });

  it('has streaming set to true', () => {
    expect(command.streaming).toBe(true);
  });

  describe('execute', () => {
    it('handles info when LLXPRT.md already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await command.execute(context, []);

      expect(logger.info).toHaveBeenCalledWith(
        '[EventBus event]: ',
        expect.objectContaining({
          kind: 'status-update',
          status: expect.objectContaining({
            state: 'completed',
            message: expect.objectContaining({
              parts: [{ kind: 'text', text: expect.stringContaining('LLXPRT.md already exists') }],
            }),
          }),
        }),
      );

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'status-update',
          status: expect.objectContaining({
            state: 'completed',
            message: expect.objectContaining({
              parts: [{ kind: 'text', text: expect.stringContaining('LLXPRT.md already exists') }],
            }),
          }),
        }),
      );
    });

    describe('when LLXPRT.md does not exist', () => {
      beforeEach(() => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
      });

      it('writes the file and executes the agent', async () => {
        await command.execute(context, []);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          path.join(mockWorkspacePath, 'LLXPRT.md'),
          '',
          'utf8',
        );
        expect(mockExecute).toHaveBeenCalled();
      });

      it('passes autoExecute: true to the agent executor', async () => {
        await command.execute(context, []);

        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            userMessage: expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('analyze the current directory'),
                }),
              ]),
              metadata: {
                coderAgent: {
                  kind: CoderAgentEvent.StateAgentSettingsEvent,
                  workspacePath: mockWorkspacePath,
                  autoExecute: true,
                },
              },
            }),
          }),
          eventBus,
        );
      });
    });
  });
});
```

### Test File 2: Add to `packages/a2a-server/src/agent/task.test.ts`

**Add after line 469 (end of existing test suite):**

```typescript
  describe('auto-approval', () => {
    it('should auto-approve tool calls when autoExecute is true', () => {
      task.autoExecute = true;
      const onConfirmSpy = vi.fn();
      const toolCalls = [
        {
          request: { callId: '1' },
          status: 'awaiting_approval',
          confirmationDetails: { onConfirm: onConfirmSpy },
        },
      ] as unknown as ToolCall[];

      // @ts-expect-error - Calling private method
      task._schedulerToolCallsUpdate(toolCalls);

      expect(onConfirmSpy).toHaveBeenCalledWith(
        ToolConfirmationOutcome.ProceedOnce,
      );
    });

    it('should auto-approve tool calls when approval mode is YOLO', () => {
      (mockConfig.getApprovalMode as Mock).mockReturnValue(ApprovalMode.YOLO);
      task.autoExecute = false;
      const onConfirmSpy = vi.fn();
      const toolCalls = [
        {
          request: { callId: '1' },
          status: 'awaiting_approval',
          confirmationDetails: { onConfirm: onConfirmSpy },
        },
      ] as unknown as ToolCall[];

      // @ts-expect-error - Calling private method
      task._schedulerToolCallsUpdate(toolCalls);

      expect(onConfirmSpy).toHaveBeenCalledWith(
        ToolConfirmationOutcome.ProceedOnce,
      );
    });

    it('should NOT auto-approve when autoExecute is false and mode is not YOLO', () => {
      task.autoExecute = false;
      (mockConfig.getApprovalMode as Mock).mockReturnValue(
        ApprovalMode.DEFAULT,
      );
      const onConfirmSpy = vi.fn();
      const toolCalls = [
        {
          request: { callId: '1' },
          status: 'awaiting_approval',
          confirmationDetails: { onConfirm: onConfirmSpy },
        },
      ] as unknown as ToolCall[];

      // @ts-expect-error - Calling private method
      task._schedulerToolCallsUpdate(toolCalls);

      expect(onConfirmSpy).not.toHaveBeenCalled();
    });
  });
```

**Required imports to add at top of file:**
```typescript
import { ApprovalMode, ToolConfirmationOutcome } from '@vybestack/llxprt-code-core';
import type { Mock } from 'vitest';
```

**Required setup in beforeEach (add after mockEventBus creation):**
```typescript
    mockConfig = createMockConfig() as Config;
    mockEventBus = {
      publish: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as ExecutionEventBus;
```

### Test File 3: Add to `packages/a2a-server/src/http/app.test.ts`

**Add after line 1063 (end of existing /executeCommand tests):**

```typescript
    it('should include agentExecutor in context', async () => {
      const mockCommand = {
        name: 'context-check-command',
        description: 'checks context',
        execute: vi.fn(async (context: CommandContext) => {
          if (!context.agentExecutor) {
            throw new Error('agentExecutor missing');
          }
          return { name: 'context-check-command', data: 'success' };
        }),
      };
      vi.spyOn(commandRegistry, 'get').mockReturnValue(mockCommand);

      const agent = request.agent(app);
      const res = await agent
        .post('/executeCommand')
        .send({ command: 'context-check-command', args: [] })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(res.body.data).toBe('success');
    });

    describe('/executeCommand streaming', () => {
      it('should execute a streaming command and stream back events', (done: (
        err?: unknown,
      ) => void) => {
        const executeSpy = vi.fn(async (context: CommandContext) => {
          context.eventBus?.publish({
            kind: 'status-update',
            status: { state: 'working' },
            taskId: 'test-task',
            contextId: 'test-context',
            final: false,
          });
          context.eventBus?.publish({
            kind: 'status-update',
            status: { state: 'completed' },
            taskId: 'test-task',
            contextId: 'test-context',
            final: true,
          });
          return { name: 'stream-test', data: 'done' };
        });

        const mockStreamCommand = {
          name: 'stream-test',
          description: 'A test streaming command',
          streaming: true,
          execute: executeSpy,
        };
        vi.spyOn(commandRegistry, 'get').mockReturnValue(mockStreamCommand);

        const agent = request.agent(app);
        agent
          .post('/executeCommand')
          .send({ command: 'stream-test', args: [] })
          .set('Content-Type', 'application/json')
          .set('Accept', 'text/event-stream')
          .on('response', (res) => {
            let data = '';
            res.on('data', (chunk: Buffer) => {
              data += chunk.toString();
            });
            res.on('end', () => {
              try {
                const events = streamToSSEEvents(data);
                expect(events.length).toBe(2);
                expect(events[0].result).toEqual({
                  kind: 'status-update',
                  status: { state: 'working' },
                  taskId: 'test-task',
                  contextId: 'test-context',
                  final: false,
                });
                expect(events[1].result).toEqual({
                  kind: 'status-update',
                  status: { state: 'completed' },
                  taskId: 'test-task',
                  contextId: 'test-context',
                  final: true,
                });
                expect(executeSpy).toHaveBeenCalled();
                done();
              } catch (e) {
                done(e);
              }
            });
          })
          .end();
      });

      it('should handle non-streaming commands gracefully', async () => {
        const mockNonStreamCommand = {
          name: 'non-stream-test',
          description: 'A test non-streaming command',
          execute: vi
            .fn()
            .mockResolvedValue({ name: 'non-stream-test', data: 'done' }),
        };
        vi.spyOn(commandRegistry, 'get').mockReturnValue(mockNonStreamCommand);

        const agent = request.agent(app);
        const res = await agent
          .post('/executeCommand')
          .send({ command: 'non-stream-test', args: [] })
          .set('Content-Type', 'application/json')
          .expect(200);

        expect(res.body).toEqual({ name: 'non-stream-test', data: 'done' });
      });
    });
```

**Helper function to add at top level of test file:**
```typescript
function streamToSSEEvents(data: string): Array<{ result: AgentExecutionEvent }> {
  return data
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.substring(6)));
}
```

**Required import to add:**
```typescript
import type { AgentExecutionEvent } from '@a2a-js/sdk/server';
```

---

## IMPLEMENTATION (GREEN)

### New File: `packages/a2a-server/src/commands/init.ts`

```typescript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoderAgentEvent, type AgentSettings } from '../types.js';
import type {
  Command,
  CommandContext,
  CommandExecutionResponse,
} from './types.js';
import type { CoderAgentExecutor } from '../agent/executor.js';
import type {
  ExecutionEventBus,
  RequestContext,
  AgentExecutionEvent,
} from '@a2a-js/sdk/server';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

type CommandActionReturn =
  | { type: 'message'; messageType: 'info' | 'error'; content: string }
  | { type: 'submit_prompt'; content: string };

export class InitCommand implements Command {
  name = 'init';
  description = 'Analyzes the project and creates a tailored LLXPRT.md file';
  requiresWorkspace = true;
  streaming = true;

  private performInitLogic(llxprtMdExists: boolean): CommandActionReturn {
    if (llxprtMdExists) {
      return {
        type: 'message',
        messageType: 'info',
        content:
          'A LLXPRT.md file already exists in this directory. No changes were made.',
      };
    }

    return {
      type: 'submit_prompt',
      content: `
You are an AI agent that brings the power of LLxprt directly into the terminal. Your task is to analyze the current directory and generate a comprehensive LLXPRT.md file to be used as instructional context for future interactions.

**Analysis Process:**

1.  **Initial Exploration:**
    *   Start by listing the files and directories to get a high-level overview of the structure.
    *   Read the README file (e.g., \`README.md\`, \`README.txt\`) if it exists. This is often the best place to start.

2.  **Iterative Deep Dive (up to 10 files):**
    *   Based on your initial findings, select a few files that seem most important (e.g., configuration files, main source files, documentation).
    *   Read them. As you learn more, refine your understanding and decide which files to read next. You don't need to decide all 10 files at once. Let your discoveries guide your exploration.

3.  **Identify Project Type:**
    *   **Code Project:** Look for clues like \`package.json\`, \`requirements.txt\`, \`pom.xml\`, \`go.mod\`, \`Cargo.toml\`, \`build.gradle\`, or a \`src\` directory. If you find them, this is likely a software project.
    *   **Non-Code Project:** If you don't find code-related files, this might be a directory for documentation, research papers, notes, or something else.

**LLXPRT.md Content Generation:**

**For a Code Project:**

*   **Project Overview:** Write a clear and concise summary of the project's purpose, main technologies, and architecture.
*   **Building and Running:** Document the key commands for building, running, and testing the project. Infer these from the files you've read (e.g., \`scripts\` in \`package.json\`, \`Makefile\`, etc.). If you can't find explicit commands, provide a placeholder with a TODO.
*   **Development Conventions:** Describe any coding styles, testing practices, or contribution guidelines you can infer from the codebase.

**For a Non-Code Project:**

*   **Directory Overview:** Describe the purpose and contents of the directory. What is it for? What kind of information does it hold?
*   **Key Files:** List the most important files and briefly explain what they contain.
*   **Usage:** Explain how the contents of this directory are intended to be used.

**Final Output:**

Write the complete content to the \`LLXPRT.md\` file. The output must be well-formatted Markdown.
`,
    };
  }

  private handleMessageResult(
    result: { content: string; messageType: 'info' | 'error' },
    context: CommandContext,
    eventBus: ExecutionEventBus,
    taskId: string,
    contextId: string,
  ): CommandExecutionResponse {
    const statusState = result.messageType === 'error' ? 'failed' : 'completed';
    const eventType =
      result.messageType === 'error'
        ? CoderAgentEvent.StateChangeEvent
        : CoderAgentEvent.TextContentEvent;

    const event: AgentExecutionEvent = {
      kind: 'status-update',
      taskId,
      contextId,
      status: {
        state: statusState,
        message: {
          kind: 'message',
          role: 'agent',
          parts: [{ kind: 'text', text: result.content }],
          messageId: uuidv4(),
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
      metadata: {
        coderAgent: { kind: eventType },
        model: context.config.getModel(),
      },
    };

    logger.info('[EventBus event]: ', event);
    eventBus.publish(event);
    return {
      name: this.name,
      data: result,
    };
  }

  private async handleSubmitPromptResult(
    result: { content: unknown },
    context: CommandContext,
    llxprtMdPath: string,
    eventBus: ExecutionEventBus,
    taskId: string,
    contextId: string,
  ): Promise<CommandExecutionResponse> {
    fs.writeFileSync(llxprtMdPath, '', 'utf8');

    if (!context.agentExecutor) {
      throw new Error('Agent executor not found in context.');
    }
    const agentExecutor = context.agentExecutor as CoderAgentExecutor;

    const agentSettings: AgentSettings = {
      kind: CoderAgentEvent.StateAgentSettingsEvent,
      workspacePath: process.env['CODER_AGENT_WORKSPACE_PATH']!,
      autoExecute: true,
    };

    if (typeof result.content !== 'string') {
      throw new Error('Init command content must be a string.');
    }
    const promptText = result.content;

    const requestContext: RequestContext = {
      userMessage: {
        kind: 'message',
        role: 'user',
        parts: [{ kind: 'text', text: promptText }],
        messageId: uuidv4(),
        taskId,
        contextId,
        metadata: {
          coderAgent: agentSettings,
        },
      },
      taskId,
      contextId,
    };

    await agentExecutor.execute(requestContext, eventBus);
    return {
      name: this.name,
      data: llxprtMdPath,
    };
  }

  async execute(
    context: CommandContext,
    _args: string[] = [],
  ): Promise<CommandExecutionResponse> {
    if (!context.eventBus) {
      return {
        name: this.name,
        data: 'Use executeStream to get streaming results.',
      };
    }

    const llxprtMdPath = path.join(
      process.env['CODER_AGENT_WORKSPACE_PATH']!,
      'LLXPRT.md',
    );
    const result = this.performInitLogic(fs.existsSync(llxprtMdPath));

    const taskId = uuidv4();
    const contextId = uuidv4();

    switch (result.type) {
      case 'message':
        return this.handleMessageResult(
          result,
          context,
          context.eventBus,
          taskId,
          contextId,
        );
      case 'submit_prompt':
        return this.handleSubmitPromptResult(
          result,
          context,
          llxprtMdPath,
          context.eventBus,
          taskId,
          contextId,
        );
      default:
        throw new Error('Unknown result type from performInitLogic');
    }
  }
}
```

---

## REFACTOR

**NO REFACTORING REQUIRED**

All code follows existing patterns:
- Test structure matches `extensions.test.ts` patterns
- Command structure matches `restore.ts` and `extensions.ts` patterns
- HTTP handler matches existing Express patterns
- No duplication introduced
- Clear separation of concerns maintained

---

## VERIFICATION

### Step 1: Run Tests
```bash
cd /Users/acoliver/projects/llxprt/branch-1/llxprt-code
pnpm test packages/a2a-server
```
**Expected:** All tests pass, including 3 new test suites:
- `init.test.ts`: 5 tests
- `task.test.ts`: 3 new auto-approval tests
- `app.test.ts`: 3 new streaming tests

### Step 2: Lint Check
```bash
pnpm lint packages/a2a-server
```
**Expected:** No linting errors

### Step 3: Build Check
```bash
pnpm build packages/a2a-server
```
**Expected:** Clean build with no TypeScript errors

### Step 4: Manual Verification Checklist
- [ ] `autoExecute` property flows from `AgentSettings` → `Task`
- [ ] Init command creates `LLXPRT.md` (not `GEMINI.md`)
- [ ] Auto-approval works with both `autoExecute: true` and YOLO mode
- [ ] Streaming commands use SSE
- [ ] Non-streaming commands still work
- [ ] Extension config returns `['LLXPRT.md']`
- [ ] No `GEMINI.md` references remain (except in license comments from upstream)
- [ ] A2A server package remains private

### Step 5: Search for GEMINI.md References
```bash
cd packages/a2a-server
grep -r "GEMINI\.md" src/ --exclude-dir=node_modules
```
**Expected:** Only one match in `extension.ts:141` showing `LLXPRT.md`

---

## COMMIT MESSAGE

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

## ESTIMATED LINES OF CODE

| File | Change Type | Lines |
|------|-------------|-------|
| `init.ts` | NEW | ~240 |
| `init.test.ts` | NEW | ~182 |
| `task.ts` | MODIFY | +4 |
| `task.test.ts` | MODIFY | +67 |
| `executor.ts` | MODIFY | +2 |
| `types.ts` | MODIFY | +1 |
| `commands/types.ts` | MODIFY | +3 |
| `command-registry.ts` | MODIFY | +2 |
| `app.ts` | MODIFY | +75 |
| `app.test.ts` | MODIFY | ~130 |
| `extension.ts` | MODIFY | 1 change |

**Total: ~707 lines added/modified**

---

## IMPLEMENTATION ORDER

1. **Update types** (types.ts, commands/types.ts) - Foundation
2. **Update Task class** (task.ts) - Core feature
3. **Update Executor** (executor.ts) - Plumbing
4. **Write Task tests** (task.test.ts) - RED phase
5. **Verify Task tests pass** - GREEN phase
6. **Create InitCommand** (init.ts) - Core feature
7. **Write Init tests** (init.test.ts) - RED phase
8. **Verify Init tests pass** - GREEN phase
9. **Register command** (command-registry.ts) - Integration
10. **Update HTTP app** (app.ts) - Infrastructure
11. **Write HTTP tests** (app.test.ts) - RED phase
12. **Verify HTTP tests pass** - GREEN phase
13. **Update extension config** (extension.ts) - Branding
14. **Run full test suite** - Final verification
15. **Run lint** - Code quality
16. **Run build** - Type check
17. **Commit** - Version control

---

## CRITICAL NOTES

1. **A2A SERVER IS PRIVATE** - Do not modify package.json to make it publishable
2. **LLXPRT.md EVERYWHERE** - No `GEMINI.md` references should remain
3. **NO EMOJI** - Follow LLxprt style (no emoji in logs/messages)
4. **LICENSE HEADERS** - Keep "Copyright 2025 Google LLC" (per upstream Apache 2.0)
5. **TEST ALL PATHS** - Both auto-execute and YOLO mode must work
6. **SSE CLEANUP** - Event listeners must be properly removed after streaming
7. **ERROR HANDLING** - All error cases from upstream must be preserved
8. **WORKSPACE PATH** - `CODER_AGENT_WORKSPACE_PATH` env var required for /init

---

## TDD PRINCIPLE COMPLIANCE

This plan follows strict TDD:
1. [OK] **RED**: All test code is written first and specified completely
2. [OK] **GREEN**: Implementation code is minimal and exact to pass tests
3. [OK] **REFACTOR**: Explicitly states "no refactoring required" (code already clean)
4. [OK] **Test behavior, not implementation**: Tests check outcomes, not internal details
5. [OK] **100% coverage**: Every code path has a corresponding test

---

## SUBAGENT SUCCESS CRITERIA

A context-wiped subagent can succeed if they:
1. Read this plan from top to bottom
2. Follow the IMPLEMENTATION ORDER exactly
3. Copy-paste the exact code from NEW TESTS and IMPLEMENTATION sections
4. Apply the exact changes specified in LLXPRT TOUCHPOINTS
5. Run VERIFICATION steps and confirm all checks pass
6. Use the provided COMMIT MESSAGE

**No external context, files, or upstream knowledge is required.**
