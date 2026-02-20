/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { migrateCommand } from './hooks/migrate.js';

export const hooksCommand: CommandModule = {
  command: 'hooks <command>',
  describe: 'Manage hooks.',
  builder: (yargs: Argv) =>
    yargs
      .command(migrateCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
  },
};
