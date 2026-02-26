# Execution Plan: gmerge/0.22.0 (v0.21.3 → v0.22.0)

> **Coordination protocol:** Follow `dev-docs/COORDINATING.md` strictly.
> Each batch = one phase. ONE PHASE = ONE SUBAGENT. VERIFY BEFORE PROCEEDING. NO COMBINING.

---

## START HERE (If you were told to "DO this plan")

### Step 1: Check current state
```bash
git branch --show-current   # Should be gmerge/0.22.0
git status                  # Should be clean (no uncommitted changes)
git log --oneline -5        # See what's already been applied
```
If not on `gmerge/0.22.0`, run `git checkout gmerge/0.22.0`.
If there are uncommitted changes, stash or commit them before proceeding.

### Step 2: Check or create the todo list
Call `todo_read()` first. If empty or doesn't exist, call `todo_write()` with the EXACT todo list from the "Todo List" section below.

### Step 3: Find where to resume
- Look at the todo list for the first `pending` item
- If an item is `in_progress`, restart that item from scratch
- If all items are `completed`, you're done — skip to the "PR Creation" section

### Step 4: Execute sequentially using subagents

Follow `dev-docs/COORDINATING.md`. For each batch:

1. **Phase-skip guard:** Verify this is the NEXT batch in sequence. If current batch index != last completed batch + 1, STOP with `todo_pause("Phase skip detected: expected batch {N}, last completed was {M}")`.
2. **Mark todo `in_progress`**
3. **BN-exec:** Launch `task` with `subagent_name: "cherrypicker"` using the EXACT prompt from the batch section below
4. **Wait for completion**
5. **BN-review:** Launch `task` with `subagent_name: "deepthinker"` using the EXACT prompt from the batch section below
6. **Read deepthinker output.** If PASS → proceed to commit. If FAIL → remediate (see Failure Recovery).
7. **BN-commit:** YOU (the coordinator) run the commit commands from the batch section.
   - For PICK batches: cherry-pick already creates commits. Only run `git add -A && git commit` if you made post-cherry-pick fixes.
   - For REIMPLEMENT/CLEANUP batches: always run `git add -A && git commit -m "<message from batch section>"`.
   - If no changes are unstaged (cherry-pick was clean), mark BN-commit completed without creating an extra commit.
8. **Mark todo `completed`**
9. **Proceed to next batch** — do NOT skip, do NOT combine

### Step 5: If blocked
- Call `todo_pause()` with the specific reason
- Do NOT attempt to work around the issue

---

## Non-Negotiables

Per `dev-docs/cherrypicking.md`:
1. **Multi-provider architecture preserved** — `USE_PROVIDER` not `USE_GEMINI`
2. **Import paths** — `@vybestack/llxprt-code-core` not `@google/gemini-cli-core`
3. **Branding** — LLxprt, not Gemini CLI (applies to imports, user-facing names, env vars, config paths — NOT copyright headers)
4. **Copyright headers preserved** — `Copyright Google LLC` headers stay on Google-sourced files; `Copyright Vybestack LLC` on Vybestack-created files
5. **No ClearcutLogger** — zero Google telemetry
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

**DO NOT CHANGE copyright/license headers.** Files originating from Google retain their `Copyright 20xx Google LLC` and `SPDX-License-Identifier: Apache-2.0` headers. Files created by Vybestack use `Copyright 20xx Vybestack LLC`. Branding substitutions apply ONLY to import paths, user-facing names, env vars, config paths, and auth types — never to copyright/license blocks.

## Subagent Config

**Cherrypicker** (executes changes):
- `subagent_name: "cherrypicker"`
- `tool_whitelist: ["read_file", "run_shell_command", "search_file_content", "glob", "list_directory", "read_many_files", "read_line_range", "write_file", "replace", "insert_at_line", "delete_line_range", "apply_patch"]`

**Deepthinker** (reviews changes — holistic: mechanical + behavioral):
- `subagent_name: "deepthinker"`
- `tool_whitelist: ["read_file", "run_shell_command", "search_file_content", "glob", "list_directory", "read_many_files", "read_line_range"]`

---

## Batch Schedule

---

### Batch 1A — PICK x2 (clean)

**Upstream commits:** `68ebf5d655ef94b364e8d97f955d3011423d4221` (typo fix), `2d3db9706785ab6b4f699d2e3133f90627d8db65` (MCP tool error detection)
**Verification level:** Quick (lint + typecheck)

#### B1A Cherrypicker Prompt
```
CONTEXT: You are executing Batch 1A of the gmerge/0.22.0 cherry-pick sync.
Branch: gmerge/0.22.0. Working directory: /Users/acoliver/projects/llxprt/branch-1/llxprt-code

PREREQUISITE CHECK:
Run: git branch --show-current  # Must be gmerge/0.22.0
Run: git status                 # Must be clean

YOUR TASK:
Cherry-pick these 2 commits (both assessed CLEAN — no conflicts expected):

git cherry-pick 68ebf5d655ef94b364e8d97f955d3011423d4221 2d3db9706785ab6b4f699d2e3133f90627d8db65

After cherry-pick, run quick verification:
npm run lint
npm run typecheck

If cherry-pick fails with conflicts:
1. Run: git cherry-pick --abort
2. Cherry-pick one at a time to isolate the problem
3. Resolve conflicts preserving LLxprt branding (see branding table in PLAN.md)
4. Run: git cherry-pick --continue

DELIVERABLES: Both commits applied cleanly. Lint and typecheck pass.

DO NOT:
- Modify any files beyond what the cherry-pick changes
- Skip ahead to Batch 1B
- Combine with other batches
```

#### B1A Deepthinker Review Prompt
```
CONTEXT: Review Batch 1A of gmerge/0.22.0. Two upstream commits were cherry-picked:
- 68ebf5d6: Fix typo in code comment (nonInteractiveCli.ts)
- 2d3db970: Fix MCP tool error detection (mcp-tool.ts)

MECHANICAL CHECKS:
Run these and report results:
  npm run lint
  npm run typecheck

BEHAVIORAL/CODE REVIEW:
For EACH commit, verify the code actually landed and does what upstream intended:

1. Run: git log --oneline -3
   Verify both commits appear in the log.

2. Run: git show HEAD~1 --stat
   Run: git show HEAD --stat
   Verify each commit touched the expected files.

3. For 68ebf5d6 (typo fix):
   Read the changed file. Confirm the typo is actually fixed, not just an empty commit.

4. For 2d3db970 (MCP tool error detection):
   Read packages/core/src/tools/mcp-tool.ts (or wherever the change landed).
   Compare with: git show 2d3db9706785ab6b4f699d2e3133f90627d8db65
   Verify: the error detection logic matches upstream intent. Is it checking the right error shape?

5. BRANDING CHECK (exclude copyright headers — Google LLC copyright is correct on Google-sourced files):
   Run: grep -rn "@google/gemini-cli\|USE_GEMINI\|GEMINI_CLI_IDE_AUTH_TOKEN\|ClearcutLogger" packages/ --include="*.ts" | grep -v node_modules | grep -v dist | grep -v "Copyright" | head -20
   Report any violations found in the changed files.

OUTPUT FORMAT:
  VERDICT: PASS or FAIL
  MECHANICAL: lint [OK/FAIL], typecheck [OK/FAIL]
  PER-COMMIT:
    68ebf5d6: [LANDED/MISSING] [CORRECT/WRONG] <details>
    2d3db970: [LANDED/MISSING] [CORRECT/WRONG] <details>
  BRANDING: [CLEAN/VIOLATIONS] <details>
  ISSUES: <numbered list if FAIL>
```

