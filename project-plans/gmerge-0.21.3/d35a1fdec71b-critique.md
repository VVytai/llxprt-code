# Critique: Reimplementation Plan for `d35a1fdec71b`

This critique evaluates the plan against five dimensions:
1) missing edge cases/risks, 2) incomplete LLxprt-state analysis, 3) missing tests, 4) breaking changes, and 5) hidden dependencies.

---

## Overall Assessment

The plan correctly identifies the two relevant files (`github.ts` and `github.test.ts`) and the overall direction (change `ERROR` to `NOT_UPDATABLE` for missing local extension configs). However, it contains several factual errors about the LLxprt codebase, under-specifies the actual code change needed, and omits a TDD workflow required by project rules.

The biggest weaknesses are:
- the plan only changes one of two `ExtensionUpdateState.ERROR` returns in the local extension branch of `checkForExtensionUpdate` — the catch block also uses `ERROR` and may need to be changed depending on the intended semantics,
- the plan incorrectly claims "LLxprt uses top-level `enableHooks`" in the Notes section — the setting is at `tools.enableHooks` in the settings schema, and `config.ts` reads it as `effectiveSettings.tools?.enableHooks`,
- "Change 1: Implement hook loading gating" is presented as a real action with a verification command, but `extension.ts` has zero references to hooks — this change is entirely N/A and the plan should state that explicitly rather than directing the implementor to run a search and figure it out,
- the plan does not analyze the behavioral difference between upstream's `loadExtensionConfig()` and LLxprt's `loadExtension()` in `checkForExtensionUpdate` — these functions have materially different failure modes and the difference is not acknowledged,
- no TDD workflow is specified: the plan does not require writing a failing test before implementing the change, violating project rules.

---

## 1) Missing Edge Cases and Risks

### 1.1 Two `ERROR` returns in the local branch, only one addressed
The current `checkForExtensionUpdate` has two `ExtensionUpdateState.ERROR` returns inside the `installMetadata?.type === 'local'` branch:

1. `setExtensionUpdateState(ExtensionUpdateState.ERROR)` when `!newExtension` (not found)
2. `setExtensionUpdateState(ExtensionUpdateState.ERROR)` in the catch block (exception thrown)

The upstream change converts both to `NOT_UPDATABLE`. The plan only describes changing the `!newExtension` case. The catch block — which covers I/O errors, permission errors, JSON parse failures, etc. — is left as `ERROR`. If the intent matches upstream (any failure to load local extension config → `NOT_UPDATABLE`), both must be changed. If only the "not found" case should become `NOT_UPDATABLE` while genuine I/O errors stay `ERROR`, this must be explicitly argued and tested. The plan does not address this at all.

### 1.2 `loadExtension()` vs `loadExtensionConfig()` semantic difference not analyzed
Upstream's `checkForExtensionUpdate` calls `loadExtensionConfig()` — a lightweight function that reads and parses only the config file. LLxprt's version calls `loadExtension()`, which also:
- calls `fs.statSync(extensionDir)` — throws if directory is missing, not just if config is missing,
- calls `loadInstallMetadata()`,
- checks `settings.security?.blockGitExtensions`,
- calls `loadSettings(workspaceDir)` internally.

This means LLxprt's local-extension update check can throw `ERROR` for reasons upstream never encounters (missing directory itself, blocked git extensions, etc.). The plan should decide whether these additional failure modes should also return `NOT_UPDATABLE` or remain `ERROR`. Currently the plan treats `loadExtension()` and `loadExtensionConfig()` as equivalent without analysis.

### 1.3 `console.error` vs warning log
Upstream's change also converts `console.error` to `debugLogger.warn` for the not-found case. The plan mentions "Logs a warning instead of error" in the summary but does not include this change in the implementation steps or code. LLxprt does not use `debugLogger` in `github.ts` currently — the plan should determine whether to use `console.warn`, introduce `debugLogger`, or leave `console.error` as-is, and justify the choice.

### 1.4 Missing `console.error` change in catch block
Even if the `ERROR`→`NOT_UPDATABLE` change is intentionally limited to the `!newExtension` case, the `catch` block still calls `console.error` with "Error checking for update…" — which is an inappropriate severity if the error is simply a missing config file. The plan does not address this log level.

---

## 2) Incomplete Analysis of LLxprt's Current State

### 2.1 "Change 1: Implement hook loading gating" is a phantom change
The plan presents Change 1 as a real work item with a verification command:
```
rg "hooks" packages/cli/src/config/extension.ts
rg "loadExtensionHooks" packages/
```
`extension.ts` contains zero mentions of "hooks" or "loadExtensionHooks". The plan should definitively state that Change 1 is N/A (not applicable) rather than leaving the implementor to verify this independently. As written, an implementor might spend time searching before concluding there is nothing to do.

