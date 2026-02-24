# Reimplementation Plan: commandPrefix Safety Fix (Upstream a47af8e2)

**Upstream Commit:** `a47af8e261ad72ee9365bab397990f25eb4c82ae`  
**Author:** Allen Hutchison <adh@google.com>  
**Date:** Fri Dec 12 15:02:19 2025 -0800  
**Title:** fix(core): commandPrefix word boundary and compound command safety (#15006)

## WARNING: SECURITY CRITICAL WARNING:

This is a **SECURITY FIX** that prevents two classes of shell command escapes in policy enforcement. Getting this wrong is worse than skipping it.

---

## Executive Summary

This is a **critical security fix** that prevents two classes of shell command escapes in policy enforcement:

1. **Word Boundary Escape**: Without strict word boundaries, `commandPrefix: ["git log"]` would incorrectly match `git logout`, allowing unintended commands.
2. **Compound Command Escape**: Prefix matching alone is insufficient for compound commands like `git log && rm -rf /`. Even if `git log` is allowed, the second command (`rm -rf /`) must be independently validated.

**CRITICAL FINDING**: The original plan MISSED the coreToolScheduler changes. Upstream touches **BOTH** `policy-engine.ts` AND `coreToolScheduler.ts` via the `isShellInvocationAllowlisted` function relocation. The plan's policy-engine-only adaptation is **INCOMPLETE** and would leave LLxprt vulnerable.

---

## Problem Analysis

### Upstream Issues (Gemini)

1. **Regex without word boundary**: `"command":"${escapeRegex(prefix)}"` in `toml-loader.ts` matches prefixes literally, so `git log` matches `git logout`.
2. **No compound command validation**: `git log && rm -rf /` matches the `git log` allowlist entry, but the entire compound command is allowed without checking `rm -rf /`.

### LLxprt Current State

**Critical Architecture Difference**: LLxprt does NOT have a separate `shell-permissions.ts` module. Functions like `isShellInvocationAllowlisted` live in `tool-utils.ts`, and `isCommandAllowed` / `checkCommandPermissions` live in `shell-utils.ts`.

**Files Currently in LLxprt**:
- [OK] `packages/core/src/policy/policy-engine.ts` — Evaluates policy rules (NEEDS compound command logic)
- [OK] `packages/core/src/policy/toml-loader.ts` — Generates regex from commandPrefix (NEEDS word boundary fix)
- [OK] `packages/core/src/utils/shell-utils.ts` — Contains `splitCommands()`, `isCommandAllowed()`, `checkCommandPermissions()`, `SHELL_TOOL_NAMES`
- [OK] `packages/core/src/utils/tool-utils.ts` — Contains `isShellInvocationAllowlisted()`
- [OK] `packages/core/src/core/coreToolScheduler.ts` — Uses `isShellInvocationAllowlisted` for allowlist checks
- [OK] `packages/core/src/tools/shell.ts` — Uses `isCommandAllowed` and `isShellInvocationAllowlisted`
- [ERROR] `packages/core/src/utils/shell-permissions.ts` — DOES NOT EXIST (upstream creates this)
- [ERROR] `packages/core/src/policy/shell-safety.test.ts` — DOES NOT EXIST (upstream creates this)

**Import Chain Analysis**:
```
coreToolScheduler.ts → imports isShellInvocationAllowlisted from tool-utils.ts
shell.ts → imports isCommandAllowed from shell-utils.ts
shell.ts → imports isShellInvocationAllowlisted from tool-utils.ts
```

**Upstream Move Analysis**:
Upstream moves `isShellInvocationAllowlisted`, `isCommandAllowed`, `checkCommandPermissions` FROM `shell-utils.ts` TO **NEW FILE** `shell-permissions.ts`. This is a **pure code organization refactor** with NO functional changes to those functions. However, the security fixes are in:
1. `toml-loader.ts` — word boundary regex
2. `policy-engine.ts` — compound command validation logic

---

## Upstream Changes (Complete Mapping)

### 1. `packages/core/src/policy/toml-loader.ts` (SECURITY FIX #1)

**Change**: Regex pattern for `commandPrefix` entries  
**Before**: `"command":"${escapeRegex(prefix)}"`  
**After**: `"command":"${escapeRegex(prefix)}(?:[\\s"]|$)"`  
**Effect**: Enforces word boundary — requires whitespace, quote, or end-of-string after prefix

**Lines Changed**: 2 occurrences (lines 352 and 437 in upstream)

### 2. `packages/core/src/policy/policy-engine.ts` (SECURITY FIX #2)

**Change**: Special handling for shell commands in ALLOW rules  
**Logic**:
- If `toolCall.name` is in `SHELL_TOOL_NAMES` AND rule decision is `ALLOW`:
  - Parse command into sub-commands using `splitCommands()`
  - If parsing fails (returns `[]` for non-empty command) → downgrade to `ASK_USER` (fail-safe)
  - If multiple sub-commands → recursively check each with `this.check()`
  - Aggregate: ANY `DENY` → `DENY`; ANY `ASK_USER` (without `DENY`) → `ASK_USER`; ALL `ALLOW` → `ALLOW`

**Required Imports**:
```typescript
import {
  SHELL_TOOL_NAMES,
  initializeShellParsers,
  splitCommands,
} from '../utils/shell-utils.js';
```

**Lines Changed**: ~60 lines inserted after rule match, before `break`

### 3. `packages/core/src/policy/shell-safety.test.ts` (NEW FILE)

**New file**: Comprehensive test suite for word boundary and compound command safety

**Test Coverage**:
1. [OK] Exact match: `git log` → ALLOW
2. [OK] With args: `git log --oneline` → ALLOW
3. [OK] Word boundary violation: `git logout` when prefix is `git log` → ASK_USER
4. [OK] Compound command with disallowed part: `git log && rm -rf /` → ASK_USER
5. [OK] Parse failure (malformed syntax): `git log &&& rm -rf /` → ASK_USER

### 4. `packages/core/src/utils/shell-permissions.ts` (NEW FILE - CODE ORGANIZATION ONLY)

**Upstream creates this file** by moving functions FROM `shell-utils.ts`:
- `isCommandAllowed`
- `checkCommandPermissions`
- `isShellInvocationAllowlisted`

**LLxprt Decision**: **DO NOT CREATE** this file. Keep functions where they are:
- `isCommandAllowed` / `checkCommandPermissions` → stay in `shell-utils.ts`
- `isShellInvocationAllowlisted` → stays in `tool-utils.ts`

**Rationale**: LLxprt's architecture already has these functions in logical places. Moving them would be churn without security benefit.

### 5. `packages/core/src/utils/shell-utils.ts` (NO CHANGE NEEDED)

**Upstream removes** ~265 lines (moved to `shell-permissions.ts`)

**LLxprt**: Keep existing functions. No changes needed to `shell-utils.ts` itself (the security logic uses existing `splitCommands()` which is already present).

### 6. `packages/core/src/utils/shell-permissions.test.ts` (NEW FILE - TESTS FOR MOVED CODE)

**Upstream creates** ~520 lines of tests for the moved functions.

**LLxprt**: These tests already exist in `shell-utils.test.ts`. No new file needed.

### 7. `packages/core/src/core/coreToolScheduler.ts` (IMPORT PATH CHANGE ONLY)

**Upstream change**:
```typescript
// Before
import { isShellInvocationAllowlisted, SHELL_TOOL_NAMES } from '../utils/shell-utils.js';

// After
import { SHELL_TOOL_NAMES } from '../utils/shell-utils.js';
import { isShellInvocationAllowlisted } from '../utils/shell-permissions.js';
```

**LLxprt**: **NO CHANGE NEEDED** because we're not creating `shell-permissions.ts`. `isShellInvocationAllowlisted` stays in `tool-utils.ts` where it already is.

### 8. `packages/core/src/tools/shell.ts` (IMPORT PATH CHANGE ONLY)

**Upstream change**:
```typescript
// Before
import { isCommandAllowed, isShellInvocationAllowlisted } from '../utils/shell-utils.js';

// After
import { isCommandAllowed, isShellInvocationAllowlisted } from '../utils/shell-permissions.js';
```

**LLxprt**: **NO CHANGE NEEDED** because we're not creating `shell-permissions.ts`. Imports stay as-is.

### 9. `packages/core/src/index.ts` (EXPORT ADDITION)

**Upstream change**:
```typescript
export * from './utils/shell-permissions.js';
```

**LLxprt**: **NO CHANGE NEEDED** because we're not creating `shell-permissions.ts`.

### 10. Test Import Path Changes

**Files**: `coreToolScheduler.test.ts`, `shell.test.ts`, `shell-utils.test.ts`

**Upstream**: Updates imports to use `shell-permissions.ts`

**LLxprt**: **NO CHANGES NEEDED** to test imports.

---

## LLxprt Implementation Plan

### Phase 1: Word Boundary Fix in TOML Loader

**File**: `packages/core/src/policy/toml-loader.ts`

**Search for** (line ~352 and ~437 based on upstream):
```typescript
(prefix) => `"command":"${escapeRegex(prefix)}`,
```

**Change to**:
```typescript
(prefix) => `"command":"${escapeRegex(prefix)}(?:[\\s"]|$)`,
```

**Occurrences**: 2 (one in each rule transformation section)

**Verification**: Run existing tests in `policy-engine.test.ts` — should pass.

---

### Phase 2: Compound Command Validation in Policy Engine

**File**: `packages/core/src/policy/policy-engine.ts`

**Required Imports** (add at top):
```typescript
import {
  SHELL_TOOL_NAMES,
  initializeShellParsers,
  splitCommands,
} from '../utils/shell-utils.js';
```

**Location to Insert Logic**: Inside `PolicyEngine.evaluate()`, AFTER a rule matches with `ALLOW` decision, BEFORE `return decision`.

**Current Code Structure** (approximate line 35-50):
```typescript
const matchingRule = this.findMatchingRule(toolName, args);

if (matchingRule) {
  const decision = matchingRule.decision;

  // In non-interactive mode, ASK_USER becomes DENY
  if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
    return PolicyDecision.DENY;
  }

  return decision; // ← INSERT NEW LOGIC BEFORE THIS
}
```

**New Logic to Insert**:
```typescript
// Special handling for shell commands: check sub-commands if present
if (
  toolName &&
  SHELL_TOOL_NAMES.includes(toolName) &&
  matchingRule.decision === PolicyDecision.ALLOW
) {
  const command = (args as { command?: string })?.command;
  if (command) {
    await initializeShellParsers();
    const subCommands = splitCommands(command);

    // If parsing fails (empty array for non-empty command), fail-safe to ASK_USER
    if (subCommands.length === 0) {
      const fallbackDecision = PolicyDecision.ASK_USER;
      return this.nonInteractive ? PolicyDecision.DENY : fallbackDecision;
    } else if (subCommands.length > 1) {
      // Compound command: validate each sub-command
      let aggregateDecision = PolicyDecision.ALLOW;

      for (const subCmd of subCommands) {
        const subResult = this.evaluate(toolName, { command: subCmd }, serverName);

        if (subResult === PolicyDecision.DENY) {
          aggregateDecision = PolicyDecision.DENY;
          break; // Fail fast
        } else if (subResult === PolicyDecision.ASK_USER) {
          aggregateDecision = PolicyDecision.ASK_USER;
        }
      }

      const decision = aggregateDecision;
      if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
        return PolicyDecision.DENY;
      }
      return decision;
    }
    // else: Single command, rule match is valid — fall through to normal return
  }
}
```

**IMPORTANT**: LLxprt's `PolicyEngine.evaluate()` is **synchronous**, but upstream's `check()` is **async**. We need to adapt:

**Option A**: Make `evaluate()` async (BREAKING CHANGE — avoid if possible)  
**Option B**: Call `initializeShellParsers()` during PolicyEngine construction, make compound validation synchronous  
**Option C**: Use `splitCommands()` without async initialization (parser is already initialized at module load)

**RECOMMENDED**: Option C. The `initializeShellParsers()` call in upstream is defensive but not strictly needed if parser initialization happens at module load (which it does in LLxprt via `shell-parser.ts`).

**Simplified Synchronous Logic**:
```typescript
// Special handling for shell commands: check sub-commands if present
if (
  toolName &&
  SHELL_TOOL_NAMES.includes(toolName) &&
  matchingRule.decision === PolicyDecision.ALLOW
) {
  const command = (args as { command?: string })?.command;
  if (command) {
    const subCommands = splitCommands(command);

    // If parsing fails (empty array for non-empty command), fail-safe to ASK_USER
    if (subCommands.length === 0) {
      const fallbackDecision = PolicyDecision.ASK_USER;
      return this.nonInteractive ? PolicyDecision.DENY : fallbackDecision;
    } else if (subCommands.length > 1) {
      // Compound command: validate each sub-command
      let aggregateDecision = PolicyDecision.ALLOW;

      for (const subCmd of subCommands) {
        const subResult = this.evaluate(toolName, { command: subCmd }, serverName);

        if (subResult === PolicyDecision.DENY) {
          aggregateDecision = PolicyDecision.DENY;
          break; // Fail fast
        } else if (subResult === PolicyDecision.ASK_USER) {
          aggregateDecision = PolicyDecision.ASK_USER;
        }
      }

      const decision = aggregateDecision;
      if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
        return PolicyDecision.DENY;
      }
      return decision;
    }
    // else: Single command, rule match is valid — fall through
  }
}
```

**Remove Import**: `initializeShellParsers` (not needed)

**Final Imports**:
```typescript
import {
  SHELL_TOOL_NAMES,
  splitCommands,
} from '../utils/shell-utils.js';
```

---

### Phase 3: Add Test Suite

**File**: `packages/core/src/policy/shell-safety.test.ts` (NEW)

**Copy from upstream**: Entire test suite from `a47af8e2:packages/core/src/policy/shell-safety.test.ts`

**Adaptation Required**:
1. Change `@google/genai` imports to LLxprt equivalents
2. Use LLxprt's `PolicyEngine` constructor signature
3. Use LLxprt's `PolicyDecision` enum

**Upstream Test Structure**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import { PolicyDecision } from './types.js';
import type { FunctionCall } from '@google/genai';
```

