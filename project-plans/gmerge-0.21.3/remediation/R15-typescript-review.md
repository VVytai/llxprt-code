# R15 Workspace Identity Remediation — TypeScript Implementation Review

**Reviewer:** LLxprt Code (TypeScript Analysis)  
**Date:** 2026-02-20  
**Status:** APPROVE_WITH_CHANGES

---

## Executive Summary

The remediation plan is **fundamentally sound and implementable**, but requires several TypeScript-specific adjustments to integrate cleanly with the existing codebase. The plan correctly identifies the core issue (unstable `process.cwd()` usage) and proposes a reasonable solution (canonical workspace identity resolver).

**Verdict:** APPROVE_WITH_CHANGES

---

## Critical Findings

### 1. **EXISTING INFRASTRUCTURE AVAILABLE** [OK]

The codebase already has relevant utilities:

- **`packages/cli/src/utils/gitUtils.ts`** exports `getGitRepoRoot()` which does exactly what the plan needs:
  ```typescript
  export const getGitRepoRoot = (): string => {
    const gitRepoRoot = (
      execSync('git rev-parse --show-toplevel', {
        encoding: 'utf-8',
      }) || ''
    ).trim();
    
    if (!gitRepoRoot) {
      throw new Error(`Git repo returned empty value`);
    }
    
    return gitRepoRoot;
  }
  ```

- **`packages/core/src/utils/workspaceContext.ts`** provides sophisticated multi-workspace management with `realpathSync` normalization.

**Recommendation:** Extend/use existing `gitUtils.ts` instead of creating a new `workspaceIdentity.ts`. Add workspace identity resolution as a new function in `gitUtils.ts` with cwd fallback logic.

---

### 2. **CWD-AWARE MEMOIZATION: TYPE SAFETY CONCERNS** WARNING:

**Plan states:**
> Use cwd-aware memoization (cache by cwd/input), not single global static root.

**TypeScript Analysis:**

Current `process.cwd()` usage in `settingsIntegration.ts` and `settingsStorage.ts` is **always at function call time**, not module-level initialization. This is actually **correct** for the use case:

```typescript
// settingsIntegration.ts:173
const workspaceDir = path.join(
  process.cwd(),  // ← Called per-invocation, not cached at module load
  '.llxprt',
  'extensions',
  extensionName,
);
```

**Issue with memoization:**

If implementing cwd-aware memoization, the cache key must include:
1. The current `process.cwd()` value
2. The extension name
3. The scope (user/workspace)

**Type signature would be:**
```typescript
interface WorkspaceIdentityCache {
  key: string; // hash of cwd + extensionName + scope
  canonicalRoot: string;
  timestamp: number; // for TTL
}

// Not great for long-running processes where cwd might change legitimately
```

**Recommendation:**

- **For CLI usage (current):** No memoization needed. Each command execution is short-lived. Just call the resolver function each time.
- **For long-running processes (future LSP/server):** Use cwd-parameterized helper, not cached state:
  
  ```typescript
  function getWorkspaceIdentity(cwd: string = process.cwd()): string {
    try {
      return getGitRepoRoot(); // Already throws if not in repo
    } catch {
      return fs.realpathSync(cwd);
    }
  }
  ```

**No module-level cache needed.** Cache at call site if performance critical.

---

### 3. **KEYCHAIN SERVICE NAME HASH STABILITY** WARNING:

**Current implementation (settingsStorage.ts:55):**
```typescript
const workspaceHash = crypto
  .createHash('md5')
  .update(process.cwd())  // ← Problem: unstable across subdirs
  .digest('hex')
  .substring(0, 8);
```

**Plan solution:** Use canonical workspace root instead of `process.cwd()`.

**TypeScript consideration:**

The current code only hashes `process.cwd()` when `isWorkspaceScope` is true. However, the detection logic is:

```typescript
const isWorkspaceScope =
  extensionDir && extensionDir.includes('.llxprt/extensions');
```

