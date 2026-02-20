/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { Task } from './task.js';
import {
  type Config,
  type ToolCallRequestInfo,
  GeminiEventType,
  type GitService,
  type CompletedToolCall,
} from '@vybestack/llxprt-code-core';
import { createMockConfig } from '../utils/testing_utils.js';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';

const mockProcessRestorableToolCalls = vi.hoisted(() => vi.fn());

vi.mock('@vybestack/llxprt-code-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@vybestack/llxprt-code-core')>();
  return {
    ...original,
    processRestorableToolCalls: mockProcessRestorableToolCalls,
  };
});

describe('Task', () => {
  it('scheduleToolCalls should not modify the input requests array', async () => {
    const mockConfig = createMockConfig();

    const mockEventBus: ExecutionEventBus = {
      publish: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      finished: vi.fn(),
    };

    // The Task constructor is private. We'll bypass it for this unit test.
    // @ts-expect-error - Calling private constructor for test purposes.
    const task = new Task(
      'task-id',
      'context-id',
      mockConfig as Config,
      mockEventBus,
    );

    // Create a mock scheduler
    task.scheduler = {
      schedule: vi.fn().mockResolvedValue(undefined),
      cancelAll: vi.fn(),
      dispose: vi.fn(),
      toolCalls: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    task['setTaskStateAndPublishUpdate'] = vi.fn();
    task['getProposedContent'] = vi.fn().mockResolvedValue('new content');

    const requests: ToolCallRequestInfo[] = [
      {
        callId: '1',
        name: 'replace',
        args: {
          file_path: 'test.txt',
          old_string: 'old',
          new_string: 'new',
        },
        isClientInitiated: false,
        prompt_id: 'prompt-id-1',
      },
    ];

    const originalRequests = JSON.parse(JSON.stringify(requests));
    const abortController = new AbortController();

    await task.scheduleToolCalls(requests, abortController.signal);

    expect(requests).toEqual(originalRequests);
  });

  describe('scheduleToolCalls', () => {
    const mockConfig = createMockConfig();
    const mockEventBus: ExecutionEventBus = {
      publish: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      finished: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should not create a checkpoint if no restorable tools are called', async () => {
      // @ts-expect-error - Calling private constructor for test purposes.
      const task = new Task(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );
      const requests: ToolCallRequestInfo[] = [
        {
          callId: '1',
          name: 'run_shell_command',
          args: { command: 'ls' },
          isClientInitiated: false,
          prompt_id: 'prompt-id-1',
        },
      ];
      const abortController = new AbortController();
      await task.scheduleToolCalls(requests, abortController.signal);
      expect(mockProcessRestorableToolCalls).not.toHaveBeenCalled();
    });

    it('should create a checkpoint if a restorable tool is called', async () => {
      const mockConfig = createMockConfig({
        getCheckpointingEnabled: () => true,
        getGitService: () => Promise.resolve({} as GitService),
      });
      mockProcessRestorableToolCalls.mockResolvedValue({
        checkpointsToWrite: new Map([['test.json', 'test content']]),
        toolCallToCheckpointMap: new Map(),
        errors: [],
      });
      // @ts-expect-error - Calling private constructor for test purposes.
      const task = new Task(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );
      const requests: ToolCallRequestInfo[] = [
        {
          callId: '1',
          name: 'replace',
          args: {
            file_path: 'test.txt',
            old_string: 'old',
            new_string: 'new',
          },
          isClientInitiated: false,
          prompt_id: 'prompt-id-1',
        },
      ];
      const abortController = new AbortController();
      await task.scheduleToolCalls(requests, abortController.signal);
      expect(mockProcessRestorableToolCalls).toHaveBeenCalledOnce();
    });

    it('should process all restorable tools for checkpointing in a single batch', async () => {
      const mockConfig = createMockConfig({
        getCheckpointingEnabled: () => true,
        getGitService: () => Promise.resolve({} as GitService),
      });
      mockProcessRestorableToolCalls.mockResolvedValue({
        checkpointsToWrite: new Map([
          ['test1.json', 'test content 1'],
          ['test2.json', 'test content 2'],
        ]),
        toolCallToCheckpointMap: new Map([
          ['1', 'test1'],
          ['2', 'test2'],
        ]),
        errors: [],
      });
      // @ts-expect-error - Calling private constructor for test purposes.
      const task = new Task(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );
      const requests: ToolCallRequestInfo[] = [
        {
          callId: '1',
          name: 'replace',
          args: {
            file_path: 'test.txt',
            old_string: 'old',
            new_string: 'new',
          },
          isClientInitiated: false,
          prompt_id: 'prompt-id-1',
        },
        {
          callId: '2',
          name: 'write_file',
          args: { file_path: 'test2.txt', content: 'new content' },
          isClientInitiated: false,
          prompt_id: 'prompt-id-2',
        },
        {
          callId: '3',
          name: 'not_restorable',
          args: {},
          isClientInitiated: false,
          prompt_id: 'prompt-id-3',
        },
      ];
      const abortController = new AbortController();
      await task.scheduleToolCalls(requests, abortController.signal);
      expect(mockProcessRestorableToolCalls).toHaveBeenCalledExactlyOnceWith(
        [
          expect.objectContaining({ callId: '1' }),
          expect.objectContaining({ callId: '2' }),
        ],
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('acceptAgentMessage', () => {
    it('should set currentTraceId when event has traceId', async () => {
      const mockConfig = createMockConfig();
      const mockEventBus: ExecutionEventBus = {
        publish: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        finished: vi.fn(),
      };

      // @ts-expect-error - Calling private constructor for test purposes.
      const task = new Task(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );

      const event = {
        type: 'content',
        value: 'test',
        traceId: 'test-trace-id',
      };

      await task.acceptAgentMessage(event);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            traceId: 'test-trace-id',
          }),
        }),
      );
    });
  });

  describe('modelInfo propagation', () => {
    it('should store modelInfo when ModelInfo event is received', async () => {
      const mockConfig = createMockConfig();
      const mockEventBus: ExecutionEventBus = {
        publish: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        finished: vi.fn(),
      };

      // @ts-expect-error - Calling private constructor for test purposes.
      const task = new Task(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );

      const event = {
        type: GeminiEventType.ModelInfo,
        value: {
          model: 'gemini-2.0-flash-exp',
        },
      } as const;

      await task.acceptAgentMessage(event);

      // Access private field for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((task as any).modelInfo).toEqual({
        model: 'gemini-2.0-flash-exp',
      });
    });

    it('should return updated model name from getMetadata when modelInfo is set', async () => {
      const mockConfig = createMockConfig();
      const mockEventBus: ExecutionEventBus = {
        publish: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        finished: vi.fn(),
      };

      const task = await Task.create(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );

      // Set modelInfo via event
      const event = {
        type: GeminiEventType.ModelInfo,
        value: {
          model: 'gemini-2.0-flash-exp',
        },
      } as const;

      await task.acceptAgentMessage(event);

      const metadata = await task.getMetadata();
      expect(metadata.model).toBe('gemini-2.0-flash-exp');
    });

    it('should use modelInfo in setTaskStateAndPublishUpdate status updates', async () => {
      const mockConfig = createMockConfig();
      const mockEventBus: ExecutionEventBus = {
        publish: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        finished: vi.fn(),
      };

      // @ts-expect-error - Calling private constructor for test purposes.
      const task = new Task(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );

      // Set modelInfo
      const event = {
        type: GeminiEventType.ModelInfo,
        value: {
          model: 'gemini-2.0-flash-exp',
        },
      } as const;

      await task.acceptAgentMessage(event);

      // Trigger a status update
      task.setTaskStateAndPublishUpdate('working', {
        kind: 'state-change' as const,
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            model: 'gemini-2.0-flash-exp',
          }),
        }),
      );
    });

    it('should use default model name when no modelInfo received', async () => {
      const mockConfig = createMockConfig();
      const mockEventBus: ExecutionEventBus = {
        publish: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        finished: vi.fn(),
      };

      const task = await Task.create(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );

      const metadata = await task.getMetadata();
      expect(metadata.model).toBe('gemini-pro'); // Default from mock config
    });

    it('should overwrite modelInfo when multiple ModelInfo events are received', async () => {
      const mockConfig = createMockConfig();
      const mockEventBus: ExecutionEventBus = {
        publish: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        finished: vi.fn(),
      };

      // @ts-expect-error - Calling private constructor for test purposes.
      const task = new Task(
        'task-id',
        'context-id',
        mockConfig as Config,
        mockEventBus,
      );

      // First ModelInfo event
      const event1 = {
        type: GeminiEventType.ModelInfo,
        value: {
          model: 'gemini-1.5-pro',
        },
      } as const;
      await task.acceptAgentMessage(event1);

      // Second ModelInfo event
      const event2 = {
        type: GeminiEventType.ModelInfo,
        value: {
          model: 'gemini-2.0-flash-exp',
        },
      } as const;
      await task.acceptAgentMessage(event2);

      // Should have the latest modelInfo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((task as any).modelInfo).toEqual({
        model: 'gemini-2.0-flash-exp',
      });
    });
  });
});
