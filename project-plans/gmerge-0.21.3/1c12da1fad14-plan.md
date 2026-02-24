# Plan: Hook Session Lifecycle & Compression Integration

Plan ID: `PLAN-20250219-GMERGE021.R4`
Generated: 2025-02-19
Total Phases: 8 (P00 preflight + P01–P07 implementation)
Source Commit: `1c12da1fad14` — `feat(hooks): Hook Session Lifecycle & Compression Integration (#14151)` (Edilmo Palencia, Dec 3 2025)

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P00)
2. Read behavioral contract definitions in P00 — they govern every hook call site
3. Written failing tests BEFORE implementing each phase (TDD mandate)
4. Verified that all imports, types, and call paths are as assumed in P00

---

## Commit Summary

This commit introduces three new hook event types (`SessionStart`, `SessionEnd`, `PreCompress`) and integrates them into the application lifecycle and chat compression service. It also adds telemetry flushing capabilities and refactors the CLI to fire session lifecycle hooks at appropriate points.

### Upstream Hook Event Types

| Event | Trigger | Input Fields |
|-------|---------|--------------|
| `SessionStart` | App startup, session resume, /clear command | `source` (startup, resume, clear) |
| `SessionEnd` | App exit, /clear command | `reason` (exit, clear, logout) |
| `PreCompress` | Before chat compression | `trigger` (manual, auto) |

### Key Differences from Upstream

| Aspect | Upstream | LLxprt |
|--------|----------|--------|
| Hook invocation | Via MessageBus (`messageBus.request()`) | Direct `HookEventHandler` calls |
| Trigger function module | `sessionHookTriggers.ts` | `lifecycleHookTriggers.ts` (existing) |
| Function names | `fireSessionStartHook()` etc. | `triggerSessionStartHook()` etc. |
| `flushTelemetry` signature | `flushTelemetry(config: Config)` | `flushTelemetry()` (config not needed) |
| Partial flush failure | Not specified | `Promise.allSettled` ensures both processors flush independently |
| EPIPE handling | Added in this commit | Already present — no action needed |

---

## Execution Tracker

| Phase | ID | Status | Description |
|-------|-----|--------|-------------|
| 0 | P00 | [ ] | Preflight verification |
| 1 | P01 | [ ] | `firePreCompressEvent` in HookEventHandler |
| 2 | P02 | [ ] | `triggerPreCompressHook` in lifecycleHookTriggers |
| 3 | P03 | [ ] | PreCompress hook in `performCompression` + compressCommand |
| 4 | P04 | [ ] | `flushTelemetry` in telemetry SDK |
| 5 | P05 | [ ] | clearCommand session lifecycle hooks + flush |
| 6 | P06 | [ ] | Telemetry shutdown in CLI cleanup |
| 7 | P07 | [ ] | Verify/wire SessionStart in interactive AppContainer |

---

# Phase P00: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R4.P00`

## Purpose

Verify all assumptions before writing any code. If any checkbox below is unchecked after verification, STOP and update the plan before proceeding.

## Dependency Verification

| Dependency | File | Status |
|------------|------|--------|
| `HookEventName.PreCompress` enum value | `packages/core/src/hooks/types.ts` | Verify present |
| `PreCompressTrigger` enum | `packages/core/src/hooks/types.ts` | Verify present |
| `PreCompressInput` interface | `packages/core/src/hooks/types.ts` | Verify present |
| `SessionStartSource.Clear` | `packages/core/src/hooks/types.ts` | Verify present |
| `SessionEndReason.Clear` | `packages/core/src/hooks/types.ts` | Verify present |
| `fireSessionStartEvent` / `fireSessionEndEvent` | `packages/core/src/hooks/hookEventHandler.ts` | Verify at lines ~275/~297 |
| EPIPE handling in hookRunner | `packages/core/src/hooks/hookRunner.ts` | Verify at lines 245-246 |
| `CommandContext.services.config: Config | null` | `packages/cli/src/ui/commands/types.ts` line 49 | Verify present |
| `BatchSpanProcessor` and `BatchLogRecordProcessor` as local vars | `packages/core/src/telemetry/sdk.ts` | Verify they are NOT module-level |

## Verification Commands

```bash
# Confirm enum values exist
grep -n "PreCompress\|PreCompressTrigger\|SessionStartSource\|SessionEndReason" \
  packages/core/src/hooks/types.ts

# Confirm fireSessionStartEvent / fireSessionEndEvent exist
grep -n "fireSessionStart\|fireSessionEnd\|firePreCompress" \
  packages/core/src/hooks/hookEventHandler.ts

# Confirm EPIPE handling exists
grep -n "EPIPE" packages/core/src/hooks/hookRunner.ts

# Confirm processors are local (not module-level) in sdk.ts
grep -n "spanProcessor\|logProcessor\|BatchSpanProcessor\|BatchLogRecordProcessor" \
  packages/core/src/telemetry/sdk.ts

# Confirm CommandContext config type
grep -n "config" packages/cli/src/ui/commands/types.ts

# Confirm triggerSessionStartHook already wired in gemini.tsx
grep -n "triggerSessionStart\|triggerSessionEnd" packages/cli/src/gemini.tsx

# Confirm SessionStart is NOT fired from AppContainer startup path
grep -n "triggerSessionStart" packages/cli/src/ui/AppContainer.tsx
```

## Confirmed Existing Infrastructure

The following are already implemented — **no changes needed**:

- `triggerSessionStartHook` and `triggerSessionEndHook` in `lifecycleHookTriggers.ts`
- `fireSessionStartEvent` / `fireSessionEndEvent` in `hookEventHandler.ts`
- EPIPE error handling in `hookRunner.ts` (line 245-246)
- Session hook wiring in `gemini.tsx` (startup/exit paths)
- `SessionEnd(exit)` in `AppContainer.tsx` cleanup (line 1728)
- All enum values: `HookEventName.PreCompress`, `PreCompressTrigger`, `SessionStartSource.*`, `SessionEndReason.*`

