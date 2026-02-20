/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  getEnvContents,
  updateSetting,
  loadExtensionSettingsFromManifest,
  ExtensionSettingScope,
} from './settingsIntegration.js';
import type { ExtensionSetting } from './extensionSettings.js';

describe('settingsIntegration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'llxprt-settings-test-'),
    );
  });

  afterEach(async () => {
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadExtensionSettingsFromManifest', () => {
    it('should load settings from llxprt-extension.json', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-extension',
        version: '1.0.0',
        settings: [
          {
            name: 'API Key',
            envVar: 'API_KEY',
            sensitive: true,
          },
          {
            name: 'API URL',
            description: 'The API endpoint URL',
            envVar: 'API_URL',
            sensitive: false,
          },
        ],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const settings = loadExtensionSettingsFromManifest(tempDir);

      expect(settings).toHaveLength(2);
      expect(settings[0]).toEqual({
        name: 'API Key',
        envVar: 'API_KEY',
        sensitive: true,
      });
      expect(settings[1]).toEqual({
        name: 'API URL',
        description: 'The API endpoint URL',
        envVar: 'API_URL',
        sensitive: false,
      });
    });

    it('should return empty array if no settings in manifest', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-extension',
        version: '1.0.0',
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const settings = loadExtensionSettingsFromManifest(tempDir);

      expect(settings).toEqual([]);
    });

    it('should return empty array if manifest not found', () => {
      const settings = loadExtensionSettingsFromManifest(tempDir);
      expect(settings).toEqual([]);
    });
  });

  describe('getEnvContents', () => {
    it('should return settings with display values', async () => {
      // Create manifest
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          {
            name: 'Public Setting',
            envVar: 'PUBLIC_VAR',
            sensitive: false,
          },
          {
            name: 'Secret Setting',
            envVar: 'SECRET_VAR',
            sensitive: true,
          },
          {
            name: 'Unset Setting',
            envVar: 'UNSET_VAR',
            sensitive: false,
          },
        ] as ExtensionSetting[],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      // Create .env file with non-sensitive value
      const envPath = path.join(tempDir, '.env');
      await fs.promises.writeFile(
        envPath,
        'PUBLIC_VAR=public-value\n',
        'utf-8',
      );

      const contents = await getEnvContents('test-ext', tempDir);

      expect(contents).toHaveLength(3);
      expect(contents[0]).toEqual({
        name: 'Public Setting',
        value: 'public-value',
      });
      expect(contents[1]).toEqual({
        name: 'Secret Setting',
        value: '[not set]',
      });
      expect(contents[2]).toEqual({
        name: 'Unset Setting',
        value: '[not set]',
      });
    });

    it('should return empty array if no settings', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-ext',
        version: '1.0.0',
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const contents = await getEnvContents('test-ext', tempDir);
      expect(contents).toEqual([]);
    });
  });

  describe('updateSetting', () => {
    it('should find setting by name and update it', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          {
            name: 'API Key',
            envVar: 'API_KEY',
            sensitive: false,
          },
        ] as ExtensionSetting[],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const mockPrompt = vi.fn().mockResolvedValue('new-value');

      const result = await updateSetting(
        'test-ext',
        tempDir,
        'API Key',
        mockPrompt,
      );

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalledWith('API Key: ', false);

      // Verify the value was written to .env
      const envPath = path.join(tempDir, '.env');
      const envContent = await fs.promises.readFile(envPath, 'utf-8');
      expect(envContent).toContain('API_KEY=new-value');
    });

    it('should find setting by envVar and update it', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          {
            name: 'API Key',
            envVar: 'API_KEY',
            sensitive: false,
          },
        ] as ExtensionSetting[],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const mockPrompt = vi.fn().mockResolvedValue('new-value');

      const result = await updateSetting(
        'test-ext',
        tempDir,
        'API_KEY',
        mockPrompt,
      );

      expect(result).toBe(true);
    });

    it('should return false if setting not found', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          {
            name: 'API Key',
            envVar: 'API_KEY',
            sensitive: false,
          },
        ] as ExtensionSetting[],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const mockPrompt = vi.fn().mockResolvedValue('new-value');

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await updateSetting(
        'test-ext',
        tempDir,
        'NonExistent',
        mockPrompt,
      );

      expect(result).toBe(false);
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Setting "NonExistent" not found'),
      );

      consoleSpy.mockRestore();
    });

    it('should return false if user cancels (empty value)', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          {
            name: 'API Key',
            envVar: 'API_KEY',
            sensitive: false,
          },
        ] as ExtensionSetting[],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const mockPrompt = vi.fn().mockResolvedValue('');

      const result = await updateSetting(
        'test-ext',
        tempDir,
        'API Key',
        mockPrompt,
      );

      expect(result).toBe(false);
    });

    it('should handle values with spaces by quoting them', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          {
            name: 'Display Name',
            envVar: 'DISPLAY_NAME',
            sensitive: false,
          },
        ] as ExtensionSetting[],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const mockPrompt = vi.fn().mockResolvedValue('My Cool Extension');

      await updateSetting('test-ext', tempDir, 'Display Name', mockPrompt);

      const envPath = path.join(tempDir, '.env');
      const envContent = await fs.promises.readFile(envPath, 'utf-8');
      expect(envContent).toContain('DISPLAY_NAME="My Cool Extension"');
    });
  });

  describe('scoped settings', () => {
    it('should support user-scoped settings', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-extension',
        version: '1.0.0',
        settings: [
          {
            name: 'User Setting',
            envVar: 'USER_SETTING',
            sensitive: false,
          },
        ],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const mockPrompt = vi.fn().mockResolvedValue('user-value');
      await updateSetting(
        'test-extension',
        tempDir,
        'User Setting',
        mockPrompt,
        ExtensionSettingScope.USER,
      );

      const userEnvPath = path.join(tempDir, '.env');
      expect(fs.existsSync(userEnvPath)).toBe(true);
      const envContent = await fs.promises.readFile(userEnvPath, 'utf-8');
      expect(envContent).toContain('USER_SETTING=user-value');
    });

    it('should support workspace-scoped settings', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-extension',
        version: '1.0.0',
        settings: [
          {
            name: 'Workspace Setting',
            envVar: 'WORKSPACE_SETTING',
            sensitive: false,
          },
        ],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      const mockPrompt = vi.fn().mockResolvedValue('workspace-value');
      await updateSetting(
        'test-extension',
        tempDir,
        'Workspace Setting',
        mockPrompt,
        ExtensionSettingScope.WORKSPACE,
      );

      const workspaceEnvPath = path.join(
        process.cwd(),
        '.llxprt',
        'extensions',
        'test-extension',
        '.env',
      );
      expect(fs.existsSync(workspaceEnvPath)).toBe(true);
      const envContent = await fs.promises.readFile(workspaceEnvPath, 'utf-8');
      expect(envContent).toContain('WORKSPACE_SETTING=workspace-value');

      // Clean up
      await fs.promises.rm(
        path.join(process.cwd(), '.llxprt', 'extensions', 'test-extension'),
        { recursive: true, force: true },
      );
    });

    it('should merge user and workspace scopes with workspace override', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-extension',
        version: '1.0.0',
        settings: [
          {
            name: 'Shared Setting',
            envVar: 'SHARED_SETTING',
            sensitive: false,
          },
        ],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      // Set user-level setting
      const mockPromptUser = vi.fn().mockResolvedValue('user-value');
      await updateSetting(
        'test-extension',
        tempDir,
        'Shared Setting',
        mockPromptUser,
        ExtensionSettingScope.USER,
      );

      // Set workspace-level setting (should override)
      const mockPromptWorkspace = vi.fn().mockResolvedValue('workspace-value');
      await updateSetting(
        'test-extension',
        tempDir,
        'Shared Setting',
        mockPromptWorkspace,
        ExtensionSettingScope.WORKSPACE,
      );

      // Get merged contents
      const contents = await getEnvContents('test-extension', tempDir);

      const sharedSetting = contents.find((s) => s.name === 'Shared Setting');
      expect(sharedSetting?.value).toBe('workspace-value');

      // Clean up
      await fs.promises.rm(
        path.join(process.cwd(), '.llxprt', 'extensions', 'test-extension'),
        { recursive: true, force: true },
      );
    });

    it('should list settings for specific scope', async () => {
      const manifestPath = path.join(tempDir, 'llxprt-extension.json');
      const manifest = {
        name: 'test-extension',
        version: '1.0.0',
        settings: [
          {
            name: 'Setting',
            envVar: 'SETTING',
            sensitive: false,
          },
        ],
      };

      await fs.promises.writeFile(
        manifestPath,
        JSON.stringify(manifest),
        'utf-8',
      );

      // Set user-level setting
      const mockPromptUser = vi.fn().mockResolvedValue('user-value');
      await updateSetting(
        'test-extension',
        tempDir,
        'Setting',
        mockPromptUser,
        ExtensionSettingScope.USER,
      );

      // Get user scope contents
      const userContents = await getEnvContents(
        'test-extension',
        tempDir,
        ExtensionSettingScope.USER,
      );

      expect(userContents).toHaveLength(1);
      expect(userContents[0].value).toBe('user-value');
    });
  });
});
