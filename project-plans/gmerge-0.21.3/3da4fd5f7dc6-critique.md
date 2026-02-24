# Critique: Reimplementation Plan for `3da4fd5f7dc6`

Overall: the plan captures the upstream intent correctly, but it is too optimistic about LLxprt equivalence and leaves several correctness and regression risks unaddressed.

## 1) Missing edge cases / risks

### A. Incorrect equivalence: profile switch ≠ auth method switch
The plan assumes upstream’s “auth method changed” can be mapped to “profile changed.” That mapping is not always valid.

- Two profiles may share the same auth method and account; clearing cache on profile switch could still be unnecessary.
- A single profile may change auth method internally (or provider config), and cache may need clearing even without profile name change.

**Risk:** behavior drift from upstream semantics; either over-clearing or under-clearing credentials.

### B. Stale/inaccurate source of truth for current profile
The plan proposes `getActiveProfileName()` without validating lifecycle ordering relative to:
- ACP request handling,
- runtime profile loading,
- concurrent auth requests,
- out-of-process profile mutations.

If `getActiveProfileName()` is stale at authenticate-time, cache clearing decisions are wrong.

### C. First-auth and unknown-profile handling is underspecified
The plan says null/undefined current profile should clear cache, but does not justify that this is always safe. For first auth, clearing may be pointless and can mask state bugs.

### D. No concurrency / reentrancy analysis
`authenticate` can be invoked repeatedly by integrations. The plan does not assess:
- overlapping authenticate calls for different methodIds/profiles,
- race between clear/load/apply overrides,
- partial failure after clear but before successful load.

### E. Failure-path behavior not addressed
No consideration of what happens if:
- `clearCachedCredentialFile()` fails,
- `loadProfileByName()` fails,
- `applyRuntimeProviderOverrides()` fails.

The sequence can leave runtime state partially updated or credential cache unexpectedly cleared.

### F. Potential provider-level cache coupling omitted
The plan only discusses one credential cache file. It does not confirm whether provider SDKs or token stores maintain additional caches requiring synchronized invalidation.

### G. Zed methodId parsing edge cases are ignored
`parseZedAuthMethodId(methodId, availableProfiles)` can produce edge outputs (fallback/default behavior, malformed IDs, removed profiles). Cache-clearing policy should account for parse failure/fallback semantics.

## 2) Incomplete analysis of LLxprt current state

### A. No code-level validation of current imports/architecture
The plan claims runtimeSettings import is “already available” by approximate line number, but does not verify exact current imports, naming, or circular dependency risk.

### B. No validation of where auth type actually lives in LLxprt
The plan states LLxprt has `security.auth.selectedType` but then pivots fully to profile comparison. It does not reconcile:
- whether `selectedType` is still authoritative for auth cache invalidation,
- whether profile metadata can expose auth type for a truer upstream parity check.

### C. No impact analysis on non-Zed authentication flows
Only Zed ACP path is analyzed. If other auth entry points still clear cache unconditionally (or rely on this side effect), behavior inconsistency may be introduced.

### D. No historical/regression context
The plan doesn’t check prior LLxprt commits/issues around credential cache bugs, so it may reintroduce previously fixed edge behavior.

## 3) Missing test scenarios

The test plan is too high-level. It needs concrete, behavioral scenarios with assertions.

Minimum missing scenarios:

1. **Same profile re-auth does not clear cache**
   - Prepopulate credential cache.
   - Call authenticate with methodId resolving to active profile.
   - Assert cache remains and auth succeeds.

2. **Different profile re-auth clears cache exactly once**
   - Active profile A, authenticate to profile B.
   - Assert clear is called once before profile load.

3. **Same profile but changed auth method/config**
   - Simulate auth-method drift within profile.
   - Assert expected invalidation behavior (whatever policy is chosen).

4. **Unknown/malformed methodId**
   - Assert deterministic behavior: error vs fallback; no accidental destructive clear.

5. **Failure injection tests**
   - clear fails; load fails; overrides fail.
   - Assert no hidden corruption and clear error propagation policy.

6. **Concurrent authenticate calls**
   - Two overlapping calls (same profile, different profile).
   - Assert final active profile and cache state are coherent.

7. **Non-Zed flow parity test**
   - Ensure other auth paths maintain intended invalidation semantics.

8. **Integration smoke for Zed ACP**
   - End-to-end auth handshake where repeated auth request occurs.

Also missing: explicit verification command sequence mandated by repo policy (`format`, `lint`, `typecheck`, `test`, `build`, haiku run).

## 4) Potential breaking changes not addressed

1. **Behavioral contract change for profile switching**
   Existing workflows may rely on unconditional clearing to force fresh login each authenticate call.

2. **Cross-profile credential leakage risk**
   If credentials are reused more than intended because profile-based check is too coarse/fine, wrong-account requests could occur.

3. **Tooling/integration expectations**
   Zed or ACP clients may expect re-auth to force prompt under certain conditions; this could silently stop happening.

4. **State divergence between runtime profile and persisted settings**
   If active profile source differs from persisted config, conditional clear can become nondeterministic.

## 5) Dependencies on other commits not mentioned

The plan likely depends on unverified assumptions that may require additional commits or prior patches:

1. **`getActiveProfileName()` correctness and timing guarantees**
   If absent/inadequate, a separate runtime-state commit is needed.

2. **`parseZedAuthMethodId` semantics stabilization**
   If parser fallback behavior is loose, this change may need accompanying parser hardening.

3. **Profile metadata linkage to auth type/provider**
   To match upstream intent, may require exposing/reading auth method from profile config.

4. **Tests infrastructure for zed-integration auth path**
   If current tests do not isolate credential cache behavior, supporting test harness commits may be required.

5. **Any prior LLxprt commit that intentionally made cache clearing unconditional**
   If that behavior was a local fix, reverting it conditionally requires referencing and reconciling that prior commit.

---

## Recommended plan improvements

1. **Define invalidation policy explicitly**: key off auth-method/provider/account identity, not just profile name.
2. **Document source-of-truth** for “current auth context” and justify lifecycle safety.
3. **Add concrete TDD test matrix** (unit + integration + concurrency + failure injection).
4. **Audit all auth entry points** for consistent cache semantics.
5. **Add rollback/observability notes** (logs/metrics around cache-clear decisions).
6. **List prerequisite commits** if parser/runtime-state/profile metadata guarantees are missing.

With those additions, the plan would be substantially safer and more implementation-ready.