/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { UnauthorizedError, isAuthenticationError } from './errors.js';

/**
 * @plan PLAN-20250219-GMERGE021.R3.P02
 * @requirement REQ-GMERGE021-R3-002
 * Tests for isAuthenticationError detection function
 */
describe('isAuthenticationError @plan:PLAN-20250219-GMERGE021.R3.P02', () => {
  /**
   * Test #12: Error with numeric code property = 401
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return true for error with code: 401 @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    const error = { code: 401 };
    expect(isAuthenticationError(error)).toBe(true);
  });

  /**
   * Test #13: UnauthorizedError instance
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return true for UnauthorizedError instance @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    const error = new UnauthorizedError('Test auth error');
    expect(isAuthenticationError(error)).toBe(true);
  });

  /**
   * Test #14: Cross-realm UnauthorizedError (constructor.name check)
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return true for error with constructor.name === "UnauthorizedError" @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    // Simulate cross-realm scenario
    class UnauthorizedError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedError';
      }
    }
    const error = new UnauthorizedError('Cross-realm auth error');
    expect(isAuthenticationError(error)).toBe(true);
  });

  /**
   * Test #15: Error message with "HTTP 401" pattern
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return true for error message containing "HTTP 401" @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    const error = new Error('Error POSTing to endpoint (HTTP 401): Unauthorized');
    expect(isAuthenticationError(error)).toBe(true);
  });

  /**
   * Test #16: Error message with "status 401" pattern
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return true for error message containing "status 401" @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    const error = new Error('status 401 Unauthorized');
    expect(isAuthenticationError(error)).toBe(true);
  });

  /**
   * Test #17: False positive prevention - model name with 401
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return false for model name "gpt-4o-1401" @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    const error = new Error('model gpt-4o-1401 not found');
    expect(isAuthenticationError(error)).toBe(false);
  });

  /**
   * Test #18: False positive prevention - resource ID with 401
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return false for resource id "9401" @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    const error = new Error('resource id 9401 not available');
    expect(isAuthenticationError(error)).toBe(false);
  });

  /**
   * Test #19: Null/undefined handling
   * @requirement REQ-GMERGE021-R3-002
   */
  it('should return false for null without throwing @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    expect(isAuthenticationError(null)).toBe(false);
  });

  it('should return false for undefined without throwing @plan:PLAN-20250219-GMERGE021.R3.P02 @requirement:REQ-GMERGE021-R3-002', () => {
    expect(isAuthenticationError(undefined)).toBe(false);
  });

  /**
   * Additional edge cases for robustness
   */
  it('should return false for non-401 error codes @plan:PLAN-20250219-GMERGE021.R3.P02', () => {
    const error = { code: 404 };
    expect(isAuthenticationError(error)).toBe(false);
  });

  it('should return false for non-object values @plan:PLAN-20250219-GMERGE021.R3.P02', () => {
    expect(isAuthenticationError('string error')).toBe(false);
    expect(isAuthenticationError(42)).toBe(false);
    expect(isAuthenticationError(true)).toBe(false);
  });

  it('should return false for generic errors @plan:PLAN-20250219-GMERGE021.R3.P02', () => {
    const error = new Error('Something went wrong');
    expect(isAuthenticationError(error)).toBe(false);
  });
});
