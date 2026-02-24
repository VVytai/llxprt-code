# Execution Plan: gmerge/0.22.0 (v0.21.3 → v0.22.0)

## START HERE (If you were told to "DO this plan")

### Step 1: Check current state
```bash
git branch --show-current   # Should be gmerge/0.22.0
git status                  # Check for uncommitted changes
```

### Step 2: Check or create the todo list
Call `todo_read()` first. If empty, call `todo_write()` with the EXACT todo list from the "Todo List Management" section below.

### Step 3: Find where to resume
- Look at the todo list for the first `pending` item
- If an item is `in_progress`, restart that item
- If all items are `completed`, you're done

### Step 4: Execute using subagents
For each batch:
- **For execution tasks (BN-exec):** Call `task` with `subagent_name: "cherrypicker"` using the prompt from the batch section below
- **For review tasks (BN-review):** Call `task` with `subagent_name: "reviewer"` using the prompt from the batch section below
- **For remediation (if review fails):** Call `task` with `subagent_name: "cherrypicker"` with the failure details
- **DO NOT** do the cherry-picks yourself — use the cherrypicker subagent
- **DO NOT** do the reviews yourself — use the reviewer subagent
- Continue until todo list is empty or you hit a blocker

### Step 5: If blocked
- Call `todo_pause()` with the specific reason
- Wait for human intervention

---

## Non-Negotiables

Per `dev-docs/cherrypicking.md`:
1. **Multi-provider architecture preserved** — `USE_PROVIDER` not `USE_GEMINI`
2. **Import paths** — `@vybestack/llxprt-code-core` not `@google/gemini-cli-core`
3. **Branding** — LLxprt, not Gemini CLI
4. **No ClearcutLogger** — zero Google telemetry
5. **No NextSpeakerChecker, FlashFallback, SmartEdit** — removed features stay removed
6. **Parallel batching** — LLxprt's coreToolScheduler processes in parallel, not serial
7. **JSONL session recording** — `SessionRecordingService`, not upstream recording

## Branding Substitutions

| Upstream | LLxprt |
|----------|--------|
| `@google/gemini-cli-core` | `@vybestack/llxprt-code-core` |
| `@google/gemini-cli` | `@vybestack/llxprt-code` |
| `GEMINI_CLI_IDE_AUTH_TOKEN` | `LLXPRT_CODE_IDE_AUTH_TOKEN` |
| `AuthType.USE_GEMINI` | `AuthType.USE_PROVIDER` |
| `GEMINI.md` | `LLXPRT.md` |
| `.gemini/` | `.llxprt/` |
| `gemini-cli` | `llxprt-code` |

## File Existence Pre-check

Before executing reimplementations, verify these files exist (they should):

| File | Used By |
|------|---------|
| `packages/core/src/hooks/hookEventHandler.ts` | B2 (transcript_path), B12 (hook refresh) |
| `packages/core/src/hooks/hookRegistry.ts` | B12 (hook refresh) |
| `packages/cli/src/config/extension-manager.ts` | B12 (hook refresh) |
| `packages/cli/src/ui/components/StatsDisplay.tsx` | B3 (stats polish), B9 (stats flex) |
| `packages/cli/src/ui/components/ModelStatsDisplay.tsx` | B3 (stats polish) |
| `packages/core/src/core/coreToolScheduler.ts` | B11 (commandPrefix), B15 (non-interactive) |
| `packages/core/src/confirmation-bus/types.ts` | B10 (always-allow) |
| `packages/core/src/policy/policy-engine.ts` | B10 (always-allow), B11 (commandPrefix) |
| `packages/a2a-server/src/config/config.ts` | B17 (A2A interactive) |
| `packages/a2a-server/src/agent/executor.ts` | B13 (typecasts) |
| `packages/core/src/services/fileSystemService.ts` | B18 (findFiles cleanup) |

---

## Batch Schedule

### Batch 1A — PICK x2 (clean picks) [SPLIT per reviewer]

**Commits:** `68ebf5d6`, `2d3db970`
**Subjects:** typo fix, MCP tool error detection
**Verification:** Quick (lint + typecheck)

**Cherry-pick command:**
```bash
git cherry-pick 68ebf5d655ef94b364e8d97f955d3011423d4221 2d3db9706785ab6b4f699d2e3133f90627d8db65
```

**Notes:** Both assessed CLEAN — should apply without conflicts.

---