## Precise Gap Analysis

| Feature | Upstream | LLxprt Status | Action |
|---------|----------|---------------|--------|
| SessionStart hook on startup | Via MessageBus | [OK] Already wired in `gemini.tsx` | None |
| SessionEnd hook on exit | Via MessageBus | [OK] Already wired in `gemini.tsx` and `AppContainer.tsx` | None |
| SessionStart hook in interactive AppContainer | Via MessageBus | [ERROR] Missing from `AppContainer.tsx` startup path | Add — P07 |
| `firePreCompressEvent` in hookEventHandler | Yes | [ERROR] Absent from `hookEventHandler.ts` | Add — P01 |
| `triggerPreCompressHook` function | Yes | [ERROR] Absent from `lifecycleHookTriggers.ts` | Add — P02 |
| PreCompress hook before `performCompression` | Yes | [ERROR] Not called in `geminiChat.ts` | Add — P03 |
| `flushTelemetry` function | Exported from core | [ERROR] Absent; processors not stored at module scope | Add — P04 |
| `registerTelemetryConfig` in cleanup | Yes | [ERROR] Absent from `cleanup.ts` | Add — P06 |
| Telemetry shutdown in `runExitCleanup` | Yes | [ERROR] Not registered | Add — P06 |
| SessionEnd before `/clear` | Yes | [ERROR] Absent from `clearCommand.ts` | Add — P05 |
| SessionStart after `/clear` | Yes | [ERROR] Absent from `clearCommand.ts` | Add — P05 |
| flushTelemetry after `/clear` | Yes | [ERROR] Absent from `clearCommand.ts` | Add — P05 |
| EPIPE error handling in hookRunner | Yes | [OK] Already present (line 245-246) | None |

## Behavioral Contracts (Govern All Implementation Phases)

### Fail-Open Policy (ALL Hook Events)

All new hook trigger calls **must** be fail-open: if a hook throws, rejects, or times out, the triggering operation continues as if no hook was configured. This matches the pattern in `lifecycleHookTriggers.ts` (each catch block logs a warning and returns `undefined`).

| Hook Event | If hook fails | Operation continues? |
|-----------|--------------|---------------------|
| SessionStart(startup) | Log warning | Yes — startup proceeds |
| SessionStart(clear) | Log warning | Yes — clear proceeds |
| SessionEnd(exit) | Log warning | Yes — exit proceeds |
| SessionEnd(clear) | Log warning | Yes — clear proceeds |
| PreCompress | Log warning | Yes — compression proceeds |

### PreCompress Trigger Classification

`performCompression` is the single canonical entry point. Callers and their trigger values:

1. `ensureCompressionBeforeSend` → `PreCompressTrigger.Auto`
2. `enforceContextWindow` → `PreCompressTrigger.Auto`
3. `compressCommand` (via `/compress`) → `PreCompressTrigger.Manual`

The `trigger?: PreCompressTrigger` parameter defaults to `Auto`; only `compressCommand` passes `Manual`.

### SessionEnd/Start Ordering in /clear

The guaranteed sequence for `/clear`:
1. `await triggerSessionEndHook(config, SessionEndReason.Clear)` — fires before any state mutation
2. Existing clear logic (`geminiClient.resetChat()`, token count reset, etc.)
3. `await triggerSessionStartHook(config, SessionStartSource.Clear)` — fires after state is reset
4. `await flushTelemetry()` — ensures hook output is written before the session resumes

### Telemetry Lifecycle Safety

- `flushTelemetry()` before `initializeTelemetry()` → no-op (processors are undefined)
- `flushTelemetry()` after `shutdownTelemetry()` → no-op (processors cleared on shutdown)
- Concurrent `flushTelemetry()` calls → safe (`forceFlush` on `BatchSpanProcessor` is idempotent)
- Processor refs must be set to `undefined` in `shutdownTelemetry()` to prevent stale-ref leaks in tests

## Verification Gate

- [ ] All enum values confirmed present in `types.ts`
- [ ] `fireSessionStartEvent` / `fireSessionEndEvent` confirmed in `hookEventHandler.ts`
- [ ] EPIPE handling confirmed in `hookRunner.ts`
- [ ] Processors confirmed as local (not module-level) in `sdk.ts`
- [ ] `CommandContext.services.config` confirmed typed as `Config | null`
- [ ] Gap analysis above matches actual file state

**IF ANY CHECKBOX IS UNCHECKED: STOP and update the plan before proceeding.**

---

# Phase P01: Add `firePreCompressEvent` to HookEventHandler

## Phase ID

`PLAN-20250219-GMERGE021.R4.P01`

## Prerequisites

- Required: Phase P00 completed and all verification gates passed
- Priority: HIGH — blocks P02 and P03

## Requirements Implemented

### REQ-P01-1: PreCompress Hook Dispatch

**Full Text**: `HookEventHandler` must expose a `firePreCompressEvent` method that dispatches a hook event with `hookEventName: 'PreCompress'` and the caller-supplied trigger value.

**Behavior**:
- GIVEN: A hook event handler instance
- WHEN: `firePreCompressEvent({ trigger: PreCompressTrigger.Manual })` is called
- THEN: The hook runner pipeline receives a `PreCompressInput` with `hookEventName: 'PreCompress'` and `trigger: 'manual'`

**Why This Matters**: This is the lowest-level dispatch point for the PreCompress event; all higher-level trigger functions depend on it.

## Implementation Tasks

### Files to Modify

- `packages/core/src/hooks/hookEventHandler.ts`
  - Add `firePreCompressEvent(context: { trigger: PreCompressTrigger })` method following the exact pattern of `fireSessionStartEvent` and `fireSessionEndEvent`
  - Import `PreCompressInput`, `PreCompressTrigger` from `types.ts` (add to existing destructuring)
  - Build a `PreCompressInput` from context and dispatch through existing hook runner pipeline
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P01`

- `packages/core/src/hooks/hookEventHandler.test.ts`
  - Add failing tests BEFORE implementing the method (TDD)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P01`

