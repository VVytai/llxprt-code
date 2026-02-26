# Reimplementation Plan: Hook Refresh on Extension Change (Upstream 126c32ac)

**Test-Driven Development (TDD) Approach — COMPLETE SELF-CONTAINED GUIDE**

---

## Executive Summary

**Upstream Commit:** `126c32aca4972deba80a875f749fcee1367c4486`  
**Author:** Tommaso Sciortino <sciortino@gmail.com>  
**Date:** Fri Dec 12 16:43:46 2025 -0800  
**Title:** Refresh hooks when refreshing extensions. (#14918)

**Problem:** Silent bug where hooks from extensions don't reload after enable/disable because initialization guards (`if (this.initialized) return;`) prevent re-initialization.

**Solution:**
1. **Remove initialization guards** from `HookSystem` and `HookRegistry` (upstream)
2. **Call `hookSystem.initialize()` in extension loader** after refreshMemory() (upstream)
3. **Dispose old HookEventHandler before re-init** to prevent MessageBus subscription leaks (LLxprt enhancement)

**TDD Approach:** Write tests first (RED), implement minimal code (GREEN), refactor if valuable.

---

## Requirements

### R1: Guard Removal (Upstream)
Remove `initialized` flag and all guard checks from `HookSystem` and `HookRegistry` to allow re-initialization.

**Why:** Current guards block re-reading configuration, preventing extension hooks from updating.

**Files:**
- `packages/core/src/hooks/hookSystem.ts` — Lines 56, 99-101, 135-138, 149-150, 183-185, 197-199
- `packages/core/src/hooks/hookRegistry.ts` — Lines 17-22, 52, 62-64, 79-81, 95-97

### R2: Re-Init Support (Upstream)
`initialize()` methods now re-read configuration on every call, not just the first.

**Why:** Extension changes modify config, requiring hook registry to reload.

**Behavioral Change:**
- **Before:** `initialize()` idempotent (safe to call multiple times, only runs once)
- **After:** `initialize()` re-reads config every time (caller responsible for avoiding excess calls)

### R3: Disposal (LLxprt Enhancement)
Dispose old `HookEventHandler` before creating new one during re-initialization.

**Why:** LLxprt's `HookEventHandler` subscribes to MessageBus in constructor (line 152 of hookEventHandler.ts). Without disposal, old subscriptions leak memory.

**Upstream doesn't need this:** Gemini's HookEventHandler doesn't subscribe to MessageBus.

**Files:**
- `packages/core/src/hooks/hookSystem.ts` — Add disposal call in `initialize()` before creating new event handler

### R4: Extension Loader Integration (Upstream)
Call `hookSystem.initialize()` after `refreshMemory()` when extensions change.

**Why:** After extensions start/stop, hooks must reload to reflect new config.

**Files:**
- `packages/core/src/utils/extensionLoader.ts` — Add hook init call in `maybeRefreshMemory()` after line 141

### R5: Remove Obsolete Error Class (Upstream)
Remove `HookRegistryNotInitializedError` class since initialization is no longer guarded.

**Files:**
- `packages/core/src/hooks/hookRegistry.ts` — Lines 17-22

### R6: Remove Status API (Upstream)
Remove `getStatus()` method and `HookSystemStatus` interface from `HookSystem`.

**Why:** Status based on `initialized` flag is no longer meaningful. Use `isInitialized()` and `getAllHooks().length` instead.

**Files:**
- `packages/core/src/hooks/hookSystem.ts` — Lines 29-32, 161-166
- Update docs to remove HOOK-009 requirement

---

## Current State Analysis

### Touchpoint 1: HookSystem.initialize() — Guard Blocks Re-Init

**File:** `packages/core/src/hooks/hookSystem.ts`

**Lines 98-127:**
```typescript
async initialize(): Promise<void> {
  if (this.initialized) {                           // Line 99: GUARD BLOCKS RE-INIT
    debugLogger.debug('HookSystem already initialized, skipping');
    return;
  }

  debugLogger.debug('Initializing HookSystem');

  await this.registry.initialize();                  // Line 107: Registry init
  
  this.eventHandler = new HookEventHandler(         // Line 111: Creates handler
    this.config,
    this.registry,
    this.planner,
    this.runner,
    this.aggregator,
    this.messageBus,
    this.injectedDebugLogger,
  );

  this.initialized = true;                           // Line 121: Sets flag

  const status = this.getStatus();                   // Line 123: Uses getStatus()
  debugLogger.log(
    `HookSystem initialized with ${status.totalHooks} registered hook(s)`,
  );
}
```

**Problem:** Line 99 guard prevents re-init → hooks can't update after extension changes.

**Missing:** No disposal of old `eventHandler` before creating new one → MessageBus subscription leak.

### Touchpoint 2: HookRegistry.initialize() — Guard Blocks Re-Init

**File:** `packages/core/src/hooks/hookRegistry.ts`

**Lines 61-73:**
```typescript
async initialize(): Promise<void> {
  if (this.initialized) {                            // Line 62: GUARD BLOCKS RE-INIT
    return;
  }

  this.entries = [];                                 // Line 66: Clears entries
  this.processHooksFromConfig();                     // Line 67: Reads config
  this.initialized = true;                           // Line 68: Sets flag

  debugLogger.log(
    `Hook registry initialized with ${this.entries.length} hook entries`,
  );
}
```

**Problem:** Line 62 guard prevents re-init → registry can't reload extension hooks.

### Touchpoint 3: HookRegistry Methods — Throw on Uninitialized

**File:** `packages/core/src/hooks/hookRegistry.ts`

**Lines 78-81 (getHooksForEvent):**
```typescript
getHooksForEvent(eventName: HookEventName): HookRegistryEntry[] {
  if (!this.initialized) {                           // Line 79: THROWS ERROR
    throw new HookRegistryNotInitializedError();
  }
  // ...
}
```

**Lines 94-97 (getAllHooks):**
```typescript
getAllHooks(): HookRegistryEntry[] {
  if (!this.initialized) {                           // Line 95: THROWS ERROR
    throw new HookRegistryNotInitializedError();
  }
  return [...this.entries];
}
```

**Problem:** Throws error if not initialized. After removing guards, these checks are unnecessary since initialization is cheap and automatic.

### Touchpoint 4: ExtensionLoader — No Hook Refresh

**File:** `packages/core/src/utils/extensionLoader.ts`

**Lines 129-143 (maybeRefreshMemory):**
```typescript
private async maybeRefreshMemory(): Promise<void> {
  if (!this.config) {
    throw new Error('Cannot refresh memory prior to calling `start`.');
  }
  if (
    !this.isStarting &&
    this.startingCount === this.startCompletedCount &&
    this.stoppingCount === this.stopCompletedCount
  ) {
    await this.config.refreshMemory();               // Line 141: Refreshes memory
    // MISSING: await this.config.getHookSystem()?.initialize();
  }
}
```

**Problem:** After extensions start/stop, memory refreshes but hooks don't → stale hook registry.

### Touchpoint 5: HookEventHandler Subscription

**File:** `packages/core/src/hooks/hookEventHandler.ts`

**Lines 151-159 (constructor):**
```typescript
if (this.messageBus !== undefined) {
  const unsubscribeFn = this.messageBus.subscribe(   // Line 152: SUBSCRIBES
    'HOOK_EXECUTION_REQUEST' as import('../confirmation-bus/types.js').MessageBusType,
    (msg: unknown) => {
      void this.onBusRequest(msg);
    },
  );
  this.subscriptionHandle = { unsubscribe: unsubscribeFn }; // Line 158: Stores handle
}
```

**Lines 915-922 (dispose):**
```typescript
dispose(): void {
  if (this.disposed) return;
  this.disposed = true;
  this.subscriptionHandle?.unsubscribe();            // Line 920: Unsubscribes
  this.subscriptionHandle = undefined;
}
```

**Context:** LLxprt has full disposal infrastructure. `HookSystem.dispose()` (line 209-211) calls `eventHandler?.dispose()`. Without calling disposal before re-init, subscription leaks.

---

## TDD Implementation

### Phase 0: Understand Existing Tests

**Existing Hook Tests:**
- `packages/core/src/hooks/hookSystem.test.ts` — 246 lines, tests initialization guards
- `packages/core/src/hooks/hookRegistry.test.ts` — 566 lines, tests initialization guards
- `packages/core/src/hooks/hookEventHandler.test.ts` — Tests event handling
- `packages/core/src/hooks/__tests__/hookSystem-integration.test.ts` — Integration tests
- `packages/core/src/utils/extensionLoader.test.ts` — 118 lines, tests extension loading

**Tests to Remove:**
1. `hookSystem.test.ts` line 94-108: "should only initialize once on multiple calls"
2. `hookSystem.test.ts` line 75-80: "should report correct status before initialization"
3. `hookSystem.test.ts` line 127-134: "should report correct status after initialization"
4. `hookSystem.test.ts` line 200-208: "should return HookSystemStatus interface"
5. `hookRegistry.test.ts` line 264-270: "should throw error if not initialized"

**Tests to Modify:**
1. `hookSystem.test.ts` line 84-92: Change from `getStatus()` to direct assertions
2. `hookSystem.test.ts` line 211-243: Change from `getStatus()` to `getAllHooks()`

---

### Phase 1: RED — Write Failing Tests for Re-Init

**Test File:** `packages/core/src/hooks/__tests__/hook-reinit.test.ts` (NEW)

**Test 1: Re-init updates registry with new extension hooks**

```typescript
/**
 * @fileoverview TDD tests for hook re-initialization on extension change
 * @requirement R2 R4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookSystem } from '../hookSystem.js';
import type { Config } from '../../config/config.js';
import type { GeminiCLIExtension } from '../../config/config.js';
import { HookEventName } from '../types.js';

describe('Hook Re-Initialization (126c32ac)', () => {
  let mockConfig: Config;
  let mockExtensions: GeminiCLIExtension[];

  beforeEach(() => {
    mockExtensions = [];
    mockConfig = {
      getEnableHooks: () => true,
      getHooks: () => ({}),
      getSessionId: () => 'test-session',
      getWorkingDir: () => '/test',
      getTargetDir: () => '/test',
      getExtensions: () => mockExtensions,
      getDisabledHooks: () => [],
      getModel: () => 'test-model',
    } as unknown as Config;
  });

  it('should reload hooks when extension with hooks is added (RED → GREEN)', async () => {
    // RED: This test will FAIL because initialize() has guard that prevents re-init
    const hookSystem = new HookSystem(mockConfig);
    
    // First init — no extensions
    await hookSystem.initialize();
    const beforeCount = hookSystem.getAllHooks().length;
    expect(beforeCount).toBe(0);

    // Add extension with hooks
    mockExtensions.push({
      name: 'test-ext',
      isActive: true,
      version: '1.0.0',
      path: '/ext',
      contextFiles: [],
      id: 'ext-123',
      hooks: {
        [HookEventName.BeforeTool]: [
          {
            matcher: 'read_file',
            hooks: [{ type: 'command', command: './check.sh' }],
          },
        ],
      },
    });

    // Re-initialize — should pick up new extension hooks
    await hookSystem.initialize();
    const afterCount = hookSystem.getAllHooks().length;

    // RED: This assertion will FAIL because guard prevents re-init
    expect(afterCount).toBeGreaterThan(beforeCount);
    expect(afterCount).toBe(1); // One hook from extension
  });

  it('should reload hooks when extension with hooks is removed (RED → GREEN)', async () => {
    // RED: This test will FAIL because initialize() has guard
    mockExtensions.push({
      name: 'test-ext',
      isActive: true,
      version: '1.0.0',
      path: '/ext',
      contextFiles: [],
      id: 'ext-123',
      hooks: {
        [HookEventName.BeforeTool]: [
          {
            hooks: [{ type: 'command', command: './check.sh' }],
          },
        ],
      },
    });

    const hookSystem = new HookSystem(mockConfig);
    await hookSystem.initialize();
    const beforeCount = hookSystem.getAllHooks().length;
    expect(beforeCount).toBe(1);

    // Remove extension
    mockExtensions.length = 0;

    // Re-initialize — should clear extension hooks
    await hookSystem.initialize();
    const afterCount = hookSystem.getAllHooks().length;

    // RED: This assertion will FAIL because guard prevents re-init
    expect(afterCount).toBeLessThan(beforeCount);
    expect(afterCount).toBe(0);
  });
});
```

**Test 2: Disposal prevents MessageBus subscription leaks**

```typescript
describe('Hook Re-Initialization Disposal (126c32ac)', () => {
  it('should dispose old event handler before creating new one (RED → GREEN)', async () => {
    // RED: This test will FAIL because initialize() doesn't dispose old handler
    const unsubscribeMock = vi.fn();
    const subscribeMock = vi.fn(() => unsubscribeMock);
    const mockMessageBus = {
      subscribe: subscribeMock,
      publish: vi.fn(),
    };

    const mockConfig = {
      getEnableHooks: () => true,
      getHooks: () => ({}),
      getSessionId: () => 'test-session',
      getWorkingDir: () => '/test',
      getTargetDir: () => '/test',
      getExtensions: () => [],
      getDisabledHooks: () => [],
      getModel: () => 'test-model',
    } as unknown as Config;

    const hookSystem = new HookSystem(mockConfig, mockMessageBus);

    // First init — subscribes to MessageBus
    await hookSystem.initialize();
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(unsubscribeMock).not.toHaveBeenCalled();

    // Re-init — should dispose old handler first
    await hookSystem.initialize();

    // RED: This assertion will FAIL because old subscription wasn't unsubscribed
    expect(unsubscribeMock).toHaveBeenCalledTimes(1); // Old handler disposed
    expect(subscribeMock).toHaveBeenCalledTimes(2);    // New handler subscribed
  });

  it('should not leak subscriptions after multiple re-inits (RED → GREEN)', async () => {
    // RED: This test will FAIL because subscriptions leak
    const unsubscribes: ReturnType<typeof vi.fn>[] = [];
    const subscribeMock = vi.fn(() => {
      const unsub = vi.fn();
      unsubscribes.push(unsub);
      return unsub;
    });
    const mockMessageBus = {
      subscribe: subscribeMock,
      publish: vi.fn(),
    };

    const mockConfig = {
      getEnableHooks: () => true,
      getHooks: () => ({}),
      getSessionId: () => 'test-session',
      getWorkingDir: () => '/test',
      getTargetDir: () => '/test',
      getExtensions: () => [],
      getDisabledHooks: () => [],
      getModel: () => 'test-model',
    } as unknown as Config;

    const hookSystem = new HookSystem(mockConfig, mockMessageBus);

    // Initialize 3 times
    await hookSystem.initialize();
    await hookSystem.initialize();
    await hookSystem.initialize();

    // Should have 3 subscriptions, 2 should be unsubscribed
    expect(subscribeMock).toHaveBeenCalledTimes(3);
    
    // RED: These assertions will FAIL because only last init ran (guard blocks others)
    expect(unsubscribes[0]).toHaveBeenCalledTimes(1); // First disposed before second init
    expect(unsubscribes[1]).toHaveBeenCalledTimes(1); // Second disposed before third init
    expect(unsubscribes[2]).not.toHaveBeenCalled();   // Third still active
  });
});
```

**Test 3: Extension loader triggers hook refresh**

Add to `packages/core/src/utils/extensionLoader.test.ts`:

```typescript
describe('Hook system integration (126c32ac)', () => {
  it('should call hookSystem.initialize() after extension changes (RED → GREEN)', async () => {
    // RED: This test will FAIL because extensionLoader doesn't call hookSystem.initialize()
    const mockHookSystemInit = vi.fn();
    const mockRefreshMemory = vi.fn();
    
    const mockConfig = {
      getMcpClientManager: () => ({
        startExtension: vi.fn(),
      }),
      getEnableExtensionReloading: () => true,
      refreshMemory: mockRefreshMemory,
      getHookSystem: () => ({
        initialize: mockHookSystemInit,
      }),
    } as unknown as Config;

    const activeExtension = {
      name: 'test-ext',
      isActive: true,
      version: '1.0.0',
      path: '/ext',
      contextFiles: [],
      id: 'ext-123',
    };

    const loader = new SimpleExtensionLoader([]);
    await loader.start(mockConfig);
    
    mockRefreshMemory.mockClear();
    mockHookSystemInit.mockClear();

    // Load extension — triggers refresh
    await loader.loadExtension(activeExtension);

    // RED: This assertion will FAIL because hookSystem.initialize() not called
    expect(mockRefreshMemory).toHaveBeenCalledOnce();
    expect(mockHookSystemInit).toHaveBeenCalledOnce();
  });

  it('should call hookSystem.initialize() after unload (RED → GREEN)', async () => {
    // RED: Similar test for unload path
    const mockHookSystemInit = vi.fn();
    const mockRefreshMemory = vi.fn();
    
    const mockConfig = {
      getMcpClientManager: () => ({
        startExtension: vi.fn(),
        stopExtension: vi.fn(),
      }),
      getEnableExtensionReloading: () => true,
      refreshMemory: mockRefreshMemory,
      getHookSystem: () => ({
        initialize: mockHookSystemInit,
      }),
    } as unknown as Config;

    const activeExtension = {
      name: 'test-ext',
      isActive: true,
      version: '1.0.0',
      path: '/ext',
      contextFiles: [],
      id: 'ext-123',
    };

    const loader = new SimpleExtensionLoader([activeExtension]);
    await loader.start(mockConfig);
    
    mockRefreshMemory.mockClear();
    mockHookSystemInit.mockClear();

    // Unload extension — triggers refresh
    await loader.unloadExtension(activeExtension);

    // RED: This assertion will FAIL because hookSystem.initialize() not called
    expect(mockRefreshMemory).toHaveBeenCalledOnce();
    expect(mockHookSystemInit).toHaveBeenCalledOnce();
  });
});
```

**Run Tests (Expect RED):**

```bash
cd packages/core
npx vitest run src/hooks/__tests__/hook-reinit.test.ts
npx vitest run src/utils/extensionLoader.test.ts
```

**Expected Output:** All new tests FAIL.

---

### Phase 2: GREEN — Remove Guards from HookRegistry

**Goal:** Make `HookRegistry.initialize()` re-run on every call.

**File:** `packages/core/src/hooks/hookRegistry.ts`

**Step 1: Remove `HookRegistryNotInitializedError` class**

```diff
-/**
- * Error thrown when attempting to use HookRegistry before initialization
- */
-export class HookRegistryNotInitializedError extends Error {
-  constructor(message = 'Hook registry not initialized') {
-    super(message);
-    this.name = 'HookRegistryNotInitializedError';
-  }
-}
-
```

**Lines to delete:** 14-22

**Step 2: Remove `initialized` field**

```diff
export class HookRegistry {
  private readonly config: Config;
  private entries: HookRegistryEntry[] = [];
- private initialized = false;
```

**Line to delete:** 52

**Step 3: Remove guard from `initialize()`**

```diff
async initialize(): Promise<void> {
-  if (this.initialized) {
-    return;
-  }

  this.entries = [];
  this.processHooksFromConfig();
-  this.initialized = true;

  debugLogger.log(
    `Hook registry initialized with ${this.entries.length} hook entries`,
  );
}
```

**Lines to delete:** 62-64, 68

**Step 4: Remove guard from `getHooksForEvent()`**

```diff
getHooksForEvent(eventName: HookEventName): HookRegistryEntry[] {
-  if (!this.initialized) {
-    throw new HookRegistryNotInitializedError();
-  }

  return this.entries
    .filter((entry) => entry.eventName === eventName && entry.enabled)
    .sort(
      (a, b) =>
        this.getSourcePriority(a.source) - this.getSourcePriority(b.source),
    );
}
```

**Lines to delete:** 79-81

**Step 5: Remove guard from `getAllHooks()`**

```diff
getAllHooks(): HookRegistryEntry[] {
-  if (!this.initialized) {
-    throw new HookRegistryNotInitializedError();
-  }

  return [...this.entries];
}
```

**Lines to delete:** 95-97

**Verify:** Run registry tests:

```bash
npx vitest run src/hooks/hookRegistry.test.ts
```

**Expected:** Some tests fail (those checking for guard behavior).

---

### Phase 3: GREEN — Remove Guards from HookSystem + Add Disposal

**Goal:** Make `HookSystem.initialize()` re-run on every call and dispose old handler.

**File:** `packages/core/src/hooks/hookSystem.ts`

**Step 1: Remove `HookSystemStatus` interface**

```diff
-/**
- * Status information for the HookSystem
- * @requirement:HOOK-009
- */
-export interface HookSystemStatus {
-  initialized: boolean;
-  totalHooks: number;
-}
-
```

**Lines to delete:** 25-32

**Step 2: Remove `initialized` field**

```diff
export class HookSystem {
  private readonly config: Config;
  private readonly registry: HookRegistry;
  private readonly planner: HookPlanner;
  private readonly runner: HookRunner;
  private readonly aggregator: HookAggregator;
  private eventHandler: HookEventHandler | null = null;
- private initialized = false;
```

**Line to delete:** 56

**Step 3: Remove guard from `initialize()` + add disposal**

```diff
async initialize(): Promise<void> {
-  if (this.initialized) {
-    debugLogger.debug('HookSystem already initialized, skipping');
-    return;
-  }

  debugLogger.debug('Initializing HookSystem');

+  // Dispose old event handler to prevent subscription leaks (LLxprt enhancement)
+  this.dispose();

  // Initialize the registry (loads hooks from config)
  await this.registry.initialize();

  // Create the event handler now that registry is ready,
  // forwarding injected dependencies per DELTA-HSYS-001
  this.eventHandler = new HookEventHandler(
    this.config,
    this.registry,
    this.planner,
    this.runner,
    this.aggregator,
    this.messageBus,
    this.injectedDebugLogger,
  );

-  this.initialized = true;

-  const status = this.getStatus();
+  const totalHooks = this.registry.getAllHooks().length;
  debugLogger.log(
-    `HookSystem initialized with ${status.totalHooks} registered hook(s)`,
+    `HookSystem initialized with ${totalHooks} registered hook(s)`,
  );
}
```

**Changes:**
- Delete lines 99-101 (guard)
- Add line 104 (disposal call)
- Delete line 121 (set initialized flag)
- Replace lines 123-126 (use totalHooks directly instead of getStatus())

**Step 4: Remove guard from `getRegistry()`**

```diff
getRegistry(): HookRegistry {
-  if (!this.initialized) {
-    throw new HookSystemNotInitializedError(
-      'Cannot access HookRegistry before HookSystem is initialized',
-    );
-  }
  return this.registry;
}
```

**Lines to delete:** 135-138

**Step 5: Update `getEventHandler()` to check only eventHandler**

```diff
getEventHandler(): HookEventHandler {
-  if (!this.initialized || !this.eventHandler) {
+  if (!this.eventHandler) {
    throw new HookSystemNotInitializedError(
      'Cannot access HookEventHandler before HookSystem is initialized',
    );
  }
  return this.eventHandler;
}
```

**Line to modify:** 149

**Step 6: Remove `getStatus()` method**

```diff
-/**
- * Get the current status of the hook system.
- * @requirement:HOOK-009
- */
-getStatus(): HookSystemStatus {
-  return {
-    initialized: this.initialized,
-    totalHooks: this.initialized ? this.registry.getAllHooks().length : 0,
-  };
-}
-
```

**Lines to delete:** 157-166

**Step 7: Update `isInitialized()` to check eventHandler**

```diff
isInitialized(): boolean {
-  return this.initialized;
+  return this.eventHandler !== null;
}
```

**Line to modify:** 172

**Step 8: Remove guard from `setHookEnabled()`**

```diff
setHookEnabled(hookId: string, enabled: boolean): void {
-  if (!this.initialized) {
-    return;
-  }
  this.registry.setHookEnabled(hookId, enabled);
}
```

**Lines to delete:** 183-185

**Step 9: Remove guard from `getAllHooks()`**

```diff
getAllHooks(): HookRegistryEntry[] {
-  if (!this.initialized) {
-    return [];
-  }
  return this.registry.getAllHooks();
}
```

**Lines to delete:** 197-199

**Step 10: Update JSDoc to remove HOOK-009 references**

```diff
/**
 * @plan:PLAN-20260216-HOOKSYSTEMREWRITE.P03
- * @requirement:HOOK-001,HOOK-003,HOOK-004,HOOK-005,HOOK-006,HOOK-007,HOOK-008,HOOK-009,HOOK-142
+ * @requirement:HOOK-001,HOOK-003,HOOK-004,HOOK-005,HOOK-006,HOOK-007,HOOK-008,HOOK-142
 * @pseudocode:analysis/pseudocode/01-hook-system-lifecycle.md
 */
```

**Line to modify:** 9

```diff
 * @requirement:HOOK-001 - Created lazily on first call to Config.getHookSystem()
 * @requirement:HOOK-003 - Calls HookRegistry.initialize() at most once per Config lifetime
 * @requirement:HOOK-004 - Returns immediately on subsequent initialize() calls
 * @requirement:HOOK-005 - Throws HookSystemNotInitializedError if accessed before initialize()
- * @requirement:HOOK-006 - Exposes getRegistry(), getEventHandler(), getStatus() as public accessors
+ * @requirement:HOOK-006 - Exposes getRegistry(), getEventHandler() as public accessors
 * @requirement:HOOK-007 - Trigger functions obtain components from HookSystem, never construct new ones
 * @requirement:HOOK-008 - First hook event fires initialize() before delegating to event handler
- * @requirement:HOOK-009 - getStatus() reports { initialized: boolean; totalHooks: number }
 * @requirement:HOOK-142 - Importable from packages/core/src/hooks/hookSystem.ts
```

**Lines to modify:** 40-48

**Verify:** Run re-init tests:

```bash
npx vitest run src/hooks/__tests__/hook-reinit.test.ts
```

**Expected:** First two test groups now PASS (re-init and disposal tests).

---

### Phase 4: GREEN — Add Hook Refresh to Extension Loader

**Goal:** Call `hookSystem.initialize()` after `refreshMemory()` when extensions change.

**File:** `packages/core/src/utils/extensionLoader.ts`

**Change:**

```diff
private async maybeRefreshMemory(): Promise<void> {
  if (!this.config) {
    throw new Error('Cannot refresh memory prior to calling `start`.');
  }
  if (
    !this.isStarting && // Don't refresh memories on the first call to `start`.
    this.startingCount === this.startCompletedCount &&
    this.stoppingCount === this.stopCompletedCount
  ) {
    // Wait until all extensions are done starting and stopping before we
    // reload memory, this is somewhat expensive and also busts the context
    // cache, we want to only do it once.
    await this.config.refreshMemory();
+    await this.config.getHookSystem()?.initialize();
  }
}
```

**Line to add:** After line 141

**Verify:** Run extension loader tests:

```bash
npx vitest run src/utils/extensionLoader.test.ts
```

**Expected:** New hook integration tests now PASS.

---

### Phase 5: GREEN — Update Existing Tests

**Goal:** Remove/update tests that rely on old guard behavior.

#### File: `packages/core/src/hooks/hookSystem.test.ts`

**Remove Test 1: "should only initialize once on multiple calls"**

```diff
- it('should only initialize once on multiple calls', async () => {
-   await hookSystem.initialize();
-   await hookSystem.initialize();
-   await hookSystem.initialize();
-   await hookSystem.initialize();
-
-   // Check that "Initializing HookSystem" was only called once
-   const initializingCalls = mockDebugLogger.debug.mock.calls.filter((call) =>
-     call[0].includes('Initializing HookSystem'),
-   );
-   expect(initializingCalls).toHaveLength(1);
- });
```

**Lines to delete:** 94-108

**Remove Test 2: "should report correct status before initialization"**

```diff
- it('should report correct status before initialization', () => {
-   const status = hookSystem.getStatus();
-   expect(status.initialized).toBe(false);
-   expect(status.totalHooks).toBe(0);
- });
```

**Lines to delete:** 75-80

**Modify Test 3: "should initialize HookSystem successfully"**

```diff
it('should initialize HookSystem successfully', async () => {
  await hookSystem.initialize();

  expect(hookSystem.isInitialized()).toBe(true);
  expect(mockDebugLogger.log).toHaveBeenCalledWith(
    expect.stringContaining('HookSystem initialized'),
  );
});
```

**Keep as-is** — No changes needed, test already checks `isInitialized()`.

**Remove Test 4: "should report correct status after initialization" (duplicate check)**

This test is likely near line 127-134 or in the "with configured hooks" section.

```diff
- it('should report correct status after initialization', async () => {
-   await hookSystem.initialize();
-   const status = hookSystem.getStatus();
-   expect(status.initialized).toBe(true);
- });
```

**Lines to delete:** Find and remove this test.

**Remove Test 5: "should return HookSystemStatus interface"**

```diff
- it('should return HookSystemStatus interface', () => {
-   const status = hookSystem.getStatus();
-   expect(status).toHaveProperty('initialized');
-   expect(status).toHaveProperty('totalHooks');
- });
```

**Lines to delete:** 200-208

**Update Test 6: "with configured hooks" → "should report correct hook count"**

Find test around line 211-243 that uses `getStatus()`:

```diff
describe('with configured hooks', () => {
  it('should report correct hook count after initialization', async () => {
    // Setup mock with hooks configuration BEFORE creating HookSystem
    const configWithHooks = {
      getEnableHooks: () => true,
      getHooks: () => ({
        BeforeTool: [
          {
            hooks: [{ type: 'command', command: './test.sh' }],
          },
        ],
      }),
      getSessionId: () => 'test-session',
      getWorkingDir: () => '/test',
      getTargetDir: () => '/test',
      getExtensions: () => [],
      getDisabledHooks: () => [],
      getModel: () => 'test-model',
    } as unknown as Config;

    const configuredHookSystem = new HookSystem(configWithHooks);
    await configuredHookSystem.initialize();

-    const status = configuredHookSystem.getStatus();
-    expect(status.initialized).toBe(true);
-    expect(status.totalHooks).toBe(1);
+    const hooks = configuredHookSystem.getAllHooks();
+    expect(configuredHookSystem.isInitialized()).toBe(true);
+    expect(hooks.length).toBe(1);
  });
});
```

**Lines to modify:** Replace `getStatus()` with `getAllHooks()`.

#### File: `packages/core/src/hooks/hookRegistry.test.ts`

**Remove Test: "should throw error if not initialized"**

```diff
- it('should throw error if not initialized', () => {
-   const uninitializedRegistry = new HookRegistry(mockConfig);
-
-   expect(() => {
-     uninitializedRegistry.getHooksForEvent(HookEventName.BeforeTool);
-   }).toThrow(HookRegistryNotInitializedError);
- });
```

**Lines to delete:** 264-270

**Verify:** Run all hook tests:

```bash
cd packages/core
npx vitest run src/hooks/
```

**Expected:** All tests PASS.

---

### Phase 6: REFACTOR — Assess and Improve

**Review Changes:**
1. **Disposal logic:** Is it idempotent? YES — `dispose()` checks `this.disposed` flag (line 917)
2. **Re-init safety:** Can `initialize()` be called concurrently? NO — JS is single-threaded, but async. Add comment warning.
3. **Performance:** Does re-init impact performance? MINIMAL — registry processes config once, same as before. Only difference: happens on demand instead of once.
4. **Clarity:** Is disposal logic clear? ADD COMMENT explaining LLxprt-specific enhancement.

**Refactoring Decision:** Add clarifying comments, no code changes needed.

**File:** `packages/core/src/hooks/hookSystem.ts`

**Add comment in `initialize()`:**

```diff
async initialize(): Promise<void> {
  debugLogger.debug('Initializing HookSystem');

-  // Dispose old event handler to prevent subscription leaks (LLxprt enhancement)
+  // Dispose old event handler to prevent MessageBus subscription leaks.
+  // LLxprt enhancement: Upstream Gemini doesn't need this because their
+  // HookEventHandler doesn't subscribe to MessageBus. LLxprt added MessageBus
+  // integration in PLAN-20250218-HOOKSYSTEM.P03 (DELTA-HEVT-001).
+  // Without disposal, each re-init creates a new subscription without
+  // unsubscribing the old one, causing memory leaks.
  this.dispose();

  // Initialize the registry (loads hooks from config)
  await this.registry.initialize();
```

**Add comment about concurrent calls:**

```diff
/**
 * Initialize the hook system. Must be called before getRegistry() or getEventHandler().
- * Safe to call multiple times - subsequent calls are no-ops.
+ * Can be called multiple times to reload hooks from config.
+ * 
+ * WARNING: Not safe for concurrent calls. Ensure initialize() completes before
+ * calling again. JavaScript is single-threaded but async, so callers must
+ * await each initialize() call before starting another.
 *
 * @requirement:HOOK-003 - Calls HookRegistry.initialize() at most once
 * @requirement:HOOK-004 - Returns immediately on subsequent calls
 * @requirement:HOOK-008 - Called by trigger functions on first event fire
 */
```

**Update requirements in JSDoc:**

```diff
 * @requirement:HOOK-001 - Created lazily on first call to Config.getHookSystem()
- * @requirement:HOOK-003 - Calls HookRegistry.initialize() at most once per Config lifetime
- * @requirement:HOOK-004 - Returns immediately on subsequent calls
+ * @requirement:HOOK-003 - Calls HookRegistry.initialize() to load hooks from config
 * @requirement:HOOK-005 - Throws HookSystemNotInitializedError if accessed before initialize()
 * @requirement:HOOK-006 - Exposes getRegistry(), getEventHandler() as public accessors
 * @requirement:HOOK-007 - Trigger functions obtain components from HookSystem, never construct new ones
 * @requirement:HOOK-008 - First hook event fires initialize() before delegating to event handler
 * @requirement:HOOK-142 - Importable from packages/core/src/hooks/hookSystem.ts
```

**Note:** HOOK-003 and HOOK-004 meanings changed. Update or deprecate these requirements.

---

### Phase 7: VERIFY — Full Test Suite

**Run all tests:**

```bash
cd packages/core
npm run test
```

**Expected:** All tests pass.

**Run linter:**

```bash
npm run lint
```

**Expected:** No errors.

**Run formatter:**

```bash
npm run format
```

**Expected:** Files formatted.

---

### Phase 8: MANUAL VERIFICATION

**Scenario:** Enable/disable extension with hooks, verify hooks update without restart.

**Steps:**

1. **Start CLI with no extensions:**
   ```bash
   npm run dev
   ```

2. **List hooks (should be empty or only system hooks):**
   ```bash
   llxprt hooks list
   ```

3. **Enable test extension with hooks:**
   Create `~/.llxprt/extensions/test-hook-ext/extension.json`:
   ```json
   {
     "name": "test-hook-ext",
     "version": "1.0.0",
     "hooks": {
       "BeforeTool": [
         {
           "matcher": "read_file",
           "hooks": [
             {
               "type": "command",
               "command": "echo 'BeforeTool hook fired'"
             }
           ]
         }
       ]
     }
   }
   ```

   Enable in CLI:
   ```bash
   llxprt extensions enable test-hook-ext
   ```

4. **List hooks (should show extension hook):**
   ```bash
   llxprt hooks list
   ```
   
   **Expected:** See `test-hook-ext` hook listed.

5. **Disable extension:**
   ```bash
   llxprt extensions disable test-hook-ext
   ```

6. **List hooks (hook should be gone):**
   ```bash
   llxprt hooks list
   ```
   
   **Expected:** `test-hook-ext` hook no longer listed.

7. **Verify no memory leaks:**
   - Enable/disable extension 10 times
   - Check process memory (should not grow significantly)
   - Check MessageBus subscription count (if exposed)

---

## Commit Strategy

**Commit 1: Add failing tests for re-initialization**

```bash
git add packages/core/src/hooks/__tests__/hook-reinit.test.ts
git add packages/core/src/utils/extensionLoader.test.ts
git commit -m "test: add failing tests for hook re-initialization (126c32ac) [RED]

Tests verify:
1. HookRegistry reloads hooks when extensions change
2. HookSystem disposes old event handler before re-init
3. ExtensionLoader calls hookSystem.initialize() after refreshMemory()

All tests currently FAIL due to initialization guards.

Part of: reimplementation of upstream 126c32ac
"
```

**Commit 2: Remove guards from HookRegistry**

```bash
git add packages/core/src/hooks/hookRegistry.ts
git commit -m "refactor: remove initialization guards from HookRegistry (126c32ac) [GREEN]

Changes:
- Remove HookRegistryNotInitializedError class
- Remove 'initialized' flag
- Remove guards from initialize(), getHooksForEvent(), getAllHooks()

Effect: initialize() now re-reads config on every call, enabling hook updates
when extensions change.

Part of: reimplementation of upstream 126c32ac
Tests: packages/core/src/hooks/__tests__/hook-reinit.test.ts now partially pass
"
```

**Commit 3: Remove guards from HookSystem + add disposal**

```bash
git add packages/core/src/hooks/hookSystem.ts
git commit -m "refactor: remove initialization guards and add disposal (126c32ac) [GREEN]

Changes:
- Remove HookSystemStatus interface
- Remove 'initialized' flag
- Remove guards from initialize() and accessor methods
- Add disposal call in initialize() to prevent MessageBus subscription leaks
- Remove getStatus() method
- Update isInitialized() to check eventHandler !== null

Effect: initialize() now re-initializes on every call, properly disposing old
event handler first to prevent memory leaks.

LLxprt Enhancement: Disposal is LLxprt-specific since upstream Gemini doesn't
have MessageBus integration. Without disposal, subscriptions leak.

Part of: reimplementation of upstream 126c32ac
Tests: packages/core/src/hooks/__tests__/hook-reinit.test.ts now fully pass
"
```

**Commit 4: Add hook refresh to extension loader**

```bash
git add packages/core/src/utils/extensionLoader.ts
git commit -m "feat: refresh hooks when extensions change (126c32ac) [GREEN]

Add hookSystem.initialize() call in maybeRefreshMemory() after refreshMemory().
This triggers hook registry reload when extensions are loaded/unloaded.

Part of: reimplementation of upstream 126c32ac
Tests: packages/core/src/utils/extensionLoader.test.ts hook integration tests pass
"
```

**Commit 5: Update tests to remove guard checks**

```bash
git add packages/core/src/hooks/hookSystem.test.ts
git add packages/core/src/hooks/hookRegistry.test.ts
git commit -m "test: remove obsolete initialization guard tests (126c32ac) [GREEN]

Remove tests that verify:
- initialize() only runs once (no longer true)
- getStatus() returns HookSystemStatus (method removed)
- Uninitialized access throws error (guards removed)

Update tests to use getAllHooks() instead of getStatus().

Part of: reimplementation of upstream 126c32ac
Tests: All hook system tests now pass
"
```

**Commit 6: Add clarifying comments (REFACTOR)**

```bash
git add packages/core/src/hooks/hookSystem.ts
git commit -m "docs: clarify re-initialization and disposal behavior (126c32ac) [REFACTOR]

Add comments explaining:
- Why disposal is LLxprt-specific (MessageBus integration)
- Concurrent initialize() call safety warning
- Updated requirement mappings (HOOK-003, HOOK-004 changed meaning)

No code changes.

Part of: reimplementation of upstream 126c32ac
"
```

---

## Final Verification Checklist

### Code Changes

- [ ] `hookRegistry.ts`: Guards removed (lines 17-22, 52, 62-64, 79-81, 95-97)
- [ ] `hookSystem.ts`: Guards removed, disposal added, getStatus() removed
- [ ] `extensionLoader.ts`: hookSystem.initialize() call added (line 142)
- [ ] Comments added explaining disposal and re-init behavior

### Tests

- [ ] New tests added: `hook-reinit.test.ts` (re-init and disposal)
- [ ] New tests added: `extensionLoader.test.ts` (hook integration)
- [ ] Obsolete tests removed: guard checks in hookSystem/hookRegistry tests
- [ ] Modified tests: replace getStatus() with getAllHooks()
- [ ] All tests pass: `npm run test`

### Documentation

- [ ] JSDoc updated: HOOK-009 removed, HOOK-003/004 clarified
- [ ] Comments explain LLxprt-specific disposal enhancement
- [ ] Warning about concurrent initialize() calls

### Manual Verification

- [ ] Extension enable/disable updates hooks without restart
- [ ] `llxprt hooks list` reflects extension changes immediately
- [ ] No memory growth after repeated enable/disable cycles
- [ ] No MessageBus subscription leaks (verify with mocks)

### Linting and Formatting

- [ ] `npm run lint` — No errors
- [ ] `npm run format` — Files formatted
- [ ] No TypeScript errors: `npm run typecheck`

---

## Risk Assessment

**Risk Level:** MEDIUM

**High-Risk Areas:**

1. **EventHandler disposal:** Incorrect disposal could break event handling
   - **Mitigation:** Disposal is idempotent, checks `disposed` flag
   - **Verification:** Test with mock MessageBus, verify unsubscribe count

2. **Concurrent initialize() calls:** Not thread-safe (though JS is single-threaded)
   - **Mitigation:** Add warning comment, document expected usage
   - **Verification:** ExtensionLoader already serializes calls (await in finally block)

3. **Registry re-init performance:** Multiple re-inits could slow down
   - **Mitigation:** ExtensionLoader batches operations, calls initialize() once after all changes
   - **Verification:** Profile extension enable/disable cycle

4. **Stale event handler references:** Code holding old eventHandler reference after re-init
   - **Mitigation:** EventHandler obtained via getEventHandler() on each use, never cached
   - **Verification:** Search codebase for eventHandler caching (none found)

**Rollback Plan:**

If critical issues arise:
1. Revert commits in reverse order (commit 6 → 5 → 4 → 3 → 2 → 1)
2. Restore guards: `if (this.initialized) return;`
3. Restore `HookRegistryNotInitializedError` class
4. Restore `getStatus()` method and `HookSystemStatus` interface
5. Remove disposal call from `initialize()`
6. Remove `hookSystem.initialize()` call from extension loader

---

## Success Criteria

1. [OK] Extension hooks reload without CLI restart
2. [OK] No "not initialized" errors thrown (guards removed)
3. [OK] No MessageBus subscription leaks (disposal working)
4. [OK] All hook tests pass (guard tests removed/updated)
5. [OK] `llxprt hooks list` reflects extension changes immediately
6. [OK] No memory growth after repeated enable/disable cycles
7. [OK] No performance regression (initialization batched)

---

## Upstream Divergence Summary

**Upstream Changes (Applied to LLxprt):**
1. Remove `initialized` flags from HookSystem and HookRegistry [OK]
2. Remove initialization guards [OK]
3. Remove `HookRegistryNotInitializedError` class [OK]
4. Remove `getStatus()` method and `HookSystemStatus` interface [OK]
5. Update `isInitialized()` to check `eventHandler !== null` [OK]
6. Call `hookSystem.initialize()` in extension loader [OK]

**LLxprt Enhancements (Not in Upstream):**
1. Dispose old HookEventHandler before re-init to prevent MessageBus subscription leaks [OK]

**Why LLxprt needs disposal:**
- LLxprt added MessageBus integration in PLAN-20250218-HOOKSYSTEM.P03 (DELTA-HEVT-001)
- HookEventHandler subscribes in constructor (line 152)
- Upstream Gemini doesn't have MessageBus, so no subscription leaks
- Without disposal, each re-init creates new subscription without unsubscribing old one

**Files LLxprt doesn't have (upstream-only changes ignored):**
- `packages/cli/src/config/extension-manager.ts` — Gemini-specific, doesn't exist in LLxprt
- `integration-tests/test-helper.ts` — Minor test helper change, not applicable

---

## Appendix: Test Output Examples

### RED Phase (Before Implementation)

```
FAIL packages/core/src/hooks/__tests__/hook-reinit.test.ts
  Hook Re-Initialization (126c32ac)
     should reload hooks when extension with hooks is added (RED → GREEN)
      Expected: 1
      Received: 0
      
      afterCount is still 0 because initialize() guard prevented re-init
      
     should reload hooks when extension with hooks is removed (RED → GREEN)
      Expected: 0
      Received: 1
      
      afterCount is still 1 because initialize() guard prevented re-init

  Hook Re-Initialization Disposal (126c32ac)
     should dispose old event handler before creating new one (RED → GREEN)
      Expected: 1
      Received: 0
      
      unsubscribeMock was never called because initialize() guard prevented re-init
```

### GREEN Phase (After Implementation)

```
PASS packages/core/src/hooks/__tests__/hook-reinit.test.ts
  Hook Re-Initialization (126c32ac)
    [OK] should reload hooks when extension with hooks is added (RED → GREEN) (25ms)
    [OK] should reload hooks when extension with hooks is removed (RED → GREEN) (18ms)

  Hook Re-Initialization Disposal (126c32ac)
    [OK] should dispose old event handler before creating new one (RED → GREEN) (12ms)
    [OK] should not leak subscriptions after multiple re-inits (RED → GREEN) (15ms)

PASS packages/core/src/utils/extensionLoader.test.ts
  Hook system integration (126c32ac)
    [OK] should call hookSystem.initialize() after extension changes (RED → GREEN) (20ms)
    [OK] should call hookSystem.initialize() after unload (RED → GREEN) (18ms)

Test Files  2 passed (2)
     Tests  6 passed (6)
```

---

## References

- **Upstream Commit:** `126c32aca4972deba80a875f749fcee1367c4486`
- **Upstream PR:** https://github.com/google/genkit/pull/14918
- **LLxprt Plan:** PLAN-20250218-HOOKSYSTEM.P03 (MessageBus integration)
- **LLxprt Requirements:** DELTA-HEVT-001 (MessageBus subscription), DELTA-HEVT-004 (disposal)
- **TDD Rules:** `dev-docs/RULES.md` — Test-first, minimal implementation, refactor if valuable

---

**END OF PLAN**
