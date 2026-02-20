# Plan: User-Scoped Extension Settings

Plan ID: PLAN-20250219-GMERGE021.R15
Generated: 2026-02-19
Total Phases: 7
Requirements: REQ-SCOPE-001, REQ-SCOPE-002, REQ-SCOPE-003, REQ-SCOPE-004, REQ-SCOPE-005

**Upstream Commit**: `ec9a8c7a7293` — Add support for user-scoped extension settings (#13748)

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P01)
2. Defined integration contracts for multi-component features
3. Written integration tests BEFORE unit tests
4. Verified all dependencies and types exist as assumed

---

## Execution Tracker

| Phase | ID | Status | Started | Completed | Verified | Semantic? | Notes |
|-------|----|--------|---------|-----------|----------|-----------|-------|
| P01 | Preflight | ⬜ | - | - | - | N/A | Preflight verification |
| P02 | Scope Types | ⬜ | - | - | - | ⬜ | Create `settingsScope.ts` + tests |
| P03 | Storage | ⬜ | - | - | - | ⬜ | Scope-aware `settingsStorage.ts` + tests |
| P04 | Integration | ⬜ | - | - | - | ⬜ | Merge logic in `settingsIntegration.ts` + tests |
| P05 | CLI Commands | ⬜ | - | - | - | ⬜ | `settings.ts` commands + tests |
| P06 | Wiring | ⬜ | - | - | - | ⬜ | Register command in `extensions.tsx` |
| P07 | Verify | ⬜ | - | - | - | ⬜ | Full suite + smoke test |

Note: "Semantic?" tracks whether semantic verification (feature actually works) was performed, not just structural verification (files exist).

---

# Phase P01: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R15.P01`

## Purpose

Verify ALL assumptions before writing any code.

## Dependency Verification

| Dependency | Verification Command | Status |
|------------|---------------------|--------|
| `@vybestack/llxprt-code-core` SecureStore | `grep -r "SecureStore" packages/cli/src/config/extensions/settingsStorage.ts` | Confirm present |
| `getGitRepoRoot` utility | `grep -r "getGitRepoRoot" packages/cli/src/utils/gitUtils.ts` | Confirm present |
| Yargs command pattern | `grep -r "CommandModule" packages/cli/src/commands/extensions.tsx` | Confirm present |
| dotenv/dotenv-flow | `cat packages/cli/package.json \| grep dotenv` | Confirm present |

## Upstream Prerequisite Analysis

```bash
# Identify any commits that ec9a8c7a7293 depends on
git log --oneline upstream/main | head -20
# Cross-reference with ec9a8c7a7293 to identify prerequisite commits
# If found, note and decide whether to implement prerequisites first
```

## Type/Interface Verification

| Type Name | Expected Definition | Verification Command |
|-----------|---------------------|---------------------|
| `ExtensionSetting` | Has `sensitive` boolean field | `grep -n "sensitive" packages/cli/src/config/extensions/extensionSettings.ts` |
| `ExtensionSettingsStorage` | Constructor takes `(name, dir)` | `grep -n "constructor" packages/cli/src/config/extensions/settingsStorage.ts` |
| `getExtensionEnvironment` | Returns `Promise<Record<string, string>>` | `grep -n "getExtensionEnvironment" packages/cli/src/config/extensions/settingsIntegration.ts` |
| `maybePromptAndSaveSettings` | Signature: `(name, settings, existing, dir)` | `grep -n "maybePromptAndSaveSettings" packages/cli/src/config/extensions/settingsIntegration.ts` |

## Call Path Verification

| Function | Where Called | Verification Command |
|----------|-------------|---------------------|
| `maybePromptAndSaveSettings` | `packages/cli/src/config/extension.ts` | `grep -rn "maybePromptAndSaveSettings" packages/cli/src/` |
| `getExtensionEnvironment` | Within `settingsIntegration.ts` and tests | `grep -rn "getExtensionEnvironment" packages/cli/src/` |
| Yargs `extensions` command builder | `config.ts` L593 | `grep -n "extensions" packages/cli/src/config/config.ts` |

## Test Infrastructure Verification

| Component | Verification |
|-----------|-------------|
| `settingsStorage.test.ts` exists | `ls packages/cli/src/config/extensions/settingsStorage.test.ts` |
| `settingsIntegration.test.ts` exists | `ls packages/cli/src/config/extensions/settingsIntegration.test.ts` |
| Test runner pattern for extensions | `npm test -- --grep "settingsStorage"` |

## Verification Gate

