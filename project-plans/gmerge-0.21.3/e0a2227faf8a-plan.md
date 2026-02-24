# Plan: Per-extension Settings Commands (e0a2227faf8a)

Plan ID: PLAN-20250219-GMERGE021.R10
Generated: 2025-02-19
Total Phases: 6
Requirements: REQ-EXT-001 (settings list command), REQ-EXT-002 (settings set command)

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Completed preflight verification (Phase P00)
2. Defined integration contracts for multi-component features
3. Written integration tests BEFORE unit tests
4. Verified all dependencies and types exist as assumed

---

# Phase P00: Preflight Verification

## Phase ID

`PLAN-20250219-GMERGE021.R10.P00`

## Purpose

Verify ALL assumptions before writing any code.

## Upstream Changes Summary

Upstream commit `e0a2227faf8a` adds:

1. **`packages/cli/src/commands/extensions/settings.ts`** — `setCommand`, `listCommand`, `settingsCommand`
2. **`packages/cli/src/commands/extensions/utils.ts`** — `getExtensionAndManager(name)`
3. **`packages/cli/src/config/extensions/extensionSettings.ts`** — `formatEnvContent()`, `updateSetting()`
4. **`packages/cli/src/commands/extensions.tsx`** — registers `settingsCommand`

## Dependency Verification

| Dependency | Location | Status |
|------------|----------|--------|
| `ExtensionSettingsStorage` | `packages/cli/src/config/extensions/settingsStorage.ts` | OK — already exists |
| `getSettingsEnvFilePath` | `packages/cli/src/config/extensions/settingsStorage.ts` | OK — already exists |
| `getKeychainServiceName` | `packages/cli/src/config/extensions/settingsStorage.ts` | OK — already exists |
| `maybePromptForSettings` | `packages/cli/src/config/extensions/settingsPrompt.ts` | OK — already exists |
| `formatSettingPrompt` | `packages/cli/src/config/extensions/settingsPrompt.ts` | OK — already exists |
| `getMissingSettings` | `packages/cli/src/config/extensions/settingsPrompt.ts` | OK — already exists |
| `ExtensionSettingSchema` | `packages/cli/src/config/extensions/extensionSettings.ts` | OK — already exists |
| `ExtensionSetting` type | `packages/cli/src/config/extensions/extensionSettings.ts` | OK — already exists |
| `loadExtensionByName` | `packages/cli/src/config/extension.ts` | OK — already exists |
| `loadExtensionConfig` | `packages/cli/src/config/extension.ts` | OK — already exists |
| `ExtensionStorage` class | `packages/cli/src/config/extension.ts` | OK — already exists |
| `exitCli` | `packages/cli/src/commands/utils.ts` | OK — already exists |

## Type/Interface Verification

| Type Name | Plan Assumption | Constraint | Resolution |
|-----------|----------------|------------|------------|
| `ExtensionConfig` (internal) | Has `settings` field | NOT exported; has no `settings` field | Add optional `settings?: ExtensionSetting[]` field |
| `GeminiCLIExtension` | Has `settings` field | From `@vybestack/llxprt-code-core`; no `settings` field | Load settings from JSON config directly |
| `ExtensionManager` | Used for loading | Does NOT exist in LLxprt | Use `loadExtensionByName()` + `loadExtensionConfig()` instead |

## Architecture Constraint

**CRITICAL**: The original upstream uses `ExtensionManager`. LLxprt already has `ExtensionSettingsStorage` in `settingsStorage.ts` which handles all `.env` + keychain storage. The implementation MUST reuse `ExtensionSettingsStorage` rather than duplicating its logic.

## Call Path Verification

| Function | Caller in This Plan | Evidence |
|----------|---------------------|----------|
| `ExtensionSettingsStorage` | `updateSetting()` in `settingsStorage.ts` | Existing pattern in `settingsPrompt.ts` |
| `loadExtensionByName` | `getExtensionAndSettings()` in `utils.ts` | Existing use in `enable.ts` / `disable.ts` |
| `loadExtensionConfig` | `getExtensionAndSettings()` in `utils.ts` | Existing use in extension commands |
| `formatSettingPrompt` | extracted `promptForSingleSetting()` | Currently inline in `maybePromptForSettings` |

## Output Convention

Existing extension commands use `console.log` / `console.error` (not `debugLogger`). All new commands MUST follow the same convention. Reference: `packages/cli/src/commands/extensions/list.ts` and `enable.ts`.

## `.env` File Location

Settings `.env` is stored in `~/.llxprt/extensions/<name>/.env` (user extensions install dir), NOT in the current working directory. Use `ExtensionStorage.getExtensionDir()`.

## Blocking Issues Found

- `ExtensionConfig` internal interface needs `settings` optional field added before `loadExtensionConfig` returns it.
- `promptForSingleSetting` must be extracted from `maybePromptForSettings` before `updateSetting` can reuse it.

## Verification Gate