#### B1A Commit
Coordinator runs:
```bash
git add -A
git commit -m "cherry-pick: fix typo + MCP tool error detection (upstream 68ebf5d6, 2d3db970)"
```
> Note: Cherry-pick already creates commits. If both applied cleanly, skip git commit — the commits are already there. Only run `git add -A && git commit` if you had to resolve conflicts or make manual fixes after the cherry-pick.

---

### Batch 1B — PICK x3 (needs adaptation)

**Upstream commits:** `22e6af414a9c273052bb07facfdaf0fe7543de4f` (error parsing), `bb33e281c09cd240f023e4bc5c85aa8df31f4f84` (IDE auth env var), `12cbe320e44b236919eead036c5e326c4d167100` (policy codebase_investigator)
**Verification level:** Quick (lint + typecheck)

#### B1B Cherrypicker Prompt
```
CONTEXT: You are executing Batch 1B of gmerge/0.22.0. Branch: gmerge/0.22.0.
PREREQUISITE: Batch 1A must be complete. Run: git log --oneline -3 to verify.

YOUR TASK:
Cherry-pick these 3 commits (EXPECT CONFLICTS — these need adaptation):

git cherry-pick 22e6af414a9c273052bb07facfdaf0fe7543de4f

If conflicts on 22e6af41:
- googleErrors.ts: Some hunks may be already applied (partial overlap from prior sync). Accept the already-applied version for those hunks. For new hunks, apply them.
- googleQuotaErrors.ts: This file has diverged. Manually merge the new fallback error parsing behavior. Preserve LLxprt's existing structure.
After resolving: git cherry-pick --continue

git cherry-pick bb33e281c09cd240f023e4bc5c85aa8df31f4f84

If conflicts on bb33e281:
- CRITICAL BRANDING: Replace ALL occurrences of GEMINI_CLI_IDE_AUTH_TOKEN with LLXPRT_CODE_IDE_AUTH_TOKEN — in source AND tests.
After resolving: git cherry-pick --continue

git cherry-pick 12cbe320e44b236919eead036c5e326c4d167100

If conflicts on 12cbe320:
- read-only.toml: LLxprt has extra entries at the tail. If the hunk fails, manually add the codebase_investigator allow line at the correct location in the policy file.
After resolving: git cherry-pick --continue

After all 3, run:
  npm run lint
  npm run typecheck

DELIVERABLES: All 3 commits applied (with adaptations). Lint and typecheck pass.

DO NOT: Skip ahead. Combine with other batches. Remove LLxprt-specific policy entries.
```

#### B1B Deepthinker Review Prompt
```
CONTEXT: Review Batch 1B of gmerge/0.22.0. Three upstream commits cherry-picked with expected conflicts:
- 22e6af41: Attempt more error parsing (googleErrors.ts, googleQuotaErrors.ts)
- bb33e281: IDE extension auth token env var (ide-server.ts)
- 12cbe320: Policy allow codebase_investigator (read-only.toml)

MECHANICAL CHECKS:
  npm run lint
  npm run typecheck

BEHAVIORAL/CODE REVIEW:

1. For 22e6af41 (error parsing):
   Read the affected files (search for googleErrors.ts, googleQuotaErrors.ts).
   Compare with upstream: git show 22e6af414a9c273052bb07facfdaf0fe7543de4f
   Verify: New error parsing logic is present. Fallback behavior works.
   Check: No duplicate code from partial prior application.

2. For bb33e281 (IDE auth env var):
   CRITICAL: Search for GEMINI_CLI_IDE_AUTH_TOKEN in the entire codebase:
     grep -rn "GEMINI_CLI_IDE_AUTH_TOKEN" packages/ --include="*.ts" | grep -v node_modules | grep -v dist
   Must return ZERO results. All must be LLXPRT_CODE_IDE_AUTH_TOKEN.
   Read the changed file to verify the auth token logic works correctly.

3. For 12cbe320 (policy codebase_investigator):
   Read the policy TOML file. Verify codebase_investigator is allowed in read-only mode.
   Verify no LLxprt-specific policy entries were accidentally removed.

4. Full branding sweep on changed files (exclude copyright headers — Google LLC copyright is correct):
   git diff HEAD~3..HEAD --name-only | xargs grep -n "@google/gemini-cli\|USE_GEMINI\|ClearcutLogger" 2>/dev/null | grep -v "Copyright"

OUTPUT FORMAT:
  VERDICT: PASS or FAIL
  MECHANICAL: lint [OK/FAIL], typecheck [OK/FAIL]
  PER-COMMIT:
    22e6af41: [LANDED/MISSING] [CORRECT/WRONG] <details>
    bb33e281: [LANDED/MISSING] [CORRECT/WRONG] <branding check result>
    12cbe320: [LANDED/MISSING] [CORRECT/WRONG] <details>
  BRANDING: [CLEAN/VIOLATIONS]
  ISSUES: <numbered list if FAIL>
```

#### B1B Commit
If cherry-picks created individual commits (no conflicts), they're already committed. If you had to resolve conflicts, the cherry-pick --continue created the commit. Only create a separate fix commit if you made post-cherry-pick fixes:
```bash
git add -A
git commit -m "fix: resolve conflicts from batch 1B cherry-picks (branding, error parsing overlap)"
```

---

### REIMPLEMENT Batch Template

Batches 2-7, 9-13, 15-17 all follow this pattern. Per-batch specifics are listed below.

#### REIMPLEMENT Cherrypicker Prompt Template
```
CONTEXT: You are executing Batch {N} of gmerge/0.22.0. Branch: gmerge/0.22.0.
PREREQUISITE: Batch {N-1} must be complete.
Run: git log --oneline -3 to verify recent commits.
Run: git status   # Must be clean (no uncommitted changes).
If previous batch is NOT committed, STOP and return ERROR: "Batch {N-1} not complete".

YOUR TASK:
Read and execute the reimplementation plan at:
  project-plans/gmerge-0.22.0/{SHA}-plan.md

Follow the plan's RED→GREEN→REFACTOR sequence:
1. Read the entire plan first
2. Write the failing tests (RED phase)
3. Run the tests to confirm they fail
4. Write the minimal production code (GREEN phase)
5. Run all tests to confirm they pass
6. Refactor only if the plan says to

IMPORTANT:
- Line numbers in the plan are APPROXIMATE. Use grep/symbol search to find edit points.
- Use the plan's code as guidance, not copy-paste — verify against current file contents.
- If a file doesn't match the plan's expectations, adapt intelligently.
{EXTRA_NOTES}

After completing all changes, run verification:
{VERIFY_COMMANDS}

DELIVERABLES: All changes from the plan implemented. Tests pass. Verification passes.

DO NOT:
- Skip the RED phase (tests first)
- Skip ahead to the next batch
- Make changes beyond this plan's scope
- Leave uncommitted changes in unrelated files
```