- [ ] All dependencies verified present
- [ ] All types match expected signatures
- [ ] `getGitRepoRoot()` is importable from `settingsScope.ts`'s location
- [ ] `maybePromptAndSaveSettings` call sites identified — zero breaking changes required
- [ ] No prerequisite upstream commits missing from LLxprt
- [ ] Test infrastructure operational

**IF ANY CHECKBOX IS UNCHECKED: STOP and update plan before proceeding.**

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

---

# Phase P02: Scope Types and Workspace Identity (TDD)

## Phase ID

`PLAN-20250219-GMERGE021.R15.P02`

## Prerequisites

- Required: Phase P01 completed
- Verification: `project-plans/gmerge-0.21.3/.completed/P01.md` exists
- Preflight verification gate passed (all checkboxes checked)

## Requirements Implemented (Expanded)

### REQ-SCOPE-001: Scope Enum and Workspace Identity

**Full Text**: The system MUST define `SettingsScope.USER` and `SettingsScope.WORKSPACE` enum values, and provide a `getWorkspaceRoot()` function that returns the canonical workspace directory.

**Behavior**:
- GIVEN: CLI is invoked from any subdirectory of a git repo
- WHEN: `getWorkspaceRoot()` is called
- THEN: Returns `fs.realpathSync(git rev-parse --show-toplevel)` — stable regardless of invocation subdir

**Behavior (fallback)**:
- GIVEN: CLI is invoked outside a git repository
- WHEN: `getWorkspaceRoot()` is called
- THEN: Returns `fs.realpathSync(process.cwd())` AND emits `console.warn` about non-git fallback

**Why This Matters**: Without a stable workspace identity, workspace-scoped keychain keys fragment across subdirectory invocations, causing settings to appear "lost."

### REQ-SCOPE-002: Workspace Env File Path

**Full Text**: The system MUST resolve workspace-scoped env settings to `<workspace-root>/.env.llxprt-extensions`, not to the bare `.env` file.

**Behavior**:
- GIVEN: Any workspace root path
- WHEN: `getWorkspaceEnvFilePath()` is called
- THEN: Returns `path.join(getWorkspaceRoot(), '.env.llxprt-extensions')`

**Why This Matters**: Writing to `.env` would overwrite unrelated project variables consumed by CI, frameworks, and tooling. The distinct filename signals LLxprt ownership.

## Implementation Tasks

### Files to Create (tests first — TDD)

- `packages/cli/src/config/extensions/settingsScope.test.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P02`
  - MUST include: `@requirement:REQ-SCOPE-001`, `@requirement:REQ-SCOPE-002`
  - Tests:
    - `getWorkspaceRoot()` returns git repo root when inside a git repo
    - `getWorkspaceRoot()` falls back to `process.cwd()` when `getGitRepoRoot` throws
    - `getWorkspaceRoot()` calls `console.warn` on fallback
    - `getWorkspaceRoot()` calls `fs.realpathSync` on the resolved path
    - `getWorkspaceEnvFilePath()` ends with `.env.llxprt-extensions`
    - Path is stable across subdir invocations (mock `getGitRepoRoot` returning fixed root)

- `packages/cli/src/config/extensions/settingsScope.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P02`
  - MUST include: `@requirement:REQ-SCOPE-001`, `@requirement:REQ-SCOPE-002`
  - Exports: `SettingsScope` enum (`USER = 'user'`, `WORKSPACE = 'workspace'`)
  - Exports: `DEFAULT_SETTINGS_SCOPE = SettingsScope.USER`
  - Exports: `getWorkspaceRoot(): string`
  - Exports: `getWorkspaceEnvFilePath(): string`

### Required Code Markers

Every function/class/test created in this phase MUST include:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R15.P02
 * @requirement REQ-SCOPE-001
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Check plan markers exist
grep -r "@plan:PLAN-20250219-GMERGE021.R15.P02" packages/cli/src/config/extensions/ | wc -l
# Expected: 2+ occurrences

# Check requirements covered
grep -r "@requirement:REQ-SCOPE-001" packages/cli/src/config/extensions/ | wc -l
# Expected: 2+ occurrences

# Run phase-specific tests (fail before impl, pass after)
npm test -- --grep "@plan:.*P02"
# Expected: All pass after implementation
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB|XXX)" packages/cli/src/config/extensions/settingsScope.ts | grep -v ".test.ts"
# Expected: No matches