- [ ] All dependencies verified above
- [ ] Architecture constraint understood (no `ExtensionManager`)
- [ ] `ExtensionConfig.settings` gap identified and resolution planned
- [ ] `.env` file path convention confirmed
- [ ] Test infrastructure (jest + existing test patterns) ready

IF ANY CHECKBOX IS UNCHECKED: STOP and update plan before proceeding.

## Success Criteria

- All dependency paths confirmed
- Architecture deviations from upstream documented with resolutions
- No hidden blockers that would require plan revision mid-implementation

---

# Phase P01: Add `settings` Field to `ExtensionConfig`

## Phase ID

`PLAN-20250219-GMERGE021.R10.P01`

## Prerequisites

- Required: Phase P00 completed
- Verification: Preflight gate all checkboxes ticked
- Expected files from previous phase: (none — preflight only)

## Requirements Implemented (Expanded)

### REQ-EXT-000: `ExtensionConfig` type carries settings definitions

**Full Text**: The internal `ExtensionConfig` interface must carry an optional `settings` array so that `loadExtensionConfig` returns settings definitions parsed from the extension JSON.
**Behavior**:
- GIVEN: An extension's JSON config file includes a `settings` array
- WHEN: `loadExtensionConfig` parses the JSON
- THEN: The returned config object includes the `settings` array
**Why This Matters**: Without this field the settings commands cannot know what settings an extension declares.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extension.ts`
  - ADD import: `import type { ExtensionSetting } from './extensions/extensionSettings.js';`
  - ADD field to internal `ExtensionConfig` interface: `settings?: ExtensionSetting[];`
  - No other changes required — `JSON.parse` already produces the raw object and the `settings` array (if present) is included automatically
  - ADD comment: `// @plan PLAN-20250219-GMERGE021.R10.P01`

### Required Code Markers

Every function/class/test created in this phase MUST include:

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R10.P01
 * @requirement REQ-EXT-000
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Verify import added
grep -n "ExtensionSetting" packages/cli/src/config/extension.ts
# Expected: import line present

# Verify settings field added to interface
grep -n "settings.*ExtensionSetting" packages/cli/src/config/extension.ts
# Expected: 1 match with optional field syntax

# Typecheck — no new errors
npm run typecheck
# Expected: Passes
```

### Semantic Verification Checklist

- [ ] `ExtensionConfig` interface now has `settings?: ExtensionSetting[]`
- [ ] Import is present for `ExtensionSetting`
- [ ] `loadExtensionConfig` return type implicitly includes the new field (no function body change needed)
- [ ] Existing callers of `loadExtensionConfig` are unaffected (optional field, defaults to `undefined`)
- [ ] Typecheck passes with no errors

## Success Criteria

- `grep` confirms field and import present
- `npm run typecheck` passes
- No existing tests broken

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/config/extension.ts`
2. Re-examine `ExtensionConfig` interface structure and re-apply

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P01.md`

---

# Phase P02: Extract `promptForSingleSetting` from `settingsPrompt.ts`

## Phase ID

`PLAN-20250219-GMERGE021.R10.P02`

## Prerequisites

- Required: Phase P01 completed
- Verification: `grep -n "settings.*ExtensionSetting" packages/cli/src/config/extension.ts`
- Expected files from previous phase: `extension.ts` updated with `settings` field

## Requirements Implemented (Expanded)

### REQ-EXT-000.1: Reusable single-setting prompt

**Full Text**: A `promptForSingleSetting(setting)` function must be exported from `settingsPrompt.ts` so `updateSetting` can prompt for individual settings without re-implementing raw-mode stdin logic.
**Behavior**:
- GIVEN: A single `ExtensionSetting` definition
- WHEN: `promptForSingleSetting(setting)` is called
- THEN: Returns the string value entered by the user (uses hidden input for `sensitive` settings on TTY)
**Why This Matters**: Prevents duplication of raw-mode stdin logic between `maybePromptForSettings` and the new `updateSetting` function.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extensions/settingsPrompt.ts`
  - Extract the per-setting prompt logic currently inline in `maybePromptForSettings` into a new named export `promptForSingleSetting`
  - `maybePromptForSettings` must continue to work identically (call `promptForSingleSetting` internally)
  - ADD comment markers: `// @plan PLAN-20250219-GMERGE021.R10.P02`

```typescript
/**
 * Prompts the user for a single setting value.
 * Returns the entered string, or empty string if cancelled.
 *
 * @plan PLAN-20250219-GMERGE021.R10.P02
 * @requirement REQ-EXT-000.1
 */
export async function promptForSingleSetting(
  setting: ExtensionSetting,
): Promise<string> {
  const prompt = formatSettingPrompt(setting);

  if (setting.sensitive && process.stdin.isTTY) {
    return promptSensitive(prompt);
  }

  return promptPlain(prompt);
}
```

### Files to Modify (Tests)