**This is brittle!** What if:
- User renames `.llxprt` to something else (config-driven)?
- Extension is in a different path structure?
- Symlinks involved?

**Recommendation:**

1. **Explicit scope parameter:** Don't infer scope from path string matching. Pass `ExtensionSettingScope` explicitly to `getKeychainServiceName()`:

   ```typescript
   export function getKeychainServiceName(
     extensionName: string,
     scope: ExtensionSettingScope,
     workspaceRoot?: string, // Only required for workspace scope
   ): string {
     const sanitized = extensionName.replace(/[^a-zA-Z0-9-_]/g, '');
     
     if (scope === ExtensionSettingScope.WORKSPACE) {
       if (!workspaceRoot) {
         throw new Error('workspaceRoot required for workspace scope');
       }
       const workspaceHash = crypto
         .createHash('md5')
         .update(workspaceRoot) // Now stable!
         .digest('hex')
         .substring(0, 8);
       return `LLxprt Code Extension ${sanitized} Workspace ${workspaceHash}`.substring(0, 255);
     }
     
     return `LLxprt Code Extension ${sanitized}`.substring(0, 255);
   }
   ```

2. **Update `ExtensionSettingsStorage` constructor** to accept scope:

   ```typescript
   constructor(
     extensionName: string,
     extensionDir: string,
     scope: ExtensionSettingScope,
     workspaceRoot?: string,
   ) {
     this.extensionDir = extensionDir;
     this.store = new SecureStore(
       getKeychainServiceName(extensionName, scope, workspaceRoot),
     );
   }
   ```

---

### 4. **BACKWARD COMPATIBILITY: DUAL-READ PATTERN** [OK]

**Plan:**
> try canonical identity first, fallback to legacy cwd-based identity when missing

**TypeScript implementation strategy:**

```typescript
async loadSettings(
  settings: ExtensionSetting[],
): Promise<Record<string, string | undefined>> {
  const result: Record<string, string | undefined> = {};
  
  // Try canonical keychain first
  const canonicalStore = new SecureStore(
    getKeychainServiceName(
      this.extensionName,
      ExtensionSettingScope.WORKSPACE,
      this.canonicalWorkspaceRoot,
    ),
  );
  
  // Fallback to legacy (current cwd-based)
  const legacyStore = new SecureStore(
    getKeychainServiceName(
      this.extensionName,
      ExtensionSettingScope.WORKSPACE,
      this.legacyWorkspaceRoot, // Could be process.cwd()
    ),
  );
  
  for (const setting of settings.filter(s => s.sensitive)) {
    try {
      let value = await canonicalStore.get(setting.envVar);
      
      if (value === null) {
        // Fallback to legacy
        value = await legacyStore.get(setting.envVar);
        
        if (value !== null) {
          // Opportunistic migration (best effort)
          try {
            await canonicalStore.set(setting.envVar, value);
          } catch (err) {
            console.warn(`Could not migrate ${setting.envVar} to canonical location:`, err);
          }
        }
      }
      
      result[setting.envVar] = value ?? undefined;
    } catch (error) {
      console.error(`Failed to load ${setting.envVar}:`, error);
      result[setting.envVar] = undefined;
    }
  }
  
  return result;
}
```

**Type safety:** All paths typed as `string`, fallback logic is `value ?? undefined` (explicit).

---

### 5. **TEST ISOLATION CONCERNS** WARNING:

**Current test setup:**
```typescript
beforeEach(async () => {
  tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'llxprt-settings-test-'),
  );
});
```

**Plan requires testing:**
- Subdirectory invocation
- CWD changes mid-process
- Legacy data migration

**TypeScript/Vitest considerations:**

