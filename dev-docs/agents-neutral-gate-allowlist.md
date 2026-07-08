<!-- @plan:PLAN-20260707-AGENTNEUTRAL.P02 -->
<!-- @requirement:REQ-012.2 -->

# Agents Neutral Gate — Central Allow-list

> **Authoritative exemption mechanism (OQ-17).** This file is the SINGLE source
> of truth for exemptions to `scripts/agents-neutral-gate.ts`. An inline
> `// gate-exempt` comment in source code grants **NOTHING** — only a matching
> entry in this artifact exempts a hit. The gate subtracts allow-listed hits
> via AST-context matching (file + subkind + context-pattern).

## Format Specification

Each entry is a markdown table row:

| File              | Subkind         | Context Pattern    | Justification                     |
| ----------------- | --------------- | ------------------ | --------------------------------- |
| `path/to/file.ts` | `F3-role-parts` | `toGeminiContents` | why this bounded exception exists |

- **File** — repo-relative file path (or suffix match). `*` = any file.
- **Subkind** — the check subkind (`A-raw-genai-import`, `B-banned-symbol`,
  `C-contract-alias`, `E-enum-redeclaration`, `F1-candidates-content`,
  `F3-role-parts`, `F5-parts-access`, `G-call-toGeminiContent`, etc.). `*` =
  any subkind (use sparingly — subkind must match unless explicitly `*`).
- **Context Pattern** — a snippet that must appear in the hit's AST-context
  snippet for the exemption to apply. `*` or empty = match any context for
  this file+subkind.
- **Justification** — written rationale for why this bounded exception exists.

### Rules

1. An inline `// gate-exempt` comment grants **nothing** (OQ-17).
2. A structural hit with no matching allow-list entry **FAILS** regardless of
   any inline comment.
3. File-level exemptions (`subkind: *`) are REJECTED for hooks/usage-keys —
   the exemption is AST-context keyed, not file-level.

## Entries

### P11 — Temporary before-model blocking compat (DELETE in P13)

| File | Subkind | Context Pattern | Justification |
| --- | --- | --- | --- |
| `packages/agents/src/core/beforeModelBlockingCompat.ts` | `A-raw-genai-import` | `import type { GenerateContentResponse }` | Temporary before-model blocking GenerateContentResponse compat; deleted in P13 with the C3 error retype |
| `packages/agents/src/core/beforeModelBlockingCompat.ts` | `F3-role-parts` | `candidate.content.parts` | Temporary before-model blocking compat; filters parts on the synthetic response; deleted in P13 |
| `packages/agents/src/core/beforeModelBlockingCompat.ts` | `F5-parts-access` | `candidate.content` | Temporary before-model blocking compat; reads parts for tool filtering; deleted in P13 |
| `packages/agents/src/core/beforeModelBlockingCompat.ts` | `F5-parts-access` | `...content` | Temporary before-model blocking compat; reads parts for AFC history filtering; deleted in P13 |
| `packages/agents/src/core/beforeModelBlockingCompat.ts` | `F1-candidates-content` | `candidates: [` | Temporary before-model blocking compat; constructs candidates envelope; deleted in P13 |

### P11 — Legacy hook restrictions compat (DELETE in P25)

| File | Subkind | Context Pattern | Justification |
| --- | --- | --- | --- |
| `packages/agents/src/core/hookRestrictionsLegacyCompat.ts` | `A-raw-genai-import` | `import type { Content, FunctionCall, GenerateContentResponse, Part }` | Legacy WeakMap/Part[]/FunctionCall restriction helpers for not-yet-migrated consumers (streamChunkWrapper, streamResponseHelpers, subagent*, executor*); deleted in P25 when last consumer migrates |
| `packages/agents/src/core/hookRestrictionsLegacyCompat.ts` | `F3-role-parts` | `content.parts` | Legacy Part[]-based filtering; deleted in P25 |
| `packages/agents/src/core/hookRestrictionsLegacyCompat.ts` | `F5-parts-access` | `candidate.content` | Legacy Part[]-based access; deleted in P25 |
| `packages/agents/src/core/hookRestrictionsLegacyCompat.ts` | `F5-parts-access` | `...content` | Legacy Part[]-based access for content filtering; deleted in P25 |

### Expected entries at target state (added by migration slices)

- `packages/agents/src/core/streamRequestHelpers.ts` — G3 hook-wire
  `toGeminiContents` adapter — IFF OQ-1a keeps the wire Gemini-shaped
  (AST-context-keyed, NOT file-level). Added by P07/P25.
- `packages/agents/src/core/hookWireAdapter.ts` — the named external-wire
  mapping functions ONLY (AST-context-keyed; Major 3). Added by P07, extended
  P13, finalized P31.
- `packages/agents/src/api/event-types.ts` / `event-schema.ts` — declared
  public usage type (committed §7A option C). Added by P19.
- `packages/agents/src/api/eventAdapter.ts` — the
  `usageStatsToPublicUsageMetadata` mapper module (committed option-(C)
  boundary mapper). Added by P19.
- **NOTE:** `packages/agents/src/core/turnLogging.ts` is NOT allow-listed —
  OQ-3t is COMMITTED NEUTRAL (turnLogging.ts must carry ZERO Gemini usage
  keys).
- Test allow-list: the named characterization tests (added by P28/P30).
