/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TEMPORARY before-model blocking GenerateContentResponse compat helper.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P11 — DELETE in P13
 * @requirement:REQ-003.2
 *
 * This module holds ONLY the before-model blocking restriction-stamping helper
 * that still operates on a GenerateContentResponse synthetic response. It is
 * consumed by beforeModelHookDecision.ts and DirectMessageProcessor's
 * _buildBlockingSyntheticResponse until P13 retypes the blocking path to
 * neutral ModelOutput. It is the SINGLE allow-listed compat island and is
 * deleted in P13 alongside the C3 error retype.
 */

import type { GenerateContentResponse } from '@google/genai';
import { canonicalizeToolName } from './toolGovernance.js';

/**
 * Stamps hook-restricted allowed-tools metadata onto a blocking synthetic
 * GenerateContentResponse. Filters the candidates' parts and the
 * automaticFunctionCallingHistory by the allowed-tools set.
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P11 — DELETE in P13
 * @requirement:REQ-003.2
 */
export function attachHookRestrictedAllowedToolsToBlockingResponse(
  response: GenerateContentResponse,
  allowedTools: readonly string[] | undefined,
): GenerateContentResponse {
  if (allowedTools === undefined) {
    return response;
  }
  const allowed = new Set(allowedTools.map(canonicalizeToolName));
  const restrictedResponse = Object.assign(
    Object.create(Object.getPrototypeOf(response)) as GenerateContentResponse,
    response,
  );
  restrictedResponse.candidates = response.candidates?.map((candidate) => ({
    ...candidate,
    content:
      candidate.content === undefined
        ? undefined
        : {
            ...candidate.content,
            parts:
              candidate.content.parts === undefined
                ? undefined
                : candidate.content.parts.filter((part) => {
                    if (part.functionCall !== undefined) {
                      const name = part.functionCall.name ?? '';
                      return allowed.has(canonicalizeToolName(name));
                    }
                    if (part.functionResponse !== undefined) {
                      const name = part.functionResponse.name ?? '';
                      return allowed.has(canonicalizeToolName(name));
                    }
                    return true;
                  }),
          },
  }));
  restrictedResponse.automaticFunctionCallingHistory =
    response.automaticFunctionCallingHistory === undefined
      ? undefined
      : response.automaticFunctionCallingHistory
          .map((content) => ({
            ...content,
            parts: (content.parts ?? []).filter((part) => {
              if (part.functionCall !== undefined) {
                const name = part.functionCall.name ?? '';
                return allowed.has(canonicalizeToolName(name));
              }
              if (part.functionResponse !== undefined) {
                const name = part.functionResponse.name ?? '';
                return allowed.has(canonicalizeToolName(name));
              }
              return true;
            }),
          }))
          .filter((content) => (content.parts?.length ?? 0) > 0);
  return restrictedResponse;
}