**LLxprt Adaptation**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import { PolicyDecision } from './types.js';

// LLxprt doesn't use FunctionCall type from @google/genai
// Use simple object type instead
type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};
```

**Test Cases** (from upstream):
```typescript
describe('Shell Safety Policy', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_shell_command',
          // Mimic the regex generated by toml-loader for commandPrefix = ["git log"]
          // Regex: "command":"git log(?:[\s"]|$)
          argsPattern: /"command":"git log(?:[\s"]|$)/,
          decision: PolicyDecision.ALLOW,
          priority: 1.01, // Higher priority than default
        },
      ],
      defaultDecision: PolicyDecision.ASK_USER,
    });
  });

  it('SHOULD match "git log" exactly', () => {
    const toolCall: ToolCall = {
      name: 'run_shell_command',
      args: { command: 'git log' },
    };
    const result = policyEngine.evaluate(
      toolCall.name,
      toolCall.args,
      undefined
    );
    expect(result).toBe(PolicyDecision.ALLOW);
  });

  it('SHOULD match "git log" with arguments', () => {
    const toolCall: ToolCall = {
      name: 'run_shell_command',
      args: { command: 'git log --oneline' },
    };
    const result = policyEngine.evaluate(
      toolCall.name,
      toolCall.args,
      undefined
    );
    expect(result).toBe(PolicyDecision.ALLOW);
  });

  it('SHOULD NOT match "git logout" when prefix is "git log" (strict word boundary)', () => {
    const toolCall: ToolCall = {
      name: 'run_shell_command',
      args: { command: 'git logout' },
    };

    // Desired behavior: Should NOT match "git log" prefix.
    // If it doesn't match, it should fall back to default decision (ASK_USER).
    const result = policyEngine.evaluate(
      toolCall.name,
      toolCall.args,
      undefined
    );
    expect(result).toBe(PolicyDecision.ASK_USER);
  });

  it('SHOULD NOT allow "git log && rm -rf /" completely when prefix is "git log" (compound command safety)', () => {
    const toolCall: ToolCall = {
      name: 'run_shell_command',
      args: { command: 'git log && rm -rf /' },
    };

    // Desired behavior: Should inspect all parts. "rm -rf /" is not allowed.
    // The "git log" part is ALLOW, but "rm -rf /" is ASK_USER (default).
    // Aggregate should be ASK_USER.
    const result = policyEngine.evaluate(
      toolCall.name,
      toolCall.args,
      undefined
    );
    expect(result).toBe(PolicyDecision.ASK_USER);
  });

  it('SHOULD NOT allow "git log &&& rm -rf /" when prefix is "git log" (parse failure)', () => {
    const toolCall: ToolCall = {
      name: 'run_shell_command',
      args: { command: 'git log &&& rm -rf /' },
    };

    // Desired behavior: Should fail safe (ASK_USER or DENY) because parsing failed.
    // If we let it pass as "single command" that matches prefix, it's dangerous.
    const result = policyEngine.evaluate(
      toolCall.name,
      toolCall.args,
      undefined
    );
    expect(result).toBe(PolicyDecision.ASK_USER);
  });
});
```

---

### Phase 4: Verification

**Run Tests**:
```bash
npm test -- packages/core/src/policy/shell-safety.test.ts
npm test -- packages/core/src/policy/policy-engine.test.ts
```

**Manual Test Scenario**:

Create test policy file `test-policy.toml`:
```toml
[[rule]]
toolName = "run_shell_command"
commandPrefix = ["git log"]
decision = "ALLOW"
priority = 1
```

**Test Commands**:
1. `git log` → Should ALLOW
2. `git log -n 10` → Should ALLOW
3. `git logout` → Should ASK_USER (word boundary prevents match)
4. `git log && echo "pwned"` → Should ASK_USER (compound command, `echo` not explicitly allowed)

---

## File Summary

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/policy/toml-loader.ts` | **SECURITY FIX** | Add word boundary to commandPrefix regex (2 lines) |
| `packages/core/src/policy/policy-engine.ts` | **SECURITY FIX** | Add compound command validation (~40 lines) |
| `packages/core/src/policy/shell-safety.test.ts` | **NEW FILE** | Add test suite (~100 lines) |