### Batch 1B — PICK x3 (needs adaptation) [SPLIT per reviewer]

**Commits:** `22e6af41`, `bb33e281`, `12cbe320`
**Subjects:** error parsing (partial overlap), IDE auth env var (branding), policy fix (tail drift)
**Verification:** Quick (lint + typecheck)

**Cherry-pick command (attempt, expect conflicts):**
```bash
git cherry-pick 22e6af414a9c273052bb07facfdaf0fe7543de4f bb33e281c09cd240f023e4bc5c85aa8df31f4f84 12cbe320e44b236919eead036c5e326c4d167100
```

**Conflict resolution notes:**
- `22e6af41`: googleErrors.ts may have duplicate hunks (partially already applied). googleQuotaErrors.ts diverged — manually merge fallback behavior.
- `bb33e281`: MUST rebrand `GEMINI_CLI_IDE_AUTH_TOKEN` → `LLXPRT_CODE_IDE_AUTH_TOKEN` in source AND tests.
- `12cbe320`: read-only.toml has extra LLxprt-specific entries at tail — manual line insertion if hunk fails.

---

### Batch 2 — REIMPLEMENT: `d4506e0f` transcript_path hooks

**Playbook:** `project-plans/gmerge-0.22.0/d4506e0f-plan.md`
**Verification:** Full (lint + typecheck + test + format + build + smoke)
**Risk:** LOW (~30 LoC)

---

### Batch 3 — REIMPLEMENT: `54de6753` stats display polish

**Playbook:** `project-plans/gmerge-0.22.0/54de6753-plan.md`
**Verification:** Quick (lint + typecheck)
**Risk:** MED (theme divergence)

---

### Batch 4 — REIMPLEMENT: `86134e99` settings validation

**Playbook:** `project-plans/gmerge-0.22.0/86134e99-plan.md`
**Verification:** Full
**Risk:** MED (730+ lines)

---

### Batch 5 — REIMPLEMENT: `299cc9be` A2A /init command

**Playbook:** `project-plans/gmerge-0.22.0/299cc9be-plan.md`
**Verification:** Quick
**Risk:** MED

---

### Batch 6 — REIMPLEMENT: `1e734d7e` multi-file drag/drop

**Playbook:** `project-plans/gmerge-0.22.0/1e734d7e-plan.md`
**Verification:** Full
**Risk:** MED

---

### Batch 7 — REIMPLEMENT: `3b2a4ba2` IDE extension refactor

**Playbook:** `project-plans/gmerge-0.22.0/3b2a4ba2-plan.md`
**Verification:** Quick
**Risk:** MED

---

### Batch 8 — PICK x5 (mid-range PICKs)

**Commits:** `e84c4bfb`, `edbe5480`, `20164ebc`, `d2a1a456`, `d9f94103`
**Subjects:** IDE license, subagent policy, IDE tests, license field, error messages
**Verification:** Full

**Cherry-pick command:**
```bash
git cherry-pick e84c4bfb8189ab9f483c18f6c9e548fa70a6af2f edbe5480ca4f76d749462e428dd609344c266fc9 20164ebcdad4931339195981f7d917bf8a9b6d03 d2a1a45646aed033480e4c5dca251c2ab3517b4a d9f94103cdf37030ee2c15d10fe9388674a5302b
```

**Notes:**
- `20164ebc` — SKIP the `clearcut-logger.test.ts` changes; if cherry-pick includes them, revert those hunks
- `d9f94103` — touches `useGeminiStream.ts` which is renamed in LLxprt; expect conflict

---

### Batch 9 — REIMPLEMENT: `6dea66f1` stats flex removal

**Playbook:** `project-plans/gmerge-0.22.0/6dea66f1-plan.md`
**Verification:** Quick
**Risk:** LOW

---

### Batch 10 — REIMPLEMENT: `5f298c17` always-allow policies WARNING: HIGH RISK

**Playbook:** `project-plans/gmerge-0.22.0/5f298c17-plan.md`
**Verification:** Full
**Risk:** HIGH — must verify zero telemetry, local TOML only

---

### Batch 11 — REIMPLEMENT: `a47af8e2` commandPrefix safety

**Playbook:** `project-plans/gmerge-0.22.0/a47af8e2-plan.md`
**Verification:** Quick
**Risk:** MED (security fix, scheduler divergence)

---

### Batch 12 — REIMPLEMENT: `126c32ac` hook refresh