### Required Code Markers

Every function/test created in this phase MUST include:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R4.P01
 * @requirement REQ-P01-1
 */
```

## Verification Commands

```bash
# Check plan markers exist
grep -r "@plan PLAN-20250219-GMERGE021.R4.P01" . | wc -l
# Expected: 2+ occurrences

# Confirm method exists
grep -n "firePreCompressEvent" packages/core/src/hooks/hookEventHandler.ts

# Run phase-specific tests
npm test -- --testPathPattern="hookEventHandler"
# Expected: All pass
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX)" packages/core/src/hooks/hookEventHandler.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] I read the requirement text
- [ ] I read the implementation code (not just checked file exists)
- [ ] `firePreCompressEvent` dispatches with `hookEventName: 'PreCompress'`
- [ ] Both `Manual` and `Auto` trigger values are passed through correctly
- [ ] Method returns failure envelope (not throw) on hook runner error
- [ ] Tests verify actual outputs, not just that code ran
- [ ] Tests would fail if implementation was removed

## Test Matrix for This Phase

1. `firePreCompressEvent` dispatches with `hookEventName: 'PreCompress'`
2. `firePreCompressEvent` passes `trigger: 'manual'` when `Manual` is given
3. `firePreCompressEvent` passes `trigger: 'auto'` when `Auto` is given
4. `firePreCompressEvent` returns failure envelope (not throw) on hook runner error

## Success Criteria

- `firePreCompressEvent` method exists in `hookEventHandler.ts`
- All 4 tests pass
- No TODOs or stubs in implementation code
- Plan marker present in code

## Failure Recovery

If this phase fails:
1. `git checkout -- packages/core/src/hooks/hookEventHandler.ts`
2. `git checkout -- packages/core/src/hooks/hookEventHandler.test.ts`
3. Re-run Phase P01

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

---

# Phase P02: Add `triggerPreCompressHook` to lifecycleHookTriggers

## Phase ID

`PLAN-20250219-GMERGE021.R4.P02`

## Prerequisites

- Required: Phase P01 completed
- Verification: `grep -r "@plan PLAN-20250219-GMERGE021.R4.P01" .`
- Expected from P01: `firePreCompressEvent` method present in `hookEventHandler.ts`
- Priority: HIGH — blocks P03

## Requirements Implemented

### REQ-P02-1: Lifecycle Trigger for PreCompress

**Full Text**: A `triggerPreCompressHook(config, trigger)` function must exist in `lifecycleHookTriggers.ts`, following the same fail-open guard pattern as `triggerSessionStartHook`.

**Behavior**:
- GIVEN: A config with hooks enabled and a hook system available
- WHEN: `triggerPreCompressHook(config, PreCompressTrigger.Auto)` is called
- THEN: `firePreCompressEvent` is invoked with the correct trigger value
- WHEN: The hook throws any error
- THEN: The function catches it, logs a warning, and returns `undefined`

**Why This Matters**: This is the public API consumed by `geminiChat.ts`; without it P03 cannot integrate the hook into compression.

## Implementation Tasks

### Files to Modify

- `packages/core/src/core/lifecycleHookTriggers.ts`
  - Import `PreCompressTrigger`, `PreCompressOutput` from `../hooks/types.js`
  - Add `triggerPreCompressHook(config: Config, trigger: PreCompressTrigger): Promise<PreCompressOutput | undefined>`
  - Follow exact same pattern as `triggerSessionStartHook` (guard → initialize → fire → catch)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P02`

- `packages/core/src/hooks/index.ts`
  - Export `triggerPreCompressHook`

- `packages/core/src/index.ts`
  - Re-export `triggerPreCompressHook` if CLI needs direct access (verify at implementation time)

- `packages/core/src/core/lifecycleHookTriggers.test.ts`
  - Add failing tests BEFORE implementing (TDD)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P02`

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R4.P02
 * @requirement REQ-P02-1
 */
```

## Verification Commands

```bash
# Check plan markers
grep -r "@plan PLAN-20250219-GMERGE021.R4.P02" . | wc -l
# Expected: 2+ occurrences

# Confirm function exists and is exported
grep -n "triggerPreCompressHook" \
  packages/core/src/core/lifecycleHookTriggers.ts \
  packages/core/src/hooks/index.ts

# Run tests
npm test -- --testPathPattern="lifecycleHookTriggers"
# Expected: All pass
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/core/src/core/lifecycleHookTriggers.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] `triggerPreCompressHook` follows the exact same guard pattern as `triggerSessionStartHook`
- [ ] Hook failure does NOT throw — returns `undefined`
- [ ] Trigger value is passed through to `firePreCompressEvent`
- [ ] Function is exported from `index.ts`
- [ ] Tests would fail if the catch-and-return-undefined behavior was removed

## Test Matrix for This Phase

5. `triggerPreCompressHook` with hooks disabled returns `undefined` (no-op)
6. `triggerPreCompressHook` with no hook system returns `undefined`
7. `triggerPreCompressHook` passes `trigger` value through to `firePreCompressEvent`
8. `triggerPreCompressHook` catches errors and returns `undefined` (fail-open)

## Success Criteria

- `triggerPreCompressHook` exists in `lifecycleHookTriggers.ts` and is exported
- All 4 tests pass
- No TODOs or stubs

## Failure Recovery

If this phase fails:
1. `git checkout -- packages/core/src/core/lifecycleHookTriggers.ts`
2. `git checkout -- packages/core/src/core/lifecycleHookTriggers.test.ts`
3. `git checkout -- packages/core/src/hooks/index.ts`
4. Re-run Phase P02

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

---

# Phase P03: Integrate PreCompress Hook in `performCompression`

## Phase ID

`PLAN-20250219-GMERGE021.R4.P03`