### 2.2 Incorrect `enableHooks` setting path in Notes
The plan states in the Notes section: "LLxprt uses top-level `enableHooks`." This is incorrect. In `settingsSchema.ts`, `enableHooks` is defined at line 1090 **inside the `tools` object** (verified: it is nested inside `tools: { ..., enableHooks: { ... } }`). In `config.ts` it is read as `effectiveSettings.tools?.enableHooks ?? false`. The distinction between `settings.enableHooks` and `settings.tools?.enableHooks` matters because any code that reads `settings.enableHooks` (without `.tools`) would return `undefined`. This note could mislead future implementors who read this plan for related hook-gating work.

### 2.3 No test exists for local-type extensions in `github.test.ts`
The plan says to "Add a test case similar to upstream." The existing test file (`github.test.ts`) has zero tests for `installMetadata.type === 'local'` in `checkForExtensionUpdate`. This is a larger gap than "add a test" implies — there is no existing local-extension test scaffold to build from. The plan should acknowledge this and provide a concrete test template.

### 2.4 No analysis of what state is emitted after the initial `CHECKING_FOR_UPDATES`
The `checkForExtensionUpdate` function always first calls `setExtensionUpdateState(ExtensionUpdateState.CHECKING_FOR_UPDATES)` before any logic. The plan does not mention whether the test should verify this initial state transition. The existing tests for git-type extensions do not check for `CHECKING_FOR_UPDATES` first — but for completeness and behavioral correctness, the new test should clarify this.

---

## 3) Missing Test Scenarios

The plan's test section specifies only one test case. Missing scenarios:

### 3.1 `loadExtension` throws (I/O error or permission error)
The catch block returns `ExtensionUpdateState.ERROR`. If the intent is to change this to `NOT_UPDATABLE` as well, a test must verify that behavior. If not, a test should verify that genuine I/O errors still return `ERROR`.

### 3.2 `loadExtension` returns `null` (not-found / missing config)
This is the primary case the plan targets. A test must:
- mock `loadExtension` to return `null`,
- verify `NOT_UPDATABLE` is returned (not `ERROR`).

### 3.3 `loadExtension` succeeds and version matches
A test for the "same version" path through the local branch verifying `UP_TO_DATE`.

### 3.4 `loadExtension` succeeds and version differs
A test for the "different version" path verifying `UPDATE_AVAILABLE`.

### 3.5 Missing TDD workflow
The plan specifies "Step 3: Add test" as a post-implementation step. Per project rules, TDD is mandatory: write a failing test first, run it to prove failure, then implement. The plan must list the failing-test step before the implementation step.

---

## 4) Potential Breaking Changes Not Addressed

### 4.1 `NOT_UPDATABLE` UX change for local extension load failures
Changing from `ERROR` to `NOT_UPDATABLE` changes the UI indicator shown in `ExtensionsList.tsx`. Both states exist in the enum and are handled in the UI, so no crash occurs. However, the semantic meaning changes: a local extension that fails to load now appears "not updatable" rather than in an error state. This is a UX change for users who have misconfigured local extensions — they lose the error signal. The plan should acknowledge this tradeoff.

### 4.2 `console.error` remains for non-found local extension
If `console.error` is left in place when `NOT_UPDATABLE` is returned, the user sees an error-level log message but the UI shows a non-error state. This inconsistency should be addressed explicitly.

---

## 5) Dependencies on Other Commits Not Mentioned

### 5.1 No upstream dependency risk for this commit
The two changes in this commit (hook loading gating and local config error handling) are self-contained in the upstream codebase. No prior upstream commits appear to be required.

### 5.2 `loadExtension` vs `loadExtensionConfig` divergence origin
LLxprt's `checkForExtensionUpdate` already uses `loadExtension()` (which predates this plan). Understanding when and why LLxprt diverged from upstream here would clarify whether this was intentional. If prior cherry-picks deliberately switched to `loadExtension()`, that context matters for deciding whether to keep the behavioral difference.

---

## Recommended Plan Improvements

1. **State Change 1 is N/A explicitly**: Do not present the hooks gating as a potential work item; state definitively that `extension.ts` has no hook loading and no code change is required.

2. **Correct the `enableHooks` path**: Fix the Notes section to accurately state the setting is at `tools.enableHooks` (not top-level).

3. **Address both `ERROR` returns in the local branch**: Decide whether the catch block should also become `NOT_UPDATABLE` and document the reasoning. The implementation must reflect this decision.

4. **Address the `console.error` → warning log change**: Decide whether to change `console.error` to `console.warn` or `debugLogger.warn` and add this to the implementation steps.

5. **Analyze `loadExtension()` vs `loadExtensionConfig()` difference**: Explicitly document which failure modes from `loadExtension()` should map to `NOT_UPDATABLE` vs `ERROR`, since `loadExtension()` can fail for reasons `loadExtensionConfig()` cannot.

6. **Add TDD workflow**: Write the failing test before implementing; list this as Step 1.

7. **Expand test matrix**: Include tests for null return, exception thrown, version match, and version mismatch cases for local-type extensions.

8. **Acknowledge the UX tradeoff**: Note that `ERROR` → `NOT_UPDATABLE` changes the UI indicator and explain why this is the correct behavior.
