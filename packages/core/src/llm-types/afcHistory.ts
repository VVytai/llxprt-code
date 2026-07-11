/**
 * Copyright 2025 Vybestack LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * AFC (automatic-function-calling) history extraction and validation at the
 * provider/core conversion boundary.
 *
 * Per the P13 AFC boundary design (PLAN-20260707-AGENTNEUTRAL): AFC decoding
 * and validation happen HERE (core), populating the first-class
 * `ModelStreamChunk.afcHistory` / `ModelOutput.afcHistory` field. Agents
 * consume ONLY `afcHistory`, never raw `providerMetadata.automaticFunctionCallingHistory`.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-001.4
 */

import type { IContent } from '../services/history/IContent.js';

/** Valid speaker values for AFC entries. */
const VALID_SPEAKERS: ReadonlySet<string> = new Set(['human', 'ai', 'tool']);

/** Valid ContentBlock type discriminators. */
const VALID_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'text',
  'tool_call',
  'tool_response',
  'media',
  'thinking',
  'code',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringField(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === 'string';
}

/**
 * Validate that a single block matches a ContentBlock variant with its
 * required fields. Returns false for unrecognized or incomplete blocks.
 */
function isValidBlock(block: unknown): boolean {
  if (!isRecord(block) || typeof block.type !== 'string') {
    return false;
  }
  if (!VALID_BLOCK_TYPES.has(block.type)) {
    return false;
  }
  switch (block.type) {
    case 'text':
      return typeof block.text === 'string';
    case 'tool_call':
      return isStringField(block, 'id') && isStringField(block, 'name');
    case 'tool_response':
      return isStringField(block, 'callId') && isStringField(block, 'toolName');
    case 'media':
      return (
        isStringField(block, 'mimeType') &&
        isStringField(block, 'data') &&
        (block.encoding === 'url' || block.encoding === 'base64')
      );
    case 'thinking':
      return isStringField(block, 'thought');
    case 'code':
      return isStringField(block, 'code');
    default:
      return false;
  }
}

function isValidAfcEntry(entry: unknown): entry is IContent {
  if (!isRecord(entry)) {
    return false;
  }
  if (typeof entry.speaker !== 'string' || !VALID_SPEAKERS.has(entry.speaker)) {
    return false;
  }
  if (!Array.isArray(entry.blocks) || entry.blocks.length === 0) {
    return false;
  }
  return entry.blocks.every(isValidBlock);
}

/**
 * Validate tool call/response pairing across all AFC entries.
 *
 * Enforces ordered one-to-one pairing with matching tool names:
 *  - Every tool_call block's `id` must have exactly one matching
 *    tool_response block's `callId` that appears AFTER it (in entry/block
 *    order). Response-before-call is rejected.
 *  - Every tool_response block's `callId` must have exactly one matching
 *    tool_call block's `id` that appears BEFORE it.
 *  - IDs must be unique: no duplicate tool_call ids, no duplicate
 *    tool_response callIds.
 *  - The tool name must match: tool_response.toolName === tool_call.name
 *    for each paired (id, callId).
 *  - No orphan calls or orphan responses.
 *
 * Returns false if any constraint is violated.
 */
function validateAfcPairing(entries: readonly IContent[]): boolean {
  // Collect tool calls and responses in document order, recording the
  // sequential position so we can enforce call-before-response ordering.
  interface CallRecord {
    readonly id: string;
    readonly name: string;
    readonly seq: number;
  }
  interface ResponseRecord {
    readonly callId: string;
    readonly toolName: string;
    readonly seq: number;
  }
  const calls: CallRecord[] = [];
  const responses: ResponseRecord[] = [];
  let seq = 0;

  for (const entry of entries) {
    for (const block of entry.blocks) {
      if (block.type === 'tool_call') {
        calls.push({ id: block.id, name: block.name, seq });
      } else if (block.type === 'tool_response') {
        responses.push({
          callId: block.callId,
          toolName: block.toolName,
          seq,
        });
      }
      seq++;
    }
  }

  if (calls.length === 0 && responses.length === 0) {
    return true;
  }

  // 1. Unique call IDs
  const callIds = calls.map((c) => c.id);
  if (new Set(callIds).size !== callIds.length) {
    return false;
  }

  // 2. Unique response callIds
  const responseIds = responses.map((r) => r.callId);
  if (new Set(responseIds).size !== responseIds.length) {
    return false;
  }

  // 3. One-to-one pairing: counts must match
  if (calls.length !== responses.length) {
    return false;
  }

  // 4. Ordered one-to-one with matching tool names.
  // Pair each call with the response that shares its id, then verify:
  //   - the response appears at or after the call's sequence
  //   - the tool names match
  const responseByCallId = new Map<string, ResponseRecord>();
  for (const r of responses) {
    responseByCallId.set(r.callId, r);
  }
  for (const call of calls) {
    const response = responseByCallId.get(call.id);
    if (response === undefined) {
      // Orphan call — no matching response.
      return false;
    }
    // Ordered: response must come at or after the call.
    if (response.seq < call.seq) {
      return false;
    }
    // Tool name must match.
    if (response.toolName !== call.name) {
      return false;
    }
  }

  // All responses are covered by the one-to-one check above (orphan
  // response => a response whose callId has no matching call; the loop
  // over calls guarantees every call has a response, and the count match
  // guarantees there are no extra responses).
  return true;
}

/**
 * Extracts and validates the automatic-function-calling (AFC) history from
 * provider metadata on an IContent. This is the canonical boundary function
 * called by `toModelStreamChunk` — agents must NOT read
 * `providerMetadata.automaticFunctionCallingHistory` directly.
 *
 * Validation rules:
 *  - Each entry must be a non-null object with a valid `speaker` ('human' |
 *    'ai' | 'tool') and a non-empty `blocks` array.
 *  - Every block must match a valid ContentBlock variant with required fields.
 *  - Tool call/response pairing: every tool_call block's `id` must have a
 *    matching tool_response block's `callId`, and vice versa. If ANY tool
 *    call or response is orphaned, the ENTIRE payload is rejected (returns
 *    undefined) — never partially accept a malformed AFC sequence.
 *
 * Returns the validated IContent[] or undefined when no valid AFC history
 * is present.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-001.4
 */
export function extractAfcHistory(content: IContent): IContent[] | undefined {
  const metadataValue =
    content.metadata?.providerMetadata?.['automaticFunctionCallingHistory'];
  if (!Array.isArray(metadataValue)) {
    return undefined;
  }
  // Fail closed: if ANY entry is structurally invalid, reject the ENTIRE
  // payload (return undefined). Never partially accept a malformed AFC
  // sequence — a single corrupt entry means the provider's AFC metadata
  // cannot be trusted as a coherent turn sequence.
  if (!metadataValue.every(isValidAfcEntry)) {
    return undefined;
  }
  const structurallyValid = metadataValue;
  if (!validateAfcPairing(structurallyValid)) {
    return undefined;
  }
  return structurallyValid;
}

/**
 * Returns the providerMetadata record without the AFC key, or undefined if
 * the input was undefined. Called by `toModelStreamChunk` so that raw AFC
 * never leaks through to agents via `providerMetadata`.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P13
 * @requirement:REQ-001.4
 */
export function stripAfcFromProviderMetadata(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (meta === undefined) return undefined;
  if ('automaticFunctionCallingHistory' in meta) {
    const { automaticFunctionCallingHistory: _removed, ...rest } = meta;
    void _removed;
    return rest;
  }
  return meta;
}
