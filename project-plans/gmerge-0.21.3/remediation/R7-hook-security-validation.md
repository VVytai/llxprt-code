# Remediation Plan: R7 — Hook Security Validation + Consent Lifecycle Hardening

**Priority:** P0 (fix before production)
**Estimated Effort:** 10-16 hours
**Root Cause:** Hook consent exists, but hook definitions remain weakly typed (`hooks?: Record<string, unknown>`), consent logic does not clearly separate new vs changed hook definitions, and lifecycle coverage across install/update/reinstall/enable paths is incomplete.

---

## Review Status

Round 1 (deepthinker): APPROVE_WITH_CHANGES — applied.
Round 2 (deepthinker + typescriptexpert): APPROVE_WITH_CHANGES — applied below.

---

## Scope

1. Define and enforce hook schema validation (name + definition structure).
2. Sanitize hook names when displayed in consent prompts (reuse existing `escapeAnsiCtrlCodes`).
3. Introduce deterministic consent-delta logic for updates with explicit canonicalization.
4. Wire/test consent behavior through install/update/reinstall; encode enable-flow policy.
5. Add robust behavioral tests for acceptance, decline, rollback, batch update outcomes, and non-interactive contexts.

---

## Design Decisions (locked)

- **Hook name matching**: case-sensitive (no normalization). `Pre-Commit` and `pre-commit` are distinct.
- **Definition change detection**: sorted `JSON.stringify` comparison for deep equality.
- **Reserved keys**: `__proto__`, `constructor`, `prototype` rejected at schema level.
- **Validation failure mode**: hard-fail (throw error). Security-first — prevent installation of malformed extensions.
- **Batch update semantics**: partial success — one extension failure does not abort others. Individual failures reported.
- **Enable-flow consent**: no re-prompt on enable (non-goal for this remediation). Document as explicit non-goal.
- **Non-interactive consent**: hard-fail — refuse to install/update extensions with new hooks in non-interactive mode.

---

## TDD Sequence

### Test Group A: Hook schema and validation (RED then GREEN)

**Primary file:** `packages/cli/src/config/extension.test.ts`

1. rejects invalid hook names (`../evil`, empty, whitespace, shell metachar patterns)
2. rejects reserved keys (`__proto__`, `constructor`, `prototype`)
3. rejects non-object hook definitions
4. rejects oversized hook payloads (bounded key/value lengths)
5. accepts valid hook names and valid shape
6. validation throws (hard-fail), does not return null

### Test Group B: Consent rendering safety (RED then GREEN)

**Primary file:** `packages/cli/src/config/extensions/consent.test.ts`

1. `escapeAnsiCtrlCodes()` correctly escapes control chars in hook names (unit test of helper)
2. `extensionConsentString()` uses escaped hook names in output
3. unicode hook names are allowed (UTF-8 passthrough)
4. `requestHookConsent()` returns false on decline (integration test with mocked stdin)
5. non-interactive context refuses installation with new hooks (hard-fail)

### Test Group C: Update delta policy (RED then GREEN)

**Primary file(s):** `consent.test.ts`, `extension.test.ts`, `extensions/update.test.ts`

1. new hook name added -> re-prompt required
2. unchanged hooks (same name + same definition via sorted JSON.stringify) -> no re-prompt
3. hook removed only -> no re-prompt
4. same hook name but materially changed definition -> re-prompt required
5. case sensitivity: `Pre-Commit` and `pre-commit` are distinct hooks

### Test Group D: Lifecycle coverage (RED then GREEN)

1. install path:
   - prompts for extension + hook consent when hooks exist
   - declines abort installation (hard-fail, throws)

2. update path:
   - added/changed hooks trigger consent
   - decline triggers rollback (previous version preserved — behavioral test)

3. batch update path (`updateAllUpdatableExtensions`):
   - one extension decline/failure does not corrupt others (partial success)
   - state transitions remain correct per extension

4. reinstall path:
   - consent behavior explicit and tested