### Files NOT Modified (Upstream Differs)

| File | Upstream Action | LLxprt Decision |
|------|----------------|-----------------|
| `packages/core/src/utils/shell-permissions.ts` | Created (new file) | **Not creating** — keep functions in existing locations |
| `packages/core/src/utils/shell-utils.ts` | Removed functions | **No change** — keep existing functions |
| `packages/core/src/utils/shell-permissions.test.ts` | Created (new file) | **Not creating** — tests already in `shell-utils.test.ts` |
| `packages/core/src/core/coreToolScheduler.ts` | Import path change | **No change** — import path stays same |
| `packages/core/src/tools/shell.ts` | Import path change | **No change** — import path stays same |
| `packages/core/src/index.ts` | Export addition | **No change** — no new module to export |

---

## Risk Assessment

**Risk Level**: MEDIUM (security fix, but well-isolated changes)

**Security Risks**:
1. **Not implementing**: Leaves LLxprt vulnerable to policy bypass via word boundary and compound command escapes
2. **Implementing incorrectly**: Could block legitimate commands or still allow malicious ones

**Implementation Risks**:
1. **Async/sync mismatch**: Upstream's `check()` is async, LLxprt's `evaluate()` is sync — handled by removing unnecessary async call
2. **Recursive evaluation**: `evaluate()` calls itself for sub-commands — safe because it uses same rules
3. **Parse failure handling**: If `splitCommands()` returns empty array for non-empty input, fail-safe to ASK_USER

