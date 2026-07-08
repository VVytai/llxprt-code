/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure logging and configuration utilities for turn execution.
 * Extracted from chatSession.ts Phase 05.
 */

import type { GenerateContentConfig } from '@google/genai';
import type { AgentRuntimeContext } from '@vybestack/llxprt-code-core/runtime/AgentRuntimeContext.js';
import type { AgentRuntimeState } from '@vybestack/llxprt-code-core/runtime/AgentRuntimeState.js';
import type { IContent } from '@vybestack/llxprt-code-core/services/history/IContent.js';
import type { UsageStats } from '@vybestack/llxprt-code-core/llm-types/index.js';

/**
 * Extract request text from neutral contents for logging.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-008
 */
export function getRequestTextFromContents(contents: IContent[]): string {
  return JSON.stringify(contents);
}

/**
 * Extract direct Gemini SDK overrides from generation config
 */
export function extractDirectGeminiOverrides(config?: GenerateContentConfig):
  | {
      serverTools?: unknown;
      toolConfig?: GenerateContentConfig['toolConfig'];
    }
  | undefined {
  if (!config || typeof config !== 'object') {
    return undefined;
  }
  const overrides: {
    serverTools?: unknown;
    toolConfig?: GenerateContentConfig['toolConfig'];
  } = {};
  const rawConfig = config as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(rawConfig, 'serverTools')) {
    overrides.serverTools = rawConfig.serverTools;
  }
  if (config.toolConfig) {
    overrides.toolConfig = config.toolConfig;
  }

  if (
    typeof overrides.serverTools === 'undefined' &&
    typeof overrides.toolConfig === 'undefined'
  ) {
    return undefined;
  }
  return overrides;
}

/**
 * Log API request to telemetry.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-008
 */
export function logApiRequest(
  runtimeContext: AgentRuntimeContext,
  runtimeState: AgentRuntimeState,
  contents: IContent[],
  model: string,
  promptId: string,
): void {
  const requestText = getRequestTextFromContents(contents);
  runtimeContext.telemetry.logApiRequest({
    model,
    promptId,
    requestText,
    sessionId: runtimeState.sessionId,
    runtimeId: runtimeState.runtimeId,
    provider: runtimeState.provider,
    timestamp: Date.now(),
  });
}

/**
 * Log API response to telemetry.
 *
 * Accepts neutral UsageStats; the telemetry sink still receives a
 * spread record, maintaining wire compatibility for downstream consumers.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-007
 * @requirement:REQ-008
 */
export function logApiResponse(
  runtimeContext: AgentRuntimeContext,
  runtimeState: AgentRuntimeState,
  model: string,
  promptId: string,
  durationMs: number,
  usage?: UsageStats,
  responseText?: string,
): void {
  runtimeContext.telemetry.logApiResponse({
    model,
    promptId,
    durationMs,
    sessionId: runtimeState.sessionId,
    runtimeId: runtimeState.runtimeId,
    provider: runtimeState.provider,
    usageMetadata:
      usage === undefined
        ? undefined
        : {
            promptTokenCount: usage.promptTokens,
            candidatesTokenCount: usage.completionTokens,
            totalTokenCount: usage.totalTokens,
            ...(usage.cachedTokens !== undefined
              ? { cachedContentTokenCount: usage.cachedTokens }
              : {}),
            ...(usage.reasoningTokens !== undefined
              ? { thoughtsTokenCount: usage.reasoningTokens }
              : {}),
            ...(usage.toolTokens !== undefined
              ? { toolUsePromptTokenCount: usage.toolTokens }
              : {}),
          },
    responseText,
  });
}

/**
 * Log API error to telemetry
 */
export function logApiError(
  runtimeContext: AgentRuntimeContext,
  runtimeState: AgentRuntimeState,
  model: string,
  promptId: string,
  durationMs: number,
  error: unknown,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorType = error instanceof Error ? error.name : 'unknown';

  runtimeContext.telemetry.logApiError({
    model,
    promptId,
    durationMs,
    error: errorMessage,
    errorType,
    sessionId: runtimeState.sessionId,
    runtimeId: runtimeState.runtimeId,
    provider: runtimeState.provider,
  });
}