## Prerequisites

- Required: Phase P02 completed
- Verification: `grep -r "@plan PLAN-20250219-GMERGE021.R4.P02" .`
- Expected from P02: `triggerPreCompressHook` exported and tested
- Priority: HIGH

## Requirements Implemented

### REQ-P03-1: Hook Fires Before Compression

**Full Text**: `performCompression` must call `triggerPreCompressHook` with the correct trigger classification before executing compression logic, and compression must proceed even if the hook fails.

**Behavior**:
- GIVEN: Chat compression is triggered automatically (via `ensureCompressionBeforeSend`)
- WHEN: `performCompression` is called
- THEN: `triggerPreCompressHook(config, PreCompressTrigger.Auto)` is awaited before compression
- GIVEN: Chat compression is triggered via `/compress` command
- WHEN: `performCompression` is called with `PreCompressTrigger.Manual`
- THEN: `triggerPreCompressHook(config, PreCompressTrigger.Manual)` is awaited before compression

### REQ-P03-2: Trigger Classification

**Full Text**: The `trigger` parameter to `performCompression` defaults to `PreCompressTrigger.Auto`. Only `compressCommand` passes `PreCompressTrigger.Manual`.

**Behavior**:
- GIVEN: `ensureCompressionBeforeSend` or `enforceContextWindow` calls `performCompression`
- WHEN: No second argument is passed
- THEN: Trigger is `Auto`
- GIVEN: `/compress` slash command calls `performCompression`
- WHEN: `PreCompressTrigger.Manual` is passed as second argument
- THEN: Trigger is `Manual`

**Why This Matters**: Correct trigger classification lets users write hook scripts that distinguish interactive compression commands from automatic threshold-based compression.

## Implementation Tasks

### Compression entry points in `geminiChat.ts` (current state)

- Line 2078: `this.compressionPromise = this.performCompression(prompt_id)` — from `ensureCompressionBeforeSend` (auto)
- Line 2275: `await this.performCompression(promptId)` — from `enforceContextWindow` (auto)
- Line 2312: `performCompression` definition — also called from `compressCommand` (manual)

### Files to Modify

- `packages/core/src/core/geminiChat.ts`
  - Add optional `trigger: PreCompressTrigger = PreCompressTrigger.Auto` parameter to `performCompression(prompt_id: string, trigger?: PreCompressTrigger)`
  - After cooldown guard, call `await triggerPreCompressHook(this.runtimeContext.providerRuntime.config, trigger)` wrapped in try/catch (fail-open)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P03`

- `packages/cli/src/ui/commands/compressCommand.ts`
  - Pass `PreCompressTrigger.Manual` to `chat.performCompression(promptId, PreCompressTrigger.Manual)`
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P03`

- Test files for both (write failing tests first)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P03`

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R4.P03
 * @requirement REQ-P03-1
 * @requirement REQ-P03-2
 */
```

## Verification Commands

```bash
# Check plan markers
grep -r "@plan PLAN-20250219-GMERGE021.R4.P03" . | wc -l
# Expected: 3+ occurrences

# Confirm trigger param added
grep -n "performCompression" packages/core/src/core/geminiChat.ts

# Confirm compressCommand passes Manual
grep -n "PreCompressTrigger.Manual" packages/cli/src/ui/commands/compressCommand.ts

# Run tests
npm test -- --testPathPattern="geminiChat|compressCommand"
# Expected: All pass
```

### Semantic Verification Checklist

- [ ] `performCompression` signature now accepts optional `trigger` parameter
- [ ] Hook is called BEFORE compression logic (not after)
- [ ] Compression proceeds even when hook throws (fail-open verified by test)
- [ ] `compressCommand` passes `Manual`; all other callers use default `Auto`
- [ ] Adding optional param is backward-compatible (all existing callers still compile)

## Test Matrix for This Phase

22. `performCompression` calls `triggerPreCompressHook` before compression logic
23. `compressCommand` calls `performCompression` with `PreCompressTrigger.Manual`
24. `ensureCompressionBeforeSend` results in `performCompression` with `PreCompressTrigger.Auto`
25. Compression proceeds when `triggerPreCompressHook` throws
26. Compression still executes when no hooks are configured

## Success Criteria

- `performCompression` has optional `trigger` param defaulting to `Auto`
- Hook fires before compression in all paths
- `compressCommand` passes `Manual`
- All 5 tests pass

## Failure Recovery

If this phase fails:
1. `git checkout -- packages/core/src/core/geminiChat.ts`
2. `git checkout -- packages/cli/src/ui/commands/compressCommand.ts`
3. Re-run Phase P03

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase P04: Add `flushTelemetry` to Telemetry SDK

## Phase ID

`PLAN-20250219-GMERGE021.R4.P04`

## Prerequisites

- Required: Phase P00 completed (processors confirmed as local vars in `sdk.ts`)
- This phase is independent of P01–P03 and may proceed in parallel
- Priority: HIGH — blocks P05

## Requirements Implemented

### REQ-P04-1: Module-Level Processor Refs

**Full Text**: `spanProcessor` and `logProcessor` must be promoted from local variables inside `initializeTelemetry` to module-level `let` variables so that `flushTelemetry` and `shutdownTelemetry` can reference them.

**Behavior**:
- GIVEN: `initializeTelemetry()` has been called
- WHEN: Module-level `spanProcessor` and `logProcessor` refs are checked
- THEN: They reference the initialized processor instances

### REQ-P04-2: `flushTelemetry` Function

**Full Text**: A `flushTelemetry()` function must be exported that calls `forceFlush()` on both processors using `Promise.allSettled` so that one failure does not abort the other. Before init or after shutdown, it is a no-op.