- `packages/cli/src/config/extensions/settingsPrompt.test.ts`
  - ADD test suite for `promptForSingleSetting` (write failing tests first)

```typescript
describe('promptForSingleSetting @plan:PLAN-20250219-GMERGE021.R10.P02', () => {
  it('should prompt using readline for non-sensitive settings @requirement:REQ-EXT-000.1', async () => {
    // Mock readline, verify formatSettingPrompt output used
  });

  it('should use hidden input mode for sensitive settings on TTY @requirement:REQ-EXT-000.1', async () => {
    // Mock process.stdin.isTTY = true, verify raw mode set
  });

  it('should return the entered value @requirement:REQ-EXT-000.1', async () => {
    // Mock readline resolving 'my-value', expect 'my-value' returned
  });

  it('should return empty string when input is empty @requirement:REQ-EXT-000.1', async () => {
    // Verify empty string is returned, not thrown
  });
});
```

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R10.P02
 * @requirement REQ-EXT-000.1
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Verify export added
grep -n "promptForSingleSetting" packages/cli/src/config/extensions/settingsPrompt.ts
# Expected: export function declaration present

# Verify tests created
grep -rn "@plan:PLAN-20250219-GMERGE021.R10.P02" packages/cli/src/config/extensions/
# Expected: matches in test file

# Run phase-specific tests (write failing first, then implement)
npm test -- --testPathPattern="settingsPrompt"
# Expected: All pass after implementation

# Regression: maybePromptForSettings still works
npm run typecheck
# Expected: Passes
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/cli/src/config/extensions/settingsPrompt.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] `promptForSingleSetting` is exported from `settingsPrompt.ts`
- [ ] `maybePromptForSettings` still calls `promptForSingleSetting` internally (behavior-preserving refactor)
- [ ] Sensitive setting path uses hidden/raw-mode input
- [ ] Non-sensitive path uses readline
- [ ] All 4 tests pass
- [ ] No duplication of raw-mode stdin logic

## Success Criteria

- `promptForSingleSetting` exported and tested
- `maybePromptForSettings` behavior unchanged
- `npm run test` and `npm run typecheck` pass

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/config/extensions/settingsPrompt.ts`
2. `git checkout -- packages/cli/src/config/extensions/settingsPrompt.test.ts`
3. Re-examine existing inline prompt logic and re-extract

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P02.md`

---

# Phase P03: Add `updateSetting` to `settingsStorage.ts`

## Phase ID

`PLAN-20250219-GMERGE021.R10.P03`

## Prerequisites

- Required: Phase P02 completed
- Verification: `grep -n "export.*promptForSingleSetting" packages/cli/src/config/extensions/settingsPrompt.ts`
- Expected files from previous phase: `settingsPrompt.ts` exports `promptForSingleSetting`

## Requirements Implemented (Expanded)

### REQ-EXT-002.1: `updateSetting` function

**Full Text**: An exported `updateSetting` function must exist in `settingsStorage.ts` that updates a single extension setting, prompting the user for the new value, storing sensitive settings in keychain and non-sensitive in `.env`.
**Behavior**:
- GIVEN: An extension name, its install dir, its settings definitions, and a setting key (name or envVar)
- WHEN: `updateSetting` is called
- THEN: The matching setting is found, the user is prompted for a new value, and the value is saved (keychain for sensitive, `.env` for non-sensitive) while preserving other settings
**Why This Matters**: The `settings set` command delegates all storage logic here; centralizing it prevents duplication.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/config/extensions/settingsStorage.ts`
  - ADD import: `import { promptForSingleSetting } from './settingsPrompt.js';`
  - ADD import: `import type { ExtensionSetting } from './extensionSettings.js';`
  - ADD exported function `updateSetting`:

```typescript
/**
 * Updates a single setting for an extension, prompting the user for the value.
 * Sensitive settings go to keychain; non-sensitive to .env.
 * Preserves all other existing settings.
 *
 * @plan PLAN-20250219-GMERGE021.R10.P03
 * @requirement REQ-EXT-002.1
 */