#### REIMPLEMENT Deepthinker Review Prompt Template
```
CONTEXT: Review Batch {N} of gmerge/0.22.0.
Reimplementation of upstream commit {SHA}: {SUBJECT}
Plan file: project-plans/gmerge-0.22.0/{SHA}-plan.md

PART 1 — MECHANICAL CHECKS:
{VERIFY_COMMANDS_WITH_REPORT}

PART 2 — BEHAVIORAL/CODE REVIEW:

Read the reimplementation plan:
  cat project-plans/gmerge-0.22.0/{SHA}-plan.md | head -100

Read the upstream diff to understand INTENT:
  git show {FULL_SHA}

Now examine what was ACTUALLY implemented:
  git diff HEAD~1 --stat
  git diff HEAD~1

For EACH requirement in the plan (R1, R2, R3...):
  a) Was it implemented? (not stubbed, not just imports)
  b) Does it achieve the intended BEHAVIOR from upstream?
  c) Is it properly integrated? (connected to callers, would work at runtime)
  d) Are tests present and behavioral (not testing implementation details)?

BRANDING CHECK:
  git diff HEAD~1 --name-only | xargs grep -n "@google/gemini-cli\|USE_GEMINI\|GEMINI_CLI_IDE_AUTH_TOKEN\|ClearcutLogger" 2>/dev/null | grep -v "Copyright"
  Must return empty. (Copyright headers with "Google LLC" are correct and must NOT be changed.)
{EXTRA_REVIEW_CHECKS}

OUTPUT FORMAT:
  VERDICT: PASS or FAIL
  MECHANICAL: lint [OK/FAIL], typecheck [OK/FAIL]{EXTRA_MECHANICAL}
  PER-REQUIREMENT:
    R1: [DONE/MISSING/PARTIAL] [BEHAVIORAL/STUBBED] <details>
    R2: [DONE/MISSING/PARTIAL] [BEHAVIORAL/STUBBED] <details>
    ...
  INTEGRATION: [CONNECTED/DISCONNECTED] <is it wired up and would work at runtime?>
  TESTS: [PRESENT/MISSING] [BEHAVIORAL/IMPLEMENTATION-COUPLED] <details>
  BRANDING: [CLEAN/VIOLATIONS]
  ISSUES: <numbered list if FAIL>
```

---

### Batch 2 — REIMPLEMENT: `d4506e0f` transcript_path hooks

**Plan:** `project-plans/gmerge-0.22.0/d4506e0f-plan.md`
**Verification:** Full | **Risk:** LOW
**Upstream SHA:** `d4506e0f`
**Subject:** Expose transcript_path to hooks via SessionRecordingService

**Cherrypicker prompt:** Use REIMPLEMENT template with:
- `{N}` = 2, `{N-1}` = 1B
- `{SHA}` = `d4506e0f`
- `{EXTRA_NOTES}` = `LLxprt uses SessionRecordingService (JSONL format), not upstream's transcript system. The plan adds a getter on Config and passes the path to hookEventHandler.buildBaseInput().`
- `{VERIFY_COMMANDS}` = `npm run lint && npm run typecheck && npm run test && npm run format && npm run build`

**Deepthinker prompt:** Use REIMPLEMENT review template with:
- `{FULL_SHA}` = `d4506e0f`
- `{SUBJECT}` = `Expose transcript_path to hooks`
- `{VERIFY_COMMANDS_WITH_REPORT}` = `npm run lint` / `npm run typecheck` / `npm run test` / `npm run format` / `npm run build`
- `{EXTRA_MECHANICAL}` = `, test [OK/FAIL], format [OK/FAIL], build [OK/FAIL]`
- `{EXTRA_REVIEW_CHECKS}` = (none)

**Commit message:** `reimplement: expose transcript_path to hooks via SessionRecordingService (upstream d4506e0f)`

---

### Batch 3 — REIMPLEMENT: `54de6753` stats display polish

**Plan:** `project-plans/gmerge-0.22.0/54de6753-plan.md`
**Verification:** Quick | **Risk:** MED
**Upstream SHA:** `54de6753`
**Subject:** Stats display polish (labels, colors, uncached math)

**Cherrypicker:** REIMPLEMENT template with `{N}=3`, `{SHA}=54de6753`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `Theme system differs between LLxprt and upstream. Use LLxprt's existing color/theme patterns, not upstream's exact color values. Update snapshots with: npm test -- --update-snapshots`

**Deepthinker:** REIMPLEMENT review template. Quick verify (lint+typecheck only). `{EXTRA_REVIEW_CHECKS}=Also verify snapshot tests were updated (not just deleted).`

**Commit:** `reimplement: stats display polish — labels, colors, uncached math (upstream 54de6753)`

---

### Batch 4 — REIMPLEMENT: `86134e99` settings validation

**Plan:** `project-plans/gmerge-0.22.0/86134e99-plan.md`
**Verification:** Full | **Risk:** MED (730+ lines)
**Upstream SHA:** `86134e99`
**Subject:** Zod-based settings validation

**Cherrypicker:** REIMPLEMENT template with `{N}=4`, `{SHA}=86134e99`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck && npm run test && npm run format && npm run build`
**Extra notes:** `RULES.md mandates schema-first with Zod. LLxprt has extra settings keys (sandbox, lsp, emojifilter, subagents, security, extensions, hooks) that upstream doesn't have — the schema must include these. Check if zod is already a dependency: grep zod packages/core/package.json`

**Deepthinker:** REIMPLEMENT review template. Full verify. `{EXTRA_REVIEW_CHECKS}=Verify ALL LLxprt-specific settings keys are covered in the Zod schema — search settingsSchema.ts for sandbox, lsp, fileFiltering, subagents.`

**Commit:** `reimplement: Zod-based settings validation with LLxprt-specific keys (upstream 86134e99)`

---

### Batch 5 — REIMPLEMENT: `299cc9be` A2A /init command

**Plan:** `project-plans/gmerge-0.22.0/299cc9be-plan.md`
**Verification:** Quick | **Risk:** MED
**Upstream SHA:** `299cc9be`
**Subject:** A2A /init command support

**Cherrypicker:** REIMPLEMENT template with `{N}=5`, `{SHA}=299cc9be`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `A2A server is PRIVATE — do not make publishable. GEMINI.md must be LLXPRT.md everywhere.`

**Deepthinker:** REIMPLEMENT review template. Quick verify. `{EXTRA_REVIEW_CHECKS}=grep -rn "GEMINI.md" packages/a2a-server/ must return zero. Verify A2A package.json is NOT set to publishable.`