**Behavior**:
- GIVEN: Telemetry is initialized
- WHEN: `flushTelemetry()` is called
- THEN: Both `spanProcessor.forceFlush()` and `logProcessor.forceFlush()` are called
- GIVEN: One `forceFlush()` rejects
- WHEN: `flushTelemetry()` is called
- THEN: The other `forceFlush()` still runs (`allSettled`, not `all`)
- GIVEN: `flushTelemetry()` is called before init or after shutdown
- THEN: Returns immediately without throwing (no-op)

**Why This Matters**: Without `flushTelemetry`, hook execution side-effects (e.g., file writes by hook scripts) may be lost if the process exits before telemetry processors drain their queues.

**Note on signature**: Upstream uses `flushTelemetry(config: Config)` but config is not needed since processors are module-level. Use the simpler no-arg signature; accept config as optional if needed for debug logging.

## Implementation Tasks

### Files to Modify

- `packages/core/src/telemetry/sdk.ts`
  - Promote `spanProcessor` and `logProcessor` to module-level `let` variables
  - Assign them inside `initializeTelemetry` (replacing `const` declarations)
  - In `shutdownTelemetry`, set both to `undefined` in the `finally` block alongside `telemetryInitialized = false`
  - Add `flushTelemetry()` using `Promise.allSettled`
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P04`

- `packages/core/src/telemetry/index.ts`
  - Export `flushTelemetry`

- Test file for sdk.ts (write failing tests first)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P04`

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R4.P04
 * @requirement REQ-P04-1
 * @requirement REQ-P04-2
 */
```

### Implementation Shape

```typescript
let spanProcessor: BatchSpanProcessor | undefined;
let logProcessor: BatchLogRecordProcessor | undefined;

export async function flushTelemetry(): Promise<void> {
  if (!spanProcessor || !logProcessor) return;
  await Promise.allSettled([
    spanProcessor.forceFlush(),
    logProcessor.forceFlush(),
  ]);
}
```

## Verification Commands

```bash
# Check plan markers
grep -r "@plan PLAN-20250219-GMERGE021.R4.P04" . | wc -l
# Expected: 3+ occurrences

# Confirm module-level declarations
grep -n "^let spanProcessor\|^let logProcessor" packages/core/src/telemetry/sdk.ts

# Confirm export
grep -n "flushTelemetry" packages/core/src/telemetry/index.ts

# Run tests
npm test -- --testPathPattern="telemetry"
# Expected: All pass
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/core/src/telemetry/sdk.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] Processor vars are module-level `let` (not inside function)
- [ ] `shutdownTelemetry` sets both refs to `undefined`
- [ ] `flushTelemetry` uses `Promise.allSettled` (not `Promise.all`)
- [ ] Pre-init no-op: `flushTelemetry()` returns without throwing when called before `initializeTelemetry`
- [ ] Post-shutdown no-op: `flushTelemetry()` returns without throwing after `shutdownTelemetry`
- [ ] Tests that call `initializeTelemetry` are updated to call `shutdownTelemetry` (or reset helper) to avoid stale-ref leaks between test cycles

## Test Matrix for This Phase

9.  `flushTelemetry()` before `initializeTelemetry()` resolves without throwing
10. `flushTelemetry()` after `shutdownTelemetry()` resolves without throwing
11. `flushTelemetry()` calls `forceFlush()` on both span and log processors
12. If `spanProcessor.forceFlush()` rejects, `logProcessor.forceFlush()` still runs
13. `shutdownTelemetry()` sets processor refs to `undefined`
14. Calling `initializeTelemetry()` twice only creates one SDK (guarded by `telemetryInitialized`)

## Success Criteria

- `flushTelemetry` exported from `packages/core/src/telemetry/index.ts`
- `spanProcessor` and `logProcessor` are module-level
- `shutdownTelemetry` clears both refs
- All 6 tests pass

## Failure Recovery

If this phase fails:
1. `git checkout -- packages/core/src/telemetry/sdk.ts`
2. `git checkout -- packages/core/src/telemetry/index.ts`
3. Re-run Phase P04

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

---

# Phase P05: Update clearCommand to Fire Session Lifecycle Hooks

## Phase ID

`PLAN-20250219-GMERGE021.R4.P05`

## Prerequisites

- Required: Phase P04 completed (`flushTelemetry` available)
- Required: `triggerSessionEndHook`, `triggerSessionStartHook` already available (pre-existing)
- Verification: `grep -r "@plan PLAN-20250219-GMERGE021.R4.P04" .`
- Priority: HIGH

## Requirements Implemented

### REQ-P05-1: SessionEnd Before Clear

**Full Text**: `/clear` must fire `triggerSessionEndHook(config, SessionEndReason.Clear)` before any state mutation (before `resetChat()`).

**Behavior**:
- GIVEN: User runs `/clear` and hooks are configured
- WHEN: The clear command executes
- THEN: `SessionEnd(clear)` fires before `resetChat()` is called

### REQ-P05-2: SessionStart After Clear

**Full Text**: `/clear` must fire `triggerSessionStartHook(config, SessionStartSource.Clear)` after all state has been reset.

**Behavior**:
- GIVEN: User runs `/clear` and hooks are configured
- WHEN: The clear command executes
- THEN: `SessionStart(clear)` fires after `resetChat()` and all state reset

### REQ-P05-3: flushTelemetry After Clear Hooks

**Full Text**: `/clear` must call `flushTelemetry()` after `triggerSessionStartHook` to ensure hook side-effects are durable before the new session begins.

### REQ-P05-4: Null Config Safety

**Full Text**: If `context.services.config` is null, `/clear` must complete without error — no hooks fired, no telemetry flush.

**Why This Matters**: The `/clear` command resets the entire conversation state; hook integrations need to observe this lifecycle boundary to perform session-scoped operations (e.g., logging session summaries).

## Implementation Tasks

### Files to Modify