**Mitigation**:
- Comprehensive test coverage (5 test cases covering all edge cases)
- Fail-safe design (parse failure → ASK_USER, not ALLOW)
- Minimal changes to existing code (only 2 files modified for security logic)
- No module reorganization needed (avoids import path churn)

---

## Success Criteria

1. [OK] All tests in `shell-safety.test.ts` pass
2. [OK] Existing policy tests pass
3. [OK] `git logout` does NOT match `git log` prefix
4. [OK] Compound commands with disallowed parts trigger ASK_USER
5. [OK] No regressions in non-shell tool policies
6. [OK] Parse failures result in ASK_USER (fail-safe)

---

## Commit Message

```
reimplement(security): commandPrefix safety fix (upstream a47af8e2)

Security fix from Gemini 0.22.0 to prevent two classes of policy escapes:

1. Word boundary enforcement: commandPrefix regex now requires whitespace,
   quote, or end-of-string after prefix. Prevents "git log" from matching
   "git logout".

2. Compound command validation: When a shell command ALLOW rule matches,
   parse into sub-commands and recursively validate each. If any sub-command
   is DENY or ASK_USER, downgrade the aggregate decision. Prevents
   "git log && rm -rf /" from bypassing policy when only "git log" is allowed.

Implementation notes:
- LLxprt keeps shell permission logic in existing locations (no module split)
- Added comprehensive test suite in shell-safety.test.ts
- Word boundary regex matches upstream exactly
- Compound validation uses synchronous recursive evaluation
- Fail-safe design: parse failure → ASK_USER

Files modified:
- toml-loader.ts: Word boundary fix (2 occurrences)
- policy-engine.ts: Compound command validation (~40 lines)
- shell-safety.test.ts: New test suite (5 test cases)

Upstream: a47af8e261ad72ee9365bab397990f25eb4c82ae
Fixes: https://github.com/google/genkit/pull/15006
```

