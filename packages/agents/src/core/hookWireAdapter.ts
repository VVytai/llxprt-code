/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @plan:PLAN-20260707-AGENTNEUTRAL.P07
 * @requirement:REQ-002.6
 *
 * The SINGLE named boundary module where the hook JSON-wire shape
 * (core-owned HookGenerateContentResponse) is converted to/from neutral
 * agents types. This is the ONLY place in agents where the hook wire shape
 * is read for the purpose of producing neutral ModelStreamChunk values.
 *
 * The core hook wire DTO (HookGenerateContentResponse) is a DELIBERATELY
 * PRESERVED external wire boundary (byte-compatible). This adapter converts
 * it to neutral types at this edge so the agents pipeline never touches the
 * wire shape directly.
 */

import type { HookGenerateContentResponse } from '@vybestack/llxprt-code-core/hooks/hookTranslator.js';
import type { ModelStreamChunk } from '@vybestack/llxprt-code-core/llm-types/modelEnvelope.js';
import type { ModelOutput } from '@vybestack/llxprt-code-core/llm-types/modelEnvelope.js';
import type {
  IContent,
  ContentBlock,
} from '@vybestack/llxprt-code-core/services/history/IContent.js';
import { ContentConverters } from '@vybestack/llxprt-code-core/services/history/ContentConverters.js';

/**
 * Maps a hook-modified JSON-wire response to a neutral ModelStreamChunk.
 *
 * Called from StreamProcessor._processAfterModelHook when the AfterModel
 * hook returns a MODIFY decision. The hook wire shape is converted to
 * neutral ContentBlock[] at this boundary; no Google-shaped value re-enters
 * the agents pipeline.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P07
 * @requirement:REQ-002.6
 * @pseudocode stream-processor-neutral.md lines 16-19
 *
 * @param modified - The hook-modified JSON-wire response (may be undefined if hook did not modify)
 * @param base - The base neutral chunk to derive speaker/usage/finishReason from
 * @returns A neutral ModelStreamChunk reflecting the hook modification, or undefined if not modified
 */
export function afterModelModifiedToChunk(
  modified: HookGenerateContentResponse | undefined,
  base: ModelStreamChunk,
): ModelStreamChunk | undefined {
  if (modified === undefined) {
    return undefined;
  }

  const candidate = modified.candidates?.[0];
  let blocks: ContentBlock[];

  if (candidate?.content?.parts) {
    const iContent = ContentConverters.toIContent({
      role: candidate.content.role ?? 'model',
      parts: candidate.content.parts,
    });
    blocks = iContent.blocks;
  } else if (modified.text !== undefined) {
    blocks = [{ type: 'text', text: modified.text }];
  } else {
    blocks = [...base.content.blocks];
  }

  const content: IContent = {
    speaker: base.content.speaker,
    blocks,
  };

  const result: ModelStreamChunk = {
    ...base,
    content,
  };

  if (modified.usageMetadata) {
    const u = modified.usageMetadata;
    result.usage = {
      promptTokens: u.promptTokenCount ?? 0,
      completionTokens: u.candidatesTokenCount ?? 0,
      totalTokens: u.totalTokenCount ?? 0,
    };
    const cached = u.cachedContentTokenCount;
    if (cached !== undefined && cached !== null && typeof cached === 'number') {
      result.usage.cachedTokens = cached;
    }
  }

  return result;
}

/**
 * Maps a hook-modified JSON-wire response to a neutral ModelOutput.
 *
 * Direct-path counterpart of `afterModelModifiedToChunk`. Used by
 * DirectMessageProcessor._applyAfterModelResult when the AfterModel hook
 * returns a MODIFY decision on the non-streaming path.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-002.6
 * @requirement:REQ-004.1
 * @pseudocode directmessageprocessor-neutral.md lines 25-30
 *
 * @param modified - The hook-modified JSON-wire response
 * @param base - The base neutral ModelOutput to derive speaker/usage from
 * @returns A neutral ModelOutput reflecting the hook modification, or undefined if not modified
 */