grep -rn -E "(in a real|placeholder|not yet|will be)" packages/cli/src/config/extensions/settingsScope.ts
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] I read REQ-SCOPE-001 text and can explain how `getWorkspaceRoot()` fulfills it
- [ ] I read REQ-SCOPE-002 text and can explain how `getWorkspaceEnvFilePath()` fulfills it
- [ ] `getWorkspaceRoot()` actually calls `getGitRepoRoot()` (not hardcoded)
- [ ] Fallback emits `console.warn` (verified by reading implementation)
- [ ] `fs.realpathSync` called on both git-root and cwd fallback paths
- [ ] Tests would fail if `getGitRepoRoot` call were removed
- [ ] Tests would fail if `realpathSync` call were removed

#### Feature Actually Works

```bash
# Manual verification (run and paste output):
node -e "
const { getWorkspaceRoot, getWorkspaceEnvFilePath } = require('./packages/cli/src/config/extensions/settingsScope.js');
console.log('root:', getWorkspaceRoot());
console.log('env:', getWorkspaceEnvFilePath());
"
# Expected: root ends at repo root, env ends with '.env.llxprt-extensions'
```

## Success Criteria

- `settingsScope.ts` created with all 4 exports
- `settingsScope.test.ts` created with 6+ tests, all passing
- Plan markers in both files
- `npm run typecheck` passes

## Failure Recovery

1. `git checkout -- packages/cli/src/config/extensions/settingsScope.ts`
2. `git checkout -- packages/cli/src/config/extensions/settingsScope.test.ts`
3. Cannot proceed to P03 until fixed

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

---

# Phase P03: Scope-Aware Settings Storage (TDD)

## Phase ID

`PLAN-20250219-GMERGE021.R15.P03`

## Prerequisites

- Required: Phase P02 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R15.P02" packages/cli/src/config/extensions/settingsScope.ts`
- Expected files from P02: `settingsScope.ts`, `settingsScope.test.ts`

## Requirements Implemented (Expanded)

### REQ-SCOPE-003: Scope-Keyed Keychain Service Names

**Full Text**: The keychain service name for workspace-scoped sensitive settings MUST embed the canonicalized workspace path, distinguishing them from user-scoped keys for the same extension.

**Behavior**:
- GIVEN: Extension `my-ext`, scope `WORKSPACE`, workspace root `/my/project`
- WHEN: `getKeychainServiceName('my-ext', SettingsScope.WORKSPACE, '/my/project')` is called
- THEN: Returns a string containing `my-ext` and a sanitized form of `/my/project`, max 255 chars

**Behavior (backward compat)**:
- GIVEN: `getKeychainServiceName('my-ext')` called with no scope argument
- WHEN: Function is invoked
- THEN: Returns exactly `'LLxprt Code Extension my-ext'` — identical to current behavior

**Why This Matters**: Without distinct service names, workspace settings overwrite user settings in the keychain, destroying user-scoped secrets.

**Behavior (legacy fallback)**:
- GIVEN: User-scoped `SecureStore.get` returns `null` for new scoped key
- WHEN: `loadSettings` is called with `USER` scope
- THEN: Falls back to legacy unscoped service name lookup before returning `undefined`

**Why This Matters**: Existing stored secrets survive the upgrade without requiring user re-entry.

## Implementation Tasks

### Files to Modify — Tests First (TDD)

- `packages/cli/src/config/extensions/settingsStorage.test.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P03`
  - MUST include: `@requirement:REQ-SCOPE-003`
  - Tests to ADD:
    - `getKeychainServiceName('my-ext')` (no args) → `'LLxprt Code Extension my-ext'` (backward compat)
    - `getKeychainServiceName('my-ext', USER)` → same as no-args result
    - `getKeychainServiceName('my-ext', WORKSPACE, '/my/project')` → includes sanitized path
    - Service name ≤ 255 chars even when workspace path is 300+ chars
    - Path separators `/`, `\`, `:` are replaced with `_` in service name
    - USER-scoped storage reads from `extensionDir/.env`
    - WORKSPACE-scoped storage reads from `getWorkspaceEnvFilePath()` (not extensionDir)
    - Legacy fallback: unscoped key found when scoped key absent

### Files to Modify — Implementation

- `packages/cli/src/config/extensions/settingsStorage.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P03`
  - MUST include: `@requirement:REQ-SCOPE-003`
  - `getKeychainServiceName(extensionName, scope?, workspaceRoot?)`: add optional `scope` and `workspaceRoot` params with defaults preserving current behavior
  - `ExtensionSettingsStorage` constructor: add optional `scope: SettingsScope = SettingsScope.USER`
  - Derive env file path from scope: USER → `extensionDir/.env`, WORKSPACE → `getWorkspaceEnvFilePath()`
  - `loadSettings`: add legacy fallback for USER scope when scoped key returns null

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R15.P03
 * @requirement REQ-SCOPE-003
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
grep -r "@plan:PLAN-20250219-GMERGE021.R15.P03" packages/cli/src/config/extensions/ | wc -l
# Expected: 2+ occurrences

npm test -- --grep "@plan:.*P03"
# Expected: All pass
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/cli/src/config/extensions/settingsStorage.ts | grep -v ".test.ts"
# Expected: No matches

grep -rn -E "return \[\]|return \{\}|return null" packages/cli/src/config/extensions/settingsStorage.ts | grep -v ".test.ts"
# Expected: No matches in new code
```