- `packages/cli/src/ui/commands/clearCommand.ts`
  - Import `triggerSessionEndHook`, `triggerSessionStartHook`, `SessionEndReason`, `SessionStartSource`, `flushTelemetry` from `@vybestack/llxprt-code-core`
  - Retrieve `config` from `context.services.config` with null guard
  - Insert hook sequence: SessionEnd → existing clear logic → SessionStart → flushTelemetry
  - Wrap all hook calls in try/catch for fail-open behavior
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P05`

- `packages/cli/src/ui/commands/clearCommand.test.ts` (or equivalent)
  - Add failing tests BEFORE implementing (TDD)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P05`

### Implementation Shape

```typescript
const config = context.services.config;
if (config) {
  await triggerSessionEndHook(config, SessionEndReason.Clear);
}
// existing clear logic (resetChat, updateHistoryTokenCount, clear, etc.) — UNCHANGED
if (config) {
  await triggerSessionStartHook(config, SessionStartSource.Clear);
  await flushTelemetry();
}
```

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R4.P05
 * @requirement REQ-P05-1
 * @requirement REQ-P05-2
 * @requirement REQ-P05-3
 * @requirement REQ-P05-4
 */
```

## Verification Commands

```bash
# Check plan markers
grep -r "@plan PLAN-20250219-GMERGE021.R4.P05" . | wc -l
# Expected: 2+ occurrences

# Confirm import added
grep -n "triggerSessionEndHook\|flushTelemetry" packages/cli/src/ui/commands/clearCommand.ts

# Confirm ordering: SessionEnd before clear, SessionStart after
grep -n "triggerSessionEnd\|resetChat\|triggerSessionStart\|flushTelemetry" \
  packages/cli/src/ui/commands/clearCommand.ts

# Run tests
npm test -- --testPathPattern="clearCommand"
# Expected: All pass
```

### Semantic Verification Checklist

- [ ] `SessionEnd(clear)` fires BEFORE any state mutation (ordering confirmed by reading file)
- [ ] `SessionStart(clear)` fires AFTER all state has been reset
- [ ] `flushTelemetry()` is called last (after SessionStart)
- [ ] All hook calls are fail-open (wrapped in try/catch or the trigger functions handle errors)
- [ ] Null config → no hooks, no flush, clear still works
- [ ] `/clear` with throwing hook still resets state

## Test Matrix for This Phase

15. `/clear` with hooks enabled fires `triggerSessionEndHook(config, 'clear')` before `resetChat()`
16. `/clear` with hooks enabled fires `triggerSessionStartHook(config, 'clear')` after `resetChat()`
17. `/clear` fires `flushTelemetry()` after `triggerSessionStartHook`
18. `/clear` with null config completes without error (no hooks, no telemetry flush)
19. `/clear` still resets state when `triggerSessionEndHook` throws
20. `/clear` still resets state when `triggerSessionStartHook` throws
21. `/clear` still resets state when `flushTelemetry` throws

## Success Criteria

- All 7 tests pass
- Ordering of hooks relative to state mutation verified
- No TODOs or stubs

## Failure Recovery

If this phase fails:
1. `git checkout -- packages/cli/src/ui/commands/clearCommand.ts`
2. Re-run Phase P05

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

---

# Phase P06: Add Telemetry Shutdown to CLI Cleanup

## Phase ID

`PLAN-20250219-GMERGE021.R4.P06`

## Prerequisites

- Required: Phase P04 completed (`flushTelemetry`, `isTelemetrySdkInitialized`, `shutdownTelemetry` available)
- Verification: `grep -r "@plan PLAN-20250219-GMERGE021.R4.P04" .`
- Priority: MEDIUM

## Requirements Implemented

### REQ-P06-1: `registerTelemetryConfig` in cleanup.ts

**Full Text**: `cleanup.ts` must expose `registerTelemetryConfig(config: Config)` so that the CLI can register the config needed for telemetry shutdown.

**Behavior**:
- GIVEN: `registerTelemetryConfig(config)` is called at app startup
- WHEN: `runExitCleanup()` is called
- THEN: `shutdownTelemetry(config)` is called if telemetry is initialized

### REQ-P06-2: Telemetry Shutdown After Other Cleanup

**Full Text**: `runExitCleanup` must call `shutdownTelemetry` AFTER all other registered cleanup functions complete, so that spans emitted during cleanup are captured.

**Behavior**:
- GIVEN: Registered cleanup functions emit telemetry spans
- WHEN: `runExitCleanup()` runs
- THEN: All cleanup functions run first, then `shutdownTelemetry` runs last
- GIVEN: `shutdownTelemetry` throws
- WHEN: `runExitCleanup()` runs
- THEN: The error is swallowed; other cleanup functions are unaffected

### REQ-P06-3: Wire `registerTelemetryConfig` at App Startup

**Full Text**: `gemini.tsx` (or `AppContainer.tsx`) must call `registerTelemetryConfig(config)` after config is initialized.

**Why This Matters**: Without registering telemetry config at exit, any pending spans from the final session are lost. Telemetry shutdown runs last to maximize span capture.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/utils/cleanup.ts`
  - Add `let telemetryConfig: Config | undefined` at module level
  - Add `export function registerTelemetryConfig(config: Config): void { telemetryConfig = config; }`
  - In `runExitCleanup`, after existing cleanup loops, add telemetry shutdown block
  - In `__resetCleanupStateForTesting`, also reset `telemetryConfig = undefined`
  - Import `Config` from core, `isTelemetrySdkInitialized`, `shutdownTelemetry` from `@vybestack/llxprt-code-core`
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P06`

- `packages/cli/src/gemini.tsx` (or `AppContainer.tsx`)
  - Call `registerTelemetryConfig(config)` after config initialization
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P06`

- Test file for cleanup.ts (write failing tests first)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P06`

### Telemetry Shutdown Block Shape

```typescript
if (telemetryConfig && isTelemetrySdkInitialized()) {
  try {
    await shutdownTelemetry(telemetryConfig);
  } catch (_) {
    // Ignore errors during telemetry shutdown
  }
}
```

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R4.P06
 * @requirement REQ-P06-1
 * @requirement REQ-P06-2
 */
```