export async function updateSetting(
  extensionName: string,
  extensionDir: string,
  settings: ExtensionSetting[],
  settingKey: string,
): Promise<void> {
  const setting = settings.find(
    (s) =>
      s.name.toLowerCase() === settingKey.toLowerCase() ||
      s.envVar.toLowerCase() === settingKey.toLowerCase(),
  );

  if (!setting) {
    const available = settings.map((s) => `${s.name} (${s.envVar})`).join(', ');
    throw new Error(
      `Setting "${settingKey}" not found. Available settings: ${available}`,
    );
  }

  const value = await promptForSingleSetting(setting);

  if (value === '') {
    throw new Error('Setting update cancelled (empty value).');
  }

  const storage = new ExtensionSettingsStorage(extensionName, extensionDir);
  const existing = await storage.loadSettings(settings);
  const updated: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (v !== undefined) updated[k] = v as string;
  }
  updated[setting.envVar] = value;

  await storage.saveSettings(settings, updated);
}
```

### Files to Modify (Tests)

- `packages/cli/src/config/extensions/settingsStorage.test.ts`
  - ADD test suite for `updateSetting` (write failing tests first, then implement)

```typescript
describe('updateSetting @plan:PLAN-20250219-GMERGE021.R10.P03', () => {
  it('should update a non-sensitive setting by name @requirement:REQ-EXT-002.1', async () => {
    // Given: extension with a non-sensitive setting
    // When: updateSetting called with setting name, value provided via prompt mock
    // Then: .env file contains updated value
  });

  it('should update a non-sensitive setting by envVar @requirement:REQ-EXT-002.1', async () => {
    // Matching by envVar key instead of name
  });

  it('should update a sensitive setting to keychain @requirement:REQ-EXT-002.1', async () => {
    // Given: sensitive setting
    // When: updateSetting called
    // Then: value in mockStore (not in .env)
  });

  it('should preserve other settings when updating one @requirement:REQ-EXT-002.1', async () => {
    // Given: two settings, both set
    // When: update one
    // Then: the other remains unchanged
  });

  it('should throw when setting key not found @requirement:REQ-EXT-002.1', async () => {
    // Given: settings list
    // When: updateSetting called with unknown key
    // Then: throws with descriptive message listing available settings
  });

  it('should throw when user provides empty value @requirement:REQ-EXT-002.1', async () => {
    // When: prompt returns empty string
    // Then: throws with cancellation message
  });
});
```

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R10.P03
 * @requirement REQ-EXT-002.1
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Verify export added
grep -n "export.*updateSetting" packages/cli/src/config/extensions/settingsStorage.ts
# Expected: 1 match

# Verify test markers
grep -rn "@plan:PLAN-20250219-GMERGE021.R10.P03" packages/cli/src/config/extensions/
# Expected: matches in settingsStorage.test.ts

# Run tests
npm test -- --testPathPattern="settingsStorage"
# Expected: All pass after implementation

npm run typecheck
# Expected: Passes
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/cli/src/config/extensions/settingsStorage.ts | grep -v ".test.ts"
# Expected: No matches

grep -rn -E "return \[\]|return \{\}|return null|return undefined" packages/cli/src/config/extensions/settingsStorage.ts | grep -v ".test.ts"
# Expected: No matches in updateSetting
```

### Semantic Verification Checklist

- [ ] `updateSetting` exported from `settingsStorage.ts`
- [ ] Matches setting by `name` OR `envVar` (case-insensitive)
- [ ] Throws with descriptive message listing available settings when key not found
- [ ] Throws when user provides empty value (cancel)
- [ ] Preserves other settings when updating one
- [ ] Sensitive settings go to keychain path (via `ExtensionSettingsStorage.saveSettings`)
- [ ] Non-sensitive settings go to `.env` path
- [ ] All 6 tests pass
- [ ] Uses `promptForSingleSetting` from P02 (no duplication)

## Success Criteria

- All 6 `updateSetting` tests pass
- `npm run typecheck` and `npm run test` pass
- No duplication of prompt logic

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/config/extensions/settingsStorage.ts`
2. `git checkout -- packages/cli/src/config/extensions/settingsStorage.test.ts`
3. Re-check `ExtensionSettingsStorage.saveSettings` signature before reimplementing

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P03.md`

---

# Phase P04: Create `getExtensionAndSettings` Utility

## Phase ID

`PLAN-20250219-GMERGE021.R10.P04`

## Prerequisites

- Required: Phase P03 completed
- Verification: `grep -n "export.*updateSetting" packages/cli/src/config/extensions/settingsStorage.ts`
- Expected files from previous phase: `settingsStorage.ts` exports `updateSetting`

## Requirements Implemented (Expanded)

### REQ-EXT-000.2: Extension lookup utility

**Full Text**: A `getExtensionAndSettings(name)` function must exist in `packages/cli/src/commands/extensions/utils.ts` that loads an extension by name and returns the extension object, its settings definitions, and its storage directory.
**Behavior**:
- GIVEN: An extension name string
- WHEN: `getExtensionAndSettings(name)` is called
- THEN: Returns `{ extension, settings, extensionDir }` or `null` (printing `console.error`) if extension not found or config not loadable
**Why This Matters**: Both `settings list` and `settings set` commands share this lookup; centralizing it prevents duplication.

## Implementation Tasks

### Files to Create

- `packages/cli/src/commands/extensions/utils.ts` (new file)
  - MUST include: `@plan PLAN-20250219-GMERGE021.R10.P04`
  - MUST include: `@requirement REQ-EXT-000.2`

