/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regression tests for issue #2410:
 * Empty message arrays must not create zero-block IContent items that would
 * be injected into subagent conversation history, causing z.ai to return
 * HTTP 400 error 1213 ("prompt parameter not received normally").
 *
 * After the neutral-type migration, these functions return IContent with
 * speaker/blocks instead of Google-shaped Content with role/parts.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeToolInteractionInput,
  createUserContentWithFunctionResponseFix,
  convertMixedPartsToIContent,
} from './MessageConverter.js';

describe('issue #2410 – empty message arrays must not create zero-block IContent', () => {
  describe('createUserContentWithFunctionResponseFix', () => {
    it('returns a human-speaker IContent for an empty array (with fallback text, not zero blocks)', () => {
      const result = createUserContentWithFunctionResponseFix([]);
      expect(result.speaker).toBe('human');
      // Empty array falls back to a placeholder text block — not a zero-block
      // content that would cause provider 400 errors.
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('converts a non-empty function-response array into a human IContent', () => {
      const parts = [
        {
          functionResponse: {
            id: 'call_1',
            name: 'read_file',
            response: { output: 'hello' },
          },
        },
      ];
      const result = createUserContentWithFunctionResponseFix(parts);
      expect(result.speaker).toBe('human');
      // The functionResponse is converted via iContentFromAgentMessageInput,
      // which maps it to a ToolResponseBlock in the merged blocks.
      expect(result.blocks.length).toBeGreaterThan(0);
    });
  });

  describe('normalizeToolInteractionInput', () => {
    it('returns a human-speaker IContent for an empty array (not zero blocks)', () => {
      const result = normalizeToolInteractionInput([]);
      // After migration, this delegates to createUserContentWithFunctionResponseFix
      // which returns a single IContent (not an array).
      expect(result.speaker).toBe('human');
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('still handles a non-empty function-response array correctly', () => {
      const parts = [
        {
          functionResponse: {
            id: 'call_1',
            name: 'read_file',
            response: { output: 'hello' },
          },
        },
      ];
      const result = normalizeToolInteractionInput(parts);
      expect(result.speaker).toBe('human');
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('still handles string input correctly', () => {
      const result = normalizeToolInteractionInput('hello');
      expect(result.speaker).toBe('human');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('text');
    });
  });

  describe('convertMixedPartsToIContent', () => {
    it('returns an IContent with zero blocks for an empty parts array', () => {
      const result = convertMixedPartsToIContent([]);
      expect(result.blocks).toHaveLength(0);
      expect(result.speaker).toBe('human');
    });

    it('still converts all-function-response parts to a tool message', () => {
      const blocks = [
        {
          type: 'tool_response' as const,
          callId: 'call_1',
          toolName: 'read_file',
          result: { output: 'hello' },
        },
      ];
      const result = convertMixedPartsToIContent(blocks);
      expect(result.speaker).toBe('tool');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('tool_response');
    });

    it('still converts text parts to an AI message', () => {
      const blocks = [{ type: 'text' as const, text: 'hello world' }];
      const result = convertMixedPartsToIContent(blocks);
      expect(result.speaker).toBe('ai');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('text');
    });
  });
});
