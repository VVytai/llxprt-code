# Remediation Plan: R15 — Workspace Identity Stabilization for Scoped Extension Settings

**Priority:** P2 (important consistency fix)
**Estimated Effort:** 8-12 hours
**Root Cause:** Workspace-scoped extension settings use `process.cwd()`-derived identity in multiple places (workspace `.env` path and keychain service hash). Launching CLI from different subdirectories can split one logical workspace into multiple storage identities.

---

## Review Status

Round 1 (deepthinker): APPROVE_WITH_CHANGES — applied.
Round 2 (deepthinker + typescriptexpert): APPROVE_WITH_CHANGES — applied below.

---

## Scope

1. Extend existing `gitUtils.ts` with a workspace identity resolver (reuse `getGitRepoRoot()`).
2. Replace `process.cwd()` usages in settings integration/storage with workspace identity.
3. Replace brittle string-based scope detection with explicit `ExtensionSettingScope` parameter.
4. Add backward-compat read fallback for legacy cwd-based keychain and workspace `.env` locations.
5. Add tests for subdirectory invocation, worktree behavior, and migration conflict handling.

---

## Design Decisions (locked)

- **Submodule behavior**: submodule root is workspace identity (default git `rev-parse --show-toplevel` behavior).
- **Monorepo behavior**: repo-root-scoped settings (single identity per git repo).
- **Memoization**: none for CLI (short-lived process). If LSP/long-running needs arise later, use class-based resolver.
- **Enable-flow consent**: explicit non-goal for this remediation.
- **Canonical resolver contract**: returns absolute normalized path, deterministic fallback to `process.cwd()`, non-throwing.

---

## TDD Sequence

### Test Group A: Workspace identity resolver (RED then GREEN)

**File:** `packages/cli/src/utils/gitUtils.test.ts` (extend existing)

1. inside git repo subdirectory -> resolves repo root
2. non-git directory -> resolves cwd fallback
3. same repo from different subdirs -> same identity
4. git command failure -> deterministic cwd fallback (non-throwing)
5. worktree path behavior documented and deterministic
6. submodule returns submodule root (not superproject)

**Testing approach:** mock `execSync` — do NOT use `process.chdir()` (test isolation).

### Test Group B: Integration points use canonical identity (RED then GREEN)

**File:** `packages/cli/src/config/extensions/settingsIntegration.test.ts`

1. workspace `.env` path uses canonical workspace identity root
2. user scope remains unchanged
3. same extension + same repo from different subdirs yields same workspace path
4. scope detection uses explicit `ExtensionSettingScope` parameter, not string matching

### Test Group C: Keychain service identity behavior (RED then GREEN)

**File:** `packages/cli/src/config/extensions/settingsStorage.test.ts`

1. workspace keychain service hash stable across subdirectories
2. keychain service changes across different repos
3. canonical and legacy keys both present -> canonical wins
4. canonical missing + legacy present -> fallback succeeds
5. migration failure (cannot write canonical) does not break reads

### Test Group D: Legacy compatibility (RED then GREEN)

1. legacy cwd-based workspace `.env` is read when canonical path empty
2. migration writes canonical path without destructive overwrite
3. warning/logging is bounded and actionable (no repeated spam)
4. legacy keychain hash formula exactly matches historical `process.cwd()`-based computation

---

## Implementation Steps

### Step 1: Extend gitUtils with workspace identity

**File:** `packages/cli/src/utils/gitUtils.ts`

- Add `getWorkspaceIdentity(cwd?: string): string` that wraps existing `getGitRepoRoot()` with:
  - Absolute/normalized path output
  - Deterministic cwd fallback on error
  - Non-throwing contract

### Step 2: Add explicit scope parameter to settings functions

**File:** `packages/cli/src/config/extensions/settingsStorage.ts`

- Replace string-based scope detection (`extensionDir.includes('.llxprt/extensions')`) with explicit `scope: ExtensionSettingScope` parameter on `getKeychainServiceName()`.
- Update `ExtensionSettingsStorage` constructor to accept workspace root parameter.

### Step 3: Replace process.cwd() in settingsIntegration

**File:** `packages/cli/src/config/extensions/settingsIntegration.ts`

Replace all `process.cwd()` calls in workspace scope path construction:
- `getExtensionEnvironment()` workspace dir
- `getEnvFilePath()` workspace path
- `getScopedEnvContents()` workspace scoped dir
- `updateSetting()` workspace scoped dir

All workspace path construction routes through `getWorkspaceIdentity()`.

### Step 4: Implement backward-compat lookup behavior

- Workspace keychain: try canonical identity first, fallback to legacy `process.cwd()`-based hash.
- Workspace `.env`: try canonical path first, fallback to legacy cwd path.
- On successful fallback: best-effort migrate to canonical location (no destructive overwrite).
- Bounded, actionable warning on fallback (log once, not every access).

### Step 5: Document legacy keychain hash formula

- Record exact historical formula (e.g., `md5(process.cwd()).substring(0,8)`) so fallback matches.
- Ensure single helper for all workspace path construction to prevent future drift.

---

## Verification

```bash
npm run test -- packages/cli/src/utils/gitUtils.test.ts
npm run test -- packages/cli/src/config/extensions/settingsIntegration.test.ts
npm run test -- packages/cli/src/config/extensions/settingsStorage.test.ts
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
| Identity ambiguity in submodules/monorepos | Explicit policy decisions locked + dedicated tests |
| Legacy migration causes data loss | Canonical-first read, non-destructive migration, fallback preserved |
| Keychain write failures during migration | Best-effort; continue serving legacy read path |
| String-based scope detection regression | Replace with explicit `ExtensionSettingScope` parameter |
| Test isolation with process.cwd | Mock `execSync`, not `process.chdir()` |

---

## Done Criteria

- [ ] Workspace identity is canonical and stable within a repo regardless of subdirectory
- [ ] Workspace path + keychain identity no longer depend directly on raw `process.cwd()`
- [ ] Scope detection uses explicit `ExtensionSettingScope` parameter, not string matching
- [ ] All workspace path construction routes through single `getWorkspaceIdentity()` helper
- [ ] Legacy workspace keychain and `.env` data remain readable via fallback
- [ ] Canonical-preferred conflict handling is tested and deterministic
- [ ] Worktree and submodule behavior explicitly tested
- [ ] Legacy hash formula documented for backward compat
- [ ] Full verification sequence passes
