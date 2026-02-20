/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extension hooks consent handling.
 *
 * Prompts users before enabling extension hooks to ensure they understand
 * the security implications.
 */

/**
 * Requests user consent before enabling extension hooks.
 *
 * Shows which hooks the extension wants to register and asks for user consent.
 * Returns true if user consents, false otherwise.
 *
 * @param extensionName - Name of the extension requesting hook registration
 * @param hookNames - Array of hook names the extension wants to register
 * @returns Promise resolving to true if user consents, false otherwise
 */
export async function requestHookConsent(
  extensionName: string,
  hookNames: string[],
): Promise<boolean> {
  if (hookNames.length === 0) {
    // No hooks to register, consent not needed
    return true;
  }

  console.log('');
  console.log('WARNING:  Extension Hook Security Warning');
  console.log('━'.repeat(60));
  console.log('');
  console.log(
    `Extension "${extensionName}" wants to register the following hooks:`,
  );
  console.log('');

  for (const hookName of hookNames) {
    console.log(`  • ${hookName}`);
  }

  console.log('');
  console.log('Hooks can intercept and modify LLxprt Code behavior.');
  console.log('Only enable hooks from extensions you trust.');
  console.log('');
  console.log('Learn more: https://docs.vybestack.com/extensions/hooks');
  console.log('');

  // Prompt for consent using readline
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    rl.question('Enable these hooks? [y/N]: ', (answer) => {
      rl.close();
      const consent = answer.trim().toLowerCase() === 'y';
      if (consent) {
        console.log(`[OK] Hooks enabled for extension "${extensionName}".`);
      } else {
        console.log(` Hooks not enabled for extension "${extensionName}".`);
      }
      console.log('');
      resolve(consent);
    });
  });
}
