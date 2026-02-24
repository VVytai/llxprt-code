# Reimplementation Plan: Hook Refresh on Extension Change (Upstream 126c32ac)

**Upstream Commit:** `126c32aca4972deba80a875f749fcee1367c4486`  
**Author:** Tommaso Sciortino <sciortino@gmail.com>  
**Date:** Fri Dec 12 16:43:46 2025 -0800  
**Title:** Refresh hooks when refreshing extensions. (#14918)

## Executive Summary

This fixes a **SILENT BUG** where hooks from extensions don't reload after extension changes because initialization guards (`if (this.initialized) return;`) prevent re-initialization.

**CRITICAL**: LLxprt has the SAME bug. Our `HookSystem` and `HookRegistry` have `initialized` flags (lines 56, 52) that block re-init.

**Upstream Solution**:
1. Remove `initialized` guards from `HookSystem` and `HookRegistry`
2. Call `hookSystem.initialize()` in extension loader's refresh path

**[CORRECTED] LLxprt Enhancement** (upstream forgot this):
3. **Dispose old `HookEventHandler` before recreating** to prevent memory leaks

**[CORRECTED] Note**: LLxprt HookSystem ALREADY has `dispose()` method (line 209-211) that calls `eventHandler?.dispose()`. HookEventHandler ALREADY has proper disposal logic (line 123 subscriptionHandle, dispose() at line 915+). The enhancement is to **CALL** `dispose()` before re-creating the event handler in `initialize()`.

## Problem Analysis

### Root Cause

**Symptom**: After enabling/disabling an extension with hooks, the hook system doesn't pick up changes until CLI restart.

**Why**:
1. `ExtensionLoader.startExtension()` / `stopExtension()` should trigger hook refresh via `config.getHookSystem()?.initialize()`
2. `HookSystem.initialize()` has guard: `if (this.initialized) return;` (line 99)
3. `HookRegistry.initialize()` has guard: `if (this.initialized) return;` (line 62)
4. Extension hooks live in `extension.hooks` config, loaded by `HookRegistry.processHooksFromConfig()`
5. Guards prevent registry from re-reading extension config → stale hook list

### LLxprt Specific Context

**Files Affected**:
- `packages/core/src/hooks/hookSystem.ts` — Lines 56, 99-101
- `packages/core/src/hooks/hookRegistry.ts` — Lines 52, 62-63
- `packages/core/src/utils/extensionLoader.ts` — **[CORRECTED]** Line 142 calls `refreshMemory()`, needs to also call `hookSystem.initialize()`

**[CORRECTED] Additional Issue** (not in upstream):
- `HookEventHandler` subscribes to `MessageBus` in constructor (line 152: `this.messageBus.subscribe(...)`)
- Stores unsubscribe function in `this.subscriptionHandle` (line 158)
- `dispose()` method exists (lines 915+) and calls `this.subscriptionHandle?.unsubscribe()` to clean up
- Recreating `HookEventHandler` without disposing old one → **subscription leak**
- LLxprt HookSystem already has `dispose()` method (line 209-211) that properly calls `eventHandler?.dispose()`
- **Solution**: Call `this.dispose()` before creating new event handler in `initialize()`

**[CORRECTED] Disposal Context**:
The disposal infrastructure already exists:
- `HookEventHandler.dispose()` unsubscribes from MessageBus (if subscribed)
- `HookSystem.dispose()` calls `eventHandler?.dispose()`
- What's missing: calling disposal **before** re-creating event handler in `initialize()`

## Upstream Changes (Git Show Summary)

### 1. `packages/core/src/hooks/hookSystem.ts`

**Removed**:
- `private initialized = false;` field
- Guard in `initialize()`: `if (this.initialized) return;`
- Guard in `getRegistry()`: `if (!this.initialized) throw ...`
- Guard in `getEventHandler()`: `if (!this.initialized || !this.eventHandler) throw ...`
- Guard in `setHookEnabled()`: `if (!this.initialized) return;`
- Guard in `getAllHooks()`: `if (!this.initialized) return [];`
- `getStatus()` method (returned `{ initialized: boolean; totalHooks: number }`)

**Kept**:
- `private eventHandler: HookEventHandler | null = null;` (used for null check)

**Effect**: `initialize()` now re-initializes on every call, no guard.

### 2. `packages/core/src/hooks/hookRegistry.ts`

**Removed**:
- `private initialized = false;` field
- Guard in `initialize()`: `if (this.initialized) return;`
- Guard in `getHooksForEvent()`: `if (!this.initialized) throw ...`
- Guard in `getAllHooks()`: `if (!this.initialized) throw ...`
- `HookRegistryNotInitializedError` class

**Effect**: `initialize()` now re-initializes on every call, no guard.

### 3. `packages/core/src/utils/extensionLoader.ts`

**Added**:
- `await this.config.getHookSystem()?.initialize();` after `refreshServerHierarchicalMemory()`
- Made `maybeStartExtension()` and `maybeStopExtension()` async (were returning `Promise<void> | undefined`)

**[CORRECTED] Context**: Upstream calls this in batch refresh path after all extension starts/stops. Upstream has `refreshServerHierarchicalMemory()` helper, LLxprt has `refreshMemory()` method.

### 4. `packages/core/src/hooks/hookSystem.test.ts`

**Removed**:
- Test: `should not initialize twice` (no longer relevant)
- Test: `should throw error when not initialized` (no error thrown anymore)
- Test: `should return correct status when initialized` (no `getStatus()` anymore)
- Test: `should return uninitialized status` (no `getStatus()` anymore)

**Modified**:
- Test: `should initialize successfully` — Changed assertion from `status.initialized` to `getAllHooks().length`

### 5. `packages/core/src/hooks/hookRegistry.test.ts`

**Removed**:
- Test: `should throw error if not initialized` (no error thrown anymore)

### 6. **[CORRECTED]** `packages/cli/src/config/extension-manager.ts`

**This file does NOT exist in LLxprt**. It only exists in upstream Gemini. The upstream change was to await `enableExtension()` instead of firing floating promise. This is not applicable to LLxprt.

## LLxprt Adaptation Strategy

### Convergence: Remove Init Guards

LLxprt will **exactly match upstream** by removing:
1. `initialized` flags from `HookSystem` and `HookRegistry`
2. All guard checks
3. `HookRegistryNotInitializedError` class
4. `getStatus()` method from `HookSystem`
5. `HookSystemStatus` interface

### Enhancement: Dispose Before Re-Init

**LLxprt addition** (upstream missed this):
- In `HookSystem.initialize()`, BEFORE creating new `HookEventHandler`:
  ```typescript
  // Dispose old event handler to prevent subscription leaks
  this.dispose();
  ```

**[CORRECTED] Why this works**:
- `HookSystem.dispose()` already exists (line 209-211)
- It calls `this.eventHandler?.dispose()` which unsubscribes from MessageBus
- After disposal, we set `eventHandler = null` (already happens when we create new one)
- This prevents MessageBus subscription leaks

**Why upstream didn't need this**:
- Gemini's `HookEventHandler` doesn't subscribe to MessageBus (no subscription leak)
- LLxprt added MessageBus integration in PLAN-20250218-HOOKSYSTEM.P03 (DELTA-HEVT-001)

### **[CORRECTED]** Extension Loader Integration

**File**: `packages/core/src/utils/extensionLoader.ts`

**Current state** (line 129-143):
- `maybeRefreshMemory()` is called after extensions start/stop
- It calls `await this.config.refreshMemory()`
- This refreshes hierarchical memory but NOT hooks

**Required change**:
- Add `await this.config.getHookSystem()?.initialize();` call
- **[CORRECTED]** Place it INSIDE `maybeRefreshMemory()` AFTER the memory refresh, matching upstream pattern
- This ensures hooks reload when extensions change

**[CORRECTED] Upstream pattern**:
```typescript
await refreshServerHierarchicalMemory(this.config);
await this.config.getHookSystem()?.initialize();
```

**[CORRECTED] LLxprt equivalent**:
```typescript
await this.config.refreshMemory();
await this.config.getHookSystem()?.initialize();
```

### Testing: Remove Obsolete Tests

Remove tests that check for:
1. "Should only initialize once on multiple calls" (line 94-108 in hookSystem.test.ts) - now valid to re-init
2. "Should throw error if not initialized" (line 264-270 in hookRegistry.test.ts) - no throws anymore
3. Tests for `getStatus()` functionality (lines 199-209 in hookSystem.test.ts) - method removed

**[CORRECTED]** Note: The test "should report correct status before initialization" (lines 75-80) and "should report correct status after initialization" (lines 127-134) also need removal since `getStatus()` is being removed.

## Implementation Plan

### Phase 1: Remove Init Guards from HookRegistry

**File**: `packages/core/src/hooks/hookRegistry.ts`

**Changes**:

1. **Remove class and field** (lines 17-22, 52):
   ```diff
   - export class HookRegistryNotInitializedError extends Error {
   -   constructor(message = 'Hook registry not initialized') {
   -     super(message);
   -     this.name = 'HookRegistryNotInitializedError';
   -   }
   - }
   
   - private initialized = false;
   ```

2. **Remove guard in `initialize()`** (lines 62-68):
   ```diff
   async initialize(): Promise<void> {
   -   if (this.initialized) {
   -     return;
   -   }
   
     this.entries = [];
     this.processHooksFromConfig();
   -   this.initialized = true;
   
     debugLogger.log(
       `Hook registry initialized with ${this.entries.length} hook entries`,
     );
   ```

3. **Remove guards in `getHooksForEvent()`** (lines 79-81):
   ```diff
   getHooksForEvent(eventName: HookEventName): HookRegistryEntry[] {
   -   if (!this.initialized) {
   -     throw new HookRegistryNotInitializedError();
   -   }
   
     return this.entries
   ```

4. **Remove guards in `getAllHooks()`** (lines 95-97):
   ```diff
   getAllHooks(): HookRegistryEntry[] {
   -   if (!this.initialized) {
   -     throw new HookRegistryNotInitializedError();
   -   }
   
     return [...this.entries];
   ```

### Phase 2: Remove Init Guards from HookSystem

**File**: `packages/core/src/hooks/hookSystem.ts`

**Changes**:

1. **Remove field** (line 56):
   ```diff
   - private initialized = false;
   ```

2. **[CORRECTED] Remove guard in `initialize()` + add disposal** (lines 98-126):
   ```diff
   async initialize(): Promise<void> {
   -   if (this.initialized) {
   -     debugLogger.debug('HookSystem already initialized, skipping');
   -     return;
   -   }
   
     debugLogger.debug('Initializing HookSystem');
   
   +   // Dispose old event handler to prevent subscription leaks (LLxprt enhancement)
   +   this.dispose();
   
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
   
   -   this.initialized = true;
   
   -   const status = this.getStatus();
   +   const totalHooks = this.registry.getAllHooks().length;
     debugLogger.log(
   -     `HookSystem initialized with ${status.totalHooks} registered hook(s)`,
   +     `HookSystem initialized with ${totalHooks} registered hook(s)`,
     );
   ```

3. **Remove guards in `getRegistry()`** (lines 135-138):
   ```diff
   getRegistry(): HookRegistry {
   -   if (!this.initialized) {
   -     throw new HookSystemNotInitializedError(
   -       'Cannot access HookRegistry before HookSystem is initialized',
   -     );
   -   }
     return this.registry;
   ```

4. **[CORRECTED] Remove guard in `getEventHandler()`** (lines 149-152):
   ```diff
   getEventHandler(): HookEventHandler {
   -   if (!this.initialized || !this.eventHandler) {
   +   if (!this.eventHandler) {
       throw new HookSystemNotInitializedError(
         'Cannot access HookEventHandler before HookSystem is initialized',
       );
     }
     return this.eventHandler;
   ```

5. **Update `isInitialized()`** (lines 171-173):
   ```diff
   isInitialized(): boolean {
   -   return this.initialized;
   +   return this.eventHandler !== null;
   ```

6. **Remove guard in `setHookEnabled()`** (lines 183-185):
   ```diff
   setHookEnabled(hookId: string, enabled: boolean): void {
   -   if (!this.initialized) {
   -     return;
   -   }
     this.registry.setHookEnabled(hookId, enabled);
   ```

7. **Remove guard in `getAllHooks()`** (lines 197-199):
   ```diff
   getAllHooks(): HookRegistryEntry[] {
   -   if (!this.initialized) {
   -     return [];
   -   }
     return this.registry.getAllHooks();
   ```

8. **Remove `getStatus()` method** (lines 161-166):
   ```diff
   - getStatus(): HookSystemStatus {
   -   return {
   -     initialized: this.initialized,
   -     totalHooks: this.initialized ? this.registry.getAllHooks().length : 0,
   -   };
   - }
   ```

9. **Remove `HookSystemStatus` interface** (lines 29-32):
   ```diff
   - export interface HookSystemStatus {
   -   initialized: boolean;
   -   totalHooks: number;
   - }
   ```

10. **Update docs to remove HOOK-009** (lines 9, 27, 46):
    ```diff
    - * @requirement:HOOK-001,HOOK-003,HOOK-004,HOOK-005,HOOK-006,HOOK-007,HOOK-008,HOOK-009,HOOK-142
    + * @requirement:HOOK-001,HOOK-003,HOOK-004,HOOK-005,HOOK-006,HOOK-007,HOOK-008,HOOK-142
    
    - * Status information for the HookSystem
    - * @requirement:HOOK-009
    - */
    
    - * @requirement:HOOK-006 - Exposes getRegistry(), getEventHandler(), getStatus() as public accessors
    + * @requirement:HOOK-006 - Exposes getRegistry(), getEventHandler() as public accessors
    
    - * @requirement:HOOK-009 - getStatus() reports { initialized: boolean; totalHooks: number }
    ```

### Phase 3: **[CORRECTED]** Update Extension Loader

**File**: `packages/core/src/utils/extensionLoader.ts`

**[CORRECTED] Current code** (lines 129-143):
```typescript
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
  }
}
```

**[CORRECTED] Change**:
Add hook system initialization AFTER memory refresh:

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
+   await this.config.getHookSystem()?.initialize();
  }
}
```

**[CORRECTED] Rationale**:
- This matches upstream pattern of refreshing hooks after memory refresh
- Hooks are refreshed only once after all extension operations complete
- Prevents multiple hook refreshes during batch extension operations

**[CORRECTED] Note**: The functions `maybeStartExtension()` and `maybeStopExtension()` already return `Promise<void> | undefined` and are already being awaited by callers, so no signature changes needed.

### Phase 4: **[CORRECTED]** Update Tests

**File**: `packages/core/src/hooks/hookSystem.test.ts`

**Remove**:
1. Test: `should only initialize once on multiple calls` (lines 94-108)
2. Test: `should report correct status before initialization` (lines 75-80)
3. Test: `should report correct status after initialization` (lines 127-134)
4. Test: `should return HookSystemStatus interface` (lines 200-208)

**[CORRECTED] Modify**:
Test: `should initialize HookSystem successfully` (lines 84-92) — Remove `getStatus()` call since it's being removed, just verify `isInitialized()`:
```diff
it('should initialize HookSystem successfully', async () => {
  await hookSystem.initialize();

  expect(hookSystem.isInitialized()).toBe(true);
  expect(mockDebugLogger.log).toHaveBeenCalledWith(
    expect.stringContaining('HookSystem initialized'),
  );
});
```

**[CORRECTED] Keep but update**:
Test: `with configured hooks` (lines 211-243) — Change from `getStatus()` to direct `getAllHooks()`:
```diff
it('should report correct hook count after initialization', async () => {
  // ... setup code ...
  await configuredHookSystem.initialize();

- const status = configuredHookSystem.getStatus();
- expect(status.initialized).toBe(true);
- expect(status.totalHooks).toBe(1);
+ const hooks = configuredHookSystem.getAllHooks();
+ expect(configuredHookSystem.isInitialized()).toBe(true);
+ expect(hooks.length).toBe(1);
});
```

**File**: `packages/core/src/hooks/hookRegistry.test.ts`

**Remove**:
Test: `should throw error if not initialized` (lines 264-270)

### Phase 5: **[CORRECTED]** No Extension Manager Changes

**[CORRECTED]** LLxprt does NOT have `packages/cli/src/config/extension-manager.ts`. This file only exists in upstream Gemini. No changes needed.

## Testing Strategy

### Unit Tests

**Modified Tests** (should still pass):
- `HookSystem.initialize()` can be called multiple times → no error, re-reads config
- `HookRegistry.initialize()` can be called multiple times → re-reads config
- Hooks are accessible without throwing "not initialized" errors (remove those tests)

**New Behavior to Test**:
1. **[CORRECTED] Re-init updates registry and disposes old handler**:
   ```typescript
   const messageBusMock = { 
     subscribe: vi.fn(() => vi.fn()), // Return unsubscribe function
     publish: vi.fn() 
   };
   const hookSystem = new HookSystem(mockConfig, messageBusMock);
   
   await hookSystem.initialize(); // Load initial hooks
   const before = hookSystem.getAllHooks().length;
   
   // Simulate extension config change (mock config.getExtensions())
   mockConfig.getExtensions.mockReturnValue([
     { name: 'ext1', isActive: true, hooks: { BeforeTool: [...] } }
   ]);
   
   await hookSystem.initialize(); // Re-init
   const after = hookSystem.getAllHooks().length;
   
   expect(after).not.toBe(before); // Hook count changed
   ```

2. **[CORRECTED] Disposal prevents leaks**:
   ```typescript
   const unsubscribeMock = vi.fn();
   const messageBusMock = { 
     subscribe: vi.fn(() => unsubscribeMock),
     publish: vi.fn() 
   };
   const hookSystem = new HookSystem(mockConfig, messageBusMock);
   
   await hookSystem.initialize(); // Creates handler, subscribes
   expect(messageBusMock.subscribe).toHaveBeenCalledTimes(1);
   
   await hookSystem.initialize(); // Disposes old, creates new
   expect(unsubscribeMock).toHaveBeenCalledTimes(1); // Old subscription cleaned up
   expect(messageBusMock.subscribe).toHaveBeenCalledTimes(2); // New subscription created
   ```

### Integration Tests

**Scenario**: Enable extension with hooks, verify hooks fire, disable extension, verify hooks don't fire.

**File**: `integration-tests/hooks/hooks-e2e.integration.test.ts` (if exists)

**Test**:
```typescript
it('should reload hooks when extension changes', async () => {
  const config = createTestConfig({ extensions: [] });
  const hookSystem = config.getHookSystem();
  await hookSystem.initialize();
  
  expect(hookSystem.getAllHooks()).toHaveLength(0);
  
  // Add extension with hooks
  config.addExtension({
    name: 'test-ext',
    isActive: true,
    hooks: {
      BeforeTool: [{ hooks: [{ type: 'command', command: 'echo test' }] }],
    },
  });
  
  await hookSystem.initialize(); // Re-init
  expect(hookSystem.getAllHooks()).toHaveLength(1);
});
```

### Manual Verification

**Steps**:
1. Start CLI with extension disabled
2. Run `llxprt hooks list` → No extension hooks
3. Enable extension with hooks: `llxprt extensions enable my-ext`
4. Run `llxprt hooks list` → Extension hooks appear
5. Disable extension: `llxprt extensions disable my-ext`
6. Run `llxprt hooks list` → Extension hooks gone

## Migration Notes

### Breaking Changes

**API Changes**:
1. `HookSystem.getStatus()` removed → Use `getAllHooks().length` and `isInitialized()` instead
2. `HookSystemStatus` interface removed
3. `HookRegistryNotInitializedError` removed → No throws on uninitialized access

**Behavioral Changes**:
1. `initialize()` no longer idempotent → Re-initializes on every call
2. Old event handlers are disposed before re-init → Prevents leaks
3. `isInitialized()` now checks `eventHandler !== null` instead of `initialized` flag

### User Impact

**None**. This is a bug fix — users will now correctly see extension hooks update without restarting.

### Rollback Plan

If issues arise:
1. Restore `initialized` flags
2. Restore guards
3. Restore `HookRegistryNotInitializedError` class
4. Restore `getStatus()` method and `HookSystemStatus` interface
5. Remove disposal logic from `initialize()`
6. Remove `hookSystem.initialize()` call from extension loader

## File Checklist

### Files to Modify

- [ ] `packages/core/src/hooks/hookRegistry.ts` — Remove guards, `initialized` flag, error class
- [ ] `packages/core/src/hooks/hookSystem.ts` — Remove guards, `initialized` flag, `getStatus()`, `HookSystemStatus`, add disposal, update docs
- [ ] `packages/core/src/utils/extensionLoader.ts` — Add `hookSystem.initialize()` call in `maybeRefreshMemory()`
- [ ] `packages/core/src/hooks/hookSystem.test.ts` — Remove obsolete tests, update assertions
- [ ] `packages/core/src/hooks/hookRegistry.test.ts` — Remove "not initialized" test

### Files NOT Modified (Check Only)

- `packages/core/src/hooks/hookEventHandler.ts` — Already has `dispose()` method and subscription cleanup
- `packages/core/src/config/config.ts` — Already has `getHookSystem()` lazy init
- **[CORRECTED]** `packages/cli/src/config/extension-manager.ts` — Does NOT exist in LLxprt (upstream only)

## Commit Message

```
reimplement: hook refresh on extension change (upstream 126c32ac)