**Playbook:** `project-plans/gmerge-0.22.0/126c32ac-plan.md`
**Verification:** Full
**Risk:** MED (accept upstream approach + add disposal)

---

### Batch 13 — REIMPLEMENT: `942bcfc6` redundant typecasts

**Playbook:** `project-plans/gmerge-0.22.0/942bcfc6-plan.md`
**Verification:** Quick
**Risk:** LOW (eslint rule + linter)

---

### Batch 14 — PICK x4 (late PICKs)

**Commits:** `ec665ef4`, `bb0c0d8e`, `79f664d5`, `ed4b440b`
**Subjects:** integration test cleanup, method sig simplify, raw token counts, quota error fix
**Verification:** Full

**Cherry-pick command:**
```bash
git cherry-pick ec665ef405c2704fc963a6e600cd64bdf545204f bb0c0d8ee329059b12e7c28860e4cf1aae15487c 79f664d5939ffcf18cda11d7f1c539dadd162974 ed4b440ba00d235fdaf4cd6b31d9bcfd69c5deb1
```

**Notes:**
- `79f664d5` — PARTIAL pick. Skip any `stream-json-formatter` or `ModelStatsDisplay` changes that reference Gemini-specific model stats infrastructure not present in LLxprt. Focus on the raw token count display in `StatsDisplay` and JSON output.
- `ed4b440b` — This is a release cherry-pick wrapper commit; the actual fix is to `googleQuotaErrors.ts`. Should apply cleanly.

---

### Batch 15 — REIMPLEMENT: `217e2b0e` non-interactive confirmation

**Playbook:** `project-plans/gmerge-0.22.0/217e2b0e-plan.md`
**Verification:** Quick
**Risk:** MED (scheduler divergence)

---

### Batch 16 — REIMPLEMENT: `d236df5b` tool output fragmentation WARNING: HIGH RISK

**Playbook:** `project-plans/gmerge-0.22.0/d236df5b-plan.md`
**Verification:** Full
**Risk:** HIGH — confirmed bug in LLxprt; multimodal tool output broken

---

### Batch 17 — REIMPLEMENT: `0c3eb826` A2A interactive

**Playbook:** `project-plans/gmerge-0.22.0/0c3eb826-plan.md`
**Verification:** Quick
**Risk:** LOW

---

### Batch 18 — CLEANUP: Remove dead findFiles

**Description:** Remove `findFiles()` from `FileSystemService` interface and all implementations. Dead code — never called, pathCorrector never adopted.
**Files:** `packages/core/src/services/fileSystemService.ts`, `packages/cli/src/zed-integration/fileSystemService.ts`, `packages/cli/src/zed-integration/fileSystemService.test.ts`, `packages/core/src/services/history/findfiles-circular.test.ts`
**Verification:** Full
**Risk:** LOW

---

## Subagent Orchestration

### Pattern for each batch:

```
Execute (cherrypicker) → Review (reviewer) → PASS? continue : Remediate (cherrypicker) → Review again
Loop remediation up to 5 times, then escalate to human.
```

### Cherrypicker subagent config:
- `subagent_name: "cherrypicker"`
- `tool_whitelist: ["read_file", "run_shell_command", "search_file_content", "glob", "list_directory", "read_many_files", "read_line_range", "write_file", "replace", "insert_at_line", "delete_line_range", "apply_patch"]`

### Reviewer subagent config:
- `subagent_name: "reviewer"`
- `tool_whitelist: ["read_file", "run_shell_command", "search_file_content", "glob", "list_directory", "read_many_files", "read_line_range"]`

### Review requirements (every batch):

**Mechanical:**
- `npm run lint` passes
- `npm run typecheck` passes
- On full-verify batches: `npm run test`, `npm run format`, `npm run build`, smoke test pass

**Qualitative (per commit in batch):**
- Code actually landed (not stubbed, not just imports)
- Behavioral equivalence to upstream intent
- Integration correctness (properly connected, would work at runtime)
- No branding violations (`@google/gemini-cli`, `USE_GEMINI`, `GEMINI_CLI_IDE_AUTH_TOKEN`, ClearcutLogger)

---

## Todo List Management

When starting execution, create this exact todo list:

