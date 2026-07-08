/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MessageConverter - Pure functions for Gemini SDK ↔ IContent format translation.
 * Handles format conversion, speaker semantics, finish-reason mapping, and validation.
 */

import type { GenerateContentResponse } from '@google/genai';
import { type Content, type Part, type PartListUnion } from '@google/genai';
import type {
  IContent,
  ContentBlock,
  ToolCallBlock,
  ToolResponseBlock,
  ThinkingBlock,
} from '@vybestack/llxprt-code-core/services/history/IContent.js';
import { iContentFromLegacyInput } from '@vybestack/llxprt-code-core/llm-types/index.js';
import { type ThoughtPart, isThoughtPart } from './googlePartHelpers.js';

// ---------------------------------------------------------------------------
// Boundary-validation helpers (typed `unknown` so guards are necessary)
// ---------------------------------------------------------------------------

/**
 * Returns true if `value` is a non-null object. Items in `PartListUnion`
 * come from external/provider data where `typeof null === 'object'`.
 */
function isNonNullObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Type-guard for a Part carrying a `functionResponse`. Restores main's
 * `item !== null && typeof item === 'object' && 'functionResponse' in item`
 * check (`'functionResponse' in null` throws).
 */
function isFunctionResponsePart(item: unknown): boolean {
  return (
    typeof item === 'object' && item !== null && 'functionResponse' in item
  );
}

/**
 * Returns true if `part` is undefined, null, or an empty object. Restores
 * main's `part === undefined || Object.keys(part).length === 0` guard
 * (`Object.keys(undefined)` throws).
 */
function isEmptyOrMissingPart(part: unknown): boolean {
  return (
    part === undefined ||
    part === null ||
    (typeof part === 'object' &&
      Object.keys(part as Record<string, unknown>).length === 0)
  );
}

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
 * Builds an IContent{speaker:'human'} from legacy PartListUnion input,
 * properly handling function response arrays (each response as a separate
 * ToolResponseBlock in the same IContent).
 *
 * Replaces the old createUserContent + {role:'user',parts} construction.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P09
 * @requirement:REQ-002.4
 * @requirement:REQ-006.4
 * @pseudocode lines 20-31
 */
export function createUserContentWithFunctionResponseFix(
  message: PartListUnion,
): IContent {
  const result = iContentFromLegacyInput(message);
  if (result.ok) {
    // Merge all IContent[] entries into a single human-speaker IContent.
    const allBlocks = result.value.flatMap((c) => c.blocks);
    return { speaker: 'human', blocks: allBlocks };
  }
  // Fallback: convert to text only if it's a string; otherwise use the error.
  const fallbackText =
    typeof message === 'string'
      ? message
      : `unsupported legacy input: ${result.error}`;
  return { speaker: 'human', blocks: [{ type: 'text', text: fallbackText }] };
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
  message: PartListUnion,
): IContent {
  // All input shapes route through the neutral converter which handles
  // string, Part, Part[], and tool-response packaging.
  return createUserContentWithFunctionResponseFix(message);
}

/**
 * Checks if a part contains valid non-thought text content.
 */
export function isValidNonThoughtTextPart(part: Part): boolean {
  const hasText = typeof part.text === 'string' && part.thought !== true;
  const hasNonTextPayload =
    Boolean(part.functionCall) ||
    Boolean(part.functionResponse) ||
    Boolean(part.inlineData) ||
    Boolean(part.fileData);
  // Technically, the model should never generate parts that have text and
  // any of these but we don't trust them so check anyways.
  return hasText && !hasNonTextPayload;
}

/**
 * Returns true if the response is valid, false otherwise.
 */
export function isValidResponse(response: GenerateContentResponse): boolean {
  if (response.candidates === undefined || response.candidates.length === 0) {
    return false;
  }
  const content = response.candidates[0]?.content;
  if (content === undefined) {
    return false;
  }
  return isValidContent(content);
}

/**
 * Validates if Content has valid parts.
 */
export function isValidContent(content: Content): boolean {
  if (content.parts === undefined || content.parts.length === 0) {
    return false;
  }
  for (const part of content.parts) {
    if (isEmptyOrMissingPart(part)) {
      return false;
    }
    if (part.thought !== true && part.text !== undefined && part.text === '') {
      return false;
    }
  }
  return true;
}

/**
 * Validates the history contains the correct roles.
 */
export function validateHistory(history: Content[]): void {
  for (const content of history) {
    if (content.role !== 'user' && content.role !== 'model') {
      throw new Error(`Role must be user or model, but got ${content.role}.`);
    }
  }
}

/**
 * Extracts valid history turns from comprehensive history.
 * Filters out invalid or empty contents from safety filters or recitation.
 */
