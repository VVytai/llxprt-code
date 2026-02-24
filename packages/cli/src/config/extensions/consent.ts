/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { escapeAnsiCtrlCodes } from '../../ui/utils/textUtils.js';

/**
 * Extension hooks consent handling.
 *
 * Prompts users before enabling extension hooks to ensure they understand
 * the security implications.
 */

/**
 * Computes the delta between current and previous hook definitions.
 *
 * @param currentHooks - Current hook definitions
 * @param previousHooks - Previous hook definitions
 * @returns Object containing arrays of new and changed hook names
 */
export function computeHookConsentDelta(
  currentHooks: Record<string, unknown> | undefined,
  previousHooks: Record<string, unknown> | undefined,
): { newHooks: string[]; changedHooks: string[] } {
  const current = currentHooks ?? {};
  const previous = previousHooks ?? {};
  const newHooks: string[] = [];
  const changedHooks: string[] = [];

  for (const name of Object.keys(current)) {
    if (!(name in previous)) {
      newHooks.push(name);
    } else {
      // Compare hook definitions using sorted JSON stringify
      const prevKeys = Object.keys(previous[name] as Record<string, unknown>);
      const currKeys = Object.keys(current[name] as Record<string, unknown>);
      const prevJson = JSON.stringify(previous[name], prevKeys.sort());
      const currJson = JSON.stringify(current[name], currKeys.sort());
      if (prevJson !== currJson) {
        changedHooks.push(name);
      }
    }
  }

  return { newHooks, changedHooks };
}

/**
 * Builds a consent prompt string for hook registration.
 *
 * @param extensionName - Name of the extension requesting hook registration
 * @param hookNames - Array of hook names the extension wants to register
 * @returns Formatted consent prompt string
 */
export function buildHookConsentPrompt(
  extensionName: string,
  hookNames: string[],
): string {
  // Escape hook names to prevent ANSI injection
  const sanitizedExtensionName = escapeAnsiCtrlCodes(extensionName);
  const sanitizedHookNames = hookNames.map((name) => escapeAnsiCtrlCodes(name));

  const lines: string[] = [];
  lines.push('');
  lines.push('WARNING:  Extension Hook Security Warning');
  lines.push('━'.repeat(60));
  lines.push('');
  lines.push(
    `Extension "${sanitizedExtensionName}" wants to register the following hooks:`,
  );
  lines.push('');

  for (const hookName of sanitizedHookNames) {
    lines.push(`  • ${hookName}`);
  }

  lines.push('');
  lines.push('Hooks can intercept and modify LLxprt Code behavior.');
  lines.push('Only enable hooks from extensions you trust.');
  lines.push('');
  lines.push('Learn more: https://docs.vybestack.com/extensions/hooks');
  lines.push('');

  return lines.join('\n');
}

/**
 * Requests user consent before enabling extension hooks.
 *
 * Shows which hooks the extension wants to register and asks for user consent.
 * Returns true if user consents, false otherwise.
 *
 * @param extensionName - Name of the extension requesting hook registration
 * @param hookNames - Array of hook names the extension wants to register
 * @param requestConsent - Optional callback to request consent (for testing)
 * @returns Promise resolving to true if user consents, false otherwise
 * @throws Error if in non-interactive context and no requestConsent callback provided
 */
export async function requestHookConsent(
  extensionName: string,
  hookNames: string[],
  requestConsent?: (prompt: string) => Promise<boolean>,
): Promise<boolean> {
  if (hookNames.length === 0) {
    // No hooks to register, consent not needed
    return true;
  }

  const consentPrompt = buildHookConsentPrompt(extensionName, hookNames);

  // If a custom consent callback is provided, use it
  if (requestConsent) {
    return requestConsent(consentPrompt);
  }

  // Check for non-interactive context
  if (!process.stdin.isTTY) {
    throw new Error(
      `Cannot install extension "${extensionName}" with hooks in non-interactive mode. ` +
        `Hooks require user consent: ${hookNames.join(', ')}`,
    );
  }

  console.log(consentPrompt);

  // Prompt for consent using readline
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const sanitizedExtensionName = escapeAnsiCtrlCodes(extensionName);

  return new Promise<boolean>((resolve) => {
    rl.question('Enable these hooks? [y/N]: ', (answer) => {
      rl.close();
      const consent = answer.trim().toLowerCase() === 'y';
      if (consent) {
        console.log(
          `[OK] Hooks enabled for extension "${sanitizedExtensionName}".`,
        );
      } else {
        console.log(
          ` Hooks not enabled for extension "${sanitizedExtensionName}".`,
        );
      }
      console.log('');
      resolve(consent);
    });
  });
}