### Semantic Verification Checklist

- [ ] Backward compat test passes: no-arg call returns same string as before
- [ ] Workspace service name includes sanitized path (path separators → `_`)
- [ ] 255-char truncation test passes with a 300-char workspace path
- [ ] USER-scope constructor still uses `extensionDir/.env` (no regression)
- [ ] WORKSPACE-scope constructor uses `getWorkspaceEnvFilePath()` from settingsScope.ts
- [ ] Legacy fallback actually tries second `SecureStore.get` call (traced in code)
- [ ] `npm run typecheck` passes — no new type errors at existing call sites

#### Integration Points Verified

- [ ] `getKeychainServiceName` called correctly from constructor (verified by reading constructor body)
- [ ] Scope default `USER` means constructor with two args is unchanged (verified)
- [ ] `getWorkspaceEnvFilePath` imported from `settingsScope.ts` (not re-implemented)

## Success Criteria

- All new tests in `settingsStorage.test.ts` pass
- Existing tests in `settingsStorage.test.ts` still pass (no regression)
- `npm run typecheck` reports no errors

## Failure Recovery

1. `git checkout -- packages/cli/src/config/extensions/settingsStorage.ts`
2. `git checkout -- packages/cli/src/config/extensions/settingsStorage.test.ts`
3. Cannot proceed to P04 until fixed

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase P04: Merged Scope Loading in Integration Layer (TDD)

## Phase ID

`PLAN-20250219-GMERGE021.R15.P04`

## Prerequisites

- Required: Phase P03 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R15.P03" packages/cli/src/config/extensions/settingsStorage.ts`
- Expected from P03: scope-aware `ExtensionSettingsStorage` constructor

## Requirements Implemented (Expanded)

### REQ-SCOPE-004: Workspace-Wins Merge Semantics

**Full Text**: `getExtensionEnvironment` MUST merge user-scope and workspace-scope settings, with workspace-scope values taking precedence over user-scope values for the same key.

**Behavior**:
- GIVEN: Key `API_URL` has value `https://user.example.com` in USER scope and `https://ws.example.com` in WORKSPACE scope
- WHEN: `getExtensionEnvironment(extensionDir)` is called
- THEN: Returns `{ API_URL: 'https://ws.example.com' }` (workspace wins)

**Behavior (single scope)**:
- GIVEN: Only USER scope has `API_URL=https://user.example.com`
- WHEN: `getExtensionEnvironment(extensionDir)` is called
- THEN: Returns `{ API_URL: 'https://user.example.com' }`

**Behavior (opt-out)**:
- GIVEN: Caller passes `mergeScopes = false`
- WHEN: `getExtensionEnvironment(extensionDir, false)` is called
- THEN: Returns only user-scope settings (current behavior)

**Why This Matters**: Team/project settings in workspace scope must override personal defaults, enabling per-project configuration without modifying user-global settings.

**Behavior (error resilience)**:
- GIVEN: Workspace `.env.llxprt-extensions` is unreadable (permissions error)
- WHEN: `getExtensionEnvironment` is called
- THEN: Logs a warning, returns user-scope settings unimpaired (workspace layer treated as empty)

## Implementation Tasks

### Files to Modify — Tests First (TDD)

- `packages/cli/src/config/extensions/settingsIntegration.test.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P04`
  - MUST include: `@requirement:REQ-SCOPE-004`
  - Tests to ADD:
    - Same key in both scopes → workspace value in merged result
    - Only USER scope set → user value returned
    - Only WORKSPACE scope set → workspace value returned
    - `mergeScopes=false` → only user-scope settings returned
    - Unreadable workspace env file → warning logged, user layer returned intact
    - `SecureStore` failure on one scope → warning logged, other scope unimpaired
    - Malformed `.env.llxprt-extensions` → parser returns partial results, no crash
    - Sensitive values returned in `getExtensionEnvironment` (no redaction at this layer)
    - `maybePromptAndSaveSettings` without `scope` arg → behavior identical to before (backward compat)
    - `maybePromptAndSaveSettings` with `scope=WORKSPACE` → storage constructed with WORKSPACE scope

