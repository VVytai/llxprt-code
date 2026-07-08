/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @requirement REQ-LOOP-001
 *
 * Pure continuation helpers for the engine-owned agentic loop. These assemble
 * functionResponse parts from completed tool calls and partition them for
 * history recording (functionCalls → 'model' role, functionResponses + others
 * → 'user' role, to maintain well-formed Gemini turn history).
 */

import type { Part } from '@google/genai';
import { DEFAULT_AGENT_ID } from '@vybestack/llxprt-code-core/core/turn.js';
import type { CompletedToolCall } from '@vybestack/llxprt-code-core/scheduler/types.js';
import type { AgentClientContract } from '@vybestack/llxprt-code-core/core/clientContract.js';
import { iContentFromBlocks } from '@vybestack/llxprt-code-core/llm-types/index.js';
import type { ToolCallBlock } from '@vybestack/llxprt-code-core/services/history/IContent.js';
import { convertBlocksToParts } from '../MessageConverter.js';

function isFunctionCallPart(part: Part): boolean {
  return 'functionCall' in part;
}

/**
 * Partitions a flat `Part[]` into functionCalls, functionResponses, and other
 * parts. Used to maintain proper history ordering: functionCalls go to the
 * 'model' role, functionResponses + otherParts go to the 'user' role.
 */
export function splitPartsByRole(parts: Part[]): {
  functionCalls: Part[];
  functionResponses: Part[];
  otherParts: Part[];
} {
  const functionCalls: Part[] = [];
  const functionResponses: Part[] = [];
  const otherParts: Part[] = [];

  for (const part of parts) {
    if ('functionCall' in part) {
      functionCalls.push(part);
    } else if ('functionResponse' in part) {
      functionResponses.push(part);
    } else {
      otherParts.push(part);
    }
  }

  return { functionCalls, functionResponses, otherParts };
}

/**
 * Splits completed tool calls into primary (DEFAULT_AGENT_ID) and external
 * (subagent) lists, filtering to only those carrying valid responseParts.
 */
export function classifyCompletedTools(tools: CompletedToolCall[]): {
  primaryTools: CompletedToolCall[];
  externalTools: CompletedToolCall[];
} {
  const primary: CompletedToolCall[] = [];
  const external: CompletedToolCall[] = [];

  for (const toolCall of tools) {
    if (!Array.isArray(toolCall.response.responseParts)) {
      continue;
    }
    const agentId = toolCall.request.agentId ?? DEFAULT_AGENT_ID;
    if (agentId === DEFAULT_AGENT_ID) {
      primary.push(toolCall);
    } else {
      external.push(toolCall);
    }
  }

  return { primaryTools: primary, externalTools: external };
}

/**
 * Builds the flat list of functionResponse parts to feed back to the model.
 * Filters out functionCall parts (already present in the assistant turn).
 */
export function buildToolResponses(geminiTools: CompletedToolCall[]): Part[] {
  return geminiTools.flatMap((toolCall) =>
    convertBlocksToParts(toolCall.response.responseParts).filter(
      (part) => !isFunctionCallPart(part),
    ),
  );
}

/**
 * Records cancelled tool history via `agentClient.addHistory`, splitting blocks
 * by type so tool calls land under speaker 'ai' and tool responses under
 * speaker 'tool'. Used when a turn is cancelled so the model sees a
 * well-formed tool response for every tool call it emitted.
 *
 * Awaits both writes so callers that exit the loop immediately afterwards can
 * guarantee the cancelled-tool history is persisted before the turn ends.
 */
export async function recordCancelledToolHistory(
  tools: CompletedToolCall[],
  agentClient: AgentClientContract,
): Promise<void> {
  const allBlocks = tools.flatMap((tc) => tc.response.responseParts);
  const toolCallBlocks = allBlocks.filter(
    (b): b is ToolCallBlock => b.type === 'tool_call',
  );
  const nonToolCallBlocks = allBlocks.filter((b) => b.type !== 'tool_call');

  if (toolCallBlocks.length > 0) {
    await agentClient.addHistory(iContentFromBlocks(toolCallBlocks, 'ai'));
  }
  if (nonToolCallBlocks.length > 0) {
    await agentClient.addHistory(iContentFromBlocks(nonToolCallBlocks, 'tool'));
  }
}
