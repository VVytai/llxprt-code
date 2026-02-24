/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isGemini2Model,
  isGemini3Model,
  supportsMultimodalFunctionResponse,
} from '../models.js';

describe('isGemini2Model()', () => {
  it('returns true for gemini-2.5-pro', () => {
    expect(isGemini2Model('gemini-2.5-pro')).toBe(true);
  });

  it('returns true for gemini-2.5-flash', () => {
    expect(isGemini2Model('gemini-2.5-flash')).toBe(true);
  });

  it('returns false for gemini-3-pro-preview', () => {
    expect(isGemini2Model('gemini-3-pro-preview')).toBe(false);
  });

  it('returns false for a non-gemini model', () => {
    expect(isGemini2Model('claude-3-opus')).toBe(false);
  });

  it('returns true for gemini-2.0-flash', () => {
    expect(isGemini2Model('gemini-2.0-flash')).toBe(true);
  });
});

describe('isGemini3Model()', () => {
  it('returns true for gemini-3-pro-preview', () => {
    expect(isGemini3Model('gemini-3-pro-preview')).toBe(true);
  });

  it('returns true for gemini-3-flash-preview', () => {
    expect(isGemini3Model('gemini-3-flash-preview')).toBe(true);
  });

  it('returns false for gemini-2.5-pro', () => {
    expect(isGemini3Model('gemini-2.5-pro')).toBe(false);
  });

  it('returns false for a non-gemini model', () => {
    expect(isGemini3Model('claude-3-opus')).toBe(false);
  });
});

describe('supportsMultimodalFunctionResponse', () => {
  it('should return true for gemini-3 model', () => {
    expect(supportsMultimodalFunctionResponse('gemini-3-pro')).toBe(true);
  });

  it('should return true for gemini-3 flash', () => {
    expect(supportsMultimodalFunctionResponse('gemini-3-flash')).toBe(true);
  });

  it('should return false for gemini-2 models', () => {
    expect(supportsMultimodalFunctionResponse('gemini-2.5-pro')).toBe(false);
    expect(supportsMultimodalFunctionResponse('gemini-2.5-flash')).toBe(false);
    expect(supportsMultimodalFunctionResponse('gemini-2.0-flash')).toBe(false);
  });

  it('should return false for claude models', () => {
    expect(supportsMultimodalFunctionResponse('claude-3-opus')).toBe(false);
    expect(supportsMultimodalFunctionResponse('claude-3-5-sonnet')).toBe(false);
  });

  it('should return false for gpt models', () => {
    expect(supportsMultimodalFunctionResponse('gpt-4o')).toBe(false);
    expect(supportsMultimodalFunctionResponse('gpt-4-turbo')).toBe(false);
  });

  it('should return false for other/unknown models', () => {
    expect(supportsMultimodalFunctionResponse('some-other-model')).toBe(false);
    expect(supportsMultimodalFunctionResponse('')).toBe(false);
    expect(supportsMultimodalFunctionResponse('gemini')).toBe(false);
  });
});
