# Review: gmerge/0.22.0 Execution Plan

## Verdict
**PASS (with minor caveats).**

The plan is structurally strong and internally consistent for executing the v0.21.3 → v0.22.0 merge strategy. I found no blocking inconsistencies, but there are a few improvements that would reduce execution risk.

## Issues Found
1. **No explicit chronological proof in PLAN.md batch sections (minor documentation gap).**  
   - Batches appear correctly ordered by upstream chronology based on CHERRIES.md, but PLAN.md itself does not show dates per batch. This is not wrong, just less auditable during execution.

2. **Cleanup batch scope is described but lacks explicit grep-based safety gate (minor execution hardening gap).**  
   - Batch 18 names files and intent clearly; adding a required pre/post usage search for `findFiles(` would reduce risk of accidental runtime breakage from missed references.

3. **High-risk batch guardrails are present but could be more concrete in acceptance criteria (minor).**  
   - `5f298c17` and `d236df5b` are clearly labeled HIGH and have special review notes, but plan could tighten this with explicit check commands/expected signals (e.g., exact search patterns and targeted regression cases).

## Checks Against Requested Criteria
1. **Completeness:** [OK] Yes. 74 commits accounted for; counts match exactly: 14 PICK + 46 SKIP + 14 REIMPLEMENT = 74.
2. **Batch ordering:** [OK] Yes. PICK groups are <=5 (B1=5, B8=5, B14=4). REIMPLEMENTs are solo batches. Sequence aligns with chronological table in CHERRIES.
3. **Verification cadence:** [OK] Yes. Full verify on even batches 2,4,6,8,10,12,14,16,18.
4. **Non-negotiables covered:** [OK] Yes. Explicitly includes multi-provider architecture, no ClearcutLogger, branding substitutions, and parallel batching preservation.
5. **REIMPLEMENT plans exist:** [OK] Yes. All 14 referenced plan files are listed and match CHERRIES REIMPLEMENT table SHAs.
6. **Todo list coverage:** [OK] Yes. Each batch has exec+review+commit, plus final docs updates (PROGRESS/NOTES/AUDIT).
7. **Risk assessment for 2 HIGH items:** [OK] Adequately flagged. Both are marked HIGH with extra review emphasis.
8. **Missing items:** WARNING: Minor hardening opportunities noted above; nothing blocking.
9. **Batch composition risks (PICK needing solo):** [OK] Current grouping is reasonable; no obvious PICK that must be solo from what is documented.
10. **Cleanup batch:** [OK] Properly planned at high level; recommend adding mandatory pre/post reference scans.

## Recommendations
1. Add a **batch-level evidence line** for chronology (e.g., earliest/latest commit date per batch) to make ordering auditable directly in PLAN.md.
2. For **B18 cleanup**, require:
   - pre-check: search all references to `findFiles(` and interface implementations,
   - post-check: zero callsites + successful typecheck/tests.
3. For **B10 (5f298c17)**, add explicit acceptance checks:
   - search for banned telemetry identifiers (ClearcutLogger, Google telemetry code paths),
   - verify persistence is local TOML only.
4. For **B16 (d236df5b)**, add explicit regression test notes:
   - one multimodal tool output case confirming encapsulated functionResponse behavior,
   - one non-multimodal control case.

## Risk Assessment
- **Overall execution risk:** **Medium** (driven by 14 reimplementations and two high-risk behavior/security-sensitive changes).
- **Primary risk concentrations:**
  - B10 (`5f298c17`) policy persistence + telemetry invariants,
  - B16 (`d236df5b`) protocol-shape correctness for multimodal tool output,
  - B4 (`86134e99`) large settings validation delta (730+ lines).
- **Mitigation quality in current plan:** Good (solo REIMPLEMENT batches, full verify cadence, explicit non-negotiables, remediation loop).
- **Residual risk after recommended hardening:** Low-to-medium.