### Files to Modify — Implementation

- `packages/cli/src/config/extensions/settingsIntegration.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P04`
  - MUST include: `@requirement:REQ-SCOPE-004`
  - `getExtensionEnvironment(extensionDir, mergeScopes = true)`:
    - When true: load USER layer, load WORKSPACE layer, return `{ ...user, ...workspace }`
    - When false: load USER layer only (existing behavior)
    - Wrap WORKSPACE load in try/catch: log warning on error, use `{}` for that layer
  - `maybePromptAndSaveSettings(..., scope = DEFAULT_SETTINGS_SCOPE)`:
    - Construct `ExtensionSettingsStorage` with `scope` parameter

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R15.P04
 * @requirement REQ-SCOPE-004
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
grep -r "@plan:PLAN-20250219-GMERGE021.R15.P04" packages/cli/src/config/extensions/ | wc -l
# Expected: 2+ occurrences

npm test -- --grep "@plan:.*P04"
# Expected: All pass
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/cli/src/config/extensions/settingsIntegration.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] Merge is `{ ...user, ...workspace }` — workspace keys overwrite user keys (verified in code)
- [ ] Error in WORKSPACE load does NOT propagate (wrapped in try/catch, verified)
- [ ] `mergeScopes=false` returns only USER layer — not a merged subset (verified)
- [ ] Sensitive values are NOT redacted here (redaction is CLI output concern, verified)
- [ ] `maybePromptAndSaveSettings` default scope is `DEFAULT_SETTINGS_SCOPE` from `settingsScope.ts`
- [ ] No call sites of `maybePromptAndSaveSettings` or `getExtensionEnvironment` broken (grep confirmed)
- [ ] `npm run typecheck` passes — existing callers need no modification

#### Env Precedence Stack Unchanged

The broader precedence stack must remain:
```
process.env (system)
  ← project env
    ← getExtensionEnvironment() result  ← [workspace wins within this layer]
```

- [ ] Confirmed by reading `getExtensionEnvironment` callers — no precedence regression

## Success Criteria

- All new tests in `settingsIntegration.test.ts` pass
- Existing tests in `settingsIntegration.test.ts` still pass
- `npm run typecheck` reports no new errors

## Failure Recovery

1. `git checkout -- packages/cli/src/config/extensions/settingsIntegration.ts`
2. `git checkout -- packages/cli/src/config/extensions/settingsIntegration.test.ts`
3. Cannot proceed to P05 until fixed

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

---

# Phase P05: CLI `settings set` / `settings list` Commands (TDD)

## Phase ID

`PLAN-20250219-GMERGE021.R15.P05`

## Prerequisites

- Required: Phase P04 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R15.P04" packages/cli/src/config/extensions/settingsIntegration.ts`
- Expected from P04: `maybePromptAndSaveSettings` accepts `scope` param; `getExtensionEnvironment` merges

## Requirements Implemented (Expanded)

### REQ-SCOPE-005: `settings set` and `settings list` CLI Subcommands

**Full Text**: The CLI MUST expose `llxprt extensions settings set <ext> <key> <value> [--scope user|workspace]` and `llxprt extensions settings list <ext> [--json]` subcommands.

**Behavior — `set` defaults to user scope**:
- GIVEN: `llxprt extensions settings set my-ext API_KEY abc123`
- WHEN: Command runs (no `--scope` flag)
- THEN: Value saved to USER-scoped storage; success message printed

**Behavior — `set` with workspace scope**:
- GIVEN: `llxprt extensions settings set my-ext API_KEY abc123 --scope workspace`
- WHEN: Command runs
- THEN: Value saved to WORKSPACE-scoped storage (keychain + `.env.llxprt-extensions`); success message printed

**Behavior — `list` human output**:
- GIVEN: `API_URL` in USER scope; `API_KEY` in both scopes (workspace wins); `API_KEY` is sensitive
- WHEN: `llxprt extensions settings list my-ext` runs
- THEN:
  ```
  API_URL=https://example.com (user)
  API_KEY=**** (workspace) [overrides user]
  ```

