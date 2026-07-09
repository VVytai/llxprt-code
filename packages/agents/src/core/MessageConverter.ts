/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MessageConverter - Pure functions for neutral IContent format translation.
 * Handles format conversion, speaker semantics, finish-reason mapping, and validation.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P09
 * @requirement:REQ-002.4
 */

import type {
  IContent,
  ContentBlock,
} from '@vybestack/llxprt-code-core/services/history/IContent.js';
import type { AgentMessageInput } from '@vybestack/llxprt-code-core/llm-types/index.js';
import {
  iContentFromAgentMessageInput,
  iContentFromLegacyInput,
} from '@vybestack/llxprt-code-core/llm-types/index.js';

/**
 * Aggregates text from content blocks while preserving spacing around non-text blocks.
 */
export function aggregateTextWithSpacing(
  blocks: ContentBlock[],
  currentText: string,
  lastBlockWasNonText: boolean,
): { text: string; lastBlockWasNonText: boolean } {
  let aggregatedText = currentText;
  let wasNonText = lastBlockWasNonText;

  for (const block of blocks) {
    if (block.type === 'text') {
      if (wasNonText && aggregatedText.length > 0) {
        aggregatedText += ' ';
      }
      aggregatedText += block.text;
      wasNonText = false;
    } else {
      wasNonText = true;
    }
  }

  return { text: aggregatedText, lastBlockWasNonText: wasNonText };
}

/**
 * Builds an IContent{speaker:'human'} from neutral AgentMessageInput,
 * properly handling function response arrays (each response as a separate
 * ToolResponseBlock in the same IContent).
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P09
 * @requirement:REQ-002.4
 * @requirement:REQ-006.4
 * @pseudocode lines 20-31
 */
export function createUserContentWithFunctionResponseFix(
  message: AgentMessageInput,
): IContent {
  const contents = iContentFromAgentMessageInput(message);
  if (contents.length > 0) {
    // Merge all IContent[] entries into a single human-speaker IContent.
    const allBlocks = contents.flatMap((c) => c.blocks);
    return { speaker: 'human', blocks: allBlocks };
  }
  return {
    speaker: 'human',
    blocks: [
      { type: 'text', text: 'unsupported legacy input: empty conversion' },
    ],
  };
}

/**
 * Normalizes tool interaction input for the provider.
 * Packages tool responses as human-speaker IContent.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P09
 * @requirement:REQ-002.4
 * @pseudocode lines 20-31
 */
export function normalizeToolInteractionInput(
  message: AgentMessageInput,
): IContent {
  return createUserContentWithFunctionResponseFix(message);
}

/**
 * Checks if a block contains valid non-thought text content.
 */
export function isValidNonThoughtTextPart(block: ContentBlock): boolean {
  if (block.type !== 'text') {
    return false;
  }
  // TextBlock is always non-thought (thoughts are ThinkingBlock).
  return block.text !== '';
}

/**
 * Validates if IContent has valid blocks.
 */
export function isValidContent(content: IContent): boolean {
  if (content.blocks.length === 0) {
    return false;
  }
  for (const block of content.blocks) {
    if (block.type === 'text' && block.text === '') {
      return false;
    }
  }
  return true;
}

/**
 * Validates the history contains the correct speakers.
 */
export function validateHistory(history: readonly unknown[]): void {
  for (const entry of history) {
    const record = entry as Record<string, unknown>;
    const speaker = record.speaker;
    if (speaker !== 'human' && speaker !== 'ai' && speaker !== 'tool') {
      throw new Error(
        `Invalid history entry: missing or invalid speaker. Got: ${String(speaker)}`,
      );
    }
    if (!Array.isArray(record.blocks)) {
      throw new Error(
        `Invalid history entry: blocks must be an array. Got: ${typeof record.blocks}`,
      );
    }
  }
}

/**
 * Extracts valid history turns from comprehensive history.
 * Filters out invalid or empty contents from safety filters or recitation.
 */
export function extractCuratedHistory(
  comprehensiveHistory: IContent[],
): IContent[] {
  if (comprehensiveHistory.length === 0) {
    return [];
  }
  const curatedHistory: IContent[] = [];
  const length = comprehensiveHistory.length;
  let i = 0;
  while (i < length) {
    if (comprehensiveHistory[i].speaker === 'human') {
      curatedHistory.push(comprehensiveHistory[i]);
      i++;
    } else {
      const result = collectModelRun(comprehensiveHistory, i, length);
      i = result.nextIndex;
      if (result.isValid) {
        curatedHistory.push(...result.modelOutput);
      }
    }
  }
  return curatedHistory;
}

