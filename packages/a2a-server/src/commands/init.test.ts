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

      // Check that publish was called with the right event
      expect(publishSpy).toHaveBeenCalled();
      const publishCall = publishSpy.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = publishCall as any;
      expect(event.kind).toBe('status-update');
      expect(event.status.state).toBe('completed');
      expect(event.status.message.parts[0].text).toContain('LLXPRT.md');
      expect(event.status.message.parts[0].text).toContain('already exists');

      // Verify logger was also called
      expect(logger.info).toHaveBeenCalledWith(
        '[EventBus event]: ',
        expect.objectContaining({
          kind: 'status-update',
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
                  text: expect.stringContaining(
                    'analyze the current directory',
                  ),
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
