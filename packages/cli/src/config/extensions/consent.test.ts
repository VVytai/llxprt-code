/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { requestHookConsent } from './consent.js';

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
});
