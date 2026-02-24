# Critique: Reimplementation Plan for `eb3312e7baaf`

The plan captures the high-level intent of the upstream commit and correctly identifies the two major workstreams (hook loading + consent warning). However, it is incomplete in several areas that create implementation and regression risk.

## 1) Missing edge cases and risks

### A. Invalid/malformed `hooks/hooks.json`
The plan says to load hooks but does not define behavior for:
- invalid JSON
- wrong schema (e.g., unknown hook names, wrong types)
- non-array values where arrays are expected
- hooks with missing required command fields

Without explicit handling, install/update may fail with opaque errors or partially load unsafe config.

### B. Path and hydration safety
Hydration with `${extensionPath}` / `${workspacePath}` is mentioned, but there is no risk analysis for:
- missing/undefined context values
- accidental double-hydration
- interpolation into shell commands causing unexpected execution semantics
- path traversal / symlink edge cases for extension directories

Given this is security-adjacent, the plan should define strict hydration behavior and validation.

### C. Consent-change detection edge cases
The proposed `hasHooks` / `previousHasHooks` diffing is underspecified:
- What if hooks existed before but are removed? Should consent be re-requested?
- What if hooks exist both before and after, but content changes materially (new command/event)?
- What if previous install had invalid hooks file and now valid hooks file appears?

Binary presence checks alone may miss risk-increasing updates.

### D. Interaction with existing inline `hooks` in extension config
LLxprt already supports `hooks?: ...` on `GeminiCLIExtension`. The plan does not define precedence/merge behavior between:
- hooks declared in main extension config
- hooks declared in `hooks/hooks.json`

This can cause silent override or duplication bugs.

### E. Runtime failure handling
No plan for what happens when hook loading fails during install/update:
- hard fail install?
- warn and continue without hooks?
- rollback behavior?

This should be explicit and test-covered.

## 2) Incomplete analysis of LLxprt current state

### A. Analysis stops at types/interfaces; misses execution pipeline integration
The plan notes that hook system exists but does not verify:
- where extension-provided hooks are merged into the active hook registry
- whether CLI config loader currently plumbs extension hooks end-to-end
- whether any normalizations are required before registration

### B. No check of current consent persistence model
It mentions signature differences but does not analyze how LLxprt stores previous consent decisions/config fingerprints. Upstream parity may require more than adding booleans to function signatures.

### C. No compatibility analysis for `@vybestack/llxprt-code-core` import surface
It assumes `HookDefinition` and `HookEventName` import path is stable and available in CLI package constraints. The plan should confirm package boundaries/build references already allow this without creating circular/runtime issues.

### D. No review of extension update/install flow breadth
Only `loadExtension()` is discussed. Need explicit audit of all paths:
- fresh install
- reinstall
- update
- non-interactive/headless flows
- scripted consent providers

## 3) Missing test scenarios

Current test list is too narrow. Missing at least:

1. **Malformed hooks file**: parse/schema errors produce deterministic user-facing errors.
2. **No hooks directory**: behavior remains unchanged (no warning, no regression).
3. **Hooks present but empty object/empty arrays**: define whether warning appears.
4. **Update transitions**:
   - none -> hooks (must warn)
   - hooks -> none (expected behavior defined)
   - hooks -> hooks changed (expected behavior defined)
5. **Precedence/merge test** between config hooks and `hooks/hooks.json`.
6. **Hydration tests** for both placeholders and unknown placeholders.
7. **Consent text snapshot/behavioral test** ensuring warning formatting and placement are stable.
8. **Non-interactive consent rejection path** with hooks warning included.
9. **Backward compatibility test** for extensions that only use existing `hooks` field in config.

Also missing explicit TDD workflow in the execution plan (failing tests first), which is required by project memory/rules.

## 4) Potential breaking changes not addressed

1. **Function signature change ripple**: Updating `maybeRequestConsentOrFail` may break internal callers/tests if not comprehensively updated.
2. **Behavioral change for existing extensions**: If warning triggers for any hooks (including previously benign/empty), users may face new prompts unexpectedly.
3. **Hook source semantics**: Introducing file-based hooks without defined merge strategy could change which hooks execute.
4. **Install UX change**: warning text changes may break snapshot or golden-output tests in CLI flows.
5. **Error strictness changes**: if malformed hooks now fail install, this may break previously installable extensions.

## 5) Dependencies on other commits not mentioned

Likely implicit dependencies are missing from the plan:

1. **Any upstream commit that adds/adjusts hook JSON schema validation** (if `eb3312e7baaf` relied on prior parser/type guards).
2. **Any commit that added recursive hydration helpers used by hook loading** in extension context.
3. **Any consent-flow refactor commit** that introduced `previousHasHooks` logic or config diff behavior.
4. **Any tests/fixtures commits** that establish expected warning copy and update semantics.

Without verifying cherry-pick neighborhood dependencies, this plan risks a partial port that compiles but diverges behaviorally.

## Recommended plan improvements

1. Add an explicit **merge/precedence contract** for config hooks vs `hooks/hooks.json`.
2. Define **strict validation + error policy** for hooks file parsing/schema.
3. Expand consent logic from boolean presence to **risk-relevant diffing** (or document why presence-only is acceptable).
4. Enumerate all install/update execution paths and expected outcomes.
5. Add a concrete **TDD test matrix** covering malformed input, transitions, compatibility, and UX output.
6. Identify and list required upstream dependency commits (or explicitly confirm none after code-level diff review).

Overall: good starting direction, but currently under-specified for safe reimplementation in a security-sensitive area.