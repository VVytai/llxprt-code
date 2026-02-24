# Plan: Expose previewFeatures flag in a2a — SKIP Decision

Plan ID: PLAN-20250219-GMERGE021.SKIP1
Generated: 2025-02-19
Total Phases: 3
Upstream Commit: `2c4ec31ed170` — expose previewFeatures flag in a2a (#14550)
Decision: **SKIP**

## Critical Reminders

This is a SKIP decision plan. No code changes will be made. All phases are documentation and verification only.

---

# Phase 01: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.SKIP1.P01`

## Prerequisites

- Required: None (first phase)
- Verification: Confirm SKIP rationale is still valid against current codebase state

## Purpose

Verify that the SKIP rationale documented in this plan still holds. The two key anti-regression tests and the absence of any `previewFeatures` consumer must be confirmed before updating CHERRIES.md.

## Preflight Verification Table

### Anti-Regression Tests

| Test File | Expected Assertion | Status |
|-----------|-------------------|--------|
| `packages/core/src/config/__tests__/config.previewFeatures.test.ts` | `getPreviewFeatures` does NOT exist on `Config.prototype` | Verify still present |
| `packages/cli/src/config/__tests__/settingsSchema.previewFeatures.test.ts` | `previewFeatures` is NOT in `SETTINGS_SCHEMA` | Verify still present |

### Consumer Search

| Search Target | Command | Expected Result |
|--------------|---------|----------------|
| `getPreviewFeatures` call sites | `grep -rn "getPreviewFeatures" packages/` | Zero matches |
| `previewFeatures` in `ConfigParameters` | `grep -n "previewFeatures" packages/core/src/config/config.ts` | Zero matches |
| `previewFeatures` in A2A config | `grep -n "previewFeatures" packages/a2a-server/src/config/config.ts` | Zero matches |
| `previewFeatures` in A2A settings | `grep -n "previewFeatures" packages/a2a-server/src/config/settings.ts` | Zero matches |

### SKIP Rationale Validity Checklist

- [ ] `config.previewFeatures.test.ts` still asserts `getPreviewFeatures` does NOT exist on `Config.prototype`
- [ ] `settingsSchema.previewFeatures.test.ts` still asserts `previewFeatures` is NOT in `SETTINGS_SCHEMA`
- [ ] No call site for `getPreviewFeatures()` exists anywhere in `packages/`
- [ ] `ConfigParameters` interface in core has no `previewFeatures` field
- [ ] `cherrypicking.md` still states LLxprt excludes Google model routing / preview feature gating

### Verification Gate

IF ALL CHECKBOXES ARE CHECKED: Proceed to Phase 02.

IF ANY CHECKBOX IS UNCHECKED: Re-evaluate the SKIP decision. The rationale may no longer be valid and a REIMPLEMENT path may need to be planned instead.

## SKIP Rationale (Expanded)

**Full rationale for this commit being SKIP:**

1. **Core anti-regression tests explicitly prevent reimplementation.** Two existing tests assert that `previewFeatures` does not exist in core `Config` or the settings schema. These are not incidental tests — they were written specifically to prevent re-addition.

2. **No downstream consumer.** LLxprt has no code that reads `previewFeatures` to control any behavior. Adding a settings key with no effect creates dead configuration surface that misleads users.

3. **Chain is broken at core by design.** The upstream value flows: `settings → ConfigParameters → Config getter → feature gate`. LLxprt's core has no getter and no feature gate. Even if the A2A settings were updated, the value cannot reach any functional code.

4. **Meaningless without the upstream ecosystem.** The commit is an enabler of upstream preview feature gates which LLxprt deliberately excludes per `cherrypicking.md`.

5. **Shallow merge risk.** Introducing nested settings objects in A2A opens a shallow merge footgun (workspace `general` object replaces entire user `general` object) without a V2 migration plan.

## Success Criteria

- All verification commands confirm rationale is still valid
- No new consumers of `previewFeatures` have been introduced since the SKIP decision was originally made

## Failure Recovery

If preflight reveals the SKIP rationale is no longer valid:

1. Do NOT proceed to Phase 02
2. Revise this plan to include a REIMPLEMENT path
3. Reference the original plan's "If the Decision Is Revisited to REIMPLEMENT" section for TDD sequencing

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/SKIP1.P01.md`

```markdown
Phase: SKIP1.P01
Completed: YYYY-MM-DD HH:MM
Verification: [paste grep outputs confirming rationale still holds]
Decision: SKIP rationale confirmed valid / SKIP rationale invalidated (circle one)
```

---

# Phase 02: Update CHERRIES.md with SKIP Rationale

## Phase ID

`PLAN-20250219-GMERGE021.SKIP1.P02`

## Prerequisites

- Required: Phase P01 completed with all checkboxes confirmed
- Verification: `project-plans/gmerge-0.21.3/.completed/SKIP1.P01.md` exists

## Purpose

Record the SKIP decision for commit `2c4ec31ed170` in CHERRIES.md so the decision is durably documented and reviewable.

## Implementation Tasks

### Files to Modify

- `project-plans/gmerge-0.21.3/CHERRIES.md`
  - Locate the entry for commit `2c4ec31ed170` (commit 14, "expose previewFeatures flag in a2a")
  - Confirm or update status to `SKIP`
  - Add or update the rationale inline

### CHERRIES.md Entry Content

The entry for `2c4ec31ed170` must contain the following rationale:

> **SKIP.** `previewFeatures` was deliberately removed from LLxprt core and is enforced by two anti-regression tests:
> `config.previewFeatures.test.ts` (asserts `getPreviewFeatures` not on `Config.prototype`) and
> `settingsSchema.previewFeatures.test.ts` (asserts `previewFeatures` not in `SETTINGS_SCHEMA`).
> No LLxprt code consumes this flag. The upstream chain (settings → ConfigParameters → Config getter → feature gate)
> is broken at core by design per `cherrypicking.md`. Dead configuration surface with no behavioral effect.
> Introducing nested settings also opens a shallow merge footgun without a V2 plan.

### No Code Changes

No TypeScript, configuration, or test files are modified in this phase. CHERRIES.md is a planning document only.

## Verification Commands

```bash
# Confirm SKIP entry exists in CHERRIES.md
grep -A 5 "2c4ec31ed170" project-plans/gmerge-0.21.3/CHERRIES.md
# Expected: Entry shows SKIP with rationale

# Confirm no code files were modified
git diff --name-only | grep -v "CHERRIES.md" | grep -v "project-plans/"
# Expected: No matches (only planning docs changed)
```

## Verification Checklist

- [ ] CHERRIES.md entry for `2c4ec31ed170` shows `SKIP`
- [ ] CHERRIES.md entry includes the anti-regression test references
- [ ] CHERRIES.md entry includes the "no consumer" rationale
- [ ] No `.ts`, `.js`, or other code files were modified

## Success Criteria

- CHERRIES.md durably records the SKIP decision with full rationale
- No code changes introduced

## Failure Recovery

If CHERRIES.md update causes merge conflicts or formatting issues:

1. `git checkout -- project-plans/gmerge-0.21.3/CHERRIES.md`
2. Re-examine the file format and retry

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/SKIP1.P02.md`

```markdown
Phase: SKIP1.P02
Completed: YYYY-MM-DD HH:MM
Files Modified: project-plans/gmerge-0.21.3/CHERRIES.md
Verification: [paste grep output showing SKIP entry]
```

---

# Phase 03: Verification That No Action Taken

## Phase ID

`PLAN-20250219-GMERGE021.SKIP1.P03`

## Prerequisites

- Required: Phase P02 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/SKIP1.P02.md` exists

## Purpose

Final confirmation that the SKIP was executed cleanly: no code was changed, no tests were broken, and the codebase is identical to pre-plan state except for planning documents.

## Verification Commands

```bash
# Confirm only planning documents changed
git diff --name-only HEAD
# Expected: Only files under project-plans/gmerge-0.21.3/ listed

# Confirm no TypeScript files changed
git diff --name-only HEAD | grep "\.ts$"
# Expected: No matches

# Confirm anti-regression tests still pass
npx vitest run packages/core/src/config/__tests__/config.previewFeatures.test.ts
npx vitest run packages/cli/src/config/__tests__/settingsSchema.previewFeatures.test.ts
# Expected: Both pass

# Confirm full test suite still passes
npm run test
# Expected: All pass

# Confirm build is clean
npm run typecheck && npm run lint && npm run build
# Expected: No errors
```

## Verification Checklist

- [ ] `git diff --name-only HEAD` shows only files under `project-plans/`
- [ ] No `.ts` files appear in `git diff --name-only HEAD`
- [ ] `config.previewFeatures.test.ts` passes
- [ ] `settingsSchema.previewFeatures.test.ts` passes
- [ ] Full `npm run test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Success Criteria

- Codebase is functionally identical to pre-plan state
- All existing tests pass
- Only CHERRIES.md and this plan file differ from pre-plan state

## Failure Recovery

If any test fails after the SKIP:

1. The SKIP itself caused no code changes, so test failures indicate a pre-existing issue
2. Investigate whether the failing test was already failing on `main` before this plan was executed
3. Do NOT fix unrelated test failures as part of this SKIP plan — open a separate issue

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/SKIP1.P03.md`

```markdown
Phase: SKIP1.P03
Completed: YYYY-MM-DD HH:MM
Git diff output: [paste git diff --name-only HEAD]
Test results: [PASS / FAIL with details]
Build results: [PASS / FAIL with details]
SKIP confirmed: YES
```

---

## Execution Tracker

| Phase | ID | Status | Started | Completed | Notes |
|-------|----|--------|---------|-----------|-------|
| 01 | P01 | ⬜ | - | - | Preflight — confirm SKIP rationale still valid |
| 02 | P02 | ⬜ | - | - | Update CHERRIES.md with SKIP rationale |
| 03 | P03 | ⬜ | - | - | Verify no code changes introduced |

## Completion Markers

- [ ] P01 preflight confirmed SKIP rationale still valid
- [ ] P02 CHERRIES.md updated with full rationale
- [ ] P03 verification confirms codebase unchanged
- [ ] All existing tests pass post-SKIP
