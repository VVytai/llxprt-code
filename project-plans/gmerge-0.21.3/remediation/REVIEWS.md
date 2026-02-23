# Remediation Plan Reviews

**Round 2 — 2026-02-20**
All 5 plans reviewed by both `deepthinker` and `typescriptexpert`.

---

## R13: direct-web-fetch Retry

| Reviewer | Verdict |
|----------|---------|
| deepthinker (R2) | APPROVE_WITH_CHANGES |
| typescriptexpert | APPROVE_WITH_CHANGES |

### Consensus corrections (to apply)

1. **Status preservation must use `HttpError` interface** from retry.ts (already exported). Cast with `as HttpError` and set `.status` on non-OK responses.
2. **`emittedChunk` flag must be per-attempt and based on any committed user-visible output** — not just CHUNK type. Set before first `yield`.
3. **RETRY events must only emit for true pre-output retries.** Add assertion.
4. **Timeout budget risk**: With retries, total time = timeout + retries x backoff. Document or adjust.
5. **Pre-aborted test assertion should be deterministic** ("no fetch call"), not "zero/at-most-one."
6. **Retry policy values** should reference existing codebase constants where available.
7. **Add stream retry tests to existing `geminiChat.runtime.test.ts`**, not a new file.
8. Effort: 6-10h (TS expert says +2h for careful stream retry testing).

### Status: Ready for final plan update

---

## R7: Hook Security Validation

| Reviewer | Verdict |
|----------|---------|
| deepthinker (R2) | APPROVE_WITH_CHANGES |
| typescriptexpert | APPROVE_WITH_CHANGES |

### Consensus corrections (to apply)

1. **Canonicalization spec needed**: hook names case-sensitive, definitions compared via sorted `JSON.stringify`, reserved keys rejected at schema level.
2. **Validation failure mode**: hard-fail (throw) for hooks — security-first, not soft-fail returning null.
3. **Sanitization**: reuse existing `escapeAnsiCtrlCodes()` from `packages/cli/src/ui/utils/textUtils.ts`.
4. **Batch update semantics**: `updateAll` uses `Promise.all` — one rejection can fail the whole batch. Define and test explicit policy (partial success vs all-or-nothing).
5. **Non-interactive consent scenario**: add explicit test/policy.
6. **Rollback-on-decline test**: existing `update.ts` has rollback code but no behavioral test for declined update. Add.
7. **Enable/reinstall**: pick firm policy, don't leave as either/or.
8. Effort: 10-16h (TS expert adds +2h).

### Status: Ready for final plan update

---

## R3: MCP URL Fixes

| Reviewer | Verdict |
|----------|---------|
| deepthinker (R2) | APPROVE_WITH_CHANGES |
| typescriptexpert | APPROVE_WITH_CHANGES |

### Consensus corrections (to apply)

1. **Explicitly mark Phase B tests as RED against current implementation** — `createTransportWithOAuth` currently defaults `url` (no type) to SSE, which is wrong.
2. **Full 4-priority chain** must be implemented in `createTransportWithOAuth`: httpUrl > url+type:http > url+type:sse > url (default HTTP). Currently only handles httpUrl > url(SSE).
3. **Add error throw** when neither url nor httpUrl configured (match `createUrlTransport` line 721 pattern).
4. **Add deprecation warning** in list.ts when both `httpUrl` and `url` present.
5. **Tighten 404 variant language**: code checks `String(error).includes('404') || includes('Not Found')`. Add explicit case/variant tests.
6. **OAuth-state map negative assertions**: non-auth failures must NOT set `mcpServerRequiresOAuth`; auth failures MUST.
7. **Phase B additional test**: `createTransportWithOAuth` throws for invalid config (no url/httpUrl).
8. **Phase C additional test**: explicit `type:http` prevents SSE fallback even on 404.
9. **Consider refactoring `createSSETransportWithAuth`** to reuse new `createTransportWithOAuth` logic.
10. Effort: 14-20h (TS expert bumps further).

### Status: Ready for final plan update

---

## R4: Hook Lifecycle Completion

| Reviewer | Verdict |
|----------|---------|
| deepthinker (R2) | APPROVE_WITH_CHANGES |
| typescriptexpert | APPROVE_WITH_CHANGES |

### Consensus corrections (to apply)

1. **Add `resolveForegroundConfig()` helper** in clearCommand.ts (parallel to existing `resolveForegroundGeminiClient()`).
2. **Add `trigger: PreCompressTrigger` parameter** to `performCompression()` with default `Auto`. Update `compressCommand.ts` to pass `Manual`.
3. **Specify exact hook ordering in clear flow**: setDebugMessage > SessionEnd > resetChat > SessionStart > resetTelemetry > updateHistoryTokenCount > clear.
4. **Add explicit import statements** in implementation steps (lifecycleHookTriggers, enums).
5. **Specify telemetry export barrel file** for `flushTelemetry`.
6. **Verify OpenTelemetry SDK version** supports `forceFlush()` on NodeSDK.
7. **Update existing clearCommand.test.ts ordering assertions** to include hook calls.
8. **Make fail-open wrapping explicit** in implementation steps for both wiring sites.

### Status: Ready for final plan update

---

## R15: Workspace Identity

| Reviewer | Verdict |
|----------|---------|
| deepthinker (R2) | APPROVE_WITH_CHANGES |
| typescriptexpert | APPROVE_WITH_CHANGES |

### Consensus corrections (to apply)

1. **Use existing `gitUtils.ts`** (`getGitRepoRoot()` already exists) — don't create new utility file.
2. **Skip cwd-aware memoization** for CLI (short-lived). If needed later for LSP, use class-based resolver.
3. **Replace brittle string matching** (`extensionDir.includes('.llxprt/extensions')`) with explicit `ExtensionSettingScope` parameter.
4. **Define canonical resolver contract**: absolute normalized path, deterministic fallback, non-throwing.
5. **Specify legacy keychain hash formula** exactly so fallback matches historical data.
6. **Add explicit workspace root parameter** to `ExtensionSettingsStorage` constructor.
7. **Use `execSync` mocking in tests**, not `process.chdir()` — avoids test isolation issues.
8. **Define worktree behavior** explicitly in tests.
9. **Ensure all workspace path construction routes through one helper** to prevent drift.
10. Effort: 8-12h (narrowed from 8-16h).

### Status: Ready for final plan update

---

## Summary

| Plan | Deepthinker R2 | TS Expert | Critical Remaining Changes |
|------|---------------|-----------|---------------------------|
| R13 | AWC | AWC | HttpError cast, emittedChunk scope, timeout budget |
| R7 | AWC | AWC | Canonicalization spec, hard-fail mode, batch semantics |
| R3 | AWC | AWC | Full 4-priority chain, Phase B RED baseline, 404 tightening |
| R4 | AWC | AWC | resolveForegroundConfig helper, trigger param, ordering spec |
| R15 | AWC | AWC | Use existing gitUtils, skip memoization, scope param |

All plans are APPROVE_WITH_CHANGES. No REJECTs. Corrections are precision refinements, not fundamental redesigns.