## Verification Commands

```bash
# Check plan markers
grep -r "@plan PLAN-20250219-GMERGE021.R4.P06" . | wc -l
# Expected: 3+ occurrences

# Confirm registerTelemetryConfig exists and is exported
grep -n "registerTelemetryConfig" packages/cli/src/utils/cleanup.ts

# Confirm it's called at startup
grep -n "registerTelemetryConfig" packages/cli/src/gemini.tsx packages/cli/src/ui/AppContainer.tsx

# Run tests
npm test -- --testPathPattern="cleanup"
# Expected: All pass
```

### Semantic Verification Checklist

- [ ] `registerTelemetryConfig` is exported from `cleanup.ts`
- [ ] Telemetry shutdown runs AFTER all other cleanup functions
- [ ] Telemetry shutdown failure does NOT propagate (swallowed)
- [ ] `__resetCleanupStateForTesting` resets `telemetryConfig`
- [ ] `registerTelemetryConfig` is called at app startup (verify by reading call site)

## Test Matrix for This Phase

27. `runExitCleanup` calls `shutdownTelemetry` exactly once when config registered and telemetry initialized
28. `runExitCleanup` does not call `shutdownTelemetry` when no config registered
29. `runExitCleanup` does not call `shutdownTelemetry` when `isTelemetrySdkInitialized()` returns false
30. `shutdownTelemetry` failure in cleanup does not prevent other cleanup functions from running
31. `__resetCleanupStateForTesting` resets `telemetryConfig` to `undefined`

## Success Criteria

- `registerTelemetryConfig` exported and wired at startup
- Telemetry shutdown runs last in `runExitCleanup`
- All 5 tests pass

## Failure Recovery

If this phase fails:
1. `git checkout -- packages/cli/src/utils/cleanup.ts`
2. Revert the `registerTelemetryConfig` call from `gemini.tsx` / `AppContainer.tsx`
3. Re-run Phase P06

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P06.md`

---

# Phase P07: Verify/Wire SessionStart in Interactive AppContainer

## Phase ID

`PLAN-20250219-GMERGE021.R4.P07`

## Prerequisites

- Required: Phases P01–P06 completed
- Verification: All previous phase markers present in codebase
- Priority: MEDIUM

## Requirements Implemented

### REQ-P07-1: SessionStart in Interactive AppContainer Init

**Full Text**: The interactive `AppContainer` initialization path must fire `SessionStart` exactly once. `gemini.tsx` fires `SessionStart(Startup)` for all paths; `AppContainer.tsx` must not double-fire it, but must fire `SessionStart(Resume)` for the resume/restore path if not already covered.

**Behavior**:
- GIVEN: Interactive session starts
- WHEN: `AppContainer` initializes
- THEN: `SessionStart` fires exactly once (not duplicated between `gemini.tsx` and `AppContainer.tsx`)
- GIVEN: Session is restored (not fresh startup)
- WHEN: `AppContainer` initializes
- THEN: `SessionStart(Resume)` fires, not `SessionStart(Startup)`

**Why This Matters**: Double-firing session hooks would confuse user hook scripts that track session counts or write per-session files.

## Implementation Tasks

### Audit First

Before writing code, run:

```bash
# Confirm current state of SessionStart calls
grep -n "triggerSessionStart" \
  packages/cli/src/gemini.tsx \
  packages/cli/src/ui/AppContainer.tsx
```

Determine:
- Does `AppContainer.tsx` currently fire `SessionStart` anywhere?
- Is there a resume path in `AppContainer.tsx` that is NOT covered by `gemini.tsx` line 1254?

### Conditional Implementation

- If `AppContainer.tsx` resume path is NOT covered by `gemini.tsx`: add `triggerSessionStartHook(config, SessionStartSource.Resume)` in the AppContainer initialization effect
- If it IS already covered: document this and add a test proving no double-fire
- Either way, write a test first

### Files to Modify (Conditional)

- `packages/cli/src/ui/AppContainer.tsx` (if resume path needs wiring)
  - Import `triggerSessionStartHook` if not already imported
  - Add call in initialization effect (where config becomes available)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P07`

- Test file (write failing tests first)
  - ADD marker: `@plan PLAN-20250219-GMERGE021.R4.P07`

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R4.P07
 * @requirement REQ-P07-1
 */
```

## Verification Commands

```bash
# Check plan markers
grep -r "@plan PLAN-20250219-GMERGE021.R4.P07" . | wc -l
# Expected: 2+ occurrences

# Confirm SessionStart call sites (should be exactly the right number)
grep -rn "triggerSessionStart" packages/cli/src/

# Run tests
npm test -- --testPathPattern="AppContainer"
# Expected: All pass
```

### Semantic Verification Checklist

- [ ] Audit result documented (resume path covered or not)
- [ ] `SessionStart` fires exactly once on startup (test proves no double-fire)
- [ ] `SessionStart(Resume)` fires for restore path, not `SessionStart(Startup)`
- [ ] No double-fire on any code path (startup, resume, clear)

## Test Matrix for This Phase

32. `SessionStart` fires exactly once on startup (not duplicated between `gemini.tsx` and `AppContainer.tsx`)
33. `SessionEnd(exit)` fires exactly once on normal exit
34. No duplicate SessionStart/SessionEnd on `/clear` (clear path emits exactly one End and one Start)
35. Existing startup/shutdown behavior unchanged in non-interactive mode
36. Session restore fires `SessionStart(Resume)` not `SessionStart(Startup)`

## Success Criteria

- Audit result documented
- All 5 lifecycle ordering/regression tests pass
- No double-firing of any session hook event

## Failure Recovery

If this phase fails:
1. `git checkout -- packages/cli/src/ui/AppContainer.tsx`
2. Re-run Phase P07

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P07.md`

---

## Complete Test Matrix Reference

All 36 tests across all phases (TDD order: write failing test → implement → pass):

