# Final Audit Report: gmerge-0.21.3 (v0.20.2 → v0.21.3)

**Date:** 2026-02-20  
**Method:** Dual-agent audit (deepthinker + typescriptexpert) per batch, notes compared  
**Scope:** All 24 batches (8 PICK + 16 REIMPLEMENT) covering 122 upstream commits

---

## Executive Summary

| Verdict | Count | Batches |
|---------|-------|---------|
| [OK] CLEAN | 14 | B1, B3, B4, B5, B6, B7, B8, R1, R8, R9, R10, R16, R17, R18 |
| WARNING: MINOR_ISSUES | 6 | B2, R2+R11, R6, R14, R15, R5 |
|  SIGNIFICANT_ISSUES | 4 | R3, R7, R12+R13, R4 (disputed) |
|  EXEMPLARY | 2 | R20, R10 |

**Overall: Feature is ~85% complete with behavior parity. 3 batches have significant gaps that need remediation.**

---

## Did We Actually Finish the Feature?

**YES, with caveats.** All 24 batches were executed and committed. The core upstream behaviors from v0.21.3 landed in LLxprt. However:

1. **3 areas have incomplete behavior parity** (R3, R7, R4)
2. **1 area has missing integration** (R13 direct-web-fetch retry)
3. **25 hook test failures** remain (claimed pre-existing but unproven)
4. **15 SettingsDialog test failures** exist (architectural test exclusion)

---

## Behavior Parity Assessment

### [OK] Full Parity Achieved (20 batches)

| Batch | Feature | Parity |
|-------|---------|--------|
| B1 | Integration test restrictions, editor types, security, enterprise docs | [OK] Full |
| B2 | OSC52 copy, CJK navigation, settings toggle, MCP --type alias | [OK] Full (minor: unused import) |
| B3 | Reclassified correctly; MCP auto-execute landed | [OK] Full |
| B4 | MCP dynamic tools, privacy screen, API error, shell truncation | [OK] Full |
| B5 | Terminal wrapping, autoupgrade detach, floating promises (160 fixes) | [OK] Full |
| B6 | Freeze fix, audio, auto-execute slash commands | [OK] Full |
| B7 | Clipboard formats, express bump, a2a prompt_id, a2a final:true | [OK] Full |
| B8 | A2A restore command (6 phases, exemplary security) | [OK] Full |
| R1 | MessageBus always-on | [OK] Full (intentional deviation: no toggle) |
| R8 | ACP credential cache | [OK] Full (profile-based vs auth-type) |
| R9 | Remove example extension | [OK] Full |
| R10 | Per-extension settings commands | [OK] Full |
| R12 | ENOTFOUND in transient codes | [OK] Full (missing test) |
| R16 | Missing extension config handling | [OK] Full |
| R17 | Command types to core | [OK] Full |
| R18 | Session ID in JSON output | [OK] Full |
| R2+R11 | Fuzzy search + TextInput search UX | [OK] Full |
| R6 | Hook system documentation | [OK] Full |
| R15 | User-scoped extension settings | WARNING: Functional but cwd-fragile |
| R20 | MCP Resources (16 phases) | [OK] Full — exemplary architecture |

### WARNING: Partial Parity (3 batches)

#### R3: MCP URL Consolidation — 70% complete
**What's missing:**
-  **List command display bug**: Shows "sse" for url-only configs but default is HTTP
-  **Zero test coverage** on HTTP→SSE fallback state machine
-  **Zero test coverage** on OAuth retry flows
- WARNING: Inverted 404 fallback gating logic
- WARNING: createTransportWithOAuth ignores type/default HTTP semantics
- WARNING: OAuth race conditions with global mutable state

#### R4: Hook Session Lifecycle — 55% complete (disputed)
**What's missing (deepthinker analysis):**
-  `flushTelemetry()` not implemented
-  PreCompress hook NOT wired into chatCompressionService
-  clearCommand lifecycle hook integration missing
- WARNING: 25 hook test failures unproven as pre-existing

**Typescriptexpert disagrees:** Rates as MINOR, says 24 of 25 failures are intentional TDD specs for future phases (P20/P21). The fail-open policy IS properly enforced.

**Reconciliation:** Both are partially right. The plumbing exists and is type-safe, but the upstream wiring into compression and clearCommand is incomplete. The test failures need git-bisect to attribute.

#### R7: Extension Hooks Security — 40% complete
**What's missing:**
-  No hook schema validation (`Record<string, unknown>` with "structure TBD")
-  No consent change detection for risk-increasing updates
-  Install/update/reinstall consent paths incomplete
-  Hook names not validated (potential path traversal)
- WARNING: Only 1 test (empty hooks short-circuit)

###  Missing Integration (1 batch)

#### R13: API Response Error Handling — 50% complete
**What landed:** Core retry.ts improvements, error cause chain, new tests.
**What's missing:**
-  **direct-web-fetch has NO retry wrapping** — defeats purpose of R12/R13
-  **No connection-phase flag** in geminiChat stream retry (data loss risk)
- WARNING: ENOTFOUND added but NOT tested
- WARNING: Missing pre-aborted signal test

---

## Architecture Quality Assessment

###  Exemplary Architecture
- **R20 (MCP Resources)**: Clean 3-layer separation (Registry → Client → UI), proper debouncing/coalescing, no monolithic patterns, comprehensive TDD
- **B8 (A2A Restore)**: Outstanding security (path traversal prevention, symlink rejection, workspace boundaries, Zod validation), multi-phase approach, atomic writes
- **R10 (Extension Settings)**: Comprehensive validation, excellent error messages, robust TTY handling