```typescript
/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @plan PLAN-20250219-GMERGE021.R10.P04
 * @requirement REQ-EXT-000.2
 */

import {
  loadExtensionByName,
  loadExtensionConfig,
  ExtensionStorage,
} from '../../config/extension.js';
import type { GeminiCLIExtension } from '@vybestack/llxprt-code-core';
import type { ExtensionSetting } from '../../config/extensions/extensionSettings.js';

export interface ExtensionWithSettings {
  extension: GeminiCLIExtension;
  settings: ExtensionSetting[];
  extensionDir: string;
}

/**
 * Loads an extension by name and returns it along with its settings definitions
 * and storage directory. Returns null (with console.error) if not found.
 *
 * @plan PLAN-20250219-GMERGE021.R10.P04
 * @requirement REQ-EXT-000.2
 */
export async function getExtensionAndSettings(
  name: string,
): Promise<ExtensionWithSettings | null> {
  const workspaceDir = process.cwd();
  const extension = loadExtensionByName(name, workspaceDir);

  if (!extension) {
    console.error(`Extension "${name}" is not installed.`);
    return null;
  }

  const extensionConfig = await loadExtensionConfig({
    extensionDir: extension.path,
    workspaceDir,
  });

  if (!extensionConfig) {
    console.error(`Could not load configuration for extension "${name}".`);
    return null;
  }

  const storage = new ExtensionStorage(extension.name);
  const extensionDir = storage.getExtensionDir();

  return {
    extension,
    settings: extensionConfig.settings ?? [],
    extensionDir,
  };
}
```

**Note**: `extensionDir` comes from `ExtensionStorage.getExtensionDir()` — this is where the `.env` file lives, NOT `process.cwd()`.

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R10.P04
 * @requirement REQ-EXT-000.2
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Verify file created
ls packages/cli/src/commands/extensions/utils.ts
# Expected: File exists

# Verify export
grep -n "export.*getExtensionAndSettings" packages/cli/src/commands/extensions/utils.ts
# Expected: 1 match

# Verify plan marker
grep -n "@plan" packages/cli/src/commands/extensions/utils.ts
# Expected: PLAN-20250219-GMERGE021.R10.P04 present

npm run typecheck
# Expected: Passes
```

### Semantic Verification Checklist

- [ ] `getExtensionAndSettings` exported from `utils.ts`
- [ ] Returns `null` + `console.error` if extension not found
- [ ] Returns `null` + `console.error` if config not loadable
- [ ] `extensionDir` from `ExtensionStorage.getExtensionDir()` (not `process.cwd()`)
- [ ] `settings` defaults to `[]` when config has no `settings` field
- [ ] Typecheck passes

#### Feature Actually Works

```bash
# Manual check: file compiles cleanly
npx tsc --noEmit packages/cli/src/commands/extensions/utils.ts 2>&1 | head -20
# Expected: No errors
```

## Success Criteria

- `utils.ts` created with correct exports
- `npm run typecheck` passes
- Integration contract matches what `settings.ts` (P05) will consume

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/commands/extensions/utils.ts` (or delete if new)
2. Re-examine `loadExtensionByName` and `ExtensionStorage` signatures before reimplementing

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P04.md`

---

# Phase P05: Create Settings Commands (`settings.ts`)

## Phase ID

`PLAN-20250219-GMERGE021.R10.P05`

## Prerequisites

- Required: Phase P04 completed
- Verification: `grep -n "export.*getExtensionAndSettings" packages/cli/src/commands/extensions/utils.ts`
- Expected files from previous phase: `utils.ts` with `getExtensionAndSettings`

## Requirements Implemented (Expanded)

### REQ-EXT-001: `extensions settings list <name>` command

**Full Text**: `llxprt extensions settings list <name>` lists all settings for a named extension, showing each setting's name, env var, optional description, and current value (masked as `[stored in keychain]` for sensitive settings).
**Behavior**:
- GIVEN: An installed extension with settings definitions
- WHEN: User runs `llxprt extensions settings list <name>`
- THEN: Each setting is printed with name, env var, description (if present), and current value (`[not set]` / `[stored in keychain]` / actual value)
**Why This Matters**: Lets users inspect what settings an extension exposes and their current values without exposing sensitive data.

### REQ-EXT-002: `extensions settings set <name> <setting>` command

**Full Text**: `llxprt extensions settings set <name> <setting>` prompts the user for a new value for the named setting of the named extension and persists it.
**Behavior**:
- GIVEN: An installed extension with at least one setting
- WHEN: User runs `llxprt extensions settings set <name> <setting>`
- THEN: User is prompted for a value (hidden for sensitive), value is saved, success message printed
**Why This Matters**: Gives users a first-class CLI interface to configure extension settings without manually editing files.

## Implementation Tasks

### Files to Create

- `packages/cli/src/commands/extensions/settings.ts` (new file)
  - MUST include: `@plan PLAN-20250219-GMERGE021.R10.P05`
  - MUST include: `@requirement REQ-EXT-001` and `@requirement REQ-EXT-002`

```typescript
/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @plan PLAN-20250219-GMERGE021.R10.P05
 * @requirement REQ-EXT-001
 * @requirement REQ-EXT-002
 */