**Commit:** `reimplement: A2A /init command with LLXPRT.md branding (upstream 299cc9be)`

---

### Batch 6 — REIMPLEMENT: `1e734d7e` multi-file drag/drop

**Plan:** `project-plans/gmerge-0.22.0/1e734d7e-plan.md`
**Verification:** Full | **Risk:** MED
**Upstream SHA:** `1e734d7e`
**Subject:** Multi-file drag/drop image support

**Cherrypicker:** REIMPLEMENT template with `{N}=6`, `{SHA}=1e734d7e`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck && npm run test && npm run format && npm run build`
**Extra notes:** `clipboardUtils and text-buffer structure differs from upstream. Verify parsePastedPaths handles: spaces in paths (backslash-escaped), multiple paths, quoted paths, mixed text+paths.`

**Deepthinker:** REIMPLEMENT review template. Full verify. `{EXTRA_REVIEW_CHECKS}=Test edge cases: what happens with empty input, single path, paths with spaces, Windows-style paths?`

**Commit:** `reimplement: multi-file drag/drop with escaped path parsing (upstream 1e734d7e)`

---

### Batch 7 — REIMPLEMENT: `3b2a4ba2` IDE extension refactor

**Plan:** `project-plans/gmerge-0.22.0/3b2a4ba2-plan.md`
**Verification:** Quick | **Risk:** MED
**Upstream SHA:** `3b2a4ba2`
**Subject:** IDE extension refactor (port file, 1-based indexing, truncation)

**Cherrypicker:** REIMPLEMENT template with `{N}=7`, `{SHA}=3b2a4ba2`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `Check packages/vscode-ide-companion/ (NOT "vscode-companion"). Verify port file path changes and 1-based character indexing are consistent with LLxprt's IDE integration.`

**Deepthinker:** REIMPLEMENT review template. Quick verify. `{EXTRA_REVIEW_CHECKS}=Verify all downstream code that reads port files still works with the new location.`

**Commit:** `reimplement: IDE extension refactor — port file, 1-based indexing (upstream 3b2a4ba2)`

---

### Batch 8 — PICK x5 (mid-range)

**Upstream commits:**
- `e84c4bfb` — IDE license generation (NOTICES.txt)
- `edbe5480` — Subagent policy fix (read-only.toml)
- `20164ebc` — IDE detection tests (detect-ide.test.ts) WARNING: SKIP clearcut-logger.test.ts hunks
- `d2a1a456` — License field in package.json
- `d9f94103` — Error message clarity WARNING: useGeminiStream.ts may be renamed

**Verification:** Full

#### B8 Cherrypicker Prompt
```
CONTEXT: Batch 8 of gmerge/0.22.0. Branch: gmerge/0.22.0.
PREREQUISITE: Batch 7 complete. Run: git log --oneline -5

YOUR TASK:
Cherry-pick these 5 commits one at a time (some need special handling):

1. git cherry-pick e84c4bfb8189ab9f483c18f6c9e548fa70a6af2f
   # IDE license — should be clean

2. git cherry-pick edbe5480ca4f76d749462e428dd609344c266fc9
   # Subagent policy — should be clean

3. git cherry-pick 20164ebcdad4931339195981f7d917bf8a9b6d03
   # IDE detection tests — WARNING: if this includes clearcut-logger.test.ts changes, REVERT THOSE HUNKS.
   # ClearcutLogger is completely removed from LLxprt. Do not add any clearcut test code.
   # After cherry-pick, check: git diff HEAD --name-only | grep clearcut
   # If clearcut files appear, revert them: git checkout HEAD -- <clearcut-files>

4. git cherry-pick d2a1a45646aed033480e4c5dca251c2ab3517b4a
   # License field — should be clean

5. git cherry-pick d9f94103cdf37030ee2c15d10fe9388674a5302b
   # Error messages — may conflict on useGeminiStream.ts (renamed in LLxprt).
   # Search for the equivalent file: grep -rn "useGeminiStream\|useLlxprtStream\|useModelStream" packages/cli/src --include="*.ts" -l
   # Apply the error message improvements to the correct LLxprt file.

After all 5, run full verification:
  npm run lint && npm run typecheck && npm run test && npm run format && npm run build

DELIVERABLES: All 5 commits applied. No clearcut code. Full verify passes.
DO NOT: Add ClearcutLogger code. Skip ahead.
```

#### B8 Deepthinker Review Prompt
```
CONTEXT: Review Batch 8 of gmerge/0.22.0. Five upstream commits cherry-picked.

MECHANICAL CHECKS:
  npm run lint
  npm run typecheck
  npm run test
  npm run format --check 2>/dev/null || npm run format
  npm run build

BEHAVIORAL/CODE REVIEW:

1. e84c4bfb (IDE license): Verify NOTICES.txt exists and looks reasonable.
2. edbe5480 (subagent policy): Read the TOML file, verify policy is correctly applied.
3. 20164ebc (IDE detection tests): CRITICAL — verify NO clearcut-logger test code was added:
     grep -rn "clearcut\|ClearcutLogger" packages/ --include="*.test.*" | grep -v node_modules | grep -v dist
   Must return zero results in newly added/changed test files.
4. d2a1a456 (license field): Check package.json files have correct license field.
5. d9f94103 (error messages): Read the error message changes. Verify they landed in the correct LLxprt file (not a ghost useGeminiStream.ts).

BRANDING CHECK (exclude copyright headers — Google LLC copyright is correct on Google-sourced files):
  git diff HEAD~5..HEAD --name-only | xargs grep -n "@google/gemini-cli\|GEMINI_CLI_IDE_AUTH_TOKEN\|ClearcutLogger" 2>/dev/null | grep -v "Copyright"

OUTPUT FORMAT:
  VERDICT: PASS or FAIL
  MECHANICAL: lint/typecheck/test/format/build [OK/FAIL each]
  PER-COMMIT: [LANDED/MISSING] [CORRECT/WRONG] per commit
  CLEARCUT CHECK: [CLEAN/CONTAMINATED]
  BRANDING: [CLEAN/VIOLATIONS]
  ISSUES: <numbered list if FAIL>
```

**Commit:** Cherry-picks create their own commits. If fixes were needed:
```bash
git add -A
git commit -m "fix: batch 8 cherry-pick adaptations (skip clearcut, remap stream file)"
```

---

### Batch 9 — REIMPLEMENT: `6dea66f1` stats flex removal

**Plan:** `project-plans/gmerge-0.22.0/6dea66f1-plan.md`
**Verification:** Quick | **Risk:** LOW
**Upstream SHA:** `6dea66f1`

**Cherrypicker:** REIMPLEMENT template with `{N}=9`, `{SHA}=6dea66f1`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `Snapshot-driven UI change. Update snapshots: npm test -- --update-snapshots. Verify ALL snapshot files are updated (check both .tsx.snap and .test.js.snap variants).`

