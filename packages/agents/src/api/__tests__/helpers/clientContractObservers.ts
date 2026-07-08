/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Phase-local observer helpers for the client-contract characterization
 * tests (P20). This module is the SINGLE sanctioned boundary that reads
 * the current client-surface contract output — the characterization tests
 * read observable values ONLY through these helpers so that
 * `.candidates`/`.parts`/`.content.parts`/`.usageMetadata` indexing never
 * leaks into the test files.
 *
 * Current state (pre-P21):
 *  - `generateDirectMessage` returns `ModelOutput` (neutral, post-P13).
 *    `visibleText`/`usageCounts` read `content.blocks` / `usage`.
 *  - `getHistory()` returns `Content[]` (Gemini-shaped, pre-P21).
 *    `historyContent` converts that to neutral `IContent[]` (deep clone)
 *    so the spec asserts content-equivalence and clone-independence
 *    without touching `.parts`/`.role` directly.
 *  - `sendMessageStream` yields `ServerAgentStreamEvent`.
 *
 * When P21 flips `getHistory()` to return `IContent[]` directly, ONLY
 * `historyContent` changes (the conversion becomes a pass-through clone).
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P20
 * @requirement:REQ-INT-001.2
 */

import { ContentConverters } from '@vybestack/llxprt-code-core/services/history/ContentConverters.js';
import type {
  IContent,
  ContentBlock,
} from '@vybestack/llxprt-code-core/services/history/IContent.js';
import type { GeminiContent } from '@vybestack/llxprt-code-core/llm-types/geminiContent.js';

// ---------------------------------------------------------------------------
// Structural local types — the helper never exports a Contract* / candidate
// / parts / usageMetadata value. These local shapes let the helper accept
// the current envelope without coupling the spec to provider internals.
// ---------------------------------------------------------------------------

/**
 * Local structural view of `ModelOutput` (the current
 * `generateDirectMessage` return type). Only the observable fields the
 * helper reads are modeled.
 */
interface ModelOutputLike {
  content?: { blocks?: ContentBlock[] };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
  } | null;
}

function isModelOutputLike(result: unknown): result is ModelOutputLike {
  return result !== null && typeof result === 'object';
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

// ---------------------------------------------------------------------------
// Observer: visible text from a direct-message result
// ---------------------------------------------------------------------------

/**
 * The model's visible text extracted from the neutral `content.blocks`
 * text blocks (concatenation of all text-type block text). Reads the
 * current `ModelOutput.content.blocks` surface ONLY — never
 * `.candidates`/`.parts`.
 */
export function visibleText(directResult: unknown): string {
  if (!isModelOutputLike(directResult)) {
    return '';
  }
  const blocks = directResult.content?.blocks;
  if (!Array.isArray(blocks)) {
    return '';
  }
  return blocks
    .filter(
      (block) =>
        block.type === 'text' &&
        typeof block.text === 'string' &&
        block.text !== '',
    )
    .map((block) => (block as { text: string }).text)
    .join('');
}

// ---------------------------------------------------------------------------
// Observer: history as neutral IContent[] (deep clone)
// ---------------------------------------------------------------------------

/**
 * Converts the observable history (currently Gemini-shaped `Content[]`
 * from `getHistory()`) to neutral `IContent[]` and returns a DEEP CLONE
 * so callers can freely inspect/mutate without touching the live
 * contract value. When P21 flips `getHistory()` to return `IContent[]`
 * directly, only this helper changes (the conversion becomes a
 * pass-through clone).
 */
export function historyContent(historyResult: unknown): IContent[] {
  if (!Array.isArray(historyResult)) {
    return [];
  }
  // The current getHistory() returns Gemini-shaped Content[]; cast through
  // unknown to the structural GeminiContent[] that ContentConverters expects.
  // When P21 flips getHistory() to return IContent[] directly, this conversion
  // becomes a pass-through clone (only this helper changes).
  const geminiContents = historyResult as unknown as GeminiContent[];
  const neutral = ContentConverters.toIContents(geminiContents);
  return neutral.map((entry) => structuredClone(entry));
}

// ---------------------------------------------------------------------------
// Observer: neutral usage counts from a direct-message result
// ---------------------------------------------------------------------------

export interface NeutralUsageCounts {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

/**
 * Neutral usage numbers read from the `ModelOutput.usage` field. Never
 * reads `.usageMetadata` (the Gemini-named envelope) — only the neutral
 * `usage` object on `ModelOutput`.
 */
export function usageCounts(directResult: unknown): NeutralUsageCounts {
  if (!isModelOutputLike(directResult) || directResult.usage == null) {
    return {};
  }
  const usage = directResult.usage;
  return {
    promptTokens: readNumber(usage.promptTokens),
    completionTokens: readNumber(usage.completionTokens),
    totalTokens: readNumber(usage.totalTokens),
    reasoningTokens: readNumber(usage.reasoningTokens),
  };
}

// ---------------------------------------------------------------------------
// Observer: ServerAgentStreamEvent type sequence
// ---------------------------------------------------------------------------

/**
 * The public `ServerAgentStreamEvent` `type` sequence. Reads ONLY the
 * `.type` discriminator — never event-internal payload fields.
 */
export function eventSequence(
  events: ReadonlyArray<{ type: string }>,
): string[] {
  return events.map((event) => event.type);
}
