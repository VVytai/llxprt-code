/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  ExtensionSettingsArraySchema,
  type ExtensionSetting,
} from './extensionSettings.js';
import {
  EXTENSIONS_CONFIG_FILENAME,
  EXTENSIONS_CONFIG_FILENAME_FALLBACK,
} from '../extension.js';
import { ExtensionSettingsStorage } from './settingsStorage.js';
import { maybePromptForSettings } from './settingsPrompt.js';

/**
 * Loads extension settings from the manifest file.
 *
 * Tries llxprt-extension.json first, then falls back to gemini-extension.json.
 * Validates the settings array using ExtensionSettingArraySchema.
 *
 * @param extensionDir - The absolute path to the extension directory
 * @returns Array of validated extension settings, or empty array if none found or invalid
 */
export function loadExtensionSettingsFromManifest(
  extensionDir: string,
): ExtensionSetting[] {
  // Try llxprt-extension.json first
  let manifestPath = path.join(extensionDir, EXTENSIONS_CONFIG_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    // Fall back to gemini-extension.json
    manifestPath = path.join(extensionDir, EXTENSIONS_CONFIG_FILENAME_FALLBACK);
  }

  if (!fs.existsSync(manifestPath)) {
    // No manifest file found
    return [];
  }

  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent) as { settings?: unknown };

    // Extract settings array if present
    const settings = manifest.settings;

    if (!settings) {
      return [];
    }

    // Validate against schema
    const validationResult = ExtensionSettingsArraySchema.safeParse(settings);

    if (!validationResult.success) {
      // Invalid settings schema
      console.error(
        `Invalid settings schema in ${manifestPath}:`,
        validationResult.error,
      );
      return [];
    }

    return validationResult.data;
  } catch (error) {
    // Handle JSON parse errors or file read errors
    console.error(
      `Failed to read or parse manifest at ${manifestPath}:`,
      error,
    );
    return [];
  }
}

/**
 * Prompts the user for missing settings and saves them to storage.
 *
 * @param extensionName - The name of the extension
 * @param settings - Array of extension settings that may need values
 * @param existingValues - Record of existing setting values keyed by envVar
 * @param extensionDir - The absolute path to the extension directory
 * @returns Promise resolving to true if successful, false if user cancelled
 */
export async function maybePromptAndSaveSettings(
  extensionName: string,
  settings: ExtensionSetting[],
  existingValues: Record<string, string | undefined>,
  extensionDir: string,
): Promise<boolean> {
  // If no settings, nothing to do
  if (settings.length === 0) {
    return true;
  }

  // Prompt for settings
  const settingsValues = await maybePromptForSettings(settings, existingValues);

  // If null returned, user cancelled
  if (settingsValues === null) {
    return false;
  }

  // Save settings using ExtensionSettingsStorage
  const storage = new ExtensionSettingsStorage(extensionName, extensionDir);
  await storage.saveSettings(settings, settingsValues);

  return true;
}

/**
 * Loads saved extension settings as environment variables.
 *
 * Reads from both .env file (non-sensitive) and keychain (sensitive).
 *
 * @param extensionDir - The absolute path to the extension directory
 * @returns Promise resolving to record of environment variables
 */
export async function getExtensionEnvironment(
  extensionDir: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // Read .env file for non-sensitive settings
  const envFilePath = path.join(extensionDir, '.env');

  if (fs.existsSync(envFilePath)) {
    try {
      const envContent = fs.readFileSync(envFilePath, 'utf-8');
      const parsed = dotenv.parse(envContent);
      Object.assign(result, parsed);
    } catch (error) {
      console.error(`Failed to read .env file at ${envFilePath}:`, error);
    }
  }

  // Load settings definitions from manifest
  const settings = loadExtensionSettingsFromManifest(extensionDir);

  if (settings.length === 0) {
    return result;
  }

  // Parse manifest to get extension name
  let extensionName: string | null = null;
  let manifestPath = path.join(extensionDir, EXTENSIONS_CONFIG_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    manifestPath = path.join(extensionDir, EXTENSIONS_CONFIG_FILENAME_FALLBACK);
  }

  if (fs.existsSync(manifestPath)) {
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as { name?: string };
      extensionName = manifest.name ?? null;
    } catch (error) {
      console.error(`Failed to read extension name from manifest:`, error);
    }
  }

  if (!extensionName) {
    return result;
  }

  // Load settings from storage (including keychain)
  const storage = new ExtensionSettingsStorage(extensionName, extensionDir);
  const settingsValues = await storage.loadSettings(settings);

  // Merge non-undefined values into result
  for (const [key, value] of Object.entries(settingsValues)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Gets all settings and their values for display purposes.
 * Sensitive settings show '[value stored in keychain]' instead of actual value.
 * Missing settings show '[not set]'.
 *
 * @param extensionName - Extension name
 * @param extensionDir - Extension directory path
 * @returns Promise resolving to array of setting display info
 */
export async function getEnvContents(
  extensionName: string,
  extensionDir: string,
): Promise<Array<{ name: string; value: string }>> {
  const settings = loadExtensionSettingsFromManifest(extensionDir);

  if (settings.length === 0) {
    return [];
  }

  const storage = new ExtensionSettingsStorage(extensionName, extensionDir);
  const settingsValues = await storage.loadSettings(settings);

  return settings.map((setting) => {
    const value = settingsValues[setting.envVar];
    let displayValue: string;

    if (value === undefined || value === '') {
      displayValue = '[not set]';
    } else if (setting.sensitive) {
      displayValue = '[value stored in keychain]';
    } else {
      displayValue = value;
    }

    return {
      name: setting.name,
      value: displayValue,
    };
  });
}

/**
 * Updates a single extension setting.
 *
 * @param extensionName - Extension name
 * @param extensionDir - Extension directory path
 * @param settingKey - Setting name or envVar to update
 * @param requestSetting - Function to prompt user for new value
 * @returns Promise resolving to true if successful
 */
export async function updateSetting(
  extensionName: string,
  extensionDir: string,
  settingKey: string,
  requestSetting: (prompt: string, sensitive: boolean) => Promise<string>,
): Promise<boolean> {
  const settings = loadExtensionSettingsFromManifest(extensionDir);

  // Find the setting by name or envVar
  const setting = settings.find(
    (s) =>
      s.name.toLowerCase() === settingKey.toLowerCase() ||
      s.envVar.toLowerCase() === settingKey.toLowerCase(),
  );

  if (!setting) {
    console.error(
      `Setting "${settingKey}" not found in extension "${extensionName}".`,
    );
    console.error('Available settings:');
    settings.forEach((s) => {
      console.error(`  - ${s.name} (${s.envVar})`);
    });
    return false;
  }

  // Prompt for new value
  const prompt = setting.description
    ? `${setting.name} (${setting.description}): `
    : `${setting.name}: `;
  const newValue = await requestSetting(prompt, setting.sensitive);

  if (newValue === '') {
    console.log('Update cancelled.');
    return false;
  }

  // Load existing values
  const storage = new ExtensionSettingsStorage(extensionName, extensionDir);
  const existingValues = await storage.loadSettings(settings);

  // Update the value
  const updatedValues: Record<string, string> = {};
  for (const s of settings) {
    const existing = existingValues[s.envVar];
    if (existing !== undefined && existing !== '') {
      updatedValues[s.envVar] = existing;
    }
  }
  updatedValues[setting.envVar] = newValue;

  // Save all settings
  await storage.saveSettings(settings, updatedValues);

  console.log(`Setting "${setting.name}" updated successfully.`);
  return true;
}
