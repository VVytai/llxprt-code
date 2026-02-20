# REIMPLEMENT: b27cf0b0a8dd - Move continue/restore logic to core

## Summary
Upstream commit b27cf0b0a8dd moves restore command logic from CLI to core package by creating `packages/core/src/commands/restore.ts` with a `performRestore()` generator function. LLxprt uses `/continue` instead of `/restore`, but the underlying logic is conceptually similar (though LLxprt's implementation is more complex, using `performResume()` for full session swapping). This reimplement adapts the pattern for potential future use where certain command logic benefits from being in core for shared/testable abstractions.

## Upstream Changes

### Files Modified:
1. **packages/core/src/commands/restore.ts** (NEW)
   - Adds `ToolCallData<HistoryType, ArgsType>` interface for checkpoint data structure
   - Adds `performRestore()` async generator that yields `CommandActionReturn<HistoryType>` events
   - Core logic: restore history, restore git snapshot, handle errors
   
2. **packages/core/src/commands/restore.test.ts** (NEW)
   - Unit tests for `performRestore()` generator
   - Tests various scenarios: history restore, git restore, error handling
   
3. **packages/core/src/commands/types.ts** (NEW)
   - Defines `ToolActionReturn`, `MessageActionReturn`, `LoadHistoryActionReturn`, `SubmitPromptActionReturn`
   - Defines `CommandActionReturn<HistoryType>` as discriminated union
   - These types were previously in `packages/cli/src/ui/commands/types.ts`

4. **packages/core/src/index.ts**
   - Exports new command modules: `restore.js` and `types.js`

5. **packages/cli/src/ui/commands/types.ts**
   - Imports `CommandActionReturn` from core instead of defining locally
   - Removes `ToolActionReturn`, `MessageActionReturn`, `LoadHistoryActionReturn`, `SubmitPromptActionReturn`
   - Updates `SlashCommandActionReturn` to use `CommandActionReturn<HistoryItemWithoutId[]>` from core

6. **packages/cli/src/ui/commands/restoreCommand.ts**
   - Uses `performRestore()` generator from core
   - Adds Zod schemas for validation (`HistoryItemSchema`, `ContentSchema`, `ToolCallDataSchema`)
   - Iterates over generator results to handle actions (message, load_history)
   - Simplified action logic delegated to core

7. **packages/cli/src/ui/commands/restoreCommand.test.ts**
   - Updated test expectations for error messages and data structure

8. **packages/cli/src/ui/hooks/useGeminiStream.ts**
   - Uses `ToolCallData` type from core
   - Checkpoint data now typed with core interface

9. **Other CLI files**
   - Import type changes: various files now import action return types from core

## LLxprt Adaptation

### Key Differences:
1. **LLxprt's `/continue` vs Upstream's `/restore`:**
   - Upstream `/restore` restores a checkpoint from a tool call (history + git snapshot)
   - LLxprt `/continue` resumes an entire session (session browser, recording swap, full history)
   - LLxprt already has `performResume()` in `packages/cli/src/services/performResume.ts`

2. **LLxprt's Current Architecture:**
   - `continueCommand.ts` returns `PerformResumeActionReturn` type
   - `slashCommandProcessor.ts` handles `perform_resume` action and calls `performResume()`
   - `performResume()` is a full service function (not a generator), handles session discovery, locking, recording swap
   - No checkpoint/tool-call restore feature in LLxprt (yet)

3. **Adaptation Strategy:**
   - **Option A (Conservative):** Don't move continue logic to core yet. LLxprt's session resume is CLI-specific (uses UI state, recording integration, React context). Core migration would require significant refactoring.
   - **Option B (Aligned with Upstream):** Move shared types to core (`CommandActionReturn` types) to align with upstream architecture, even if continue logic stays in CLI.
   - **Option C (Future-Proof):** Create a core abstraction for session operations (history loading, metadata swapping) that CLI can use, similar to upstream's generator pattern.

### Recommended Approach: **Option B (Partial Alignment)**
Move command action return types to core, keep continue/resume logic in CLI for now. This:
- Aligns type system with upstream
- Enables future code sharing
- Doesn't force premature abstraction of CLI-specific session logic
- Reduces merge conflicts on shared types

### Future Consideration:
If LLxprt adds checkpoint/tool-call restore (similar to upstream's feature), that logic should go in core following upstream's generator pattern.

## Implementation Steps

### Phase 1: Move Command Action Types to Core
1. Create `packages/core/src/commands/types.ts` with:
   - `ToolActionReturn`
   - `MessageActionReturn`
   - `LoadHistoryActionReturn<HistoryType>`
   - `SubmitPromptActionReturn`
   - `CommandActionReturn<HistoryType>` union type
   
2. Update `packages/core/src/index.ts`:
   - Export `* from './commands/types.js'`

3. Update `packages/cli/src/ui/commands/types.ts`:
   - Import `CommandActionReturn` from `@vybestack/llxprt-code-core`
   - Remove local definitions of `ToolActionReturn`, `MessageActionReturn`, `LoadHistoryActionReturn`, `SubmitPromptActionReturn`
   - Update `SlashCommandActionReturn` to include `CommandActionReturn<HistoryItemWithoutId[]>` from core
   - Keep `PerformResumeActionReturn`, `OpenDialogActionReturn`, `ConfirmShellCommandsActionReturn`, `ConfirmActionReturn` in CLI (UI-specific)

4. Fix import paths in all CLI files that reference action return types

### Phase 2: Verify and Test
5. Run `npm run typecheck` to ensure no type errors
6. Run `npm run test` to ensure all tests pass
7. Run `npm run build` to ensure clean build
8. Test `/continue` command manually with haiku test

### Phase 3: Documentation
9. Add inline comments referencing upstream commit: `@upstream b27cf0b0a8dd`
10. Document in this file why full continue logic stays in CLI

## Files to Create/Modify

### Create:
- `packages/core/src/commands/types.ts` - Command action return types (adapted from upstream)

### Modify:
- `packages/core/src/index.ts` - Add export for commands/types
- `packages/cli/src/ui/commands/types.ts` - Remove duplicated types, import from core
- (Multiple CLI files) - Update imports for action return types

### No Changes Needed:
- `packages/cli/src/ui/commands/continueCommand.ts` - Logic stays in CLI
- `packages/cli/src/services/performResume.ts` - Implementation stays in CLI
- `packages/cli/src/ui/hooks/slashCommandProcessor.ts` - Action handling stays in CLI

## Testing

### Type Safety:
```bash
npm run typecheck
```
Should pass with no errors.

### Unit Tests:
```bash
npm run test
```
Specifically verify:
- `packages/cli/src/ui/commands/__tests__/continueCommand.spec.ts`
- `packages/cli/src/__tests__/sessionBrowserE2E.spec.ts`
- `packages/cli/src/services/__tests__/performResume.spec.ts`

### Integration Test:
```bash
npm run build
node scripts/start.js --profile-load synthetic "write me a haiku"
```

### Manual Verification:
1. Start CLI: `npm start`
2. Enter a prompt to create history
3. Test `/continue` (should open session browser in interactive mode)
4. Test `/continue latest` with active conversation (should prompt confirmation)
5. Test `/continue latest` in non-interactive mode (should show error)

## Estimated Effort

**2-3 hours**

Breakdown:
- 30 min: Create core types file and understand upstream structure
- 30 min: Update core index.ts exports
- 45 min: Refactor CLI types.ts and update imports across CLI files
- 30 min: Run full verification suite (typecheck, lint, format, test, build)
- 15 min: Manual testing with haiku test and /continue command
- 15 min: Documentation and commit preparation

## Notes

### Why Not Move Continue Logic to Core?
LLxprt's `/continue` is tightly coupled to CLI concerns:
- Uses `RecordingIntegration` (CLI-specific state management)
- Requires `RecordingSwapCallbacks` (mutable React state)
- Depends on `SessionRecordingService` (filesystem-specific implementation)
- Handles UI-specific concerns (confirmation dialogs, active conversation checks)

Moving this to core would require:
- Creating core abstractions for session state management
- Abstracting recording infrastructure (significant refactor)
- Potentially limiting CLI flexibility

Upstream's `/restore` is simpler (just history + git restore), making it suitable for core. LLxprt's feature is more complex and benefits from staying in CLI for now.

### Alignment Benefits:
By moving shared types to core:
- Easier to merge future upstream changes
- Shared vocabulary between CLI and potential future core session features
- Foundation for extracting core session logic later if needed

### Future Work:
If LLxprt adds tool-call checkpointing (like upstream's `/restore`), that logic should go in `packages/core/src/commands/restore.ts` following upstream's generator pattern.

## Related Upstream Files (Reference)

For context, upstream's implementation:

```typescript
// packages/core/src/commands/restore.ts (simplified)
export async function* performRestore<HistoryType, ArgsType>(
  toolCallData: ToolCallData<HistoryType, ArgsType>,
  gitService: GitService | undefined,
): AsyncGenerator<CommandActionReturn<HistoryType>> {
  if (toolCallData.history && toolCallData.clientHistory) {
    yield {
      type: 'load_history',
      history: toolCallData.history,
      clientHistory: toolCallData.clientHistory,
    };
  }
  
  if (toolCallData.commitHash) {
    if (!gitService) {
      yield { type: 'message', messageType: 'error', content: '...' };
      return;
    }
    await gitService.restoreProjectFromSnapshot(toolCallData.commitHash);
    yield { type: 'message', messageType: 'info', content: 'Restored...' };
  }
}
```

This pattern could inspire future LLxprt session management improvements, but is not required for basic type alignment.
