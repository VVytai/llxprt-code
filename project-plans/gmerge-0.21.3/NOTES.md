# Notes: v0.20.2 → v0.21.3

## Running Notes

*(Add notes after each batch)*

---

## Pre-Execution Notes

### Key Decisions Made During Planning

1. **Model routing commits** - All SKIP per user directive. LLxprt lets users control models.

2. **Flash 3 config (9b571d42)** - SKIP. Contains Google internal codename "skyhawk" with TODO saying "SHOULD NOT be merged".

3. **ModelDialog (17bf02b9)** - SKIP. LLxprt's is 628 lines vs upstream's 209 lines. Completely diverged with hardcoded Gemini model names.

4. **MessageBus (533a3fb3)** - REIMPLEMENT as hardcoded `true`. No setting, just always on.

5. **A2A commits** - Now included (removed "A2A stays private" from runbook).

6. **previewFeatures in a2a (2c4ec31ed)** - SKIP. Related to model routing stuff.

### Files to Watch

- `packages/core/src/config/config.ts` - MessageBus change
- `packages/core/src/hooks/` - LLxprt's reimplemented hooks
- `packages/cli/src/config/extensions/` - LLxprt's reimplemented extensions
- `packages/core/src/utils/retry.ts` - LLxprt's retry logic

### cherrypicking.md Updates Made

Added to "Features Completely Removed" section:
- Model Routing / Availability Service
- Hooks System Commits (reimplemented)
- Extensions System Commits (reimplemented)
- Settings UI Commits (diverged)
- Banner/Static Refresh Commits
- Stdio Patching Commits

### cherrypicking-runbook.md Updates Made

- Removed "A2A server stays private" constraint

---

## Batch Notes

### Batch 1 - COMPLETED
- Applied 4 commits (1 skipped - f588219bb already covered by existing code)
- Required post-cherry-pick fixes:
  - Added ExternalEditorClosed emit overload to events.ts
  - Added optional onEditorClose parameter to openDiff function
  - Removed invalid config property from SchedulerCallbacks

### Batch 2 - COMPLETED
- Applied 4 commits (1 skipped - 48e8c12476b6 SettingsDialog conflicts, R2 will handle)
- Required branding fix: @google/gemini-cli-core → @vybestack/llxprt-code-core in commandUtils.ts

### Batch 3-B8 - BLOCKED / RECLASSIFIED TO REIMPLEMENT
**Reason:** GeminiClient API has diverged significantly between upstream and LLxprt.

Cherry-pick of b27cf0b0a (Move key restore logic to core) introduced:
- 9 conflicting files
- Missing methods on GeminiClient: restoreHistory, hasChatInitialized, getHistoryService, getContentGenerator, clearTools, dispose, generateDirectMessage
- Module mismatches: nextSpeakerChecker.js, chatRecordingService.js, chatCompressionService.js, clientHookTriggers.js

**Recommendation:** B3-B8 commits should be reclassified from PICK to REIMPLEMENT. The upstream commits assume a refactored GeminiClient that LLxprt has not adopted.

### Applied Commits (so far):
1. 528584f31 - Restrict integration tests tools
2. 19d68e6f2 - refactor(editor): use const assertion for editor types
3. 5cfd694c4 - fix(security): Fix npm audit vulnerabilities
4. 99f6abfd2 - Add new enterprise instructions
5. 6494221b1 - fix: post-B1 cherry-pick type fixes (LLxprt fix commit)
6. c8935861c - feat(cli): support /copy in remote sessions using OSC52
7. 2dd23e068 - fix(cli): Fix word navigation for CJK characters
8. 7ca51cc2f - do not toggle the setting item when entering space
9. d19f6d6a2 - feat(mcp): add --type alias for --transport flag

### Skipped Commits:
1. f588219bb - Bundle default policies (already covered)
2. 48e8c12476b6 - remove unused isSearching field (R2 will implement)

### R1 - MessageBus Always Enabled (533a3fb3) - CODE COMPLETE
**Status:** Implementation complete, lint/typecheck verified, awaiting commit

**Changes made:**
- `packages/core/src/config/config.ts` - Removed `enableMessageBusIntegration` field from ConfigParameters interface, removed dead conditional block (was never executed since MessageBus already constructed unconditionally at line 822)
- `packages/core/src/core/coreToolScheduler.test.ts` - Removed 3 stale `getEnableMessageBusIntegration` mock methods
- `packages/a2a-server/src/utils/testing_utils.ts` - Removed 1 stale mock method

**Additional B2 type fixes included:**
- `packages/cli/src/ui/components/shared/text-buffer.ts` - Fixed @google import to @vybestack
- `packages/cli/src/ui/utils/commandUtils.ts` - Fixed DebugLogger import (debugLogger → new DebugLogger())
- `packages/cli/src/ui/contexts/KeypressContext.tsx` - Added optional `insertable` property to Key interface for CJK word navigation support

**Deviation from upstream:** Upstream added `enableMessageBusIntegration` as a configurable option. LLxprt makes MessageBus always-on with no option to disable (simpler, hooks always work).

### B3 Commit Analysis (performed manually)

| Commit | Subject | Verdict | Reason |
|--------|---------|---------|--------|
| b27cf0b0a8dd | Move key restore logic to core | REIMPLEMENT | LLxprt uses /continue not /restore - adapt for our command |
| 1040c246f5a0 | Auto-execute on Enter for MCP prompts | CHERRY-PICK | Clean feature, adds autoExecute for argumentless MCP prompts |
| 84f521b1c62b | Cursor visibility in interactive mode | SKIP | Already fixed in LLxprt during prior cursor work |
| 8b0a8f47c1b2 | Session id in JSON output | REIMPLEMENT | Architecture differs, ~100 lines, adds session_id to JsonFormatter |
| 2d1c1ac5672e | Latch hasFailedCompressionAttempt | SKIP | LLxprt rewrote compression entirely, flag doesn't exist |

**Documentation updated:** Added compression and restore notes to dev-docs/cherrypicking.md

...