Fixes silent bug where hooks from extensions don't reload after enable/disable
because initialization guards block re-initialization.

Changes:
1. Remove `initialized` flags from HookSystem and HookRegistry (upstream)
2. Remove init guards from initialize(), getHooksForEvent(), getAllHooks() (upstream)
3. Remove HookRegistryNotInitializedError class (upstream)
4. Remove getStatus() method and HookSystemStatus interface from HookSystem (upstream)
5. Update isInitialized() to check eventHandler !== null instead of flag (upstream)
6. Call hookSystem.initialize() in extensionLoader after refreshMemory() (upstream)
7. ADD: Dispose old HookEventHandler before re-init to prevent subscription leaks (LLxprt enhancement)

Effect:
- HookSystem.initialize() can now be called multiple times to reload config
- Extension loader calls initialize() after extension changes
- Old event handlers are properly disposed (prevents MessageBus subscription leaks)

Upstream forgot disposal because Gemini doesn't have MessageBus integration.
LLxprt added MessageBus in PLAN-20250218-HOOKSYSTEM.P03 (DELTA-HEVT-001),
so we must dispose subscriptions to prevent leaks.

Upstream: 126c32aca4972deba80a875f749fcee1367c4486
Fixes: https://github.com/google/genkit/pull/14918
```

## Risk Assessment

**Risk Level**: MEDIUM

**Rationale**:
1. **Removes safety guards** — Code that relied on "not initialized" errors will break
2. **Changes re-init semantics** — Must ensure no callers assume idempotence
3. **Adds disposal logic** — Incorrect disposal could break event handling

**High-Risk Areas**:
1. `getEventHandler()` after re-init — Must return new handler, not stale one
2. MessageBus subscriptions — Must verify unsubscribe works correctly
3. Concurrent initialize() calls — Not thread-safe (but JS is single-threaded)

**Mitigation**:
1. Run full test suite (unit + integration)
2. Test extension enable/disable cycle manually
3. Monitor for memory leaks in long-running sessions
4. Verify MessageBus subscription count doesn't grow unbounded

## Success Criteria

1. Extension hooks reload without CLI restart
2. No "not initialized" errors thrown (remove those tests)
3. No MessageBus subscription leaks (verify with mock)
4. All hook tests pass
5. `llxprt hooks list` reflects extension changes immediately
6. No memory growth after repeated enable/disable cycles

## **[CORRECTED]** Critical Inaccuracy Summary

The original plan had several critical inaccuracies that were corrected:

1. **Disposal Infrastructure**: The original plan stated that disposal needed to be added, but LLxprt ALREADY has full disposal infrastructure (`HookSystem.dispose()`, `HookEventHandler.dispose()`, `subscriptionHandle`). The fix is to CALL `this.dispose()` before re-creating the handler.

2. **Extension Loader**: The original plan claimed the hook system call should already exist in `extensionLoader.ts`, but it does NOT. LLxprt's `maybeRefreshMemory()` only calls `config.refreshMemory()`, not `hookSystem.initialize()`. This call must be ADDED.

3. **Extension Manager**: The original plan included changes to `packages/cli/src/config/extension-manager.ts`, but this file does NOT exist in LLxprt (it's upstream Gemini only). This section was removed.

4. **Test Updates**: The original plan missed several `getStatus()` tests that need removal (lines 75-80, 127-134, 200-208 in hookSystem.test.ts).

5. **Lifecycle Assumptions**: The original plan claimed "LLxprt added MessageBus integration" as the reason for needing disposal. This is CORRECT — HookEventHandler subscribes to MessageBus in constructor (line 152) and stores the unsubscribe function. The disposal logic exists but wasn't being called before re-init.

All line numbers were verified against actual source code and are correct.