**Behavior — `list --json`**:
- GIVEN: Same state as above
- WHEN: `llxprt extensions settings list my-ext --json` runs
- THEN: Emits JSON with `key`, `effectiveValue` (`null` for sensitive), `scope`, `shadowed` (boolean), `sensitive` fields

**Why This Matters**: Without these commands, users have no way to configure workspace-scoped extension settings. The `--json` flag enables scripting and CI automation.

## Implementation Tasks

### Files to Create — Tests First (TDD)

- `packages/cli/src/commands/extensions/settings.test.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P05`
  - MUST include: `@requirement:REQ-SCOPE-005`
  - Tests:
    - `settings set` writes to user-scoped storage by default
    - `settings set --scope workspace` writes to workspace storage
    - Invalid `--scope value` → error message + non-zero exit
    - Unknown extension name → actionable error
    - Unknown setting key → actionable error
    - `settings list` redacts sensitive values (`****`) in human output
    - `settings list --json` emits `null` for sensitive values
    - `settings list` shows scope label for each key
    - `settings list` shows `[overrides user]` when workspace value shadows user value
    - `settings list --json` output is stable (regression for script consumers)

- `packages/cli/src/commands/extensions/settings.ts`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P05`
  - MUST include: `@requirement:REQ-SCOPE-005`
  - Exports: `settingsCommand` (Yargs `CommandModule`)
  - `set` subcommand: positional `<extension-name>`, `<setting-name>`, `<value>`; `--scope` option defaulting to `'user'`
  - `list` subcommand: positional `<extension-name>`; `--json` boolean flag
  - Human list format: `KEY=value (scope)` with optional `[overrides user]`
  - JSON list format: array of `{ key, effectiveValue, scope, shadowed, sensitive }`
  - Sensitive value rule: `****` in human, `null` in JSON — never expose raw value in output

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R15.P05
 * @requirement REQ-SCOPE-005
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
grep -r "@plan:PLAN-20250219-GMERGE021.R15.P05" packages/cli/src/commands/extensions/ | wc -l
# Expected: 2+ occurrences

npm test -- --grep "@plan:.*P05"
# Expected: All pass
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/cli/src/commands/extensions/settings.ts | grep -v ".test.ts"
# Expected: No matches

grep -rn -E "(in a real|placeholder|not yet)" packages/cli/src/commands/extensions/settings.ts
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] `settings set` actually calls `ExtensionSettingsStorage.saveSettings` (not a no-op)
- [ ] `settings list` actually reads from BOTH scopes and merges (not just one scope)
- [ ] Sensitive values are redacted — tested by verifying `****` appears in output
- [ ] `--json` output includes all required fields: `key`, `effectiveValue`, `scope`, `shadowed`, `sensitive`
- [ ] `[overrides user]` logic correct: appears only when both scopes have the same key
- [ ] Error cases return non-zero exit code (tested)

#### Feature Actually Works (Manual Smoke Test)

```bash
# Run after P06 wiring phase:
node scripts/start.js --help | grep -A5 "extensions"
# Expected: settings subcommand visible in help output
```

## Success Criteria

- `settings.ts` created with both subcommands fully implemented
- `settings.test.ts` created with 10+ tests, all passing
- `npm run typecheck` passes

## Failure Recovery

1. `git checkout -- packages/cli/src/commands/extensions/settings.ts`
2. `git checkout -- packages/cli/src/commands/extensions/settings.test.ts`
3. Cannot proceed to P06 until fixed

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

---

# Phase P06: Register Command in `extensions.tsx`

## Phase ID

`PLAN-20250219-GMERGE021.R15.P06`

## Prerequisites

- Required: Phase P05 completed
- Verification: `grep -r "@plan:PLAN-20250219-GMERGE021.R15.P05" packages/cli/src/commands/extensions/settings.ts`
- Expected from P05: `settingsCommand` exported from `settings.ts`

## Requirements Implemented (Expanded)

This phase is a wiring phase — it makes the commands created in P05 reachable from the CLI. No new requirements are introduced; REQ-SCOPE-005 is completed here by making `settingsCommand` reachable from `llxprt extensions`.

**Behavior**:
- GIVEN: User runs `llxprt extensions settings set ...`
- WHEN: CLI parses arguments
- THEN: Yargs routes to `settingsCommand` in `settings.ts`

**Why This Matters**: A command that isn't registered is unreachable by users, making all previous phases inert.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/commands/extensions.tsx`
  - MUST include: `@plan:PLAN-20250219-GMERGE021.R15.P06`
  - ADD import: `import { settingsCommand } from './extensions/settings.js';`
  - ADD in yargs builder: `yargs.command(settingsCommand)`
  - **This is the ONLY change to this file**