1. **`process.chdir()` in tests:** Dangerous! Affects parallel test execution. Use **parameter injection** instead:

   ```typescript
   // DON'T DO THIS:
   it('should resolve from subdirectory', () => {
     const original = process.cwd();
     process.chdir('/some/subdir'); // ← Breaks parallel tests
     // test...
     process.chdir(original);
   });
   
   // DO THIS:
   it('should resolve from subdirectory', () => {
     const identity = getWorkspaceIdentity('/some/subdir');
     expect(identity).toBe('/some');
   });
   ```

2. **Mock `execSync` for git commands:**
   
   ```typescript
   vi.mock('child_process', () => ({
     execSync: vi.fn((cmd: string) => {
       if (cmd.includes('rev-parse --show-toplevel')) {
         return '/mocked/repo/root\n';
       }
       throw new Error('Not a git repo');
     }),
   }));
   ```

3. **SecureStore mock already exists** (good!):
   
   ```typescript
   vi.mock('@vybestack/llxprt-code-core', () => ({
     SecureStore: vi.fn().mockImplementation(() => ({ ... })),
   }));
   ```

**Recommendation:** Add utility functions to setup test fixtures:

```typescript
// test/fixtures/workspaceIdentity.ts
export function setupGitRepoMock(repoRoot: string) {
  vi.mock('child_process', () => ({
    execSync: vi.fn((cmd: string) => {
      if (cmd.includes('rev-parse --show-toplevel')) {
        return `${repoRoot}\n`;
      }
      throw new Error('Not a git repo');
    }),
  }));
}

export function setupNonGitMock() {
  vi.mock('child_process', () => ({
    execSync: vi.fn(() => {
      throw new Error('Not a git repo');
    }),
  }));
}
```

---

### 6. **ASYNC PATTERNS: NO ISSUES** [OK]

All file I/O already uses `async/await` patterns correctly:
- `fs.promises.readFile()`
- `fs.promises.writeFile()`
- `SecureStore` methods are async

Plan's proposed changes fit naturally into existing async architecture.

---

### 7. **MODULE-LEVEL STATE: CRITICAL WARNING** 

**Current codebase:**

`settingsStorage.ts` creates `SecureStore` instances in the **constructor**, which means the keychain service name is determined **at construction time**.

If we're changing how workspace identity is determined, we need to ensure:

1. **No module-level singletons** that cache the wrong identity
2. **Constructor parameters** include all identity-determining inputs
3. **Tests create fresh instances** for each scenario

**Current test pattern is GOOD:**
```typescript
beforeEach(() => {
  storage = new ExtensionSettingsStorage(extensionName, tmpDir);
  // Fresh instance per test [OK]
});
```

**Danger zone:**
```typescript
// DON'T DO THIS:
const globalStorage = new ExtensionSettingsStorage('my-ext', process.cwd());

export function getSetting(key: string) {
  return globalStorage.loadSettings(...); // ← Wrong identity if cwd changed
}
```

**Plan says:** "No cache in critical path" — this is **correct**.

---

## Evaluation Against Plan Questions

### Q1: Will replacing process.cwd() with workspace identity helper integrate cleanly?

**Answer:** YES, with modifications.

- [OK] Existing `getGitRepoRoot()` in `gitUtils.ts` provides foundation
- [OK] Current code structure (instance-per-call) supports parameterization
- WARNING: Must update **all callsites** in:
  - `settingsIntegration.ts` (4 locations)
  - `settingsStorage.ts` (1 location)
  - Tests must inject workspace root

**Integration points:**

```typescript
// Before:
const workspaceDir = path.join(process.cwd(), '.llxprt', 'extensions', name);

// After:
const workspaceRoot = getWorkspaceIdentity();
const workspaceDir = path.join(workspaceRoot, '.llxprt', 'extensions', name);
```

---

### Q2: Is cwd-aware memoization type-safe and testable?

**Answer:** NOT NEEDED for current CLI usage.

- CLI commands are **short-lived** (seconds)
- No performance benefit from caching across requests
- Caching **adds complexity** without benefit
- **For tests:** Pass workspace root as parameter, don't cache

**If caching becomes necessary (LSP server):**

