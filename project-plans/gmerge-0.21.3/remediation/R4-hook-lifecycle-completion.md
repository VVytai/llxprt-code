# Remediation Plan: R4 — Lifecycle Hook Wiring Completion + Telemetry Flush API

**Priority:** P1 (fix before next release)
**Estimated Effort:** 6-10 hours
**Root Cause:** Lifecycle trigger helpers exist (`triggerPreCompressHook`, `triggerSessionEndHook`, `triggerSessionStartHook`), but key call sites are incomplete (`geminiChat` compression path and `/clear` command path). Telemetry only exposes `shutdownTelemetry`; there is no non-shutdown flush API.

**Telemetry context:** This repo uses local OpenTelemetry (file/console exporters) with batch processors/readers. A targeted flush API remains useful at lifecycle boundaries for deterministic delivery.

---

## Review Status

Round 1 (deepthinker): APPROVE_WITH_CHANGES — applied.
Round 2 (deepthinker + typescriptexpert): APPROVE_WITH_CHANGES — applied below.

---

## Scope

1. Wire `triggerPreCompressHook` into `performCompression()` with `PreCompressTrigger` parameter.
2. Wire `triggerSessionEndHook` / `triggerSessionStartHook` into clearCommand with explicit ordering.
3. Add `resolveForegroundConfig()` helper in clearCommand (parallel to existing `resolveForegroundGeminiClient()`).
4. Implement `flushTelemetry()` with concurrent-call guard in telemetry SDK.
5. Add tests for all wiring points including ordering and fail-open behavior.

---

## Hook Ordering Contract (clear command)

```
1. setDebugMessage
2. triggerSessionEndHook(config, SessionEndReason.Clear)
3. geminiClient.resetChat()
4. triggerSessionStartHook(config, SessionStartSource.Clear)
5. resetTelemetry counters
6. updateHistoryTokenCount
7. ui.clear()
```

Steps 2-4 require config; steps 5-7 execute regardless.

---

## TDD Sequence

### Test Group A: PreCompress hook wiring (RED then GREEN)

**File(s):** existing compression tests and/or `geminiChat.contextlimit.test.ts`

1. PreCompress fires when compression actually proceeds
   - Assert `triggerPreCompressHook` called with config and `PreCompressTrigger.Auto`
2. PreCompress uses `PreCompressTrigger.Manual` when triggered from `/compress` command
3. PreCompress NOT called when compression short-circuits (cooldown, empty history, under threshold)
4. PreCompress failure does not block compression (fail-open)
   - Mock hook to throw; compression still completes

### Test Group B: /clear lifecycle ordering (RED then GREEN)

**File:** `packages/cli/src/ui/commands/clearCommand.test.ts`

1. `/clear` with config:
   - SessionEnd(Clear) fires before `resetChat()`
   - SessionStart(Clear) fires after `resetChat()`
   - Telemetry/UI clear still happens after hooks
   - Update existing ordering assertions to include hook call positions

2. `/clear` when hooks throw:
   - command still completes (fail-open)
   - SessionStart still called even if SessionEnd throws

3. `/clear` without available config/runtime:
   - no hook trigger attempted (no crash)
   - UI clear and telemetry reset still happen

### Test Group C: telemetry flush API (RED then GREEN)

**File:** `packages/core/src/telemetry/telemetry.test.ts`

1. `flushTelemetry()` calls SDK `forceFlush()` when available (feature-detected)
2. `flushTelemetry()` no-ops when SDK not initialized
3. concurrent calls share one in-flight promise
4. flush failures are swallowed/logged (non-fatal)

---

## Implementation Steps

### Step 1: Add trigger parameter to performCompression

**File:** `packages/core/src/core/geminiChat.ts`

```typescript
import {
  triggerPreCompressHook,
} from './lifecycleHookTriggers.js';
import { PreCompressTrigger } from '../hooks/types.js';

async performCompression(
  prompt_id: string,
  trigger: PreCompressTrigger = PreCompressTrigger.Auto,
): Promise<void> {
  if (this.isCompressionInCooldown()) return;

  // Fire hook after deciding compression will proceed, before actual work
  await triggerPreCompressHook(this.runtimeContext.config, trigger);

  // ... existing compression logic (fail-open: hook errors caught by wrapper)
}
```