### Required Code Markers

```typescript
// @plan PLAN-20250219-GMERGE021.R15.P06
```

## Verification Commands

### Automated Checks (Structural)

```bash
grep -r "@plan:PLAN-20250219-GMERGE021.R15.P06" packages/cli/src/commands/extensions.tsx | wc -l
# Expected: 1+ occurrences

grep "settingsCommand" packages/cli/src/commands/extensions.tsx | wc -l
# Expected: 2 (import + usage)
```

### Semantic Verification Checklist

- [ ] Import path is `'./extensions/settings.js'` (not `.ts`) for ESM compatibility
- [ ] `yargs.command(settingsCommand)` added in the correct location (alongside other subcommands)
- [ ] No other changes made to `extensions.tsx` (single-responsibility wiring)
- [ ] `npm run build` succeeds — no import resolution errors

#### Feature Reachability Verified

```bash
# After build:
node packages/cli/dist/index.js extensions settings --help
# Expected: help text showing 'set' and 'list' subcommands with their options
```

## Success Criteria

- `extensions.tsx` imports and registers `settingsCommand`
- `npm run build` succeeds
- Help output shows `settings` as an `extensions` subcommand

## Failure Recovery

1. `git checkout -- packages/cli/src/commands/extensions.tsx`
2. Cannot proceed to P07 until fixed

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P06.md`

---

# Phase P07: Full Verification Suite

## Phase ID

`PLAN-20250219-GMERGE021.R15.P07`

## Prerequisites

- Required: Phase P06 completed
- Verification: `grep "settingsCommand" packages/cli/src/commands/extensions.tsx`
- All previous phases' completion markers exist under `project-plans/gmerge-0.21.3/.completed/`

## Purpose

Run the complete project verification suite to confirm no regressions and that the full feature is reachable end-to-end.

## Verification Commands

### Full Suite (Run in Order)

```bash
# 1. Unit/integration tests
npm run test
# Expected: All tests pass, including new P02–P05 tests

# 2. Type checking
npm run typecheck
# Expected: Zero errors

# 3. Linting
npm run lint
# Expected: Zero warnings or errors

# 4. Formatting
npm run format
# Expected: No formatting changes needed (run before this if needed)

# 5. Build
npm run build
# Expected: Successful compilation

# 6. Smoke test — confirms no runtime regression
node scripts/start.js --profile-load synthetic "write me a haiku"
# Expected: Haiku output, no crash, no new error messages
```

### Plan Coverage Verification

```bash
# All plan phase markers present
for phase in P01 P02 P03 P04 P05 P06; do
  echo "--- $phase ---"
  grep -r "@plan:PLAN-20250219-GMERGE021.R15.$phase" packages/cli/src/ | wc -l
done
# Expected: Each phase has 1+ occurrences

# All requirement markers present
for req in REQ-SCOPE-001 REQ-SCOPE-002 REQ-SCOPE-003 REQ-SCOPE-004 REQ-SCOPE-005; do
  echo "--- $req ---"
  grep -r "@requirement:$req" packages/cli/src/ | wc -l
done
# Expected: Each requirement has 1+ occurrences
```

### End-to-End CLI Verification

```bash
# Build first
npm run build

# Test help output
node packages/cli/dist/index.js extensions settings --help
# Expected: Shows 'set' and 'list' subcommands

# Test scope option visibility
node packages/cli/dist/index.js extensions settings set --help
# Expected: Shows --scope option with 'user' | 'workspace' choices

# Test list --json option visibility
node packages/cli/dist/index.js extensions settings list --help
# Expected: Shows --json flag
```

### Semantic Verification Checklist

- [ ] All 5 phase completion markers exist in `project-plans/gmerge-0.21.3/.completed/`
- [ ] `npm run test` passes — no failures, no skipped tests that shouldn't be skipped
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — succeeds
- [ ] Smoke test produces haiku output
- [ ] `settings --help` shows correct subcommands
- [ ] `settings set --help` shows `--scope` option
- [ ] `settings list --help` shows `--json` flag
- [ ] No deferred implementations in any changed file (no TODO/FIXME/STUB)
- [ ] Backward compatibility confirmed: existing callers of `maybePromptAndSaveSettings` and `getExtensionEnvironment` unchanged

#### Prerequisite Commit Check (Final)

```bash
# Confirm no prerequisite upstream commits were missed
git log --oneline upstream/main | head -20
# Confirm ec9a8c7a7293 has no unevaluated dependencies
```

## Success Criteria

- `npm run test && npm run typecheck && npm run lint && npm run build` all succeed
- Smoke test produces haiku with no errors
- CLI help shows all new commands and options
- All plan and requirement markers traceable in codebase

## Failure Recovery

If any verification step fails:
1. Identify which phase introduced the failure by checking git diff per phase
2. Return to that phase's failure recovery procedure
3. Re-run full P07 verification after fixing

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P07.md`

