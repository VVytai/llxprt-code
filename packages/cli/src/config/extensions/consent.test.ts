/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { requestHookConsent } from './consent.js';
import { escapeAnsiCtrlCodes } from '../../ui/utils/textUtils.js';

describe('consent', () => {
  describe('requestHookConsent', () => {
    it('should return true if no hooks to register', async () => {
      const result = await requestHookConsent('test-extension', []);
      expect(result).toBe(true);
    });

    // Note: Testing the interactive prompt would require mocking stdin/stdout
    // which is complex in the ESM environment. The logic is simple enough
    // that we can rely on manual testing for the interactive behavior.
    // The key test is that empty hooks array returns true without prompting.
  });

  describe('consent rendering safety', () => {
    it('should escape control characters in hook names', () => {
      const maliciousHookName = 'hook\u001b[12D\u001b[Kname';
      const escaped = escapeAnsiCtrlCodes(maliciousHookName);

      // Should escape the ANSI codes
      expect(escaped).not.toContain('\u001b');
      expect(escaped).toContain('\\u001b');
    });

    it('should handle multiple control characters', () => {
      const hookName = 'hook\u001b[31m\u001b[1mbad\u001b[0m';
      const escaped = escapeAnsiCtrlCodes(hookName);

      // All ANSI codes should be escaped
      expect(escaped).not.toContain('\u001b');
      expect(escaped).toContain('\\u001b[');
    });

    it('should preserve normal text', () => {
      const normalHookName = 'pre-commit';
      const escaped = escapeAnsiCtrlCodes(normalHookName);

      // Normal text should pass through unchanged
      expect(escaped).toBe(normalHookName);
    });

    it('should handle empty strings', () => {
      const escaped = escapeAnsiCtrlCodes('');
      expect(escaped).toBe('');
    });

    it('should handle unicode hook names', () => {
      const unicodeHookName = 'pre-commit-';
      const escaped = escapeAnsiCtrlCodes(unicodeHookName);

      // Unicode should pass through
      expect(escaped).toBe(unicodeHookName);
    });
  });

  describe('update delta policy', () => {
    // Import the function that computes hook consent delta (will be implemented in GREEN phase)
    // For now, we write tests that will fail because the function doesn't exist

    it('should detect new hook names as requiring consent', async () => {
      // This test will fail because computeHookConsentDelta doesn't exist yet
      const { computeHookConsentDelta } = await import('./consent.js');

      const previousHooks = {
        'pre-commit': { command: 'lint' },
      };
      const currentHooks = {
        'pre-commit': { command: 'lint' },
        'post-install': { command: 'setup' },
      };

      const delta = computeHookConsentDelta(currentHooks, previousHooks);

      expect(delta.newHooks).toEqual(['post-install']);
      expect(delta.changedHooks).toEqual([]);
    });

    it('should not require consent for unchanged hooks', async () => {
      const { computeHookConsentDelta } = await import('./consent.js');

      const previousHooks = {
        'pre-commit': { command: 'lint' },
      };
      const currentHooks = {
        'pre-commit': { command: 'lint' },
      };

      const delta = computeHookConsentDelta(currentHooks, previousHooks);

      expect(delta.newHooks).toEqual([]);
      expect(delta.changedHooks).toEqual([]);
    });

    it('should not require consent for removed hooks', async () => {
      const { computeHookConsentDelta } = await import('./consent.js');

      const previousHooks = {
        'pre-commit': { command: 'lint' },
        'post-install': { command: 'setup' },
      };
      const currentHooks = {
        'pre-commit': { command: 'lint' },
      };

      const delta = computeHookConsentDelta(currentHooks, previousHooks);

      expect(delta.newHooks).toEqual([]);
      expect(delta.changedHooks).toEqual([]);
    });

    it('should require consent for changed hook definitions', async () => {
      const { computeHookConsentDelta } = await import('./consent.js');

      const previousHooks = {
        'pre-commit': { command: 'lint' },
      };
      const currentHooks = {
        'pre-commit': { command: 'lint --fix' },
      };

      const delta = computeHookConsentDelta(currentHooks, previousHooks);

      expect(delta.newHooks).toEqual([]);
      expect(delta.changedHooks).toEqual(['pre-commit']);
    });

    it('should use sorted JSON comparison for hook definitions', async () => {
      const { computeHookConsentDelta } = await import('./consent.js');

      // Same hook definition but keys in different order
      const previousHooks = {
        'pre-commit': { command: 'lint', args: ['--strict'] },
      };
      const currentHooks = {
        'pre-commit': { args: ['--strict'], command: 'lint' },
      };

      const delta = computeHookConsentDelta(currentHooks, previousHooks);

      // Should not detect as changed because sorted JSON is the same
      expect(delta.newHooks).toEqual([]);
      expect(delta.changedHooks).toEqual([]);
    });

    it('should treat case-sensitive hook names as distinct', async () => {
      const { computeHookConsentDelta } = await import('./consent.js');

      const previousHooks = {
        'Pre-Commit': { command: 'lint' },
      };
      const currentHooks = {
        'Pre-Commit': { command: 'lint' },
        'pre-commit': { command: 'lint' },
      };

      const delta = computeHookConsentDelta(currentHooks, previousHooks);

      // pre-commit should be detected as new (different from Pre-Commit)
      expect(delta.newHooks).toEqual(['pre-commit']);
      expect(delta.changedHooks).toEqual([]);
    });

    it('should handle undefined previous hooks', async () => {
      const { computeHookConsentDelta } = await import('./consent.js');

      const currentHooks = {
        'pre-commit': { command: 'lint' },
      };

      const delta = computeHookConsentDelta(currentHooks, undefined);

      // All hooks should be new
      expect(delta.newHooks).toEqual(['pre-commit']);
      expect(delta.changedHooks).toEqual([]);
    });

    it('should handle undefined current hooks', async () => {
      const { computeHookConsentDelta } = await import('./consent.js');

      const previousHooks = {
        'pre-commit': { command: 'lint' },
      };

      const delta = computeHookConsentDelta(undefined, previousHooks);

      // No new or changed hooks
      expect(delta.newHooks).toEqual([]);
      expect(delta.changedHooks).toEqual([]);
    });
  });

  describe('non-interactive context', () => {
    it('should refuse installation with new hooks in non-interactive context', async () => {
      // Mock stdin.isTTY to simulate non-interactive environment
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });

      try {
        // This should throw because we're in a non-interactive context
        await expect(
          requestHookConsent('test-extension', ['pre-commit']),
        ).rejects.toThrow();
      } finally {
        // Restore original value
        Object.defineProperty(process.stdin, 'isTTY', {
          value: originalIsTTY,
          configurable: true,
        });
      }
    });

    it('should allow installation with no hooks in non-interactive context', async () => {
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });

      try {
        // Should succeed because no hooks to consent to
        const result = await requestHookConsent('test-extension', []);
        expect(result).toBe(true);
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', {
          value: originalIsTTY,
          configurable: true,
        });
      }
    });
  });
});