import type { CommandModule } from 'yargs';
import { getExtensionAndSettings } from './utils.js';
import { ExtensionSettingsStorage, updateSetting } from '../../config/extensions/settingsStorage.js';
import { getErrorMessage } from '../../utils/errors.js';
import { exitCli } from '../utils.js';

// --- LIST COMMAND ---
interface ListArgs {
  name: string;
}

/**
 * @plan PLAN-20250219-GMERGE021.R10.P05
 * @requirement REQ-EXT-001
 */
export async function handleSettingsList(name: string): Promise<void> {
  const result = await getExtensionAndSettings(name);
  if (!result) return;

  const { extension, settings, extensionDir } = result;

  if (settings.length === 0) {
    console.log(`Extension "${name}" has no configurable settings.`);
    return;
  }

  const storage = new ExtensionSettingsStorage(extension.name, extensionDir);
  const currentValues = await storage.loadSettings(settings);

  console.log(`Settings for "${name}":`);
  for (const s of settings) {
    const rawValue = currentValues[s.envVar];
    const displayValue =
      rawValue === undefined || rawValue === ''
        ? '[not set]'
        : s.sensitive
          ? '[stored in keychain]'
          : rawValue;
    console.log(`- ${s.name} (${s.envVar})`);
    if (s.description) {
      console.log(`  Description: ${s.description}`);
    }
    console.log(`  Value: ${displayValue}`);
  }
}

const listCommand: CommandModule<object, ListArgs> = {
  command: 'list <name>',
  describe: 'List all settings for an extension.',
  builder: (yargs) =>
    yargs.positional('name', {
      describe: 'Name of the extension.',
      type: 'string',
      demandOption: true,
    }),
  handler: async (args) => {
    try {
      await handleSettingsList(args.name);
    } catch (error) {
      console.error(getErrorMessage(error));
      await exitCli(1);
    }
    await exitCli();
  },
};

// --- SET COMMAND ---
interface SetArgs {
  name: string;
  setting: string;
}

/**
 * @plan PLAN-20250219-GMERGE021.R10.P05
 * @requirement REQ-EXT-002
 */
export async function handleSettingsSet(
  name: string,
  settingKey: string,
): Promise<void> {
  const result = await getExtensionAndSettings(name);
  if (!result) return;

  const { extension, settings, extensionDir } = result;

  if (settings.length === 0) {
    console.error(`Extension "${name}" has no configurable settings.`);
    return;
  }

  await updateSetting(extension.name, extensionDir, settings, settingKey);
  console.log(`Setting "${settingKey}" updated for extension "${name}".`);
}

const setCommand: CommandModule<object, SetArgs> = {
  command: 'set <name> <setting>',
  describe: 'Set a specific setting for an extension.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'Name of the extension.',
        type: 'string',
        demandOption: true,
      })
      .positional('setting', {
        describe: 'Setting name or env var to configure.',
        type: 'string',
        demandOption: true,
      }),
  handler: async (args) => {
    try {
      await handleSettingsSet(args.name, args.setting);
    } catch (error) {
      console.error(getErrorMessage(error));
      await exitCli(1);
    }
    await exitCli();
  },
};

// --- PARENT SETTINGS COMMAND ---
/**
 * @plan PLAN-20250219-GMERGE021.R10.P05
 * @requirement REQ-EXT-001
 * @requirement REQ-EXT-002
 */
export const settingsCommand: CommandModule = {
  command: 'settings <command>',
  describe: 'Manage extension settings.',
  builder: (yargs) =>
    yargs
      .command(listCommand)
      .command(setCommand)
      .demandCommand(1, 'Specify a subcommand: list or set.')
      .version(false),
  handler: () => {},
};
```

### Files to Create (Tests)

- `packages/cli/src/commands/extensions/settings.test.ts` (new file)
  - Write failing tests FIRST, then implement

```typescript
describe('handleSettingsList @plan:PLAN-20250219-GMERGE021.R10.P05', () => {
  it('should print "no configurable settings" when extension has none @requirement:REQ-EXT-001', async () => {});
  it('should display [not set] for missing values @requirement:REQ-EXT-001', async () => {});
  it('should display [stored in keychain] for sensitive settings with values @requirement:REQ-EXT-001', async () => {});
  it('should display actual value for non-sensitive settings @requirement:REQ-EXT-001', async () => {});
  it('should print error and return if extension not found @requirement:REQ-EXT-001', async () => {});
});

describe('handleSettingsSet @plan:PLAN-20250219-GMERGE021.R10.P05', () => {
  it('should call updateSetting with correct args and print success @requirement:REQ-EXT-002', async () => {});
  it('should print error when extension not found @requirement:REQ-EXT-002', async () => {});
  it('should print error and exit(1) when setting key not found @requirement:REQ-EXT-002', async () => {});
  it('should print error and exit(1) when update cancelled @requirement:REQ-EXT-002', async () => {});
});
```

### Required Code Markers

```typescript
/**
 * @plan PLAN-20250219-GMERGE021.R10.P05
 * @requirement REQ-EXT-001
 * @requirement REQ-EXT-002
 */
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Verify files created
ls packages/cli/src/commands/extensions/settings.ts
ls packages/cli/src/commands/extensions/settings.test.ts
# Expected: Both exist