export function extractCuratedHistory(
  comprehensiveHistory: Content[],
): Content[] {
  if (comprehensiveHistory.length === 0) {
    return [];
  }
  const curatedHistory: Content[] = [];
  const length = comprehensiveHistory.length;
  let i = 0;
  while (i < length) {
    if (comprehensiveHistory[i].role === 'user') {
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
 * Collects a contiguous run of model-role content, tracking validity.
 */
function collectModelRun(
  history: Content[],
  startIndex: number,
  length: number,
): { modelOutput: Content[]; isValid: boolean; nextIndex: number } {
  const modelOutput: Content[] = [];
  let isValid = true;
  let i = startIndex;
  while (i < length && history[i].role === 'model') {
    modelOutput.push(history[i]);
    if (isValid && !isValidContent(history[i])) {
      isValid = false;
    }
    i++;
  }
  return { modelOutput, isValid, nextIndex: i };
}

/**
 * Checks if a Content has text content in the first part.
 */
export function hasTextContent(
  content: Content | undefined,
): content is Content & { parts: [{ text: string }, ...Part[]] } {
  if (
    !content ||
    content.role !== 'model' ||
    !content.parts ||
    content.parts.length === 0
  ) {
    return false;
  }
  const firstPartText = content.parts[0].text;
  return typeof firstPartText === 'string' && firstPartText !== '';
}

/**
 * Convert PartListUnion (user input) to IContent format.
 */
export function convertPartListUnionToIContent(input: PartListUnion): IContent {
  if (typeof input === 'string') {
    // Simple string input from user
    return {
      speaker: 'human',
      blocks: [{ type: 'text', text: input }],
    };
  }

  // Handle Part or Part[] - delegate to helper
  // After filtering out string case, input is PartUnion[] | PartUnion = (Part | string)[] | Part | string
  // But we know strings are already handled, so cast to Part[]
  const parts = (Array.isArray(input) ? input : [input]) as Part[];
  return convertMixedPartsToIContent(parts);
}

/**
 * Converts mixed Parts (function calls, responses, text, thoughts) to IContent.
 */
export function convertMixedPartsToIContent(parts: Part[]): IContent {
  // Fast path: all function responses → tool message
  const allFunctionResponses = parts.every((part) =>
    isFunctionResponsePart(part),
  );
  if (allFunctionResponses) {
    return convertAllFunctionResponses(parts);
  }

  // Mixed content: classify parts and determine speaker
  const { blocks, hasAIContent, hasToolContent } = classifyMixedParts(parts);

  return {
    speaker: resolveSpeaker(hasToolContent, hasAIContent),
    blocks,
  };
}

function resolveSpeaker(
  hasToolContent: boolean,
  hasAIContent: boolean,
): IContent['speaker'] {
  if (hasToolContent) {
    return 'tool';
  }
  if (hasAIContent) {
    return 'ai';
  }
  return 'human';
}

function convertAllFunctionResponses(parts: Part[]): IContent {
  const blocks: ContentBlock[] = [];
  for (const part of parts) {
    if (
      isNonNullObject(part) &&
      'functionResponse' in part &&
      part.functionResponse
    ) {
      blocks.push({
        type: 'tool_response',
        callId: part.functionResponse.id ?? '',
        toolName: part.functionResponse.name ?? '',
        result: part.functionResponse.response ?? {},
        error: undefined,
      } as ToolResponseBlock);
    }
  }
  return { speaker: 'tool', blocks };
}

export function classifyMixedParts(parts: Part[]): {
  blocks: ContentBlock[];
  hasAIContent: boolean;
  hasToolContent: boolean;
} {
  const blocks: ContentBlock[] = [];
  let hasAIContent = false;
  let hasToolContent = false;

  for (const part of parts) {
    if (typeof part === 'string') {
      blocks.push({ type: 'text', text: part });
      hasAIContent = true;
    } else if (isThoughtPart(part)) {
      const thinkingBlock: ThinkingBlock = {
        type: 'thinking',
        thought: part.text ?? '',
        isHidden: true,
        sourceField: part.llxprtSourceField ?? 'thought',
      };
      if (part.thoughtSignature) {
        thinkingBlock.signature = part.thoughtSignature;
      }
      blocks.push(thinkingBlock);
      hasAIContent = true;
    } else if ('text' in part && part.text !== undefined) {
      blocks.push({ type: 'text', text: part.text });
      hasAIContent = true;
    } else if ('functionCall' in part && part.functionCall) {
      hasAIContent = true;
      blocks.push({
        type: 'tool_call',
        id: part.functionCall.id ?? '',
        name: part.functionCall.name ?? '',
        parameters: part.functionCall.args ?? {},
      } as ToolCallBlock);
    } else if ('functionResponse' in part && part.functionResponse) {
      hasToolContent = true;
      blocks.push({
        type: 'tool_response',
        callId: part.functionResponse.id ?? '',
        toolName: part.functionResponse.name ?? '',
        result: part.functionResponse.response ?? {},
        error: undefined,
      } as ToolResponseBlock);
    }
  }

  return { blocks, hasAIContent, hasToolContent };
}

/**
 * Converts IContent blocks to Gemini Parts array.
 */
export function convertBlocksToParts(blocks: ContentBlock[]): Part[] {
  const parts: Part[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        parts.push({ text: block.text });
        break;
      case 'tool_call': {
        const toolCall = block;
        parts.push({
          functionCall: {
            id: toolCall.id,
            name: toolCall.name,
            args: toolCall.parameters as Record<string, unknown>,
          },
        });
        break;
      }
      case 'tool_response': {
        const toolResponse = block;
        parts.push({
          functionResponse: {
            id: toolResponse.callId,
            name: toolResponse.toolName,
            response: toolResponse.result as Record<string, unknown>,
          },
        });
        break;
      }
      case 'thinking': {
        const thinkingBlock = block;
        const thoughtPart: ThoughtPart = {
          thought: true,
          text: thinkingBlock.thought,
        };
        if (thinkingBlock.signature) {
          thoughtPart.thoughtSignature = thinkingBlock.signature;
        }
        if (thinkingBlock.sourceField) {
          thoughtPart.llxprtSourceField = thinkingBlock.sourceField;
        }
        parts.push(thoughtPart);
        break;
      }
      default:
        break;
    }
  }

  return parts;
}