### Step 2: Update compressCommand to pass Manual trigger

**File:** `packages/cli/src/ui/commands/compressCommand.ts`

```typescript
await chat.performCompression(promptId, PreCompressTrigger.Manual);
```

### Step 3: Add resolveForegroundConfig helper and wire hooks in clearCommand

**File:** `packages/cli/src/ui/commands/clearCommand.ts`

```typescript
import {
  triggerSessionEndHook,
  triggerSessionStartHook,
} from '@vybestack/llxprt-code-core';
import { SessionEndReason, SessionStartSource } from '@vybestack/llxprt-code-core';

function resolveForegroundConfig(context: CommandContext): Config | null {
  if (context.services.config) {
    return context.services.config;
  }
  try {
    return getCliRuntimeServices().config;
  } catch {
    return null;
  }
}

// In action handler:
const config = resolveForegroundConfig(context);
const geminiClient = resolveForegroundGeminiClient(context);

if (config && geminiClient) {
  context.ui.setDebugMessage('Clearing terminal and resetting chat.');
  await triggerSessionEndHook(config, SessionEndReason.Clear);
  await geminiClient.resetChat();
  await triggerSessionStartHook(config, SessionStartSource.Clear);
} else {
  context.ui.setDebugMessage('Clearing terminal.');
}

// Always (regardless of config availability):
uiTelemetryService.setLastPromptTokenCount(0);
context.ui.updateHistoryTokenCount(0);
context.ui.clear();
```

### Step 4: Implement flushTelemetry

**File:** `packages/core/src/telemetry/sdk.ts`

```typescript
let flushInProgress: Promise<void> | null = null;

export async function flushTelemetry(): Promise<void> {
  if (!sdk) return;
  if (flushInProgress) return flushInProgress;

  flushInProgress = (async () => {
    try {
      if (sdk && 'forceFlush' in sdk && typeof sdk.forceFlush === 'function') {
        await sdk.forceFlush();
      }
    } catch (error) {
      console.warn('Telemetry flush failed:', error);
    } finally {
      flushInProgress = null;
    }
  })();

  return flushInProgress;
}
```

Export via `packages/core/src/telemetry/index.ts`.

---

## Verification

```bash
npm run test -- packages/core/src/core/geminiChat.contextlimit.test.ts
npm run test -- packages/cli/src/ui/commands/clearCommand.test.ts
npm run test -- packages/cli/src/ui/commands/compressCommand.test.ts
npm run test -- packages/core/src/telemetry/telemetry.test.ts
npm run typecheck
npm run lint
npm run format
npm run build
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Hook invocation at wrong compression boundary | No-op path tests ensure hooks skip short-circuit cases |
| Clear flow regressions from ordering changes | Extend existing ordering assertions in clearCommand.test.ts |
| ForceFlush API differences across SDK versions | Feature-detect method presence; safe no-op fallback |
| Hook failures masking main behavior | Strict fail-open with dedicated warning logging |
| performCompression signature change breaks callers | Default parameter (`Auto`) makes change backward-compatible |

---

## Done Criteria

- [ ] PreCompress hook wired into `performCompression` with `PreCompressTrigger` parameter
- [ ] `PreCompressTrigger.Manual` passed from `/compress` command
- [ ] PreCompress not invoked on compression no-op/cooldown paths
- [ ] `resolveForegroundConfig()` helper added to clearCommand
- [ ] `/clear` triggers SessionEnd(Clear) before reset and SessionStart(Clear) after reset
- [ ] `/clear` ordering assertions updated in existing tests
- [ ] `/clear` remains fail-open if hooks error or config unavailable
- [ ] `flushTelemetry()` exists, is exported via telemetry barrel, and is concurrency-safe
- [ ] `flushTelemetry()` no-ops when SDK uninitialized and does not throw fatally
- [ ] Full verification sequence passes