# Verify exports
grep -n "export.*settingsCommand\|export.*handleSettings" packages/cli/src/commands/extensions/settings.ts
# Expected: settingsCommand, handleSettingsList, handleSettingsSet

# Run tests
npm test -- --testPathPattern="settings.test"
# Expected: All pass after implementation

npm run typecheck
# Expected: Passes
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK|STUB)" packages/cli/src/commands/extensions/settings.ts | grep -v ".test.ts"
# Expected: No matches

grep -rn -E "(in a real|placeholder|not yet|will be)" packages/cli/src/commands/extensions/settings.ts | grep -v ".test.ts"
# Expected: No matches
```

### Semantic Verification Checklist

- [ ] `handleSettingsList` prints `[not set]` for undefined/empty values
- [ ] `handleSettingsList` prints `[stored in keychain]` for sensitive settings with values
- [ ] `handleSettingsList` prints actual value for non-sensitive settings with values
- [ ] `handleSettingsList` prints "no configurable settings" when `settings.length === 0`
- [ ] `handleSettingsSet` prints success message after `updateSetting` resolves
- [ ] `handleSettingsSet` calls `exitCli(1)` on `updateSetting` error
- [ ] `settingsCommand` parent wraps both subcommands with `demandCommand(1, ...)`
- [ ] All 9 tests pass

#### Edge Cases Verified

- [ ] Extension not found: `console.error` + `return` (not `exitCli(1)`)
- [ ] Update error: `console.error` + `exitCli(1)` (fatal)
- [ ] No raw sensitive value ever printed in list output
- [ ] `handleSettingsSet` with `settings.length === 0` → `console.error` + return (no crash)

## Success Criteria

- All 9 command tests pass
- `npm run typecheck` and `npm run test` pass
- `settingsCommand` ready to be registered in P06

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/commands/extensions/settings.ts`
2. `git checkout -- packages/cli/src/commands/extensions/settings.test.ts`
3. Verify `getExtensionAndSettings`, `updateSetting`, `ExtensionSettingsStorage` signatures match usage

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P05.md`

---

# Phase P06: Register `settingsCommand` in `extensions.tsx`

## Phase ID

`PLAN-20250219-GMERGE021.R10.P06`

## Prerequisites

- Required: Phase P05 completed
- Verification: `grep -n "export.*settingsCommand" packages/cli/src/commands/extensions/settings.ts`
- Expected files from previous phase: `settings.ts` with `settingsCommand` export

## Requirements Implemented (Expanded)

### REQ-EXT-001.CLI / REQ-EXT-002.CLI: CLI registration

**Full Text**: The `settingsCommand` must be registered in `extensions.tsx` so that `llxprt extensions settings list` and `llxprt extensions settings set` are reachable from the CLI.
**Behavior**:
- GIVEN: LLxprt CLI is installed
- WHEN: User runs `llxprt extensions settings --help`
- THEN: Help text shows `list` and `set` subcommands
**Why This Matters**: Without registration the commands are unreachable regardless of implementation correctness.

## Implementation Tasks

### Files to Modify

- `packages/cli/src/commands/extensions.tsx`
  - ADD import: `import { settingsCommand } from './extensions/settings.js';`
  - ADD `.command(settingsCommand)` before the existing `.demandCommand(...)` call
  - ADD comment: `// @plan PLAN-20250219-GMERGE021.R10.P06`

### Required Code Markers

```typescript
// @plan PLAN-20250219-GMERGE021.R10.P06
// @requirement REQ-EXT-001.CLI
// @requirement REQ-EXT-002.CLI
```

## Verification Commands

### Automated Checks (Structural)

```bash
# Verify import added
grep -n "settingsCommand" packages/cli/src/commands/extensions.tsx
# Expected: import line + .command(settingsCommand) present

# Full test suite
npm run test
# Expected: All pass

npm run typecheck
# Expected: Passes

npm run lint
# Expected: Passes

npm run format
# Expected: No changes needed

npm run build
# Expected: Succeeds
```

### Deferred Implementation Detection

```bash
grep -rn -E "(TODO|FIXME|HACK)" packages/cli/src/commands/extensions.tsx | grep -v ".test.ts"
# Expected: No new matches from this phase
```

### Semantic Verification Checklist

- [ ] `settingsCommand` imported from `./extensions/settings.js`
- [ ] `.command(settingsCommand)` added before `.demandCommand(...)`
- [ ] Full build succeeds
- [ ] All tests pass

#### Feature Actually Works