```
todo_write({ todos: [
  { id: "B1A-exec",   content: "B1A PICK x2 (clean): cherry-pick 68ebf5d6 2d3db970 (typo, MCP errors)", status: "pending" },
  { id: "B1A-review", content: "B1A REVIEW: lint, typecheck, qualitative check", status: "pending" },
  { id: "B1A-commit", content: "B1A COMMIT: stage and commit", status: "pending" },
  { id: "B1B-exec",   content: "B1B PICK x3 (needs adaptation): cherry-pick 22e6af41 bb33e281 12cbe320 (error parsing, IDE auth→LLXPRT_CODE_IDE_AUTH_TOKEN, policy)", status: "pending" },
  { id: "B1B-review", content: "B1B REVIEW: lint, typecheck, verify branding, check conflict resolution", status: "pending" },
  { id: "B1B-commit", content: "B1B COMMIT: stage and commit", status: "pending" },
  { id: "B2-exec",    content: "B2 REIMPLEMENT d4506e0f: transcript_path hooks (~30 LoC) — see d4506e0f-plan.md", status: "pending" },
  { id: "B2-review",  content: "B2 REVIEW: FULL verify (lint+typecheck+test+format+build+smoke) + qualitative", status: "pending" },
  { id: "B2-commit",  content: "B2 COMMIT", status: "pending" },
  { id: "B3-exec",    content: "B3 REIMPLEMENT 54de6753: stats display polish — see 54de6753-plan.md", status: "pending" },
  { id: "B3-review",  content: "B3 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B3-commit",  content: "B3 COMMIT", status: "pending" },
  { id: "B4-exec",    content: "B4 REIMPLEMENT 86134e99: settings validation (730+ lines) — see 86134e99-plan.md", status: "pending" },
  { id: "B4-review",  content: "B4 REVIEW: FULL verify + qualitative", status: "pending" },
  { id: "B4-commit",  content: "B4 COMMIT", status: "pending" },
  { id: "B5-exec",    content: "B5 REIMPLEMENT 299cc9be: A2A /init command — see 299cc9be-plan.md", status: "pending" },
  { id: "B5-review",  content: "B5 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B5-commit",  content: "B5 COMMIT", status: "pending" },
  { id: "B6-exec",    content: "B6 REIMPLEMENT 1e734d7e: multi-file drag/drop — see 1e734d7e-plan.md", status: "pending" },
  { id: "B6-review",  content: "B6 REVIEW: FULL verify + qualitative", status: "pending" },
  { id: "B6-commit",  content: "B6 COMMIT", status: "pending" },
  { id: "B7-exec",    content: "B7 REIMPLEMENT 3b2a4ba2: IDE ext refactor — see 3b2a4ba2-plan.md", status: "pending" },
  { id: "B7-review",  content: "B7 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B7-commit",  content: "B7 COMMIT", status: "pending" },
  { id: "B8-exec",    content: "B8 PICK x5: cherry-pick e84c4bfb edbe5480 20164ebc d2a1a456 d9f94103 (IDE license, subagent policy, IDE tests, license field, error msgs)", status: "pending" },
  { id: "B8-review",  content: "B8 REVIEW: FULL verify + qualitative (skip clearcut test hunks in 20164ebc)", status: "pending" },
  { id: "B8-commit",  content: "B8 COMMIT", status: "pending" },
  { id: "B9-exec",    content: "B9 REIMPLEMENT 6dea66f1: stats flex removal — see 6dea66f1-plan.md", status: "pending" },
  { id: "B9-review",  content: "B9 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B9-commit",  content: "B9 COMMIT", status: "pending" },
  { id: "B10-exec",   content: "B10 REIMPLEMENT 5f298c17: always-allow policies [HIGH RISK] — see 5f298c17-plan.md", status: "pending" },
  { id: "B10-review", content: "B10 REVIEW: FULL verify + qualitative + ZERO TELEMETRY CHECK", status: "pending" },
  { id: "B10-commit", content: "B10 COMMIT", status: "pending" },
  { id: "B11-exec",   content: "B11 REIMPLEMENT a47af8e2: commandPrefix safety — see a47af8e2-plan.md", status: "pending" },
  { id: "B11-review", content: "B11 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B11-commit", content: "B11 COMMIT", status: "pending" },
  { id: "B12-exec",   content: "B12 REIMPLEMENT 126c32ac: hook refresh (remove guards + add disposal) — see 126c32ac-plan.md", status: "pending" },
  { id: "B12-review", content: "B12 REVIEW: FULL verify + qualitative", status: "pending" },
  { id: "B12-commit", content: "B12 COMMIT", status: "pending" },
  { id: "B13-exec",   content: "B13 REIMPLEMENT 942bcfc6: redundant typecasts (eslint rule) — see 942bcfc6-plan.md", status: "pending" },
  { id: "B13-review", content: "B13 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B13-commit", content: "B13 COMMIT", status: "pending" },
  { id: "B14-exec",   content: "B14 PICK x4: cherry-pick ec665ef4 bb0c0d8e 79f664d5 ed4b440b (integration tests, method sig, token counts, quota fix)", status: "pending" },
  { id: "B14-review", content: "B14 REVIEW: FULL verify + qualitative (79f664d5 partial — skip stream-json-formatter)", status: "pending" },
  { id: "B14-commit", content: "B14 COMMIT", status: "pending" },
  { id: "B15-exec",   content: "B15 REIMPLEMENT 217e2b0e: non-interactive confirmation — see 217e2b0e-plan.md", status: "pending" },
  { id: "B15-review", content: "B15 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B15-commit", content: "B15 COMMIT", status: "pending" },
  { id: "B16-exec",   content: "B16 REIMPLEMENT d236df5b: tool output fragmentation [HIGH RISK] — see d236df5b-plan.md", status: "pending" },
  { id: "B16-review", content: "B16 REVIEW: FULL verify + qualitative + MULTIMODAL TEST", status: "pending" },
  { id: "B16-commit", content: "B16 COMMIT", status: "pending" },
  { id: "B17-exec",   content: "B17 REIMPLEMENT 0c3eb826: A2A interactive — see 0c3eb826-plan.md", status: "pending" },
  { id: "B17-review", content: "B17 REVIEW: quick verify + qualitative", status: "pending" },
  { id: "B17-commit", content: "B17 COMMIT", status: "pending" },
  { id: "B18-exec",   content: "B18 CLEANUP: remove dead findFiles from FileSystemService interface", status: "pending" },
  { id: "B18-review", content: "B18 REVIEW: FULL verify + qualitative", status: "pending" },
  { id: "B18-commit", content: "B18 COMMIT", status: "pending" },
  { id: "FINAL-progress", content: "UPDATE PROGRESS.md with all batch commit hashes", status: "pending" },
  { id: "FINAL-notes",    content: "UPDATE NOTES.md with conflicts, deviations, follow-ups", status: "pending" },
  { id: "FINAL-audit",    content: "UPDATE AUDIT.md with all 74 commit outcomes", status: "pending" }
]})
```

