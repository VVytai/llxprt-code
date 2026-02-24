# Critique: REIMPLEMENT plan for b27cf0b0a8dd (continue logic to core)

## Executive Summary

The plan is thoughtful and mostly sound in choosing **partial alignment** (types to core, `/continue` logic remaining in CLI). That recommendation is directionally correct given LLxprt's current architecture and coupling.  
However, the plan is incomplete in several important areas: it under-specifies migration surface area, omits TDD and repo-mandated verification flow details, and underestimates risks around package boundaries, exported API stability, and potential type cycles/versioning friction.

---

## 1) Is the recommended approach (partial alignment) correct?

### Verdict
**Yes, with caveats.**

Keeping full `/continue` and `performResume()` in CLI is justified today:
- It appears tightly coupled to CLI/UI state, session browser behavior, and recording integration.
- Upstream `/restore` is not a 1:1 feature match for LLxprt `/continue`.
- A forced move now would likely create leaky abstractions and increase complexity.

Moving common action-return types to core is also reasonable:
- Reduces duplication.
- Aligns with upstream direction.
- Creates a cleaner future extraction path.

### Caveat
The plan frames this as "partial alignment," but does not define **clear boundaries** for what remains CLI-owned vs core-owned long-term. Without that, this can become an intermediate state that lingers and causes churn.

**Recommendation:** add explicit boundary rules now (e.g., "core owns command action primitives; CLI owns UI orchestration actions and session/recording orchestration").

---

## 2) Missing steps / risks

### A. Missing migration inventory
The plan says "multiple CLI files" need import updates but does not enumerate them. This is risky in a large TS codebase.

**Recommendation:** add a concrete import migration checklist using grep/AST search before edits and after edits.

### B. Type/API compatibility risks not explicitly covered
Potential issues:
- Generic compatibility (`CommandActionReturn<HistoryItemWithoutId[]>`) and discriminated-union narrowing regressions.
- Build graph/package boundary concerns when introducing new core exports.
- Risk of accidental runtime import (vs type-only import), affecting bundling.

**Recommendation:** require:
- `import type` where possible.
- compile-time checks in both core and CLI package contexts.
- quick smoke test for bundle/start path.

### C. No explicit TDD step for this change
Project memory mandates TDD for code changes. Plan currently assumes refactor-only and jumps to verification.

**Recommendation:** include at least one failing test first:
- e.g., a test proving CLI command types resolve from core export contract (or a targeted type test / unit test where existing test fails until import move is complete).

### D. Verification flow is incomplete vs repo mandate
Plan includes typecheck/test/build + haiku, but misses required lint/format ordering and full stated workflow.

**Recommendation:** include full mandated verification explicitly:
1. `npm run test`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run format`
5. `npm run build`
6. `node scripts/start.js --profile-load synthetic --prompt "write me a haiku"`

And rerun full cycle after any fixes.

### E. "Add inline comments referencing upstream commit" is questionable
Adding traceability comments in production code may create noise and violate local style if not already common.

**Recommendation:** prefer plan/docs/changelog traceability over inline code comments unless project convention explicitly uses `@upstream` tags.

### F. No rollback/containment strategy
If moving types to core triggers broad type fallout, no staged fallback is defined.

**Recommendation:** implement in small commits:
1) add core types + exports,  
2) migrate CLI imports,  
3) cleanup dead local types.  
This allows quick bisect/revert per step if needed.

### G. Potential naming/domain mismatch not addressed
Upstream naming is `/restore`; local domain is `/continue`/`perform_resume`. Blindly importing upstream type semantics could embed misleading terminology over time.

**Recommendation:** ensure type names are domain-neutral and not restore-specific. If needed, introduce local aliases to preserve intent clarity.

---

## 3) Is the effort estimate realistic?

### Verdict
**Slightly optimistic.**  
"2-3 hours" is possible only if import surface is small and tests are stable.

Given mandatory full verification (test/typecheck/lint/format/build/haiku), realistic range is more likely:

- **3-5 hours** for smooth path.
- **5-8 hours** if there is non-trivial type fallout or test brittleness.

Main underestimate driver: full verification runtime + likely iterative fixes in a cross-package type refactor.

---

## 4) Better alternatives

### Alternative A (best near-term): "No-op functional change, contract-first extraction"
Keep behavior unchanged and do:
1. Introduce core `commands/types.ts`.
2. Export it.
3. Migrate only stable, clearly shared primitives.
4. Keep CLI-specific union members and orchestration actions local.

This is close to current recommendation, but with stricter scoping and less ambition in first pass.

### Alternative B: Introduce a thin core protocol layer, not full logic move
Instead of moving `/continue` logic, define a minimal core protocol:
- action/event contract
- pure transformation helpers
- serializer/validator shapes

CLI keeps orchestration and side effects. This gives future portability without forcing immediate architecture shift.

### Alternative C: Defer all movement until an actual core consumer exists
If no second consumer exists today, keep types in CLI and only mirror upstream when a concrete reuse case appears.  
This minimizes churn but sacrifices upstream alignment and may increase future merge friction.

---

## Recommended plan adjustments (actionable)

1. **Add explicit scope guardrails**
   - What is moving now (shared action primitives only).
   - What is not moving (performResume/session/recording/UI flows).

2. **Add concrete file migration checklist**
   - Enumerate all references before editing.
   - Verify zero stale imports afterward.

3. **Adopt staged implementation**
   - Stage 1: add core types + exports.
   - Stage 2: migrate imports with type-only imports.
   - Stage 3: remove duplicated CLI types.

4. **Add TDD-compliant step**
   - Introduce/adjust a failing test (or type-level test harness) before implementation.

5. **Use full repo-mandated verification**
   - test -> typecheck -> lint -> format -> build -> haiku (and rerun after fixes).

6. **Avoid inline upstream comments unless standard**
   - Keep traceability in plan/changelog/PR notes.

7. **Revise estimate**
   - Update to 3-5h baseline, 5-8h with contingency.

---

## Final assessment

The **core decision (partial alignment) is correct**, but the plan needs stronger execution rigor: explicit boundaries, migration inventory, staged rollout, TDD compliance, and fuller risk controls. With those improvements, this becomes a low-to-moderate risk refactor with good long-term alignment value.