**Deepthinker:** Quick verify. `{EXTRA_REVIEW_CHECKS}=Confirm no other width="100%" or flexGrow layout constraints in StatsDisplay-family files were missed.`

**Commit:** `reimplement: stats flex removal for cleaner layout (upstream 6dea66f1)`

---

### Batch 10 — REIMPLEMENT: `5f298c17` always-allow policies WARNING: HIGH RISK

**Plan:** `project-plans/gmerge-0.22.0/5f298c17-plan.md`
**Verification:** Full | **Risk:** HIGH
**Upstream SHA:** `5f298c17`
**Subject:** Persistent always-allow policies (local TOML, zero telemetry)

**Cherrypicker:** REIMPLEMENT template with `{N}=10`, `{SHA}=5f298c17`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck && npm run test && npm run format && npm run build`
**Extra notes:** `HIGH RISK. CRITICAL REQUIREMENTS: (1) ZERO Google telemetry — all storage is local TOML at ~/.llxprt/policies/auto-saved.toml. (2) Skip smart-edit.ts entirely (removed from LLxprt). (3) Use LLxprt tool names (run_shell_command, not shell). (4) Security: consider adding denylist for dangerous shell prefix persistence (rm, sudo, curl|sh). Plan is 2234 lines — read it fully before starting.`

**Deepthinker:** Full verify. Extra checks:
```
{EXTRA_REVIEW_CHECKS}=
ZERO TELEMETRY AUDIT (CRITICAL):
  grep -rn "ClearcutLogger\|clearcut\|telemetry.*google\|analytics.*google" packages/ --include="*.ts" | grep -v node_modules | grep -v dist | grep -v test
  Must return ZERO results.

STORAGE PATH AUDIT:
  grep -rn "auto-saved.toml\|policies/" packages/ --include="*.ts" | grep -v node_modules | grep -v dist
  Verify all paths are under ~/.llxprt/ (NOT ~/.gemini/ or any Google path).

SMART-EDIT CHECK:
  grep -rn "smart.edit\|smartEdit\|smart_edit" packages/ --include="*.ts" | grep -v node_modules | grep -v dist
  Must return ZERO new results from this batch.

SECURITY REVIEW:
  Can a user persist "always allow" for: rm -rf, sudo, curl|sh?
  If yes, is there adequate warning/guardrail?
```

**Commit:** `reimplement: persistent always-allow policies — local TOML, zero telemetry (upstream 5f298c17)`

---

### Batch 11 — REIMPLEMENT: `a47af8e2` commandPrefix safety WARNING: SECURITY

**Plan:** `project-plans/gmerge-0.22.0/a47af8e2-plan.md`
**Verification:** Quick | **Risk:** MED (security fix)
**Upstream SHA:** `a47af8e2`
**Subject:** Word boundary fix + compound command validation

**Cherrypicker:** REIMPLEMENT template with `{N}=11`, `{SHA}=a47af8e2`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `SECURITY FIX. Key behaviors: (1) "git log" must NOT match "git logout" (word boundary). (2) Compound commands (cmd1 && cmd2, cmd1 | cmd2, cmd1 ; cmd2) must evaluate EACH part. (3) Add explicit test for rm vs rmdir prefix confusion (deepthinker review flagged this gap).`

**Deepthinker:** Quick verify. Extra checks:
```
{EXTRA_REVIEW_CHECKS}=
SECURITY VERIFICATION:
  Read the new/changed test file. Verify these specific cases are tested:
  1. "git log" allowed but "git logout" requires confirmation (word boundary)
  2. "git log && rm -rf /" requires evaluation of BOTH parts
  3. "rm" allowed does NOT match "rmdir" (prefix confusion)
  4. Compound separators: &&, ||, ;, | all handled
  5. Parse failure → ASK_USER (fail-safe, not fail-open)
```

**Commit:** `reimplement: commandPrefix word boundary + compound command safety (upstream a47af8e2)`

---

### Batch 12 — REIMPLEMENT: `126c32ac` hook refresh

**Plan:** `project-plans/gmerge-0.22.0/126c32ac-plan.md`
**Verification:** Full | **Risk:** MED
**Upstream SHA:** `126c32ac`
**Subject:** Remove initialization guards, enable re-init, add HookEventHandler disposal

**Cherrypicker:** REIMPLEMENT template with `{N}=12`, `{SHA}=126c32ac`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck && npm run test && npm run format && npm run build`
**Extra notes:** `Accept upstream approach (remove guards) but ADD disposal of old HookEventHandler before re-init (upstream forgot this — it's a memory leak fix). Verify dispose() doesn't have unexpected side effects beyond event handler teardown.`

**Deepthinker:** Full verify. `{EXTRA_REVIEW_CHECKS}=Verify: (1) Old HookEventHandler is disposed before creating new one on re-init. (2) No event subscription leaks. (3) Extension loader calls re-init when extensions change.`

**Commit:** `reimplement: hook refresh with disposal — remove guards, fix memory leak (upstream 126c32ac)`

---

### Batch 13 — REIMPLEMENT: `942bcfc6` redundant typecasts

**Plan:** `project-plans/gmerge-0.22.0/942bcfc6-plan.md`
**Verification:** Quick | **Risk:** LOW
**Upstream SHA:** `942bcfc6`
**Subject:** Add @typescript-eslint/no-unnecessary-type-assertion rule + fix violations

**Cherrypicker:** REIMPLEMENT template with `{N}=13`, `{SHA}=942bcfc6`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `DETERMINISTIC approach: (1) Add the eslint rule to ALL eslint configs (check root + packages/ui + packages/lsp + packages/vscode-ide-companion). (2) Run eslint --fix on reported violations. (3) Manually review any remaining violations (some may be legitimate). (4) Do NOT remove time estimates from the plan — just ignore them.`

**Deepthinker:** Quick verify. `{EXTRA_REVIEW_CHECKS}=Verify the eslint rule was added to ALL config files, not just root. Run: find . -name "eslint.config.*" -not -path "*/node_modules/*" | head -10`

**Commit:** `reimplement: add no-unnecessary-type-assertion eslint rule + fix violations (upstream 942bcfc6)`

---

### Batch 14 — PICK x4 (late)

**Upstream commits:**
- `ec665ef4` — Integration test process cleanup
- `bb0c0d8e` — Simplify integration test method signature
- `79f664d5` — Raw token counts in JSON output WARNING: PARTIAL PICK
- `ed4b440b` — Quota error fix (release cherry-pick wrapper)

**Verification:** Full