Contents:
```markdown
Phase: P07
Completed: [DATE]
Verification Output:
  npm run test: PASS ([N] tests)
  npm run typecheck: PASS
  npm run lint: PASS
  npm run format: PASS
  npm run build: PASS
  Smoke test: PASS (haiku produced)
  CLI help: PASS (settings subcommand visible)
```

---

## File Changes Summary

| File | Change Type | Plan Phase | Description |
|------|-------------|------------|-------------|
| `packages/cli/src/config/extensions/settingsScope.ts` | **NEW** | P02 | `SettingsScope` enum, `getWorkspaceRoot()`, `getWorkspaceEnvFilePath()` |
| `packages/cli/src/config/extensions/settingsScope.test.ts` | **NEW** | P02 | Scope/workspace identity tests |
| `packages/cli/src/config/extensions/settingsStorage.ts` | **MODIFY** | P03 | Scope param on `getKeychainServiceName`, scope-aware constructor, legacy fallback |
| `packages/cli/src/config/extensions/settingsStorage.test.ts` | **MODIFY** | P03 | Backward-compat, workspace scope, service name sanitization tests |
| `packages/cli/src/config/extensions/settingsIntegration.ts` | **MODIFY** | P04 | `mergeScopes` param on `getExtensionEnvironment`; `scope` param on `maybePromptAndSaveSettings` |
| `packages/cli/src/config/extensions/settingsIntegration.test.ts` | **MODIFY** | P04 | Merge, precedence, error, secret, compat tests |
| `packages/cli/src/commands/extensions/settings.ts` | **NEW** | P05 | `settings set` and `settings list` subcommands |
| `packages/cli/src/commands/extensions/settings.test.ts` | **NEW** | P05 | CLI command tests (set/list, redaction, errors) |
| `packages/cli/src/commands/extensions.tsx` | **MODIFY** | P06 | Register `settingsCommand` |

### Files Explicitly NOT Modified

| File | Reason |
|------|--------|
| `packages/cli/src/config/extensions/extensionSettings.ts` | Zod schema unchanged; `sensitive` field already provides redaction metadata |
| `packages/cli/src/config/extensions/settingsPrompt.ts` | Prompt logic is scope-agnostic; invoked after scope resolution |

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Workspace identity | `git rev-parse --show-toplevel` via existing `getGitRepoRoot()` | Stable across subdir invocations; canonicalized via `realpathSync` |
| Fallback identity | `path.resolve(process.cwd())` with warning | Usable outside git repos; non-silently |
| Workspace env file | `.env.llxprt-extensions` at workspace root | Prevents collision with project `.env` files |
| Secret storage | `SecureStore` always; file never holds secrets | Unchanged from current; workspace scope just changes service name |
| Legacy compat | Lazy fallback lookup on first read | No migration burden on users; no eager writes |
| List redaction | `****` human / `null` JSON | Secrets never visible in terminal or logs |
| Scope precedence | workspace overrides user | Matches upstream; allows team-wide overrides |
| Default scope | `user` | Backward compatible; no behavior change without explicit `--scope workspace` |
| Machine-readable output | `--json` on `settings list` | Enables scripting without brittle text parsing |
| Signature changes | All with default args | Zero breaking changes at existing call sites |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `getGitRepoRoot()` throws inside CI or non-git dirs | Fallback to `process.cwd()` with explicit warning |
| Long workspace paths truncate 255-char service name | Path truncated at 200 chars before appending; test enforces this |
| Concurrency: two writes to `.env.llxprt-extensions` | Single-user CLI; atomic write (write to tmp, rename) minimizes partial-file risk |
| `.env.llxprt-extensions` consumed by unintended tooling | Distinct filename; document that this file is managed by LLxprt |
| `settings list` output format changes break scripts | `--json` provides a stable structured alternative |
| SecureStore backend rejects path-containing service names | Sanitize `/`, `\`, `:` to `_` before embedding |
