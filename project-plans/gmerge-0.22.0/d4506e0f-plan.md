# Reimplementation Plan: Add transcript_path to Hook Events

**Upstream Commit:** d4506e0fc06c54727c4f627a06a59609df4b66ca  
**Date:** Wed Dec 10 15:44:30 2025 -0500  
**Author:** Sasha Varlamov <sasha@sashavarlamov.com>

## Overview

This commit adds support for `transcript_path` in hook event payloads, providing hooks with the path to the current session's transcript file. This enables external tools and scripts to access the full conversation context.

## What Upstream Does

Upstream adds `transcript_path` to the base hook input by:

1. **In `hookEventHandler.ts`:**
   - Modifies `createBaseInput()` to fetch the transcript path from `chatRecordingService`
   - Chains through `config.getGeminiClient()?.getChatRecordingService()?.getConversationFilePath()`
   - Provides empty string fallback if service not available

2. **In `chatRecordingService.ts`:**
   - Adds new method `getConversationFilePath(): string | null`
   - Returns `this.conversationFile` which tracks the current recording file path

3. **In tests:**
   - Updates mock config to include the full service chain
   - Changes assertion from empty string to actual file path

## Why Can't Cherry-Pick

LLxprt Code has architectural differences:

- **Upstream:** Uses `ChatRecordingService` class accessed via `config.getGeminiClient().getChatRecordingService()`
- **LLxprt:** Uses `SessionRecordingService` class (different location and architecture)
- **LLxprt:** SessionRecordingService already has `getFilePath()` method (line 234 of `SessionRecordingService.ts`)
- **Access pattern differs:** LLxprt needs to wire SessionRecordingService through Config or find alternative access path

## Implementation Plan

### 1. Wire SessionRecordingService Through Config [OK]

**File:** `packages/core/src/config/config.ts`

Add a private field and getter/setter for SessionRecordingService:

```typescript
// Around line 548 (near other service fields)
private sessionRecordingService: SessionRecordingService | undefined = undefined;

// Add getter (around line 2600, with other getters)
getSessionRecordingService(): SessionRecordingService | undefined {
  return this.sessionRecordingService;
}

// Add setter (around line 2600, with other getters)
setSessionRecordingService(service: SessionRecordingService | undefined): void {
  this.sessionRecordingService = service;
}
```

### 2. Update HookEventHandler to Use SessionRecordingService [OK]

**File:** `packages/core/src/hooks/hookEventHandler.ts`

Modify `buildBaseInput()` method (around line 168):

```typescript
/**
 * Build base HookInput fields from Config
 * @requirement:HOOK-144
 */
private buildBaseInput(eventName: string): HookInput {
  // Get transcript path from SessionRecordingService if available
  const recordingService = this.config.getSessionRecordingService();
  const transcriptPath = recordingService?.getFilePath() ?? '';

  return {
    session_id: this.config.getSessionId(),
    cwd: this.config.getTargetDir(),
    timestamp: new Date().toISOString(),
    hook_event_name: eventName,
    transcript_path: transcriptPath,
  };
}
```

**Change summary:**
- Add 2 lines before the return statement to fetch transcript path
- Replace hardcoded empty string with `transcriptPath` variable

### 3. Update Tests [OK]

**File:** `packages/core/src/hooks/hookEventHandler.test.ts`

Update the mock config setup (around line 45):

```typescript
mockConfig = {
  getSessionId: vi.fn().mockReturnValue('test-session-123'),
  getTargetDir: vi.fn().mockReturnValue('/test/target'),
  getSessionRecordingService: vi.fn().mockReturnValue({
    getFilePath: vi
      .fn()
      .mockReturnValue('/test/target/.llxprt/tmp/chats/session-2025-01-20-test-session.jsonl'),
  }),
} as unknown as Config;
```

Update the assertion in the "should include session_id from config" test (around line 84):

```typescript
expect(mockRunner.executeHooksParallel).toHaveBeenCalledWith(
  plan.hookConfigs,
  'BeforeModel',
  expect.objectContaining({
    session_id: 'test-session-123',
    cwd: '/test/target',
    hook_event_name: 'BeforeModel',
    transcript_path: '/test/target/.llxprt/tmp/chats/session-2025-01-20-test-session.jsonl',
  }),
);
```

### 4. Wire SessionRecordingService in Application (Deferred)

**Note:** This step is intentionally deferred as it requires finding where SessionRecordingService is instantiated in the application layer (likely in CLI or initialization code) and calling `config.setSessionRecordingService(service)`.

**Search locations:**
- `packages/core/src/recording/resumeSession.ts` - Creates SessionRecordingService instances
- CLI initialization code - Where Config is created and services are wired up

This wiring step should be done when the feature is fully integrated, ensuring that:
1. SessionRecordingService is created during app initialization
2. `config.setSessionRecordingService(service)` is called
3. Service remains available throughout the session lifecycle

## Estimated Size

- **Lines of Code:** ~30 LoC
  - Config.ts: 8 lines (field + getter + setter)
  - hookEventHandler.ts: 4 lines (transcript path fetching)
  - hookEventHandler.test.ts: 18 lines (mock updates + assertion changes)

## Testing Verification

1. **Unit Tests:** Update existing hookEventHandler tests to verify `transcript_path` is included
2. **Integration:** Manually verify hooks receive valid transcript path when SessionRecordingService is active
3. **Fallback:** Verify empty string when SessionRecordingService is not set (backward compatibility)

## Commit Message

```
reimplement: add transcript_path to hook events (upstream d4506e0f)

Add transcript_path field to hook event base input, populated from
SessionRecordingService.getFilePath(). This provides hooks with access
to the current session's transcript file path.

Wire SessionRecordingService through Config with getter/setter methods.
Update hookEventHandler.buildBaseInput() to fetch transcript path from
recording service, falling back to empty string if unavailable.

Update tests to mock SessionRecordingService and verify transcript_path
is correctly included in hook event payloads.

Upstream: d4506e0fc06c54727c4f627a06a59609df4b66ca
```

## Notes

- SessionRecordingService.getFilePath() returns `string | null`, so we use `?? ''` to provide empty string fallback
- The transcript file is only created after first content event (deferred materialization), so early hooks may receive empty string
- This matches upstream's fallback behavior when ChatRecordingService is unavailable
- Application-level wiring (step 4) should be done when fully integrating session recording with the hook system