#### B14 Cherrypicker Prompt
```
CONTEXT: Batch 14 of gmerge/0.22.0. Branch: gmerge/0.22.0.
PREREQUISITE: Batch 13 complete.

YOUR TASK:
Cherry-pick these 4 commits:

1. git cherry-pick ec665ef405c2704fc963a6e600cd64bdf545204f
   # Integration test cleanup — should be clean

2. git cherry-pick bb0c0d8ee329059b12e7c28860e4cf1aae15487c
   # Method sig simplify — should be clean

3. git cherry-pick 79f664d5939ffcf18cda11d7f1c539dadd162974
   # PARTIAL PICK. This commit adds raw token counts but ALSO touches:
   #   - stream-json-formatter (doesn't exist in LLxprt — skip those changes)
   #   - ModelStatsDisplay with Gemini-specific model stats infra (skip if references unavailable types)
   # Focus on: StatsDisplay changes for raw token count display, JSON output changes.
   # If cherry-pick conflicts, resolve by keeping only the applicable hunks.
   # After resolving: verify no references to missing types/imports remain.

4. git cherry-pick ed4b440ba00d235fdaf4cd6b31d9bcfd69c5deb1
   # Quota error fix — this is a release cherry-pick wrapper. Actual fix is in googleQuotaErrors.ts.
   # Should apply cleanly.

After all 4:
  npm run lint && npm run typecheck && npm run test && npm run format && npm run build

DELIVERABLES: All 4 applied (79f664d5 partial). Full verify passes.
DO NOT: Include stream-json-formatter code. Add references to non-existent Gemini model stats types.
```

#### B14 Deepthinker Review Prompt
```
CONTEXT: Review Batch 14. Four upstream commits, one partial.

MECHANICAL: npm run lint/typecheck/test/format/build (report each)

BEHAVIORAL/CODE REVIEW:
1. ec665ef4: Process cleanup in integration tests. Verify test files were updated.
2. bb0c0d8e: Method signature simplification. Verify the simplification is correct.
3. 79f664d5 (PARTIAL): CRITICAL — verify:
   a) Raw token count display IS present in StatsDisplay
   b) NO references to stream-json-formatter (doesn't exist in LLxprt)
   c) NO references to Gemini-specific model stats types that don't exist
   d) Run: grep -rn "stream-json-formatter\|StreamJsonFormatter" packages/ --include="*.ts" | grep -v node_modules
      Must return ZERO results.
4. ed4b440b: Quota error fix in googleQuotaErrors.ts. Read the fix, verify it's correct.

BRANDING + INTEGRATION check on all changed files.

OUTPUT FORMAT: VERDICT + per-commit assessment + issues
```

**Commit:** Cherry-picks create commits. Fix commit if needed:
```bash
git add -A
git commit -m "fix: batch 14 — partial pick of 79f664d5 (skip stream-json-formatter)"
```

---

### Batch 15 — REIMPLEMENT: `217e2b0e` non-interactive confirmation

**Plan:** `project-plans/gmerge-0.22.0/217e2b0e-plan.md`
**Verification:** Quick | **Risk:** MED
**Upstream SHA:** `217e2b0e`
**Subject:** Error on confirmation-requiring tools in non-interactive mode

**Cherrypicker:** REIMPLEMENT template with `{N}=15`, `{SHA}=217e2b0e`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `LLxprt's coreToolScheduler has PARALLEL batching (diverges from upstream's sequential). The non-interactive check must work correctly when multiple tools execute in parallel — one tool erroring should not prevent other tools in the batch from completing. Also test YOLO mode and allowed-tools bypass.`

**Deepthinker:** Quick verify. `{EXTRA_REVIEW_CHECKS}=Verify: (1) non-interactive mode correctly errors on confirmation-requiring tools. (2) YOLO mode bypasses the check. (3) Parallel batch: one tool error doesn't crash the batch.`

**Commit:** `reimplement: non-interactive auto-confirmation with parallel batch safety (upstream 217e2b0e)`

---

### Batch 16 — REIMPLEMENT: `d236df5b` tool output fragmentation WARNING: HIGH RISK

**Plan:** `project-plans/gmerge-0.22.0/d236df5b-plan.md`
**Verification:** Full | **Risk:** HIGH (confirmed bug in LLxprt)
**Upstream SHA:** `d236df5b`
**Subject:** Fix multimodal tool output sent as separate sibling parts instead of encapsulated

**Cherrypicker:** REIMPLEMENT template with `{N}=16`, `{SHA}=d236df5b`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck && npm run test && npm run format && npm run build`
**Extra notes:** `CONFIRMED BUG in LLxprt. The fix is in convertToFunctionResponse() in coreToolScheduler.ts. CRITICAL: fix must be PROVIDER-AGNOSTIC (work for ALL providers, not just Google). The Gemini 3 detection uses model.startsWith('gemini-3-') — non-Gemini models should safely get the default (sibling) behavior. Use grep to find convertToFunctionResponse, do NOT rely on plan's line numbers.`

**Deepthinker:** Full verify. Extra checks:
```
{EXTRA_REVIEW_CHECKS}=
BUG FIX VERIFICATION:
  Find convertToFunctionResponse in coreToolScheduler.ts.
  Verify multimodal content (text + image) is now properly encapsulated in functionResponse, not sent as separate sibling parts.

PROVIDER-AGNOSTIC CHECK:
  Verify the fix works for ALL providers:
  - Gemini 3: new nested behavior
  - Gemini 2: backward-compatible sibling behavior
  - Claude/GPT/other: safe default behavior (should not break)

EDGE CASES:
  Check test coverage for: text-only, image-only, mixed text+image, empty output, single-part output.

TYPE SAFETY:
  Verify no unsafe casts were added. Check the functionResponse type includes the new structure.
```

**Commit:** `reimplement: fix tool output fragmentation — provider-agnostic multimodal encapsulation (upstream d236df5b)`

---

### Batch 17 — REIMPLEMENT: `0c3eb826` A2A interactive

**Plan:** `project-plans/gmerge-0.22.0/0c3eb826-plan.md`
**Verification:** Quick | **Risk:** LOW
**Upstream SHA:** `0c3eb826`
**Subject:** Pass interactive=true in A2A config

**Cherrypicker:** REIMPLEMENT template with `{N}=17`, `{SHA}=0c3eb826`, `{VERIFY_COMMANDS}=npm run lint && npm run typecheck`
**Extra notes:** `Small change — add interactive: true to A2A config construction. A2A stays PRIVATE. Do NOT use vi.spyOn(globalThis, 'Config') in tests — use behavioral tests on the returned config (isInteractive() should return true).`

**Deepthinker:** Quick verify. `{EXTRA_REVIEW_CHECKS}=Verify A2A package.json is NOT publishable. Verify isInteractive() returns true for A2A configs.`

**Commit:** `reimplement: A2A interactive mode config (upstream 0c3eb826)`

---

### Batch 18 — CLEANUP: Remove dead findFiles

**No upstream SHA.** This is LLxprt-only cleanup.
**Verification:** Full | **Risk:** LOW

