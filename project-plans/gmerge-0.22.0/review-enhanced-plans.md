# Deepthinker Review: All 14 Enhanced REIMPLEMENT Plans

**All 14 plans: CONDITIONAL PASS** — no FAIL verdicts. Consistent themes across all reviews documented below.

## Recurring Themes (Apply to ALL plans)

### 1. Brittle Line Numbers
Every reviewer flagged hardcoded line numbers as fragile. Plans reference exact lines (e.g., "line 242", "line 1028") that may have drifted since the plan was written. **Mitigation during execution:** cherrypicker subagents should use symbol/grep-driven navigation, not fixed line references. Treat line numbers as approximate.

### 2. Test-First Ordering
Several plans label their RED phase but actually describe implementation changes before tests (especially snapshot-driven UI plans like 54de6753 and 6dea66f1). **Mitigation during execution:** subagents must write and run failing tests FIRST, then implement. The plans provide the test code — just enforce ordering.

### 3. Time Estimates
Several plans include time estimates despite project rules prohibiting them. **Mitigation:** ignore all time/day estimates in plans.

### 4. Pre-Checked Checklists
Some plans mark success criteria as `[x]` (done) before execution. **Mitigation:** treat all checklist items as unchecked during execution.

## Per-Plan Verdicts

| SHA | Subject | Verdict | Key Issue |
|-----|---------|---------|-----------|
| `d4506e0f` | transcript_path hooks | COND PASS | Missing RED checkpoint before implementation; deferred wiring leaves feature partially disabled |
| `54de6753` | stats display polish | COND PASS | Implementation before tests in RED phase; snapshot-dependent assertions |
| `86134e99` | settings validation | COND PASS | Some Zod assertions may be fragile against version changes; not all LLxprt settings provably covered |
| `299cc9be` | A2A /init command | COND PASS | Minor branding scope claim too broad; test setup may need compile adjustments |
| `1e734d7e` | drag/drop images | COND PASS | Missing mixed prose+paths test; backslash edge cases underspecified |
| `3b2a4ba2` | IDE ext refactor | COND PASS | Tests too implementation-coupled (mock internals, exact strings); downstream compat not validated |
| `6dea66f1` | stats flex removal | COND PASS | TDD sequencing mislabeled; snapshot file coverage may be incomplete |
| `5f298c17` | always-allow policies | COND PASS | **HIGH RISK**: Plan too large (2234 lines) for single-pass execution; shell prefix persistence needs denylist/warning guardrails |
| `a47af8e2` | commandPrefix safety | COND PASS | **SECURITY**: Missing rm vs rmdir explicit test; loader-driven integration test needed |
| `126c32ac` | hook refresh | COND PASS | Concurrency only documented not tested; dispose() side effects need verification |
| `942bcfc6` | typecasts / eslint | COND PASS | Multiple eslint configs not accounted for; per-file commit loop is noisy |
| `d236df5b` | tool fragmentation | COND PASS | **HIGH RISK**: Stale line refs at zed call site; model naming convention fragile for Gemini 3 detection |
| `217e2b0e` | non-interactive | COND PASS | Contradictory mock config statements; YOLO RED test expectation ambiguous |
| `0c3eb826` | A2A interactive | COND PASS | Test spy strategy (`vi.spyOn(globalThis, 'Config')`) won't work; needs behavioral test instead |

## Actionable Items for Execution Phase

1. **All plans:** Use grep/symbol search, not line numbers, to locate edit points
2. **All plans:** Enforce test-first ordering even where plan labels are inconsistent
3. **5f298c17:** Consider splitting into 2-3 sub-batches during execution if subagent struggles
4. **a47af8e2:** Add explicit `rm` vs `rmdir` security test before marking batch complete
5. **d236df5b:** Verify zed call site location via grep, not line 500
6. **0c3eb826:** Replace `vi.spyOn(globalThis, 'Config')` with behavioral test on returned config
7. **942bcfc6:** Check all eslint configs, not just root

## Summary

These plans are substantially better than the originals — they have real test code, actual implementation snippets, and concrete touchpoints. The CONDITIONAL issues are execution-time concerns that the cherrypicker/reviewer subagent loop will catch. No plans need to be sent back for rewriting before execution.