### [OK] Good Architecture
- **B5 (Floating Promises)**: 160 violations fixed appropriately, lint rule correctly configured
- **R1 (MessageBus)**: Clean removal of conditional, simpler than upstream
- **R3 (MCP URL)**: Good type design for transport consolidation, proper deprecation warnings

### WARNING: Architecture Concerns
- **R7 (Hook Security)**: `Record<string, unknown>` is not a security design — needs proper Zod schema
- **R15 (Scoped Settings)**: process.cwd() for workspace identity is fragile — needs canonical root discovery
- **R3 (MCP URL)**: 200+ line connectToMcpServer with nested try-catch is hard to test and reason about
- **R4 (Hook Lifecycle)**: Hooks plumbing exists but upstream integration points (compression, clearCommand) are missing

### [ERROR] No 5000-Line If-Statement Problems
No batch fell into the "multi-if-statement instead of a system" anti-pattern. R20 in particular demonstrates proper system design with clean abstractions.

---

## Cross-Cutting Issues

### 1. Test Coverage Gaps (Systemic)
Several batches removed or skipped tests:
- R14: Accept header tests removed (mock timeout issues)
- R3: Zero fallback/OAuth test coverage
- R12: ENOTFOUND untested
- R7: Only 1 consent test
- R4: 25 hook test failures (attribution disputed)
- SettingsDialog: 15 test failures (architectural exclusion)

**Total known test failures: ~55+** across hooks, settings, and new features.

### 2. Upstream Behaviors Intentionally Skipped
These SKIP decisions were correct per LLxprt policy:
- Model routing/availability (9 commits) — LLxprt users control models directly
- Google telemetry (5 commits) — LLxprt uses own telemetry
- Gemini-specific branding (4 commits) — LLxprt has own brand
- Release churn (18 commits) — version bumps irrelevant
- GitHub workflows (15 commits) — org-specific

### 3. Intentional Deviations from Upstream
| Area | Upstream | LLxprt | Correct? |
|------|----------|--------|----------|
| MessageBus | Configurable (default true) | Always on, no toggle | [OK] Simpler |
| Auth cache | AuthType comparison | Profile comparison | [OK] Fits multi-profile |
| Hooks | MessageBus-based triggers | HookEventHandler direct | [OK] LLxprt architecture |
| Extensions | ExtensionManager class | loadExtension() functions | [OK] LLxprt architecture |
| SettingsDialog | ~400 lines, AsyncFzf | ~1272 lines, Fzf sync | [OK] More features |
| Retry | Gated by retryFetchErrors | Always-on | WARNING: Intentional but doc needed |
| Compression | hasFailedCompressionAttempt latch | Rewritten compression | [OK] Own implementation |

---

## Priority Remediation Recommendations

### P0 — Fix Before Production

1. **R3: Fix list command transport display bug** (5-min fix)
   ```typescript
   const transportType = server.type || 'http'; // Not 'sse'
   ```

2. **R13: Add retry wrapping to direct-web-fetch** (1-2 hours)
   - Without this, ENOTFOUND/network improvements don't help web content fetching

3. **R7: Add hook schema validation** (2-3 hours)
   - Define proper Zod schema for hooks field
   - Validate hook names match `[a-zA-Z0-9_-]+`
   - This is a security gap

### P1 — Fix Before Next Release

4. **R3: Add HTTP→SSE fallback tests** (4-6 hours)
   - The most complex untested code path in the entire merge

5. **R3: Add OAuth retry tests** (3-4 hours)
   - Stored token, fresh token, failure, race conditions

6. **R13: Add connection-phase flag to stream retry** (2-3 hours)
   - Prevent mid-stream retry data loss

7. **R4: Wire PreCompress hook into chatCompressionService** (1-2 hours)
   - Hook exists but isn't called from compression

8. **R7: Add consent change detection for updates** (3-4 hours)
   - Re-prompt when hook set expands or privilege increases

9. **R12: Add ENOTFOUND test** (30 min)
   - Code exists but untested

### P2 — Address Eventually

10. **R15: Replace process.cwd() with canonical workspace root** (4-6 hours)
11. **R4: Implement flushTelemetry with concurrent-call guard** (2-3 hours)
12. **R14: Add write-stream error handlers** (1-2 hours)
13. **Attribute 25 hook test failures** via git-bisect (2-3 hours)
14. **R3: Refactor connectToMcpServer** into testable state machine (8-12 hours)

---

## Agent Disagreements

| Batch | Deepthinker | Typescriptexpert | Resolution |
|-------|-------------|-------------------|------------|
| R4 | 55% complete | MINOR_ISSUES | Both partially right — plumbing exists, upstream wiring incomplete |
| R7 | 40% complete | MINOR_ISSUES (elevated to SIGNIFICANT by hook validation) | Deepthinker more accurate — security gap is real |
| Hook tests | "Unproven pre-existing" | "24 of 25 intentional TDD specs" | Need git-bisect evidence |
| R20 | 8.5/10 | CLEAN | Agree — excellent implementation |

---

## Final Verdict

**The gmerge-0.21.3 merge is substantially complete.** The core features (MCP Resources, MCP dynamic tools, shell fixes, security fixes, hooks system, extension settings, retry improvements, A2A restore) all landed with generally good-to-excellent code quality and proper LLxprt architectural adaptation.

**3 areas need immediate attention before production:**
1. R3 list command display bug (trivial fix)
2. R13 direct-web-fetch missing retry (moderate fix)
3. R7 hook security validation (moderate fix)

**The architecture is sound** — no batch fell into the "5000-line if-statement" trap. R20 (MCP Resources) and B8 (A2A Restore) are particularly exemplary implementations. The intentional deviations from upstream are well-documented and appropriate for LLxprt's multi-provider architecture.

**Estimated remediation effort for all P0+P1 items: ~20-30 hours.**