---

## Failure Recovery

### Cherry-pick conflict
```bash
git cherry-pick --abort   # Reset to pre-cherry-pick state
# Fix the problematic commit, then retry the batch without it
# Add a fix commit for manual resolution
```

### Review failure → remediation loop
1. Reviewer identifies issues
2. Launch cherrypicker with remediation prompt including the specific failures
3. Re-run reviewer
4. Max 5 iterations, then `todo_pause("Review failed after 5 remediation attempts for batch N")`

### Build/test failure
1. Check if failure is pre-existing: `git stash && npm run test && git stash pop`
2. If pre-existing, document in NOTES.md and continue
3. If caused by batch, fix and add fix commit

---

## Note-Taking Requirements

After each batch:
1. Update `PROGRESS.md` with batch status and LLxprt commit hash
2. Append to `NOTES.md` with conflicts, deviations, decisions
3. Update `AUDIT.md` with commit outcomes

---

## Context Recovery

If you lose context and need to resume:

1. **Branch:** `gmerge/0.22.0`
2. **Range:** upstream `v0.21.3..v0.22.0` (74 commits)
3. **Decisions:** 14 PICK / 46 SKIP / 14 REIMPLEMENT
4. **Key files:**
   - `project-plans/gmerge-0.22.0/PLAN.md` (this file)
   - `project-plans/gmerge-0.22.0/CHERRIES.md` (all decisions)
   - `project-plans/gmerge-0.22.0/PROGRESS.md` (batch status)
   - `project-plans/gmerge-0.22.0/NOTES.md` (running notes)
   - `project-plans/gmerge-0.22.0/AUDIT.md` (reconciliation)
   - `project-plans/gmerge-0.22.0/<sha>-plan.md` (per-REIMPLEMENT playbooks)
   - `dev-docs/cherrypicking.md` (criteria and non-negotiables)
5. **Check todo list** with `todo_read()` to find where you are
6. **Check git state** with `git log --oneline -20` to see what's been applied