```typescript
// Type-safe approach:
class WorkspaceIdentityResolver {
  private cache = new Map<string, string>();
  
  resolve(cwd: string = process.cwd()): string {
    if (this.cache.has(cwd)) {
      return this.cache.get(cwd)!;
    }
    
    const identity = this.computeIdentity(cwd);
    this.cache.set(cwd, identity);
    return identity;
  }
  
  private computeIdentity(cwd: string): string {
    try {
      // Use git from specific cwd
      return execSync('git rev-parse --show-toplevel', {
        cwd,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return fs.realpathSync(cwd);
    }
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}
```

**Testable:** Inject resolver instance, call `clearCache()` between tests.

---

### Q3: Is backward-compat fallback implementable without breaking tests?

**Answer:** YES, fully implementable.

**Strategy:**

1. **Read path:** Try canonical → fallback to legacy → return undefined
2. **Write path:** Always write to canonical
3. **Migration:** Best-effort copy from legacy to canonical on first read

**Test compatibility:**

Current tests create temp directories that **aren't git repos**, so:
- Canonical identity = `fs.realpathSync(tempDir)`
- Legacy identity = `fs.realpathSync(tempDir)` (same!)

Tests won't break because temp directories produce **same identity either way**.

**To test migration:**

```typescript
it('migrates from legacy cwd-based keychain to canonical', async () => {
  // Setup legacy location
  const legacyRoot = path.join(tempDir, 'subdir');
  await fs.promises.mkdir(legacyRoot, { recursive: true });
  
  const legacyStorage = new ExtensionSettingsStorage(
    'test-ext',
    legacyRoot,
    ExtensionSettingScope.WORKSPACE,
    legacyRoot, // legacy uses subdir as workspace root
  );
  
  await legacyStorage.saveSettings(
    [{ name: 'key', envVar: 'KEY', sensitive: true }],
    { KEY: 'legacy-value' },
  );
  
  // Now read with canonical resolver
  const canonicalRoot = tempDir; // parent directory
  const canonicalStorage = new ExtensionSettingsStorage(
    'test-ext',
    path.join(canonicalRoot, '.llxprt', 'extensions', 'test-ext'),
    ExtensionSettingScope.WORKSPACE,
    canonicalRoot,
  );
  
  const values = await canonicalStorage.loadSettings([
    { name: 'key', envVar: 'KEY', sensitive: true },
  ]);
  
  expect(values.KEY).toBe('legacy-value'); // Found via fallback
  
  // Verify migration happened
  const canonicalValue = await canonicalStorage.store.get('KEY');
  expect(canonicalValue).toBe('legacy-value');
});
```

---

### Q4: Are test descriptions feasible with existing infrastructure?

**Answer:** YES, all feasible.

**Test Group A (workspaceIdentity.test.ts):**

| Test | Feasible? | Notes |
|------|-----------|-------|
| 1. git repo subdir → resolves repo root | [OK] | Mock `execSync` |
| 2. non-git → resolves cwd fallback | [OK] | Mock git failure |
| 3. same repo different subdirs → same identity | [OK] | Call with different paths |
| 4. cwd changes across repos → identity updates | [OK] | Pass cwd as param |
| 5. git command failure → deterministic fallback | [OK] | Mock `execSync` throw |
| 6. worktree behavior documented | [OK] | Document, mock git output |
| 7. submodule policy | [OK] | Mock appropriate git output |

**Test Group B (settingsIntegration.test.ts):**

All existing tests pass because temp directories produce stable identity.

**New tests needed:**
- Multi-workspace test (pass different workspace roots)
- Subdirectory stability test

**Test Group C (settingsStorage.test.ts):**

Mock `SecureStore` already supports testing different service names.

**New tests needed:**
- Different service names for different workspace roots
- Canonical + legacy dual-read behavior

**Test Group D (migration):**

Requires sequential test: write legacy → read canonical → verify migration.

---

### Q5: TypeScript-specific concerns?

