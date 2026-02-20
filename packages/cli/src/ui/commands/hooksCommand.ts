/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';
import { type HookRegistryEntry } from '@vybestack/llxprt-code-core';

const COLOR_GREEN = '\u001b[32m';
const COLOR_YELLOW = '\u001b[33m';
const COLOR_CYAN = '\u001b[36m';
const COLOR_GREY = '\u001b[90m';
const RESET_COLOR = '\u001b[0m';

/**
 * Format a hook entry for display
 */
function formatHookEntry(entry: HookRegistryEntry, hookName: string): string {
  const statusBadge = entry.enabled
    ? `${COLOR_GREEN}[enabled]${RESET_COLOR}`
    : `${COLOR_GREY}[disabled]${RESET_COLOR}`;

  const sourceBadge = `${COLOR_CYAN}[${entry.source}]${RESET_COLOR}`;

  return `  ${statusBadge} ${sourceBadge} ${hookName} (${entry.eventName})`;
}

/**
 * List all registered hooks
 */
async function listHooks(context: CommandContext): Promise<void> {
  const { config } = context.services;
  if (!config) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Config not loaded.',
      },
      Date.now(),
    );
    return;
  }

  const hookSystem = config.getHookSystem();
  if (!hookSystem) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: 'Hooks system is not enabled. Enable it in settings with tools.enableHooks.',
      },
      Date.now(),
    );
    return;
  }

  await hookSystem.initialize();
  const hookRegistry = hookSystem.getRegistry();
  const allHooks = hookRegistry.getAllHooks();

  if (allHooks.length === 0) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: 'No hooks registered.',
      },
      Date.now(),
    );
    return;
  }

  let message = 'Registered hooks:\n\n';

  // Group by event name
  const byEvent = new Map<string, HookRegistryEntry[]>();
  for (const entry of allHooks) {
    const eventName = entry.eventName;
    if (!byEvent.has(eventName)) {
      byEvent.set(eventName, []);
    }
    byEvent.get(eventName)!.push(entry);
  }

  for (const [eventName, entries] of byEvent.entries()) {
    message += `${COLOR_YELLOW}${eventName}${RESET_COLOR}:\n`;
    for (const entry of entries) {
      const hookName = hookRegistry.getHookName(entry);
      message += formatHookEntry(entry, hookName) + '\n';
    }
    message += '\n';
  }

  const enabledCount = allHooks.filter(
    (h: HookRegistryEntry) => h.enabled,
  ).length;
  const disabledCount = allHooks.length - enabledCount;

  message += `Total: ${allHooks.length} hooks (${enabledCount} enabled, ${disabledCount} disabled)\n`;
  message += RESET_COLOR;

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: message,
    },
    Date.now(),
  );
}

/**
 * Enable a hook by name
 */
async function enableHook(
  context: CommandContext,
  hookName: string,
): Promise<void> {
  const { config } = context.services;
  if (!config) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Config not loaded.',
      },
      Date.now(),
    );
    return;
  }

  const hookSystem = config.getHookSystem();
  if (!hookSystem) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Hooks system is not enabled.',
      },
      Date.now(),
    );
    return;
  }

  await hookSystem.initialize();
  const hookRegistry = hookSystem.getRegistry();

  // Find the hook
  const allHooks = hookRegistry.getAllHooks();
  const matchingHook = allHooks.find(
    (entry) => hookRegistry.getHookName(entry) === hookName,
  );

  if (!matchingHook) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `Hook '${hookName}' not found.`,
      },
      Date.now(),
    );
    return;
  }

  // Remove from disabled list
  const disabledHooks = config.getDisabledHooks();
  const newDisabledHooks = disabledHooks.filter(
    (name: string) => name !== hookName,
  );
  config.setDisabledHooks(newDisabledHooks);

  // Update the registry
  hookRegistry.setHookEnabled(hookName, true);

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `Enabled hook '${hookName}'.`,
    },
    Date.now(),
  );
}

/**
 * Disable a hook by name
 */
async function disableHook(
  context: CommandContext,
  hookName: string,
): Promise<void> {
  const { config } = context.services;
  if (!config) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Config not loaded.',
      },
      Date.now(),
    );
    return;
  }

  const hookSystem = config.getHookSystem();
  if (!hookSystem) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Hooks system is not enabled.',
      },
      Date.now(),
    );
    return;
  }

  await hookSystem.initialize();
  const hookRegistry = hookSystem.getRegistry();

  // Find the hook
  const allHooks = hookRegistry.getAllHooks();
  const matchingHook = allHooks.find(
    (entry: HookRegistryEntry) => hookRegistry.getHookName(entry) === hookName,
  );

  if (!matchingHook) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `Hook '${hookName}' not found.`,
      },
      Date.now(),
    );
    return;
  }

  // Add to disabled list
  const disabledHooks = config.getDisabledHooks();
  if (!disabledHooks.includes(hookName)) {
    const newDisabledHooks = [...disabledHooks, hookName];
    config.setDisabledHooks(newDisabledHooks);
  }

  // Update the registry
  hookRegistry.setHookEnabled(hookName, false);

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `Disabled hook '${hookName}'.`,
    },
    Date.now(),
  );
}

const listCommand: SlashCommand = {
  name: 'list',
  description: 'List all registered hooks',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext) => {
    await listHooks(context);
  },
};

const enableCommand: SlashCommand = {
  name: 'enable',
  description: 'Enable a hook by name',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext, args: string) => {
    const hookName = args.trim();
    if (!hookName) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Usage: /hooks enable <hook-name>',
        },
        Date.now(),
      );
      return;
    }
    await enableHook(context, hookName);
  },
};

const disableCommand: SlashCommand = {
  name: 'disable',
  description: 'Disable a hook by name',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext, args: string) => {
    const hookName = args.trim();
    if (!hookName) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Usage: /hooks disable <hook-name>',
        },
        Date.now(),
      );
      return;
    }
    await disableHook(context, hookName);
  },
};

export const hooksCommand: SlashCommand = {
  name: 'hooks',
  description: 'View, enable, or disable hooks',
  kind: CommandKind.BUILT_IN,
  subCommands: [listCommand, enableCommand, disableCommand],
  action: async (context: CommandContext, args: string) => {
    // Default action when no subcommand is provided - show the list
    if (!args || args.trim() === '') {
      await listHooks(context);
    } else {
      // Try to parse as a subcommand
      const tokens = args.trim().split(/\s+/);
      const subCommandName = tokens[0];
      const subArgs = tokens.slice(1).join(' ');

      const subCommand = [listCommand, enableCommand, disableCommand].find(
        (cmd) => cmd.name === subCommandName,
      );

      if (subCommand && subCommand.action) {
        await subCommand.action(context, subArgs);
      } else {
        await listHooks(context);
      }
    }
  },
};
