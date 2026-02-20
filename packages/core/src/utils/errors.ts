/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

interface GaxiosError {
  response?: {
    data?: unknown;
  };
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return String(error);
  } catch {
    return 'Failed to get error details';
  }
}

export class FatalError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

export class FatalAuthenticationError extends FatalError {
  constructor(message: string) {
    super(message, 41);
  }
}
export class FatalInputError extends FatalError {
  constructor(message: string) {
    super(message, 42);
  }
}
export class FatalSandboxError extends FatalError {
  constructor(message: string) {
    super(message, 44);
  }
}
export class FatalConfigError extends FatalError {
  constructor(message: string) {
    super(message, 52);
  }
}
export class FatalTurnLimitedError extends FatalError {
  constructor(message: string) {
    super(message, 53);
  }
}
export class FatalToolExecutionError extends FatalError {
  constructor(message: string) {
    super(message, 54);
  }
}
export class FatalCancellationError extends FatalError {
  constructor(message: string) {
    super(message, 130);
  }
}

export class ForbiddenError extends Error {}
export class UnauthorizedError extends Error {}
export class BadRequestError extends Error {}
export class NotYetImplemented extends Error {
  constructor(message = 'This feature is not yet implemented') {
    super(message);
    this.name = 'NotYetImplemented';
  }
}

interface ResponseData {
  error?: {
    code?: number;
    message?: string;
  };
}

export function toFriendlyError(error: unknown): unknown {
  if (error && typeof error === 'object' && 'response' in error) {
    const gaxiosError = error as GaxiosError;
    const data = parseResponseData(gaxiosError);
    if (data.error && data.error.message && data.error.code) {
      switch (data.error.code) {
        case 400:
          return new BadRequestError(data.error.message);
        case 401:
          return new UnauthorizedError(data.error.message);
        case 403:
          // It's import to pass the message here since it might
          // explain the cause like "the cloud project you're
          // using doesn't have code assist enabled".
          return new ForbiddenError(data.error.message);
        default:
      }
    }
  }
  return error;
}

function parseResponseData(error: GaxiosError): ResponseData {
  // Inexplicably, Gaxios sometimes doesn't JSONify the response data.
  if (typeof error.response?.data === 'string') {
    try {
      return JSON.parse(error.response?.data) as ResponseData;
    } catch {
      return {};
    }
  }
  return error.response?.data as ResponseData;
}

/**
 * Checks if an error is a 401 authentication error.
 * Uses structured error properties from MCP SDK errors first.
 * 
 * @plan PLAN-20250219-GMERGE021.R3.P03
 * @requirement REQ-GMERGE021-R3-002
 */
export function isAuthenticationError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }

  // MCP SDK errors (SseError, StreamableHTTPError) carry numeric 'code'
  if ('code' in error) {
    const errorCode = (error as { code: unknown }).code;
    if (errorCode === 401) {
      return true;
    }
  }

  // Class identity check
  if (error instanceof UnauthorizedError) {
    return true;
  }

  // Cross-realm duck-typing (check both constructor name and error name)
  if (error instanceof Error) {
    if (
      error.constructor.name === 'UnauthorizedError' ||
      error.name === 'UnauthorizedError'
    ) {
      return true;
    }
  }

  // Anchored message pattern — must not match '401' appearing in model names, IDs, etc.
  const message = getErrorMessage(error);
  if (/\bHTTP 401\b/.test(message) || /\bstatus 401\b/i.test(message)) {
    return true;
  }

  return false;
}