5. enable-flow:
   - explicit non-goal — no re-prompt on enable
   - documented with rationale comment in code

---

## Implementation Steps

### Step 1: Add hook schema module

**File:** `packages/cli/src/config/extensions/hookSchema.ts` (new)

- Use Zod (consistent with codebase patterns — `.strip()` for container, `.passthrough()` for definitions).
- Hook name: `z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/)`.
- Reject reserved keys explicitly.
- Hook definition: `z.object({...}).passthrough()` for forward compatibility.
- Export inferred type via `z.infer<typeof ...>`.

### Step 2: Wire schema into extension loading/install (hard-fail)

**File:** `packages/cli/src/config/extension.ts`

- Replace `hooks?: Record<string, unknown>` with schema-derived type.
- Parse hooks via Zod schema in `loadExtensionConfig` / install flow.
- On failure: throw with descriptive error message (not return null).

### Step 3: Harden consent prompt output

**File:** `packages/cli/src/config/extensions/consent.ts`

- Import and apply `escapeAnsiCtrlCodes()` from `packages/cli/src/ui/utils/textUtils.ts`.
- Apply to all displayed hook names in `extensionConsentString()` and `requestHookConsent()`.

### Step 4: Implement consent-delta logic with canonicalization

**File(s):** `consent.ts`, `extension.ts`, `extensions/update.ts`

```typescript
export function computeHookConsentDelta(
  currentHooks: Hooks | undefined,
  previousHooks: Hooks | undefined,
): { newHooks: string[]; changedHooks: string[] } {
  const current = currentHooks ?? {};
  const previous = previousHooks ?? {};
  const newHooks: string[] = [];
  const changedHooks: string[] = [];
  for (const name of Object.keys(current)) {
    if (!(name in previous)) {
      newHooks.push(name);
    } else {
      const prevJson = JSON.stringify(previous[name], Object.keys(previous[name] as object).sort());
      const currJson = JSON.stringify(current[name], Object.keys(current[name] as object).sort());
      if (prevJson !== currJson) {
        changedHooks.push(name);
      }
    }
  }
  return { newHooks, changedHooks };
}
```

- On update: re-prompt when `newHooks.length > 0 || changedHooks.length > 0`.
- On decline: abort and rollback (preserve previous extension state).

### Step 5: Fix batch update behavior

**File:** `packages/cli/src/config/extensions/update.ts`

- Ensure `updateAllUpdatableExtensions` handles individual failures without aborting the batch.
- Report per-extension outcomes.

### Step 6: Document enable-flow non-goal

- Add code comment at enable path explaining that re-consent on enable is an explicit non-goal for this remediation and why.

---

## Verification

```bash
npm run test -- packages/cli/src/config/extensions/consent.test.ts
npm run test -- packages/cli/src/config/extension.test.ts
npm run test -- packages/cli/src/config/extensions/update.test.ts
npm run typecheck
npm run lint
npm run format
npm run build
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Schema too strict breaks existing extensions | Bounded but forward-compatible schema (.passthrough) |
| Prompt spam on harmless edits | Prompt only for new or materially changed hooks (sorted JSON comparison) |
| Non-interactive consent deadlock | Hard-fail in non-interactive mode — no readline prompt |
| Batch update corruption | Partial-success model — individual failures isolated |
| JSON.stringify edge cases (circular refs) | Hook definitions are JSON-serializable by construction (from config files) |

---

## Done Criteria

- [ ] Hook schema validation exists and replaces weak `Record<string, unknown>` usage
- [ ] Invalid names/definitions/reserved keys are rejected via hard-fail (throw)
- [ ] Consent output is sanitized via `escapeAnsiCtrlCodes`
- [ ] Update consent logic handles new + materially changed hooks (sorted JSON comparison)
- [ ] Declined update preserves previous extension state (rollback proven)
- [ ] Batch update remains stable under mixed outcomes (partial success)
- [ ] Non-interactive mode refuses new-hook installation (hard-fail)
- [ ] Enable-flow non-goal documented
- [ ] Full verification sequence passes