**Answer:** Several, addressed above.

**Summary:**

1. [OK] **Type safety:** All paths are `string`, no `any` types needed
2. [OK] **Async patterns:** Existing async/await works fine
3. WARNING: **Module state:** Avoid singletons, use instance-per-call
4. WARNING: **Test isolation:** Don't use `process.chdir()`, inject parameters
5. [OK] **Error handling:** Existing try/catch patterns adequate
6. WARNING: **Scope detection:** Replace string matching with explicit parameter

---

## Required Changes to Plan

### Change 1: Use Existing `gitUtils.ts`

**Instead of creating `workspaceIdentity.ts`**, add to existing `gitUtils.ts`:

```typescript
// packages/cli/src/utils/gitUtils.ts

/**
 * Gets the canonical workspace identity for settings storage.
 * 
 * For git repositories, returns the repository root.
 * For non-git directories, returns the canonicalized cwd.
 * 
 * @param cwd - The current working directory (defaults to process.cwd())
 * @returns Canonical workspace identity path
 */
export function getWorkspaceIdentity(cwd: string = process.cwd()): string {
  try {
    // Try git repo root first
    return execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf-8',
    }).trim();
  } catch {
    // Fallback to canonicalized cwd
    return fs.realpathSync(cwd);
  }
}
```

### Change 2: Explicit Scope Parameter

Update `getKeychainServiceName()` signature:

```typescript
export function getKeychainServiceName(
  extensionName: string,
  scope: ExtensionSettingScope,
  workspaceRoot?: string,
): string {
  const sanitized = extensionName.replace(/[^a-zA-Z0-9-_]/g, '');
  
  if (scope === ExtensionSettingScope.WORKSPACE) {
    if (!workspaceRoot) {
      throw new Error('workspaceRoot required for workspace-scoped settings');
    }
    const hash = crypto.createHash('md5')
      .update(workspaceRoot)
      .digest('hex')
      .substring(0, 8);
    return `LLxprt Code Extension ${sanitized} Workspace ${hash}`.substring(0, 255);
  }
  
  return `LLxprt Code Extension ${sanitized}`.substring(0, 255);
}
```

### Change 3: ExtensionSettingsStorage Constructor

```typescript
export class ExtensionSettingsStorage {
  private readonly extensionDir: string;
  private readonly store: SecureStore;
  
  constructor(
    extensionName: string,
    extensionDir: string,
    scope: ExtensionSettingScope = ExtensionSettingScope.USER,
    workspaceRoot?: string,
  ) {
    this.extensionDir = extensionDir;
    
    // Compute service name with explicit scope
    const serviceName = getKeychainServiceName(
      extensionName,
      scope,
      scope === ExtensionSettingScope.WORKSPACE ? workspaceRoot : undefined,
    );
    
    this.store = new SecureStore(serviceName);
  }
  
  // ... rest of class
}
```

### Change 4: Update All Callsites

**settingsIntegration.ts:**

```typescript
import { getWorkspaceIdentity } from '../../utils/gitUtils.js';

export async function getExtensionEnvironment(
  extensionDir: string,
): Promise<Record<string, string>> {
  // ... existing code ...
  
  const workspaceRoot = getWorkspaceIdentity();
  
  // User storage (unchanged)
  const userStorage = new ExtensionSettingsStorage(
    extensionName,
    extensionDir,
    ExtensionSettingScope.USER,
  );
  
  // Workspace storage (now with canonical root)
  const workspaceDir = path.join(
    workspaceRoot,
    '.llxprt',
    'extensions',
    extensionName,
  );
  const workspaceStorage = new ExtensionSettingsStorage(
    extensionName,
    workspaceDir,
    ExtensionSettingScope.WORKSPACE,
    workspaceRoot,
  );
  
  // ... rest of function
}
```

### Change 5: Backward Compat in loadSettings