export function afterModelModifiedToModelOutput(
  modified: HookGenerateContentResponse | undefined,
  base: ModelOutput,
): ModelOutput | undefined {
  if (modified === undefined) {
    return undefined;
  }

  const candidate = modified.candidates?.[0];
  let blocks: ContentBlock[];

  if (candidate?.content?.parts) {
    const iContent = ContentConverters.toIContent({
      role: candidate.content.role ?? 'model',
      parts: candidate.content.parts,
    });
    blocks = iContent.blocks;
  } else if (modified.text !== undefined) {
    blocks = [{ type: 'text', text: modified.text }];
  } else {
    blocks = [...base.content.blocks];
  }

  const content: IContent = {
    speaker: base.content.speaker,
    blocks,
  };

  const result: ModelOutput = {
    ...base,
    content,
  };

  if (modified.usageMetadata) {
    const u = modified.usageMetadata;
    result.usage = {
      promptTokens: u.promptTokenCount ?? 0,
      completionTokens: u.candidatesTokenCount ?? 0,
      totalTokens: u.totalTokenCount ?? 0,
    };
    const cached = u.cachedContentTokenCount;
    if (cached !== undefined && cached !== null && typeof cached === 'number') {
      result.usage.cachedTokens = cached;
    }
  }

  return result;
}

/**
 * Maps a before-model blocking JSON-wire response to a neutral ModelOutput.
 *
 * Used by DirectMessageProcessor when a BeforeModel hook blocks with a
 * synthetic response. The hook wire shape is converted to neutral
 * ContentBlock[] at this boundary; no Google-shaped value re-enters the
 * agents pipeline.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-004.1
 * @pseudocode directmessageprocessor-neutral.md lines 20-22
 *
 * @param reason - The effective block reason (may be undefined)
 * @param synthetic - The hook-supplied synthetic JSON-wire response
 * @returns A neutral ModelOutput carrying the block reason/text
 */
export function beforeModelBlockingToModelOutput(
  reason: string | undefined,
  synthetic: HookGenerateContentResponse,
): ModelOutput {
  const candidate = synthetic.candidates?.[0];
  let blocks: ContentBlock[];

  if (candidate?.content?.parts) {
    const iContent = ContentConverters.toIContent({
      role: candidate.content.role ?? 'model',
      parts: candidate.content.parts,
    });
    blocks = iContent.blocks;
  } else if (synthetic.text !== undefined) {
    blocks = [{ type: 'text', text: synthetic.text }];
  } else {
    blocks = [{ type: 'text', text: reason ?? 'Execution blocked' }];
  }

  const result: ModelOutput = {
    content: {
      speaker: 'ai',
      blocks,
    },
  };

  if (synthetic.usageMetadata) {
    const u = synthetic.usageMetadata;
    result.usage = {
      promptTokens: u.promptTokenCount ?? 0,
      completionTokens: u.candidatesTokenCount ?? 0,
      totalTokens: u.totalTokenCount ?? 0,
    };
    const cached = u.cachedContentTokenCount;
    if (cached !== undefined && cached !== null && typeof cached === 'number') {
      result.usage.cachedTokens = cached;
    }
  }

  return result;
}

/**
 * Maps an AfterModel BLOCKING decision to a neutral ModelOutput.
 *
 * Used by StreamProcessor's streaming AfterModel BLOCK branch. Builds a
 * neutral ModelOutput carrying the block reason text, replacing the old
 * synthetic GenerateContentResponse path.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-002.6
 * @pseudocode stream-processor-neutral.md lines 20-22
 *
 * @param reason - The effective block reason
 * @param base - The base neutral chunk/output to derive speaker/usage from
 * @param systemMessage - Optional system message from the hook
 * @returns A neutral ModelOutput carrying the block reason
 */
export function afterModelBlockingToModelOutput(
  reason: string | undefined,
  base: ModelStreamChunk | ModelOutput,
  systemMessage?: string,
): ModelOutput {
  void systemMessage;
  return {
    ...base,
    content: {
      speaker: 'ai',
      blocks: [
        {
          type: 'text',
          text: reason ?? 'Execution blocked by AfterModel hook',
        },
      ],
    },
  };
}
