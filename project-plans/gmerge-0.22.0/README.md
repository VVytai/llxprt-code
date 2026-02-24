# Gemini 0.22.0 Merge Plans

This directory contains reimplementation playbooks for critical upstream fixes from Gemini 0.22.0.

## Plans

### 1. [a47af8e2-plan.md](./a47af8e2-plan.md) — commandPrefix Safety Fix
**Upstream:** `a47af8e261ad72ee9365bab397990f25eb4c82ae`  
**Type:** Security fix  
**Priority:** HIGH  
**Risk:** LOW

**What**: Prevents two classes of shell command policy escapes:
1. Word boundary escape: `git log` no longer matches `git logout`
2. Compound command escape: `git log && rm -rf /` now validates both parts

**LLxprt Adaptation**:
- Keep shell permission logic in `policy-engine.ts` (no module split like upstream)
- Add compound command validation directly to policy decision flow
- Comprehensive test suite in `shell-safety.test.ts`

**Files**:
- `packages/core/src/policy/toml-loader.ts` — Add word boundary to regex
- `packages/core/src/policy/policy-engine.ts` — Add compound command validation
- `packages/core/src/policy/shell-safety.test.ts` — New test suite

### 2. [126c32ac-plan.md](./126c32ac-plan.md) — Hook Refresh on Extension Change
**Upstream:** `126c32aca4972deba80a875f749fcee1367c4486`  
**Type:** Bug fix  
**Priority:** HIGH  
**Risk:** MEDIUM

**What**: Fixes silent bug where extension hooks don't reload after enable/disable because initialization guards prevent re-init.

**LLxprt Enhancement**:
- Dispose old `HookEventHandler` before re-init to prevent MessageBus subscription leaks
- Upstream forgot this because Gemini doesn't have MessageBus integration

**Files**:
- `packages/core/src/hooks/hookRegistry.ts` — Remove init guards
- `packages/core/src/hooks/hookSystem.ts` — Remove init guards, add disposal
- `packages/core/src/utils/extensionLoader.ts` — Verify init call
- Test files — Remove obsolete tests

## Implementation Order

**Recommended**: Implement in order (a47af8e2 first, then 126c32ac)

**Rationale**:
1. a47af8e2 is lower risk (security hardening with minimal behavioral change)
2. 126c32ac changes fundamental initialization semantics (higher risk)
3. Both are independent — no conflicts

## Commit Messages

### a47af8e2
```
reimplement: commandPrefix safety fix (upstream a47af8e2)

Security fix from Gemini 0.22.0 to prevent two classes of policy escapes:

1. Word boundary enforcement: commandPrefix regex now requires whitespace,
   quote, or end-of-string after prefix. Prevents "git log" from matching
   "git logout".

2. Compound command validation: When a shell command ALLOW rule matches,
   parse into sub-commands and recursively validate each. If any sub-command
   is DENY or ASK_USER, downgrade the aggregate decision. Prevents
   "git log && rm -rf /" from bypassing policy when only "git log" is allowed.

Adaptation notes:
- LLxprt keeps shell permission logic in policy-engine.ts (no module split)
- Added comprehensive test suite in shell-safety.test.ts
- Word boundary regex matches upstream exactly
- Compound validation logic adapted for LLxprt's single policy engine

Upstream: a47af8e261ad72ee9365bab397990f25eb4c82ae
```

### 126c32ac
```
reimplement: hook refresh on extension change (upstream 126c32ac)

Fixes silent bug where hooks from extensions don't reload after enable/disable
because initialization guards block re-initialization.

Changes:
1. Remove `initialized` flags from HookSystem and HookRegistry (upstream)
2. Remove init guards from initialize(), getHooksForEvent(), getAllHooks() (upstream)
3. Remove HookRegistryNotInitializedError class (upstream)
4. Remove getStatus() method from HookSystem (upstream)
5. ADD: Dispose old HookEventHandler before re-init to prevent subscription leaks (LLxprt enhancement)

Effect:
- HookSystem.initialize() can now be called multiple times to reload config
- Extension loader calls initialize() after extension changes
- Old event handlers are properly disposed (prevents MessageBus subscription leaks)

Upstream forgot disposal because Gemini doesn't have MessageBus integration.
LLxprt added MessageBus in PLAN-20250218-HOOKSYSTEM.P03 (DELTA-HEVT-004),
so we must dispose subscriptions to prevent leaks.

Upstream: 126c32aca4972deba80a875f749fcee1367c4486
```

## Verification Checklist

### a47af8e2
- [ ] Word boundary regex in toml-loader.ts updated
- [ ] Compound command validation in policy-engine.ts added
- [ ] shell-safety.test.ts created and passing
- [ ] `git logout` does NOT match `git log` prefix
- [ ] `git log && rm -rf /` triggers ASK_USER when only `git log` allowed
- [ ] Existing policy tests still pass

### 126c32ac
- [ ] `initialized` flags removed from HookSystem and HookRegistry
- [ ] Init guards removed from all methods
- [ ] HookRegistryNotInitializedError class removed
- [ ] getStatus() method removed
- [ ] Disposal logic added to HookSystem.initialize()
- [ ] Obsolete tests removed
- [ ] Extension enable/disable cycle reloads hooks without restart
- [ ] No MessageBus subscription leaks

## Risk Summary

| Plan | Risk Level | Key Risks | Mitigation |
|------|-----------|-----------|------------|
| a47af8e2 | LOW | Legitimate compound commands may need explicit allowlist entries | Fail-safe design (parse failure → ASK_USER), comprehensive tests |
| 126c32ac | MEDIUM | Removing safety guards, disposal logic could break event handling | Full test suite, manual verification, leak testing |

## Testing Strategy

### a47af8e2
1. **Unit**: shell-safety.test.ts (word boundary, compound commands, parse failures)
2. **Integration**: policy-engine.test.ts (existing tests should pass)
3. **Manual**: Test policy TOML with `git log` prefix against `git logout` and compound commands

### 126c32ac
1. **Unit**: hookSystem.test.ts, hookRegistry.test.ts (updated tests)
2. **Integration**: Extension enable/disable cycle
3. **Manual**: `llxprt hooks list` before/after extension changes
4. **Leak**: Verify MessageBus subscription count doesn't grow

## Notes

- Both fixes are critical security/reliability improvements
- LLxprt diverges from upstream only where necessary (module structure, disposal)
- Comprehensive test coverage ensures safety
- Plans include rollback procedures if issues arise
