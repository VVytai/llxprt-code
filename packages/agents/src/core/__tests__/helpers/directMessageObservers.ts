/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Phase-local observer helpers for the direct-message characterization
 * tests (P12). This module is the SINGLE sanctioned boundary that reads
 * the CURRENT `GenerateContentResponse` surface — the characterization
 * tests read observable values ONLY through these helpers so that
 * candidate/part/usageMetadata indexing never leaks into the test files.
 *
 * When P13 flips the return type to `ModelOutput`, ONLY this helper file
 * changes; the tests stay green because they assert observable values
 * (visible text, committed history, usage counts), never the envelope
 * shape.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P12
 * @requirement:REQ-INT-001.3
 */

import type { GenerateContentResponse } from '@google/genai';
import type { HistoryService } from '@vybestack/llxprt-code-core/services/history/HistoryService.js';
import type { IContent } from '@vybestack/llxprt-code-core/services/history/IContent.js';

interface CandidateLike {
  content?: { parts?: Array<{ text?: unknown }> };
}

interface ResponseLike {
  candidates?: CandidateLike[];
  usageMetadata?: Record<string, unknown>;
  text?: unknown;
}

function isResponseLike(result: unknown): result is ResponseLike {
  return result !== null && typeof result === 'object';
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * The model's visible text via the current `.text` accessor, with a
 * fallback to the first candidate's first text part (BeforeModel blocking
 * fabricator constructs a plain object without a `.text` getter).
 */
export function visibleText(result: unknown): string {
  if (!isResponseLike(result)) {
    return '';
  }

  // Try `.text` getter (normal path)
  const textVal = result.text;
  if (typeof textVal === 'string') {
    return textVal;
  }

  // Fallback: read from candidate parts
  const candidates = result.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const candidate = candidates[0];
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      const textPart = parts.find((p) => typeof p.text === 'string');
      if (textPart !== undefined && typeof textPart.text === 'string') {
        return textPart.text;
      }
    }
  }

  return '';
}

/**
 * A deep clone of the committed neutral `HistoryService` state (already
 * `IContent`-based today).
 */
export function committedHistory(historyService: HistoryService): IContent[] {
  return historyService.getAll().map((entry) => structuredClone(entry));
}

export interface NeutralUsageCounts {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

/**
 * Neutral usage numbers mapped from the current `usageMetadata` shape to
 * NEUTRAL names.
 */
export function usageCounts(result: unknown): NeutralUsageCounts {
  if (!isResponseLike(result) || result.usageMetadata === undefined) {
    return {};
  }
  const meta = result.usageMetadata;
  return {
    promptTokens: readNumber(meta.promptTokenCount),
    completionTokens: readNumber(meta.candidatesTokenCount),
    totalTokens: readNumber(meta.totalTokenCount),
    reasoningTokens: readNumber(meta.thoughtsTokenCount),
  };
}

/**
 * The public `ServerAgentStreamEvent` `type` sequence.
 */
export function eventSequence(
  events: Array<{ type: string }>,
): string[] {
  return events.map((event) => event.type);
}

export type { GenerateContentResponse };
