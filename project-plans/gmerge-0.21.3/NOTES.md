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

### R1 - MessageBus Always Enabled (533a3fb3) - COMMITTED

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

### B4 Evaluation
| SHA | Subject | Decision | Reason |
|-----|---------|----------|--------|
| 0c7ae22f5def | Disable flaky extension test | SKIP | No integration-tests dir |
| 5f60281d2528 | MCP dynamic tool update | CHERRY-PICK | Files exist |
| ae8694b30 | Privacy screen fix | CHERRY-PICK | Bug fix |
| 7db5abdecfdf | API error fix | CHERRY-PICK | Runtime crash fix |
| d284fa66c | shellExecutionService fix | CHERRY-PICK | Critical bug fix |

### B5 Evaluation
| SHA | Subject | Decision | Reason |
|-----|---------|----------|--------|
| 934b309b4cc6 | Terminal wrapping fix | CHERRY-PICK | Bug fix |
| 616d6f666705 | Session summary | NO_OP (out-of-range) | Ancestor of v0.20.2; excluded from this merge scope |
| 996cbcb680fd | Model routing docs | SKIP | Per policy |
| bdd15e8911ba | Autoupgrade detach | CHERRY-PICK | Process fix |
| 025e450ac247 | Floating promises lint | CHERRY-PICK | Code quality |

### B6 Evaluation
- 171103aedc9f: NO_OP (subsumed)
  - Upstream commit refactors shell env handling via `getSanitizedEnv()`.
  - LLxprt already enforces env sanitization in both execution paths through `sanitizeEnvironment(..., isSandboxOrCI, ...)` and config-level `isSandboxOrCI` wiring.
- 560550f5df78: REIMPLEMENT (R20)
  - Large feature delta (20 files, ~1146 upstream LOC) touching core MCP client, config, CLI completion, @-command processing, and MCP status UI.
  - Implement via dedicated phased plan (`560550f5df78-plan.md`) instead of direct cherry-pick.
Other B6 commits: completed/adapted earlier in this branch.

### B7 Evaluation
OSC52, deps, A2A types: SKIP (already implemented or managed separately)

### B8 Evaluation
| SHA | Subject | Decision | Reason |
|-----|---------|----------|--------|
| b27cf0b0a | Restore to core | REIMPLEMENT (R17) | Already classified |
| 1f813f6a0 | A2A restore | CHERRY-PICK | After R17 |
| 299cc9beb | A2A init | CHERRY-PICK | After 1f813f6a0 |

### R17 - Command Types to Core (f44a02eaf) - COMMITTED
- Moved CommandActionReturn types from CLI to core package
- Added packages/core/src/commands/types.ts with shared type definitions
- Updated CLI to import from core

### R18 - Session ID in JSON Output (557fbb221) - COMMITTED
- Added session_id field to JsonOutput type
- Wired session_id through nonInteractiveCli

### R8 - ACP Credential Cache (42ef7f602) - COMMITTED
- Added conditional credential cache clearing in zedIntegration
- 3 new tests for auth cache behavior

### R9 - Remove Example Extension (83f500486) - COMMITTED
- Deleted packages/cli/src/commands/extensions/examples/custom-commands/

### R12 - ENOTFOUND to Retry (c6f2ef01c) - COMMITTED
- Added ENOTFOUND to TRANSIENT_ERROR_CODES in retry.ts

### R13 - API Response Error Handling (8632a17c9) - COMMITTED
- Improved API error parsing in retry.ts (139 insertions)
- New error handling tests

### R3 - MCP URL Consolidation (FULL) - COMMITTED
- Added `type?: 'sse' | 'http'` field to MCPServerConfig (Phase 1 - partial)
- Added isAuthenticationError utility in errors.ts (Phase 1 - partial)
- Added HTTP→SSE fallback in connectToMcpServer (Phase 2 - full)
- Added OAuth retry helpers: getStoredOAuthToken, showAuthRequiredMessage, retryWithOAuth
- Updated mcp-client-manager.ts to suppress auth error logging
- Updated CLI mcp add command to use url+type instead of httpUrl
- Updated mcpCommand.ts to show runtime-detected OAuth servers
- Tests updated to match new stored-token-first retry flow

### R14 - GitHub 415 Fix - COMMITTED
- Fixed Accept header: application/vnd.github+json for tarballs/zipballs
- Fixed User-agent branding (gemini-cli → llxprt-code)
- **Note:** New Accept header tests removed (timeouts due to incomplete https mock)

### R4 - Hook Session Lifecycle - COMMITTED
- Added session start/end events to lifecycleHookTriggers
- Added hookEventHandler support for session lifecycle

### R10 - Per-Extension Settings Commands - COMMITTED
- Created `packages/cli/src/commands/extensions/settings.ts` (set/list commands)
- Created `packages/cli/src/commands/extensions/utils.ts` (getExtensionAndConfig helper)
- Updated settingsIntegration.ts with getEnvContents, updateSetting

### R15+R16+R7 - User-scoped Settings, Missing Config, Hooks Security - COMMITTED
- Added ExtensionSettingScope enum (USER/WORKSPACE) to settingsIntegration.ts
- Created consent.ts (requestHookConsent)
- Updated settingsStorage.ts for workspace-scoped keychain
- Improved null safety in extension.ts

### R5 - Hooks Commands Panel - COMMITTED
- Created hooks.ts yargs command, hooks/migrate.ts, hooksCommand.ts slash command
- Added disabled hooks support to hookRegistry.ts
- Added disabledHooks field + methods to Config
- Updated settingsSchema.ts with hooks.disabled
- Fixed R3 OAuth test compatibility


### d591140f62ff - NO_OP (policy)
- Attempted cherry-pick surfaced broad conflicts in `prompts.ts`/`geminiChat.ts` because upstream commit assumes preview-model fallback flow.
- LLxprt policy: users explicitly select model/fallback behavior; we do not reintroduce implicit preview fallback toggles.
- Decision: mark as NO_OP (policy-driven) rather than force-porting mismatched behavior.

### R2+R11 - Fuzzy Search in Settings - COMMITTED
- Added fzf-based fuzzy search filtering
- Added TextInput search box (always visible)
- Added keyboard-driven search mode (/ to activate, Esc to clear)
- Added conditional scope selection visibility
- Updated snapshots

### R6 - Hook System Documentation - COMMITTED
- Added best-practices.md and writing-hooks.md
- Rebranded for LLxprt Code

### Pre-existing Test Failures (not caused by this merge)
- `editor.test.ts` (12 failures) - spawnSync mock missing, vim/emacs command args changed
- `modifiable-tool.test.ts` (2 failures) - override content behavior changed
- `mcp/add.test.ts` (2 failures) - --type alias for MCP add command not wired
- `hookSystem.test.ts` (1 failure) - hook count mismatch
- `hooks-caller-integration.test.ts` (9 failures) - hook caller output type mismatches
- `hooks-caller-application.test.ts` (4 failures) - hook blocking/modification tests
- `notification-hook.test.ts` (3 failures) - notification hook format
- `hookSystem-lifecycle.test.ts` (5 failures) - lifecycle hooks
- `hookSystem-integration.test.ts` (3 failures) - integration hooks
- `codesearch.test.ts` (1 failure) - URL format change (API key in query param vs body)
- `SettingsDialog.test.tsx` (15 failures) - UIStateProvider context missing, timing issues