```bash
# Build and check CLI help
npm run build && node packages/cli/dist/index.js extensions --help 2>&1 | grep -i settings
# Expected: "settings" appears in output

node packages/cli/dist/index.js extensions settings --help 2>&1
# Expected: Shows "list" and "set" subcommands

# Integration smoke test
node scripts/start.js --profile-load synthetic "write me a haiku"
# Expected: Haiku output, no errors
```

#### Integration Points Verified

- [ ] `extensions.tsx` registers `settingsCommand` via `.command()` (verified by reading file)
- [ ] `settingsCommand.command` = `'settings <command>'` (verified in `settings.ts`)
- [ ] `settingsCommand.builder` wraps `listCommand` and `setCommand` (verified in `settings.ts`)
- [ ] CLI help output shows settings subcommands (verified by running build)

## Success Criteria

- `llxprt extensions settings --help` shows `list` and `set` subcommands
- `npm run test`, `typecheck`, `lint`, `format`, `build` all pass
- Haiku smoke test succeeds

## Failure Recovery

If this phase fails:

1. `git checkout -- packages/cli/src/commands/extensions.tsx`
2. Re-check `settingsCommand` export name and path

## Phase Completion Marker

Create: `project-plans/gmerge-0.21.3/.completed/P06.md`

---

## Files to Create/Modify Summary

| File | Action | Phase | What Changes |
|------|--------|-------|--------------|
| `packages/cli/src/config/extension.ts` | Modify | P01 | Add `settings?: ExtensionSetting[]` to internal `ExtensionConfig`; add import |
| `packages/cli/src/config/extensions/settingsPrompt.ts` | Modify | P02 | Extract and export `promptForSingleSetting()` |
| `packages/cli/src/config/extensions/settingsPrompt.test.ts` | Modify | P02 | Tests for `promptForSingleSetting()` |
| `packages/cli/src/config/extensions/settingsStorage.ts` | Modify | P03 | Add exported `updateSetting()` function |
| `packages/cli/src/config/extensions/settingsStorage.test.ts` | Modify | P03 | Tests for `updateSetting()` |
| `packages/cli/src/commands/extensions/utils.ts` | Create | P04 | `getExtensionAndSettings()` helper |
| `packages/cli/src/commands/extensions/settings.ts` | Create | P05 | `listCommand`, `setCommand`, `settingsCommand` |
| `packages/cli/src/commands/extensions/settings.test.ts` | Create | P05 | Tests for list and set command handlers |
| `packages/cli/src/commands/extensions.tsx` | Modify | P06 | Import and register `settingsCommand` |

## Key Differences from Upstream

| Aspect | Upstream | LLxprt Implementation |
|--------|----------|----------------------|
| Extension loading | `ExtensionManager` class | `loadExtensionByName()` + `loadExtensionConfig()` |
| Settings storage | `ExtensionManager` manages keychain | `ExtensionSettingsStorage` (already exists) |
| Keychain access | `KeychainTokenStorage` | `SecureStore` via `ExtensionSettingsStorage` |
| Settings prompt | New `promptForSetting` in extensionSettings.ts | Extracted `promptForSingleSetting` from `settingsPrompt.ts` |
| Error reporting | `debugLogger` | `console.log` / `console.error` (project convention) |
| Extension id | Extension has `.id` field | Extension identified by `.name` (no `.id`) |
| `.env` location | Workspace `.env` | Extension install dir `.env` (via `ExtensionSettingsStorage`) |
| `ExtensionConfig` type | Exported with `settings` | Internal only; `settings` field must be added (P01) |
| `formatEnvContent()` | Added to extensionSettings.ts | Not needed — `ExtensionSettingsStorage.saveSettings` handles quoting |

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| `ExtensionConfig` type change | Medium | Additive optional field; existing callers receive `undefined` handled by `?? []` |
| `settingsPrompt.ts` refactor | Low | Behavior-preserving extraction; `maybePromptForSettings` unchanged |
| New commands break existing | Low | Only adds new exports/commands; no existing function signature changes |
| `.env` path confusion | Medium | P00 preflight confirms `ExtensionStorage.getExtensionDir()` usage; tested in P03 |

## Execution Tracker

| Phase | ID | Status | Semantic? | Notes |
|-------|-----|--------|-----------|-------|
| P00 | P00 | ⬜ | N/A | Preflight verification |
| P01 | P01 | ⬜ | ⬜ | Add `settings` field to `ExtensionConfig` |
| P02 | P02 | ⬜ | ⬜ | Extract `promptForSingleSetting` |
| P03 | P03 | ⬜ | ⬜ | Add `updateSetting` to `settingsStorage.ts` |
| P04 | P04 | ⬜ | ⬜ | Create `getExtensionAndSettings` utility |
| P05 | P05 | ⬜ | ⬜ | Create settings commands (`settings.ts`) |
| P06 | P06 | ⬜ | ⬜ | Register `settingsCommand` in `extensions.tsx` |

Update this table after each phase completes.