### hookEventHandler.test.ts (P01)
1. `firePreCompressEvent` dispatches with `hookEventName: 'PreCompress'`
2. `firePreCompressEvent` passes `trigger: 'manual'` when `Manual` is given
3. `firePreCompressEvent` passes `trigger: 'auto'` when `Auto` is given
4. `firePreCompressEvent` returns failure envelope (not throw) on hook runner error

### lifecycleHookTriggers.test.ts (P02)
5. `triggerPreCompressHook` with hooks disabled returns `undefined` (no-op)
6. `triggerPreCompressHook` with no hook system returns `undefined`
7. `triggerPreCompressHook` passes `trigger` value through to `firePreCompressEvent`
8. `triggerPreCompressHook` catches errors and returns `undefined` (fail-open)

### telemetry/sdk.test.ts (P04)
9.  `flushTelemetry()` before `initializeTelemetry()` resolves without throwing
10. `flushTelemetry()` after `shutdownTelemetry()` resolves without throwing
11. `flushTelemetry()` calls `forceFlush()` on both span and log processors
12. If `spanProcessor.forceFlush()` rejects, `logProcessor.forceFlush()` still runs
13. `shutdownTelemetry()` sets processor refs to `undefined`
14. Calling `initializeTelemetry()` twice only creates one SDK

### clearCommand.test.ts (P05)
15. `/clear` fires `triggerSessionEndHook(config, 'clear')` before `resetChat()`
16. `/clear` fires `triggerSessionStartHook(config, 'clear')` after `resetChat()`
17. `/clear` fires `flushTelemetry()` after `triggerSessionStartHook`
18. `/clear` with null config completes without error
19. `/clear` still resets state when `triggerSessionEndHook` throws
20. `/clear` still resets state when `triggerSessionStartHook` throws
21. `/clear` still resets state when `flushTelemetry` throws

### geminiChat / compressCommand tests (P03)
22. `performCompression` calls `triggerPreCompressHook` before compression logic
23. `compressCommand` calls `performCompression` with `PreCompressTrigger.Manual`
24. `ensureCompressionBeforeSend` results in `performCompression` with `PreCompressTrigger.Auto`
25. Compression proceeds when `triggerPreCompressHook` throws
26. Compression still executes when no hooks are configured

### cleanup.test.ts (P06)
27. `runExitCleanup` calls `shutdownTelemetry` exactly once when config registered and telemetry initialized
28. `runExitCleanup` does not call `shutdownTelemetry` when no config registered
29. `runExitCleanup` does not call `shutdownTelemetry` when `isTelemetrySdkInitialized()` is false
30. `shutdownTelemetry` failure does not prevent other cleanup from completing
31. `__resetCleanupStateForTesting` resets `telemetryConfig`

### Lifecycle ordering / regression (P07)
32. `SessionStart` fires exactly once on startup
33. `SessionEnd(exit)` fires exactly once on normal exit
34. No duplicate SessionStart/SessionEnd on `/clear`
35. Startup/shutdown behavior unchanged in non-interactive mode
36. Session restore fires `SessionStart(Resume)` not `SessionStart(Startup)`

---

## Files to Modify — Summary

| File | Change | Phase |
|------|--------|-------|
| `packages/core/src/hooks/hookEventHandler.ts` | Add `firePreCompressEvent` method | P01 |
| `packages/core/src/core/lifecycleHookTriggers.ts` | Add `triggerPreCompressHook` | P02 |
| `packages/core/src/hooks/index.ts` | Export `triggerPreCompressHook` | P02 |
| `packages/core/src/index.ts` | Re-export if needed for CLI access | P02 |
| `packages/core/src/core/geminiChat.ts` | Add `trigger` param to `performCompression`, call `triggerPreCompressHook` | P03 |
| `packages/cli/src/ui/commands/compressCommand.ts` | Pass `PreCompressTrigger.Manual` to `performCompression` | P03 |
| `packages/core/src/telemetry/sdk.ts` | Module-level processor refs, add `flushTelemetry` | P04 |
| `packages/core/src/telemetry/index.ts` | Export `flushTelemetry` | P04 |
| `packages/cli/src/ui/commands/clearCommand.ts` | Add SessionEnd/Start hooks and `flushTelemetry` | P05 |
| `packages/cli/src/utils/cleanup.ts` | Add `registerTelemetryConfig`, telemetry shutdown in `runExitCleanup` | P06 |
| `packages/cli/src/gemini.tsx` | Call `registerTelemetryConfig(config)` after init | P06 |
| `packages/cli/src/ui/AppContainer.tsx` | Verify/add SessionStart on interactive init | P07 |

---

## Potential Breaking Changes

1. **`flushTelemetry` export** — New public API on `packages/core/src/telemetry/index.ts`. Additive only; no existing consumers.
2. **`performCompression` signature** — Adding optional second parameter is backward-compatible. No external callers.
3. **`/clear` latency** — Clear now awaits two hook calls and a telemetry flush. If no hooks configured, guard returns immediately. If telemetry not initialized, `flushTelemetry` is a no-op.
4. **Telemetry shutdown ordering** — Moving shutdown to `runExitCleanup` means shutdown happens after all other cleanup functions. Spans emitted during cleanup are now more likely to be flushed. Improvement, not regression.
5. **Module-level telemetry processor refs** — Tests that call `initializeTelemetry` without a matching `shutdownTelemetry` will leak processor state. Tests must call `shutdownTelemetry` or a `__resetTelemetryStateForTesting` helper after each telemetry test.
6. **New hook events trigger user scripts** — Users with hook scripts for `SessionStart`/`SessionEnd` will now see these fire on `/clear`. Users may see `PreCompress` fire. Intentional behavior — note in release notes.

---

## No New External Dependencies Required

All infrastructure (types, hookEventHandler fire methods for other events, lifecycle trigger pattern, OpenTelemetry processor APIs) is already present. This implementation adds only new functions and wiring using existing patterns.