---

## Additional Notes

### Why No Module Split?

Upstream splits `shell-utils.ts` into two files:
- `shell-utils.ts` (parsing utilities)
- `shell-permissions.ts` (permission checks)

**LLxprt doesn't need this split because**:
1. Functions are already logically organized:
   - `shell-utils.ts`: parsing + policy helpers
   - `tool-utils.ts`: tool matching + allowlist checks
2. No import cycle issues (split was to avoid circular deps in Gemini)
3. Fewer files = simpler architecture

### Future Considerations

1. **Async Policy Engine**: If LLxprt ever needs async policy evaluation (e.g., for remote policy servers), revisit the `initializeShellParsers()` call
2. **Performance**: Recursive `evaluate()` calls for compound commands are O(n) where n = number of sub-commands. For typical commands (1-3 sub-commands), negligible overhead.
3. **Parser Initialization**: Currently happens at module load. If parser initialization fails, `splitCommands()` falls back to regex (already implemented).

---

## Testing Strategy

### Unit Tests (New)

**File**: `shell-safety.test.ts`

**Coverage**:
1. Exact match: `git log` → ALLOW
2. With args: `git log --oneline` → ALLOW
3. Word boundary violation: `git logout` → ASK_USER
4. Compound command with disallowed part: `git log && rm -rf /` → ASK_USER
5. Parse failure (malformed syntax): `git log &&& rm -rf /` → ASK_USER

### Integration Tests

**Existing tests** in `policy-engine.test.ts` should cover:
1. Normal command approval
2. Blocklist enforcement
3. Non-interactive mode fallback

### Regression Tests

**Run full test suite**:
```bash
npm test
```

**Focus areas**:
- Policy engine tests (should all pass)
- Shell tool tests (should all pass)
- Tool scheduler tests (should all pass)

---

## Rollback Plan

If issues arise:

1. **Revert word boundary change** in `toml-loader.ts`:
   ```diff
   - (prefix) => `"command":"${escapeRegex(prefix)}(?:[\\s"]|$)`,
   + (prefix) => `"command":"${escapeRegex(prefix)}`,
   ```

2. **Remove compound command validation** from `policy-engine.ts`:
   - Delete the special handling block
   - Remove imports for `SHELL_TOOL_NAMES` and `splitCommands`

3. **Remove test file**: Delete `shell-safety.test.ts`

4. **Verify rollback**: Run test suite to ensure no breakage

---

## References

- **Upstream Commit**: a47af8e261ad72ee9365bab397990f25eb4c82ae
- **Upstream PR**: https://github.com/google/genkit/pull/15006
- **Related Issue**: Security vulnerability in commandPrefix matching
- **LLxprt Issue**: (create after review)
