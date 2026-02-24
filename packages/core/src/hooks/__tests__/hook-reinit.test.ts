/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview TDD tests for hook re-initialization on extension change
 * @requirement R2 R4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookSystem } from '../hookSystem.js';
import type { Config } from '../../config/config.js';
import type { GeminiCLIExtension } from '../../config/config.js';
import { HookEventName } from '../types.js';

describe('Hook Re-Initialization (126c32ac)', () => {
  let mockConfig: Config;
  let mockExtensions: GeminiCLIExtension[];

  beforeEach(() => {
    mockExtensions = [];
    mockConfig = {
      getEnableHooks: () => true,
      getHooks: () => ({}),
      getSessionId: () => 'test-session',
      getWorkingDir: () => '/test',
      getTargetDir: () => '/test',
      getExtensions: () => mockExtensions,
      getDisabledHooks: () => [],
      getModel: () => 'test-model',
    } as unknown as Config;
  });

  it('should reload hooks when extension with hooks is added (RED → GREEN)', async () => {
    // RED: This test will FAIL because initialize() has guard that prevents re-init
    const hookSystem = new HookSystem(mockConfig);

    // First init — no extensions
    await hookSystem.initialize();
    const beforeCount = hookSystem.getAllHooks().length;
    expect(beforeCount).toBe(0);

    // Add extension with hooks
    mockExtensions.push({
      name: 'test-ext',
      isActive: true,
      version: '1.0.0',
      path: '/ext',
      contextFiles: [],
      id: 'ext-123',
      hooks: {
        [HookEventName.BeforeTool]: [
          {
            matcher: 'read_file',
            hooks: [{ type: 'command', command: './check.sh' }],
          },
        ],
      },
    });

    // Re-initialize — should pick up new extension hooks
    await hookSystem.initialize();
    const afterCount = hookSystem.getAllHooks().length;

    // RED: This assertion will FAIL because guard prevents re-init
    expect(afterCount).toBeGreaterThan(beforeCount);
    expect(afterCount).toBe(1); // One hook from extension
  });

  it('should reload hooks when extension with hooks is removed (RED → GREEN)', async () => {
    // RED: This test will FAIL because initialize() has guard
    mockExtensions.push({
      name: 'test-ext',
      isActive: true,
      version: '1.0.0',
      path: '/ext',
      contextFiles: [],
      id: 'ext-123',
      hooks: {
        [HookEventName.BeforeTool]: [
          {
            hooks: [{ type: 'command', command: './check.sh' }],
          },
        ],
      },
    });

    const hookSystem = new HookSystem(mockConfig);
    await hookSystem.initialize();
    const beforeCount = hookSystem.getAllHooks().length;
    expect(beforeCount).toBe(1);

    // Remove extension
    mockExtensions.length = 0;

    // Re-initialize — should clear extension hooks
    await hookSystem.initialize();
    const afterCount = hookSystem.getAllHooks().length;

    // RED: This assertion will FAIL because guard prevents re-init
    expect(afterCount).toBeLessThan(beforeCount);
    expect(afterCount).toBe(0);
  });
});

describe('Hook Re-Initialization Disposal (126c32ac)', () => {
  it('should dispose old event handler before creating new one (RED → GREEN)', async () => {
    // RED: This test will FAIL because initialize() doesn't dispose old handler
    const unsubscribeMock = vi.fn();
    const subscribeMock = vi.fn(() => unsubscribeMock);
    const mockMessageBus = {
      subscribe: subscribeMock,
      publish: vi.fn(),
    };

    const mockConfig = {
      getEnableHooks: () => true,
      getHooks: () => ({}),
      getSessionId: () => 'test-session',
      getWorkingDir: () => '/test',
      getTargetDir: () => '/test',
      getExtensions: () => [],
      getDisabledHooks: () => [],
      getModel: () => 'test-model',
    } as unknown as Config;

    const hookSystem = new HookSystem(mockConfig, mockMessageBus);

    // First init — subscribes to MessageBus
    await hookSystem.initialize();
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(unsubscribeMock).not.toHaveBeenCalled();

    // Re-init — should dispose old handler first
    await hookSystem.initialize();

    // RED: This assertion will FAIL because old subscription wasn't unsubscribed
    expect(unsubscribeMock).toHaveBeenCalledTimes(1); // Old handler disposed
    expect(subscribeMock).toHaveBeenCalledTimes(2); // New handler subscribed
  });

  it('should not leak subscriptions after multiple re-inits (RED → GREEN)', async () => {
    // RED: This test will FAIL because subscriptions leak
    const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];
    const subscribeMock = vi.fn(() => {
      const unsub = vi.fn();
      unsubscribes.push(unsub);
      return unsub;
    });
    const mockMessageBus = {
      subscribe: subscribeMock,
      publish: vi.fn(),
    };

    const mockConfig = {
      getEnableHooks: () => true,
      getHooks: () => ({}),
      getSessionId: () => 'test-session',
      getWorkingDir: () => '/test',
      getTargetDir: () => '/test',
      getExtensions: () => [],
      getDisabledHooks: () => [],
      getModel: () => 'test-model',
    } as unknown as Config;

    const hookSystem = new HookSystem(mockConfig, mockMessageBus);

    // Initialize 3 times
    await hookSystem.initialize();
    await hookSystem.initialize();
    await hookSystem.initialize();

    // Should have 3 subscriptions, 2 should be unsubscribed
    expect(subscribeMock).toHaveBeenCalledTimes(3);

    // RED: These assertions will FAIL because only last init ran (guard blocks others)
    expect(unsubscribes[0]).toHaveBeenCalledTimes(1); // First disposed before second init
    expect(unsubscribes[1]).toHaveBeenCalledTimes(1); // Second disposed before third init
    expect(unsubscribes[2]).not.toHaveBeenCalled(); // Third still active
  });
});