```typescript
async loadSettings(
  settings: ExtensionSetting[],
  legacyWorkspaceRoot?: string,
): Promise<Record<string, string | undefined>> {
  const result: Record<string, string | undefined> = {};
  
  // ... load non-sensitive from .env ...
  
  // For sensitive settings, try canonical then legacy
  for (const setting of sensitiveSettings) {
    try {
      let value = await this.store.get(setting.envVar);
      
      // If not found and legacy root provided, try legacy store
      if (value === null && legacyWorkspaceRoot) {
        const legacyStore = new SecureStore(
          getKeychainServiceName(
            this.extensionName,
            ExtensionSettingScope.WORKSPACE,
            legacyWorkspaceRoot,
          ),
        );
        
        value = await legacyStore.get(setting.envVar);
        
        // Best-effort migration
        if (value !== null) {
          try {
            await this.store.set(setting.envVar, value);
            console.log(`Migrated ${setting.envVar} to canonical location`);
          } catch (err) {
            console.warn(`Could not migrate ${setting.envVar}:`, err);
          }
        }
      }
      
      result[setting.envVar] = value ?? undefined;
    } catch (error) {
      console.error(`Failed to load ${setting.envVar}:`, error);
      result[setting.envVar] = undefined;
    }
  }
  
  return result;
}
```

---

## Implementation Sequence (Revised for TypeScript)

### Step 1: Extend gitUtils.ts

```bash
# Test file: packages/cli/src/utils/gitUtils.test.ts
npm run test -- packages/cli/src/utils/gitUtils.test.ts
```

**Tests to add:**
- `getWorkspaceIdentity()` returns repo root in git repo
- Returns canonicalized cwd in non-git directory
- Handles symlinks correctly
- Same repo from different subdirs returns same value

### Step 2: Update settingsStorage.ts

```bash
npm run test -- packages/cli/src/config/extensions/settingsStorage.test.ts
```

**Changes:**
- Add scope parameter to constructor
- Update `getKeychainServiceName()` signature
- Add backward-compat fallback in `loadSettings()`

### Step 3: Update settingsIntegration.ts

```bash
npm run test -- packages/cli/src/config/extensions/settingsIntegration.test.ts
```

**Changes:**
- Import `getWorkspaceIdentity()` from gitUtils
- Replace all `process.cwd()` calls
- Pass workspace root to storage constructors

### Step 4: Update tests

**Add new test files:**
- `packages/cli/src/utils/gitUtils.test.ts` (if doesn't exist)

**Update existing tests:**
- Mock `execSync` for git commands
- Test multi-workspace scenarios
- Test migration behavior

### Step 5: Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run format
npm run build
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
```

---

## Risk Assessment (TypeScript Perspective)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Type inference breaks | Low | Explicit return types on new functions |
| Async deadlock | Low | No new locks, existing patterns safe |
| Test flakiness | Medium | Avoid `process.chdir()`, use mocks |
| Module initialization order | Low | No module-level state changes |
| Breaking change to API | Medium | Add new params as optional, deprecate old usage |
| Git command injection | Low | Using `execSync` with no user input |
| Keychain migration data loss | Medium | Read-only fallback, best-effort migration |

---

## Conclusion

**APPROVE_WITH_CHANGES**

The remediation plan is **architecturally sound** and addresses a real consistency issue. The proposed solution (canonical workspace identity) is the right approach.

**Required changes:**

1. [OK] Use existing `gitUtils.ts` instead of new file
2. [OK] Add explicit scope parameter instead of string matching
3. [OK] Skip caching for CLI usage (add later if needed)
4. [OK] Implement dual-read fallback with best-effort migration
5. [OK] Update tests to avoid `process.chdir()`, use mocked `execSync`

**TypeScript-specific strengths:**

- Existing code structure supports parameterization
- Async patterns already in place
- Type safety naturally enforced
- Test infrastructure (Vitest) supports mocking

**Implementation estimate:** 8-12 hours (within plan estimate)

**Confidence level:** HIGH — changes are localized, testable, and backward-compatible.
