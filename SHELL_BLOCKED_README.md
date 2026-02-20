# Shell Execution Blocked - Manual Action Required

The AI session encountered a `posix_spawnp` shell failure. All code changes are complete but uncommitted.

## Run These Commands

```bash
git add -A
git commit -m 'refactor(core): MessageBus always enabled + B2 type fixes'
rm SHELL_BLOCKED_README.md
```

## What Was Changed

### R1: MessageBus Always Enabled (533a3fb3)
- `packages/core/src/config/config.ts` - Removed `enableMessageBusIntegration` field and dead conditional
- `packages/core/src/core/coreToolScheduler.test.ts` - Removed 3 stale mock methods
- `packages/a2a-server/src/utils/testing_utils.ts` - Removed 1 stale mock method

### B2 Type Fixes
- `packages/cli/src/ui/components/shared/text-buffer.ts` - Fixed @google import to @vybestack
- `packages/cli/src/ui/utils/commandUtils.ts` - Fixed DebugLogger import
- `packages/cli/src/ui/contexts/KeypressContext.tsx` - Added `insertable` property to Key interface

## Verification Status
- [OK] Lint passed
- [OK] Typecheck passed
-  Commit pending (blocked by shell failure)

After committing, resume the AI session to continue with R1-review and remaining tasks.
