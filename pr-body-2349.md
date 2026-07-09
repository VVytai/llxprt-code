## Summary

Migrates `packages/agents` off `@google/genai` and all Google-shaped structural content to neutral domain-named types (issue #2349). This PR executes phases P01-P33 of `PLAN-20260707-AGENTNEUTRAL`, including the tooling, type foundation, production migration slices, dependency removal, and final enforcement gate.

This is the implementation PR for the **multi-phase migration plan** (P01-P33). The phase sequence covers the stream pipeline, side-channels, direct-message path, structural access sites, runtime enums, usage metadata, client contract, subagents, executors, remaining retypes, and enforcement gate.

## What this PR does

### P01: Core Mutation Tooling

- Provisions Stryker mutation testing for `packages/core` (`stryker.conf.json` + `@stryker-mutator/*` devDeps + `test:mutation` script)
- Enables the 80%+ mutation gate for P05 gap type implementation

### P02: AST Gate Skeleton (`scripts/agents-neutral-gate.ts`)

- AST-context-aware structural counter with working `--count`/`--by-file` modes
- Real fail-mode for the cheap #2424 vectors behind `--enforce-imports`:
  - (a) raw `@google/genai` imports
  - (b) banned Google symbols (provenance-based: spares same-named identifiers from safe modules)
  - (c) `Contract*` payload-type aliases from `clientContract`
  - (e) local `FinishReason` enum re-declarations
- Expensive structural checks (`checkD`/`checkG-barrel`/`checkH` + full `checkF` fail gate) mature at P31
- Creates the ratchet baseline (count=38) that every migration slice must decrease
- Fixtures proving green-on-clean, red-on-vectors, and provenance-based checkB

### P03-P05: Neutral Gap Types (`packages/core/src/llm-types/agentMessageInput.ts`)

- `AgentMessageInput` DTO replacing `PartListUnion` (accepts string/ContentBlock[]/IContent/IContent[])
- `iContentFromAgentMessageInput` neutral conversion from all input shapes
- `iContentFromLegacyInput` lossless legacy converter preserving thought signatures, media, tool calls/responses
- `iContentFromBlocks` neutral block-to-IContent helper for AfterModel hook paths
- `sendParamsToRequest` turn-request DTO mapping to `ModelGenerationRequest`
- `ModelOutput.afcHistory?: IContent[]` neutral AFC slot
- Extended `toModelStreamChunk` preserves `providerMetadata` and `responseId` (OQ-16 gap)
- 48 behavioral + property-based tests, all passing
- Type predicates (NOT `as` casts) for all `unknown` input narrowing

### P06: Stream-Pipeline Behavioral Characterization

- 6 characterization tests pinning observable agent-loop behavior (event ordering, finished event, tool calls, thoughts, empty stream, pending tool calls)
- Safety net for the stream pipeline migration in P07-P09

## How this prevents the #2424 rejection

The rejected PR #2424 was a source-swap that re-pointed imports to aliases while leaving the Google-shaped round-trip intact. This PR AST gate catches that exact pattern:

1. **Structural detection** keys on AST structure (candidates/parts construction), not just type names
2. **Provenance-based checkB** distinguishes safe neutral identifiers from banned-module bindings
3. **Central allow-list** is the single authoritative exemption mechanism (inline comments grant nothing)
4. **Per-slice enforcement** `--enforce-imports` scoped to each migration slice files prevents re-introduction mid-migration

## Verification

- `npm run typecheck` green
- 54 tests pass (48 gap-type + 6 characterization)
- AST gate: `--count` = 38, `--enforce-imports` green on clean fixture, red on all 4 vector fixtures
- No lint/complexity loosening, no suppression directives anywhere

## Test plan

- [x] `npm run typecheck`
- [x] Gap type tests (48 tests pass)
- [x] Characterization tests (6 tests pass)
- [x] AST gate fixtures (6 fixtures: clean passes, 4 vectors fail, safe-neutral-names passes)
- [ ] Full `npm run test` (CI)
- [ ] `npm run lint` (CI)
- [ ] `npm run build` (CI)

Fixes #2349