#### B18 Cherrypicker Prompt
```
CONTEXT: Batch 18 of gmerge/0.22.0 — cleanup task (no upstream commit).
PREREQUISITE: Batch 17 complete.

YOUR TASK:
Remove the dead findFiles() method from the codebase. It is never called — pathCorrector was never adopted in LLxprt.

Files to modify:
1. packages/core/src/services/fileSystemService.ts
   - Remove findFiles from the FileSystemService interface (line with: findFiles(fileName: string, searchPaths: readonly string[]): string[])
   - Remove findFiles implementation from StandardFileSystemService class
   - Remove the globSync import if it becomes unused

2. packages/cli/src/zed-integration/fileSystemService.ts
   - Remove findFiles delegation method

3. packages/cli/src/zed-integration/fileSystemService.test.ts
   - Remove findFiles test (the "should always use fallback for findFiles" test)

4. packages/core/src/services/history/findfiles-circular.test.ts
   - DELETE this entire file (it only tests findFiles)

After changes:
  npm run lint && npm run typecheck && npm run test && npm run format && npm run build

Verify no remaining references:
  grep -rn "findFiles" packages/ --include="*.ts" | grep -v node_modules | grep -v dist

DELIVERABLES: findFiles removed. No remaining references. Full verify passes.
DO NOT: Remove any other methods from FileSystemService. Modify unrelated files.
```

#### B18 Deepthinker Review Prompt
```
CONTEXT: Review Batch 18 — cleanup of dead findFiles() code.

MECHANICAL: npm run lint/typecheck/test/format/build (report each)

BEHAVIORAL/CODE REVIEW:
1. Verify findFiles is completely removed:
   grep -rn "findFiles" packages/ --include="*.ts" | grep -v node_modules | grep -v dist
   Must return ZERO results.

2. Verify globSync import was cleaned up if unused:
   grep -rn "globSync" packages/core/src/services/fileSystemService.ts

3. Verify findfiles-circular.test.ts was deleted:
   ls packages/core/src/services/history/findfiles-circular.test.ts 2>/dev/null && echo "STILL EXISTS" || echo "DELETED"

4. Verify no other methods were accidentally removed from FileSystemService:
   Read packages/core/src/services/fileSystemService.ts — readTextFile and writeTextFile must still exist.

OUTPUT FORMAT: VERDICT + checks + issues
```

**Commit:**
```bash
git add -A
git commit -m "cleanup: remove dead findFiles from FileSystemService (pathCorrector never adopted)"
```

---

## Todo List

When starting execution, create this EXACT todo list:

```
todo_write({ todos: [
  { id: "B1A-exec",   content: "B1A EXECUTE: cherry-pick 68ebf5d6 2d3db970 (subagent: cherrypicker)", status: "pending" },
  { id: "B1A-review", content: "B1A REVIEW: quick verify + holistic code review (subagent: deepthinker)", status: "pending" },
  { id: "B1A-commit", content: "B1A COMMIT: coordinator runs git add/commit", status: "pending" },
  { id: "B1B-exec",   content: "B1B EXECUTE: cherry-pick 22e6af41 bb33e281 12cbe320 with branding fixes (subagent: cherrypicker)", status: "pending" },
  { id: "B1B-review", content: "B1B REVIEW: quick verify + branding audit (subagent: deepthinker)", status: "pending" },
  { id: "B1B-commit", content: "B1B COMMIT: coordinator runs git add/commit if fixes needed", status: "pending" },
  { id: "B2-exec",    content: "B2 EXECUTE: reimplement d4506e0f transcript_path hooks (subagent: cherrypicker)", status: "pending" },
  { id: "B2-review",  content: "B2 REVIEW: FULL verify + holistic review (subagent: deepthinker)", status: "pending" },
  { id: "B2-commit",  content: "B2 COMMIT: coordinator commits", status: "pending" },
  { id: "B3-exec",    content: "B3 EXECUTE: reimplement 54de6753 stats display polish (subagent: cherrypicker)", status: "pending" },
  { id: "B3-review",  content: "B3 REVIEW: quick verify + holistic review (subagent: deepthinker)", status: "pending" },
  { id: "B3-commit",  content: "B3 COMMIT: coordinator commits", status: "pending" },
  { id: "B4-exec",    content: "B4 EXECUTE: reimplement 86134e99 settings validation (subagent: cherrypicker)", status: "pending" },
  { id: "B4-review",  content: "B4 REVIEW: FULL verify + holistic review (subagent: deepthinker)", status: "pending" },
  { id: "B4-commit",  content: "B4 COMMIT: coordinator commits", status: "pending" },
  { id: "B5-exec",    content: "B5 EXECUTE: reimplement 299cc9be A2A /init command (subagent: cherrypicker)", status: "pending" },
  { id: "B5-review",  content: "B5 REVIEW: quick verify + holistic review (subagent: deepthinker)", status: "pending" },
  { id: "B5-commit",  content: "B5 COMMIT: coordinator commits", status: "pending" },
  { id: "B6-exec",    content: "B6 EXECUTE: reimplement 1e734d7e multi-file drag/drop (subagent: cherrypicker)", status: "pending" },
  { id: "B6-review",  content: "B6 REVIEW: FULL verify + holistic review (subagent: deepthinker)", status: "pending" },
  { id: "B6-commit",  content: "B6 COMMIT: coordinator commits", status: "pending" },
  { id: "B7-exec",    content: "B7 EXECUTE: reimplement 3b2a4ba2 IDE ext refactor (subagent: cherrypicker)", status: "pending" },
  { id: "B7-review",  content: "B7 REVIEW: quick verify + holistic review (subagent: deepthinker)", status: "pending" },
  { id: "B7-commit",  content: "B7 COMMIT: coordinator commits", status: "pending" },
  { id: "B8-exec",    content: "B8 EXECUTE: cherry-pick e84c4bfb edbe5480 20164ebc d2a1a456 d9f94103 — skip clearcut (subagent: cherrypicker)", status: "pending" },
  { id: "B8-review",  content: "B8 REVIEW: FULL verify + clearcut contamination check (subagent: deepthinker)", status: "pending" },
  { id: "B8-commit",  content: "B8 COMMIT: coordinator commits fix if needed", status: "pending" },
  { id: "B9-exec",    content: "B9 EXECUTE: reimplement 6dea66f1 stats flex removal (subagent: cherrypicker)", status: "pending" },
  { id: "B9-review",  content: "B9 REVIEW: quick verify + holistic review (subagent: deepthinker)", status: "pending" },
  { id: "B9-commit",  content: "B9 COMMIT: coordinator commits", status: "pending" },
  { id: "B10-exec",   content: "B10 EXECUTE: reimplement 5f298c17 always-allow [HIGH RISK] (subagent: cherrypicker)", status: "pending" },
  { id: "B10-review", content: "B10 REVIEW: FULL verify + ZERO TELEMETRY AUDIT + security review (subagent: deepthinker)", status: "pending" },
  { id: "B10-commit", content: "B10 COMMIT: coordinator commits", status: "pending" },
  { id: "B11-exec",   content: "B11 EXECUTE: reimplement a47af8e2 commandPrefix safety [SECURITY] (subagent: cherrypicker)", status: "pending" },
  { id: "B11-review", content: "B11 REVIEW: quick verify + security test verification (subagent: deepthinker)", status: "pending" },
  { id: "B11-commit", content: "B11 COMMIT: coordinator commits", status: "pending" },
  { id: "B12-exec",   content: "B12 EXECUTE: reimplement 126c32ac hook refresh + disposal (subagent: cherrypicker)", status: "pending" },
  { id: "B12-review", content: "B12 REVIEW: FULL verify + memory leak check (subagent: deepthinker)", status: "pending" },
  { id: "B12-commit", content: "B12 COMMIT: coordinator commits", status: "pending" },
  { id: "B13-exec",   content: "B13 EXECUTE: reimplement 942bcfc6 redundant typecasts (subagent: cherrypicker)", status: "pending" },
  { id: "B13-review", content: "B13 REVIEW: quick verify + eslint config coverage check (subagent: deepthinker)", status: "pending" },
  { id: "B13-commit", content: "B13 COMMIT: coordinator commits", status: "pending" },
  { id: "B14-exec",   content: "B14 EXECUTE: cherry-pick ec665ef4 bb0c0d8e 79f664d5(partial) ed4b440b (subagent: cherrypicker)", status: "pending" },
  { id: "B14-review", content: "B14 REVIEW: FULL verify + partial-pick validation (subagent: deepthinker)", status: "pending" },
  { id: "B14-commit", content: "B14 COMMIT: coordinator commits fix if needed", status: "pending" },
  { id: "B15-exec",   content: "B15 EXECUTE: reimplement 217e2b0e non-interactive confirmation (subagent: cherrypicker)", status: "pending" },
  { id: "B15-review", content: "B15 REVIEW: quick verify + parallel batch safety check (subagent: deepthinker)", status: "pending" },
  { id: "B15-commit", content: "B15 COMMIT: coordinator commits", status: "pending" },
  { id: "B16-exec",   content: "B16 EXECUTE: reimplement d236df5b tool fragmentation [HIGH RISK] (subagent: cherrypicker)", status: "pending" },
  { id: "B16-review", content: "B16 REVIEW: FULL verify + provider-agnostic + edge cases (subagent: deepthinker)", status: "pending" },
  { id: "B16-commit", content: "B16 COMMIT: coordinator commits", status: "pending" },
  { id: "B17-exec",   content: "B17 EXECUTE: reimplement 0c3eb826 A2A interactive (subagent: cherrypicker)", status: "pending" },
  { id: "B17-review", content: "B17 REVIEW: quick verify + A2A privacy check (subagent: deepthinker)", status: "pending" },
  { id: "B17-commit", content: "B17 COMMIT: coordinator commits", status: "pending" },
  { id: "B18-exec",   content: "B18 EXECUTE: cleanup — remove dead findFiles (subagent: cherrypicker)", status: "pending" },
  { id: "B18-review", content: "B18 REVIEW: FULL verify + complete removal check (subagent: deepthinker)", status: "pending" },
  { id: "B18-commit", content: "B18 COMMIT: coordinator commits", status: "pending" },
  { id: "FINAL-progress", content: "FINAL: update PROGRESS.md with all batch commit hashes (subagent: coordinator)", status: "pending" },
  { id: "FINAL-notes",    content: "FINAL: update NOTES.md with conflicts and deviations (subagent: coordinator)", status: "pending" },
  { id: "FINAL-audit",    content: "FINAL: update AUDIT.md with all 74 commit outcomes (subagent: coordinator)", status: "pending" }
]})
```