/**
 * Collects a contiguous run of AI-speaker content, tracking validity.
 */
function collectModelRun(
  history: IContent[],
  startIndex: number,
  length: number,
): { modelOutput: IContent[]; isValid: boolean; nextIndex: number } {
  const modelOutput: IContent[] = [];
  let isValid = true;
  let i = startIndex;
  while (i < length && history[i].speaker === 'ai') {
    modelOutput.push(history[i]);
    if (isValid && !isValidContent(history[i])) {
      isValid = false;
    }
    i++;
  }
  return { modelOutput, isValid, nextIndex: i };
}

/**
 * Checks if an IContent has text content in the first block.
 */
export function hasTextContent(
  content: IContent | undefined,
): content is IContent & { blocks: [{ text: string }, ...ContentBlock[]] } {
  if (
    content === undefined ||
    content.speaker !== 'ai' ||
    content.blocks.length === 0
  ) {
    return false;
  }
  const firstBlock = content.blocks[0];
  return firstBlock.type === 'text' && firstBlock.text !== '';
}

/**
 * Convert AgentMessageInput to IContent format.
 */
export function convertPartListUnionToIContent(
  input: AgentMessageInput,
): IContent {
  if (typeof input === 'string') {
    return {
      speaker: 'human',
      blocks: [{ type: 'text', text: input }],
    };
  }

  const contents = iContentFromAgentMessageInput(input);
  if (contents.length > 0) {
    // If the neutral converter produced a single IContent, return it.
    // Override speaker to 'tool' when all blocks are tool responses
    // (iContentFromAgentMessageInput defaults to 'human').
    if (contents.length === 1) {
      const single = contents[0];
      if (
        single.speaker === 'human' &&
        single.blocks.length > 0 &&
        single.blocks.every((b) => b.type === 'tool_response')
      ) {
        return { ...single, speaker: 'tool' as const };
      }
      return single;
    }
    // Merge multiple IContent into one, preserving speaker.
    const allBlocks = contents.flatMap((c) => c.blocks);
    const speaker = allBlocks.every((b) => b.type === 'tool_response')
      ? 'tool'
      : 'human';
    return {
      speaker,
      blocks: allBlocks,
    };
  }

  // Fallback: try legacy converter for Part/Part[] shapes.
  const legacyResult = iContentFromLegacyInput(input);
  if (legacyResult.ok) {
    return {
      speaker: 'human',
      blocks: legacyResult.value.flatMap((c) => c.blocks),
    };
  }

  return {
    speaker: 'human',
    blocks: [
      { type: 'text', text: `unsupported input: ${legacyResult.error}` },
    ],
  };
}

/**
 * Converts ContentBlock[] to ContentBlock[] — identity pass-through.
 *
 * Previously this converted neutral blocks to Google Part[]. Now that the
 * history recording layer is neutral, this is an identity function kept for
 * API compatibility with callers that build IContent from blocks.
 */
export function convertBlocksToParts(blocks: ContentBlock[]): ContentBlock[] {
  return blocks;
}

/**
 * Converts mixed blocks to IContent, classifying the speaker.
 * Exported for backward compatibility.
 */
export function classifyMixedParts(blocks: ContentBlock[]): {
  blocks: ContentBlock[];
  hasAIContent: boolean;
  hasToolContent: boolean;
} {
  let hasAIContent = false;
  let hasToolContent = false;

  for (const block of blocks) {
    if (block.type === 'text') {
      hasAIContent = true;
    } else if (block.type === 'thinking') {
      hasAIContent = true;
    } else if (block.type === 'tool_call') {
      hasAIContent = true;
    } else if (block.type === 'tool_response') {
      hasToolContent = true;
    }
  }

  return { blocks, hasAIContent, hasToolContent };
}

/**
 * Converts mixed blocks to IContent.
 */
export function convertMixedPartsToIContent(blocks: ContentBlock[]): IContent {
  const { hasAIContent, hasToolContent } = classifyMixedParts(blocks);

  let speaker: IContent['speaker'] = 'human';
  if (hasToolContent) {
    speaker = 'tool';
  } else if (hasAIContent) {
    speaker = 'ai';
  }

  return { speaker, blocks };
}