---

## Failure Recovery

### Cherry-pick conflict
```bash
git cherry-pick --abort   # Reset to pre-cherry-pick state
# Then cherry-pick one at a time to isolate the problem
# Resolve conflicts preserving LLxprt branding/architecture
# git cherry-pick --continue
```

### Review failure → remediation loop
Per `dev-docs/COORDINATING.md`:
1. Deepthinker identifies issues (numbered list)
2. Launch **cherrypicker** with remediation prompt:
   ```
   CONTEXT: Remediation for Batch {N}. The deepthinker review found these issues:
   {paste numbered issues from deepthinker output}

   Fix each issue. After fixing, run: {VERIFY_COMMANDS}
   ```
3. Launch **deepthinker** again with the same review prompt
4. Max 5 iterations. After 5 failures: `todo_pause("Batch {N} review failed after 5 remediation attempts")`
5. **NEVER skip a failed batch** — fix it or escalate

### HIGH-RISK batch remediation (B10, B11, B16)

These batches have elevated consequences and require extra remediation checks:

**B10 (always-allow policies):** Before re-review, re-run the ZERO TELEMETRY AUDIT from the review prompt. If any grep returns non-empty, the remediation MUST address it before proceeding.

**B11 (commandPrefix safety):** Before re-review, re-run ALL 5 security test cases from the review prompt. If any case is missing test coverage, the remediation MUST add it.

**B16 (tool output fragmentation):** Before re-review, re-run the provider-agnostic check and edge case coverage. Non-Gemini providers MUST NOT be broken by the fix.

### Build/test failure
1. Check if pre-existing: `git stash && npm run test && git stash pop`
2. If pre-existing, document in NOTES.md and continue
3. If caused by batch, include in remediation loop

---

## Note-Taking (After Each Batch)

The coordinator should update these files after each batch commit:
1. `project-plans/gmerge-0.22.0/PROGRESS.md` — batch status + LLxprt commit hash
2. `project-plans/gmerge-0.22.0/NOTES.md` — append: conflicts, deviations, decisions
3. `project-plans/gmerge-0.22.0/AUDIT.md` — update commit outcomes

---

## PR Creation (After All Batches)

After FINAL-audit is complete:
```bash
git push origin gmerge/0.22.0
gh pr create --base main --head gmerge/0.22.0 \
  --title "Sync upstream v0.21.3 → v0.22.0 (Fixes #TRACKING_ISSUE)" \
  --body "See project-plans/gmerge-0.22.0/CHERRIES.md and AUDIT.md for full details."
```
Then follow PR rules: `gh pr checks NUM --watch --interval 300`, review CodeRabbit, loop until green.

---

## Context Recovery

If you lose context:
1. **Branch:** `gmerge/0.22.0`
2. **Range:** upstream `v0.21.3..v0.22.0` (74 commits: 14 PICK / 46 SKIP / 14 REIMPLEMENT)
3. **Coordination protocol:** `dev-docs/COORDINATING.md`
4. **Key files:**
   - This file: `project-plans/gmerge-0.22.0/PLAN.md`
   - Decisions: `project-plans/gmerge-0.22.0/CHERRIES.md`
   - Progress: `project-plans/gmerge-0.22.0/PROGRESS.md`
   - Notes: `project-plans/gmerge-0.22.0/NOTES.md`
   - Audit: `project-plans/gmerge-0.22.0/AUDIT.md`
   - Per-reimplement plans: `project-plans/gmerge-0.22.0/<sha>-plan.md`
   - Review findings: `project-plans/gmerge-0.22.0/review-enhanced-plans.md`
5. **Resume:** `todo_read()` → find first pending → execute using subagents per batch section above
6. **Git state:** `git log --oneline -20` to see what's been applied
