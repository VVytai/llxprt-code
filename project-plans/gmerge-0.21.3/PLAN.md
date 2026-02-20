# Plan: Execution Plan: v0.20.2 → v0.21.3

Plan ID: PLAN-20250219-GMERGE021
Generated: 2025-02-19
Total Phases: 48 execution phases (B1–B8, R1–R16, each with exec/verify/review)
Requirements: gemini-cli v0.21.3 sync

## Critical Reminders

Before implementing ANY phase, ensure you have:

1. Checked current branch (`git branch --show-current` → must be `gmerge/0.21.3`)
2. Called `todo_read()` to find the first pending item
3. Read the per-phase plan file (`<sha>-plan.md`) before executing that batch
4. Read the per-phase critique file (`<sha>-critique.md`) if present — critique gaps are required fixes
5. Never combined exec + review into a single subagent call
6. Each verification phase MUST pass before proceeding to the next exec phase

---

## START HERE (If you were told to "DO this plan")

### Step 1: Check current state
```bash
git branch --show-current  # Should be gmerge/0.21.3
git status                 # Check for uncommitted changes
```

### Step 2: Check or create the todo list
Call `todo_read()` first. If empty, call `todo_write()` with the todo list from the "Todo List" section below.

### Step 3: Find where to resume
- Look at the todo list for the first `pending` item
- If an item is `in_progress`, restart that item
- If all items are `completed`, you're done

### Step 4: Execute using subagents
- **B*-exec tasks:** Call `task` with `subagent_name: "cherrypicker"`
- **B*-verify tasks:** Run verification commands inline (no subagent needed for quick checks)
- **B*-review tasks:** Call `task` with `subagent_name: "reviewer"`
- **R*-exec tasks:** Call `task` with `subagent_name: "typescriptexpert"`
- **R*-verify tasks:** Run verification commands inline
- **R*-review tasks:** Call `task` with `subagent_name: "deepthinker"`
- Continue until todo list is empty or blocked

### Step 5: If blocked
- Call `todo_pause()` with the specific reason
- Wait for human intervention

---

## Overview

This plan syncs LLxprt Code from upstream gemini-cli **v0.20.2** to **v0.21.3**
(commits spanning 2025-12-02 to 2025-12-19, 122 total upstream commits).

| Decision | Count |
|----------|-------|
| PICK | 36 |
| SKIP | 68 |
| REIMPLEMENT | 18 |

**Batches:** 8 PICK batches (36 commits) + 16 REIMPLEMENT batches = 24 total executable batches

See also: [CHERRIES.md](./CHERRIES.md) for full per-commit decisions, [AUDIT.md](./AUDIT.md) for post-implementation reconciliation, [PROGRESS.md](./PROGRESS.md) for execution status, [NOTES.md](./NOTES.md) for runtime deviations and conflicts, [SUMMARY.md](./SUMMARY.md) for the 10,000-foot view.

---

## Non-Negotiables

Per `dev-docs/cherrypicking.md`:
- No `@google/gemini-cli` imports (use `@vybestack/llxprt-code-core`)
- No Google telemetry (ClearcutLogger)
- No model routing/availability service
- Preserve multi-provider architecture
- LLxprt tool names: `list_directory`, `search_file_content`, `replace`

---

## Branding Substitutions

| Upstream | LLxprt |
|----------|--------|
| `@google/gemini-cli-core` | `@vybestack/llxprt-code-core` |
| `gemini-cli` | `llxprt-code` |
| `Gemini CLI` | `LLxprt Code` |
| `gemini` (command) | `llxprt` |
| `loadHierarchicalGeminiMemory` | `loadHierarchicalLlxprtMemory` |
| `GeminiRespondingSpinner` | `LlxprtRespondingSpinner` |

---

## Individual Plan Files

Each REIMPLEMENT batch has a detailed plan (and critique where applicable):

| Batch | Phase ID | SHA | Subject | Plan | Critique |
|-------|----------|-----|---------|------|----------|
| R1 | PLAN-20250219-GMERGE021.R1 | 533a3fb312ad | MessageBus always true | [533a3fb312ad-plan.md](./533a3fb312ad-plan.md) | [critique](./533a3fb312ad-critique.md) |
| R2 | PLAN-20250219-GMERGE021.R2 | 344f2f26e78e | Fuzzy search in settings | [344f2f26e78e-plan.md](./344f2f26e78e-plan.md) | — |
| R3 | PLAN-20250219-GMERGE021.R3 | bdbbe9232d23 | MCP url consolidation | [bdbbe9232d23-plan.md](./bdbbe9232d23-plan.md) | [critique](./bdbbe9232d23-critique.md) |
| R4 | PLAN-20250219-GMERGE021.R4 | 1c12da1fad14 | Hook Session Lifecycle | [1c12da1fad14-plan.md](./1c12da1fad14-plan.md) | [critique](./1c12da1fad14-critique.md) |
| R5 | PLAN-20250219-GMERGE021.R5 | b8c038f41f82 | Hooks Commands Panel | [b8c038f41f82-plan.md](./b8c038f41f82-plan.md) | — |
| R6 | PLAN-20250219-GMERGE021.R6 | 8d4082ef2e38 | Hook System Documentation | [8d4082ef2e38-plan.md](./8d4082ef2e38-plan.md) | — |
| R7 | PLAN-20250219-GMERGE021.R7 | eb3312e7baaf | Extension Hooks Security | [eb3312e7baaf-plan.md](./eb3312e7baaf-plan.md) | [critique](./eb3312e7baaf-critique.md) |
| R8 | PLAN-20250219-GMERGE021.R8 | 3da4fd5f7dc6 | ACP credential cache | [3da4fd5f7dc6-plan.md](./3da4fd5f7dc6-plan.md) | [critique](./3da4fd5f7dc6-critique.md) |
| R9 | PLAN-20250219-GMERGE021.R9 | 470f3b057f59 | Remove example extension | [470f3b057f59-plan.md](./470f3b057f59-plan.md) | [critique](./470f3b057f59-critique.md) |
| R10 | PLAN-20250219-GMERGE021.R10 | e0a2227faf8a | Per-extension settings | [e0a2227faf8a-plan.md](./e0a2227faf8a-plan.md) | — |
| R11 | PLAN-20250219-GMERGE021.R11 | d5e5f58737a0 | Setting search UX | [d5e5f58737a0-plan.md](./d5e5f58737a0-plan.md) | — |
| R12 | PLAN-20250219-GMERGE021.R12 | 6a3b56c5b6a8 | Retry logic fetch errors | [6a3b56c5b6a8-plan.md](./6a3b56c5b6a8-plan.md) | [critique](./6a3b56c5b6a8-critique.md) |
| R13 | PLAN-20250219-GMERGE021.R13 | dd3fd73ffe9a | API response error handling | [dd3fd73ffe9a-plan.md](./dd3fd73ffe9a-plan.md) | [critique](./dd3fd73ffe9a-critique.md) |
| R14 | PLAN-20250219-GMERGE021.R14 | 205d0f456e9c | Extensions GitHub 415 fix | [205d0f456e9c-plan.md](./205d0f456e9c-plan.md) | [critique](./205d0f456e9c-critique.md) |
| R15 | PLAN-20250219-GMERGE021.R15 | ec9a8c7a7293 | User-scoped extension settings | [ec9a8c7a7293-plan.md](./ec9a8c7a7293-plan.md) | [critique](./ec9a8c7a7293-critique.md) |
| R16 | PLAN-20250219-GMERGE021.R16 | d35a1fdec71b | Missing extension config | [d35a1fdec71b-plan.md](./d35a1fdec71b-plan.md) | — |
| R17 | PLAN-20250219-GMERGE021.R17 | b27cf0b0a8dd | Continue logic to core | [b27cf0b0a8dd-plan.md](./b27cf0b0a8dd-plan.md) | [critique](./b27cf0b0a8dd-critique.md) |
| R18 | PLAN-20250219-GMERGE021.R18 | 8b0a8f47c1b2 | Session ID in JSON output | [8b0a8f47c1b2-plan.md](./8b0a8f47c1b2-plan.md) | [critique](./8b0a8f47c1b2-critique.md) |

**Note on R17 (b27cf0b0a8dd):** Originally B3 PICK, reclassified to REIMPLEMENT. Adapts upstream /restore logic for LLxprt's /continue command. Critique recommends partial alignment with staged commits.

**Note on R18 (8b0a8f47c1b2):** Originally B3 PICK, reclassified to REIMPLEMENT. Adds session_id to JSON output. Critique recommends minimal approach (just add session_id inline, skip error-path refactor).

**Note on R12 (6a3b56c5b6a8):** The plan concludes NO ACTION IS REQUIRED — LLxprt's retry.ts already subsumes and exceeds the upstream changes. The critique identifies edge cases to verify before finalizing that call. Treat as a verification + optional minor-fix batch.

**Note on 1f813f6a060e:** This commit was planned as REIMPLEMENT in early analysis but was reclassified to PICK in CHERRIES.md. See Batch 8 below. Its detailed plan file ([1f813f6a060e-plan.md](./1f813f6a060e-plan.md)) and critique ([1f813f6a060e-critique.md](./1f813f6a060e-critique.md)) remain available for context if conflicts arise during cherry-pick.

---

## Implementation Order and Dependencies

The batches must execute in this order to respect dependencies:

```
PICK Batches (B1–B8) → can start immediately, run sequentially
       │
       ├─ B1 (security, refactor, docs, policy)
       ├─ B2 (CLI features, MCP transport alias)
       ├─ B3 (hooks integration points, MCP auto-execute, shell)
       ├─ B4 (MCP dynamic tools, shell fix, bug fixes)
       ├─ B5 (session, floating-promises lint)
       ├─ B6 (freeze fix, audio, auto-exec, MCP Resources )
       ├─ B7 (clipboard, deps, a2a)
       └─ B8 (a2a restore command)

REIMPLEMENT Batches — internal dependencies:
       │
       ├─ R1  (MessageBus always-true) — no deps, do first among R batches
       ├─ R8  (ACP credential cache) — no deps on other R batches
       ├─ R9  (Remove example extension) — no deps
       ├─ R12 (Retry logic) — verify-only; no deps
       ├─ R13 (API response error handling) — AFTER R12 (both touch retry.ts)
       ├─ R3  (MCP url consolidation) — AFTER R13 (isAuthenticationError used by both)
       ├─ R14 (Extensions GitHub 415 fix) — no code deps on above
       ├─ R10 (Per-extension settings commands) — no deps
       ├─ R15 (User-scoped extension settings) — AFTER R10 (builds on settings commands)
       ├─ R16 (Missing extension config handling) — AFTER R15
       ├─ R7  (Extension Hooks Security) — AFTER R16 (extension loading must be stable)
       ├─ R4  (Hook Session Lifecycle) — AFTER R1 (MessageBus), no UI dep
       ├─ R5  (Hooks Commands Panel) — AFTER R4 (hook types and lifecycle must exist)
       ├─ R2  (Fuzzy search in settings) — after PICK batches settle SettingsDialog
       ├─ R11 (Setting search UX) — AFTER R2 (R11 upgrades the UX from R2's search)
       ├─ R6  (Hook System Documentation) — AFTER R4, R5 (documents what's implemented)
       ├─ R17 (Continue logic to core) — no deps, from B3 reclassification
       └─ R18 (Session ID in JSON output) — no deps, from B3 reclassification
```

**Critical ordering rules:**
1. All PICK batches should complete before or concurrent with REIMPLEMENT batches. PICK commits fix bugs and add features that REIMPLEMENT batches may depend on.
2. R12 must precede R13: both touch `retry.ts`; R12 establishes the baseline status.
3. R13 must precede R3: `isAuthenticationError()` (from R13) is used by the MCP transport rewrite (R3).
4. R10 must precede R15: per-extension settings commands are the foundation for scoped settings.
5. R4 must precede R5 and R6: session lifecycle hooks (R4) must exist before panel commands (R5) and documentation (R6).
6. R2 must precede R11: R2 adds fuzzy search; R11 replaces the `/`-trigger UX with inline search input (a UX evolution of R2).
7. R7 must come after extension loading is stable (R16, R15, R14).

---

## Key Risks and Mitigations

### Highest-Risk Items (from critiques)

| Risk | Affected Batches | Mitigation |
|------|-----------------|------------|
| **MCP transport default change** (url default shifts SSE→HTTP) | R3 | Strict test matrix: 6+ transport config combos; compatibility section; user-visible warning |
| **Streaming retry introduces partial-output duplication** | R13 | `isConnectionPhase` flag; abort-signal never retried; full retry behavior matrix test |
| **Extension settings write to workspace `.env`** collides with project env | R15 | Define workspace identity policy; scope to extension-specific prefix; document precedence |
| **Command interface break** (`Command.execute` signature) | B8/1f813f6a PICK | Enumerate all Command implementations before changing; provide compat shim if needed |
| **Hook failure semantics undefined** at new call sites | R4, R5 | Explicit fail-open policy at each trigger point; hooks must never block core flow unless intentional |
| **Extension Hooks security surface** (hydration of `${extensionPath}`) | R7 | Strict JSON schema validation; no path traversal; consent logic tests across install/update/reinstall scenarios |
| **Retry logic semantic drift** (`retryFetchErrors` always-on vs gated) | R12, R13 | Document intentional divergence; add negative-case tests to avoid false-positive retries |
| **MessageBus always-on side effects** | R1 | Audit `getEnableMessageBusIntegration` call sites; verify hooks still work with `enableHooks=false` |
| **Checkpoint schema backward compatibility** | B8 | Validate old checkpoint files gracefully; define schema version or migration path |
| **ACP credential cache profile-vs-authtype mismatch** | R8 | Policy: clear cache when provider/auth-method changes, not just profile name; test same-profile re-auth |
| **Settings Dialog UX change breaks snapshot tests** | R2, R11 | Run `--updateSnapshot` after R2; regenerate again after R11 UX upgrade |
| **`retryFetchErrors` propagation to `direct-web-fetch`** | R13 | Verify `Config.getRetryFetchErrors()` exists or add it; test per-attempt timeout vs total timeout |

### Cross-Cutting Concerns

1. **Hooks system is LLxprt-specific**: All hook commits (R4, R5, R6, R7) use LLxprt's `HookEventHandler` and `lifecycleHookTriggers.ts` directly — NOT upstream's MessageBus-based approach. Never port upstream's `sessionHookTriggers.ts` directly; adapt to LLxprt's own trigger functions.

2. **Extensions are reimplemented**: All extension commits (R7, R10, R14, R15, R16) must be adapted to LLxprt's `loadExtension()` function-based architecture — NOT upstream's `ExtensionManager` class.

3. **SettingsDialog is massively diverged** (1272 lines vs ~400 upstream): R2 (fuzzy search) and R11 (search UX) add new functionality rather than patching diverged code. Implement these as net-new features that fit LLxprt's existing component structure.

4. **Telemetry functions** (like `flushTelemetry` added by R4) should use LLxprt's OpenTelemetry plumbing, but must be guarded against init-before-use and concurrent-flush scenarios.

---

## Estimated Effort

| Category | Batches | Estimated Effort |
|----------|---------|-----------------|
| PICK B1–B8 (36 commits) | 8 batches | ~4–6 hours (mostly conflict-free cherry-picks) |
| R1 MessageBus | 1 batch | ~1 hour |
| R2 Fuzzy search in settings | 1 batch | ~3–4 hours |
| R3 MCP url consolidation | 1 batch | ~8–12 hours (major rewrite, large test matrix) |
| R4 Hook Session Lifecycle | 1 batch | ~4–6 hours |
| R5 Hooks Commands Panel | 1 batch | ~6–8 hours (new files: CLI cmd, slash cmd, UI component) |
| R6 Hook System Documentation | 1 batch | ~5–7 hours |
| R7 Extension Hooks Security | 1 batch | ~4–6 hours |
| R8 ACP credential cache | 1 batch | ~2–3 hours |
| R9 Remove example extension | 1 batch | ~1 hour |
| R10 Per-extension settings | 1 batch | ~4–5 hours |
| R11 Setting search UX | 1 batch | ~3–4 hours |
| R12 Retry logic (verify) | 1 batch | ~1–2 hours |
| R13 API response error handling | 1 batch | ~7–10 hours |
| R14 Extensions GitHub 415 fix | 1 batch | ~3–4 hours |
| R15 User-scoped ext settings | 1 batch | ~5–7 hours |
| R16 Missing ext config | 1 batch | ~1–2 hours |
| **Total** | **24 batches** | **~63–98 hours** |

**Practical note:** Some REIMPLEMENT batches interact with each other (R12/R13, R2/R11, R10/R15/R16, R4/R5/R6). An experienced implementor who does them in dependency order and re-runs the full verification suite at each FULL VERIFY checkpoint will spend the lower end of these estimates. Expect the upper end if conflicts or test failures require investigation.

---

## Batch Schedule

### PICK Batches (36 commits in 8 batches)

#### Batch 1: PICK commits 1-5 (Dec 2-3)
Phase ID: `PLAN-20250219-GMERGE021.B1`
```bash
git cherry-pick 035bea3699f1 08573459450b 54c62d580c05 7a6d3067c647 f588219bb9bf
```
| SHA | Subject |
|-----|---------|
| 035bea3699f1 | Restrict integration tests tools |
| 08573459450b | refactor(editor): use const assertion for editor types |
| 54c62d580c05 | fix(security): Fix npm audit vulnerabilities |
| 7a6d3067c647 | Add new enterprise instructions |
| f588219bb9bf | fix: Bundle default policies for npx distribution |

**B1-verify:** `npm run lint && npm run typecheck`

---

#### Batch 2: PICK commits 6-10 (Dec 3-4) - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.B2`
```bash
git cherry-pick 9bc5a4d64f4c 518e73ac9f8b b745d46395a7 48e8c12476b6 0a2971f9d30c
```
| SHA | Subject |
|-----|---------|
| 9bc5a4d64f4c | feat(cli): support /copy in remote sessions using OSC52 |
| 518e73ac9f8b | fix(cli): Fix word navigation for CJK characters |
| b745d46395a7 | do not toggle the setting item when entering space |
| 48e8c12476b6 | remove unused isSearching field |
| 0a2971f9d30c | feat(mcp): add `--type` alias for `--transport` flag |

**B2-verify:** Full suite
```bash
npm run lint && npm run typecheck && npm run test && npm run format && npm run build
node scripts/start.js --profile-load synthetic --prompt "write me a haiku"
```

---

#### Batch 3: RECLASSIFIED (Dec 4)
Phase ID: `PLAN-20250219-GMERGE021.B3`

**Analysis performed:** B3 commits were individually evaluated due to GeminiClient API divergence.

| SHA | Subject | Decision | Reason |
|-----|---------|----------|--------|
| b27cf0b0a8dd | Move key restore logic to core | **REIMPLEMENT (R17)** | LLxprt uses /continue not /restore |
| 1040c246f5a0 | Auto-execute for MCP prompts | **CHERRY-PICKED** | Applied as bd3bbe824 |
| 84f521b1c62b | Cursor visibility fix | **SKIP** | Already fixed in LLxprt |
| 8b0a8f47c1b2 | Session id in JSON output | **REIMPLEMENT (R18)** | Architecture differs |
| 2d1c1ac5672e | Compression latch fix | **SKIP** | LLxprt rewrote compression |

**B3-verify:** Already verified with 1040c246f5a0 cherry-pick

---

#### Batch 4: PICK commits 16-20 (Dec 4) - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.B4`
```bash
git cherry-pick 0c7ae22f5def 5f60281d2528 ae8694b30f6e 7db5abdecfdf d284fa66c015
```
| SHA | Subject |
|-----|---------|
| 0c7ae22f5def | Disable flaky extension reloading test on linux |
| 5f60281d2528 | Add support for MCP dynamic tool update |
| ae8694b30f6e | Fix privacy screen for legacy tier users |
| 7db5abdecfdf | Fixes [API Error: Cannot read properties of undefined] |
| d284fa66c015 | Fix bug in shellExecutionService (truncation + bloat) |

**B4-verify:** Full suite

---

#### Batch 5: PICK commits 21-25 (Dec 4-5)
Phase ID: `PLAN-20250219-GMERGE021.B5`
```bash
git cherry-pick 934b309b4cc6 616d6f666705 996cbcb680fd bdd15e8911ba 025e450ac247
```
| SHA | Subject |
|-----|---------|
| 934b309b4cc6 | Fix issue passing model content reflecting terminal wrapping |
| 616d6f666705 | feat(sessions): use 1-line generated session summary |
| 996cbcb680fd | Docs: Model routing clarification |
| bdd15e8911ba | Fully detach autoupgrade process |
| 025e450ac247 | Disallow floating promises |

**B5-verify:** `npm run lint && npm run typecheck`

---

#### Batch 6: PICK commits 26-30 (Dec 8) - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.B6`
```bash
git cherry-pick 389cadb06ad6 84c07c8fa174 89570aef0633 171103aedc9f 560550f5df78
```
| SHA | Subject |
|-----|---------|
| 389cadb06ad6 | Fix: Prevent freezing in non-interactive when debug enabled |
| 84c07c8fa174 | fix(audio): improve reading of audio files |
| 89570aef0633 | feat: auto-execute on slash command completion |
| 171103aedc9f | refactor(core): Improve env var handling in shell |
| 560550f5df78 | **feat: Add support for MCP Resources** |

**B6-verify:** Full suite

---

#### Batch 7: PICK commits 31-35 (Dec 9-16)
Phase ID: `PLAN-20250219-GMERGE021.B7`
```bash
git cherry-pick afd4829f1096 364b12e2fae5 d591140f62ff 6e51bbc21570 674494e80b66
```
| SHA | Subject |
|-----|---------|
| afd4829f1096 | fix: use Gemini API supported image formats for clipboard |
| 364b12e2fae5 | chore(deps): bump express from 5.1.0 to 5.2.0 |
| d591140f62ff | Fix prompt and chat code |
| 6e51bbc21570 | Add prompt_id propagation in a2a-server task |
| 674494e80b66 | allow final:true on a2a server edit calls |

**B7-verify:** `npm run lint && npm run typecheck`

---

#### Batch 8: PICK commit 36 (Dec 9) - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.B8`
```bash
git cherry-pick 1f813f6a060e
```
| SHA | Subject |
|-----|---------|
| 1f813f6a060e | feat(a2a): Introduce restore command for a2a server |

> **If this cherry-pick conflicts:** The detailed reimplementation plan at [1f813f6a060e-plan.md](./1f813f6a060e-plan.md) covers all phases. The [critique](./1f813f6a060e-critique.md) calls out the most dangerous areas: Command.execute signature migration, checkpoint filename collisions, partial failure handling, and workspace/git availability validation. Resolve conflicts by reading the plan and addressing each gap the critique identifies.

**B8-verify:** Full suite

---

### REIMPLEMENT Batches (18 commits, all independent batches)

Each REIMPLEMENT has a detailed plan file. Read the plan (and critique if present) before implementing. The critiques are authoritative — treat every identified gap as a required fix or documented decision before closing the batch.

---

#### Batch R1: 533a3fb312ad — MessageBus always true
Phase ID: `PLAN-20250219-GMERGE021.R1`
**Plan:** [533a3fb312ad-plan.md](./533a3fb312ad-plan.md) | **Critique:** [533a3fb312ad-critique.md](./533a3fb312ad-critique.md)

**Action:** In `packages/core/src/config/config.ts`, replace conditional `messageBusEnabled` logic with `const messageBusEnabled = true`. Remove `enableMessageBusIntegration` from `ConfigParameters`.

**Critique gaps to address before closing:**
- Audit all `getEnableMessageBusIntegration` references — not just the 3 test mocks listed
- Verify persisted settings with `enableMessageBusIntegration: false` do not crash (runtime tolerance)
- Update test mocks from `false` to `true` only after confirming the disabled-path is truly dead

**R1-verify:** `npm run lint && npm run typecheck`

---

#### Batch R2: 344f2f26e78e — Fuzzy search in settings - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.R2`
**Plan:** [344f2f26e78e-plan.md](./344f2f26e78e-plan.md)

**Action:** Add fuzzy search (press `/` to enter search mode) to LLxprt's SettingsDialog using the synchronous `Fzf` class already available in the codebase. LLxprt's SettingsDialog is ~1272 lines vs upstream's ~400; implement as a net-new feature rather than a direct port.

**Key decisions:**
- Use synchronous `Fzf` (not `AsyncFzf`) — list is small enough
- Search must not interfere with sub-settings mode, scope selector, or edit mode
- Add "No matches found." display and Escape-exits-search behavior

**Note:** R11 (d5e5f58737a0) upgrades this UX to an always-visible inline search field. Do R2 first; R11 will refactor it.

**R2-verify:** Full suite

---

#### Batch R3: bdbbe9232d23 — MCP url consolidation
Phase ID: `PLAN-20250219-GMERGE021.R3`
**Plan:** [bdbbe9232d23-plan.md](./bdbbe9232d23-plan.md) | **Critique:** [bdbbe9232d23-critique.md](./bdbbe9232d23-critique.md)

**Action:** Major MCP transport rewrite. Add `type?: 'sse' | 'http'` to `MCPServerConfig`. Rewrite `createUrlTransport()` with priority: `httpUrl` > `url+type` > `url` (defaulting HTTP). Add `isAuthenticationError()` to errors.ts. Add HTTP→SSE fallback for `url`-only configs. Update CLI mcp-add to write `url + type` instead of `httpUrl`.

**Critical risks (from critique):**
- `url` without `type` changes default from SSE→HTTP — this is a **breaking semantic change** for existing configs. Document this explicitly in NOTES.md and add a migration warning in code.
- `isAuthenticationError()` message-based fallback (checking for "401" in message) is too broad — add strictness tests proving non-auth errors are not misclassified.
- OAuth retry + transport fallback ordering must be precisely defined (state machine, not approximation).

**Requires:** R13 complete first (isAuthenticationError comes from R13's work on errors.ts).

**R3-verify:** `npm run lint && npm run typecheck`

---

#### Batch R4: 1c12da1fad14 — Hook Session Lifecycle - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.R4`
**Plan:** [1c12da1fad14-plan.md](./1c12da1fad14-plan.md) | **Critique:** [1c12da1fad14-critique.md](./1c12da1fad14-critique.md)

**Action:** Add `flushTelemetry()` to telemetry SDK. Add `triggerPreCompressHook` to `lifecycleHookTriggers.ts`. Wire PreCompress into `chatCompressionService.ts`. Add `SessionEnd`/`SessionStart` hooks to `clearCommand.ts`. Add telemetry shutdown to `cleanup.ts`.

**Architecture note:** LLxprt uses `HookEventHandler` directly — NOT upstream's MessageBus-based `sessionHookTriggers.ts`. Adapt to LLxprt's `lifecycleHookTriggers.ts`.

**Critical risks (from critique):**
- Resolve config access in `clearCommand` before implementing (not a footnote — it's a blocker)
- Define fail-open policy explicitly: hooks must never block `/clear`, compression, or startup if they fail
- Guard `flushTelemetry` against init-before-use and concurrent calls (module-level refs + guards)

**Requires:** R1 complete first (MessageBus must be always-on before wiring new hook events through it).

**R4-verify:** Full suite

---

#### Batch R5: b8c038f41f82 — Hooks Commands Panel
Phase ID: `PLAN-20250219-GMERGE021.R5`
**Plan:** [b8c038f41f82-plan.md](./b8c038f41f82-plan.md)

**Action:** Add `hooks.disabled` to settings schema. Add `getDisabledHooks()` to Config. Wire disabled hooks into HookRegistry initialization. Create `/hooks panel`, `/hooks enable`, `/hooks disable` slash commands and `HooksList` UI component. Optionally add `llxprt hooks migrate` CLI command.

**Priority order per plan:** P0 settings+config, P1 UI slash cmd, P2 CLI cmd, P3 deep-merge fix.

**Requires:** R4 complete first (session lifecycle hooks and hook type stability needed).

**R5-verify:** `npm run lint && npm run typecheck`

---

#### Batch R6: 8d4082ef2e38 — Hook System Documentation - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.R6`
**Plan:** [8d4082ef2e38-plan.md](./8d4082ef2e38-plan.md)

**Action:** Documentation-only. Create `docs/hooks/best-practices.md`. Update `docs/hooks/index.md` (add PreCompress, Notification events; add configuration precedence; add session trigger subtypes). Update `docs/hooks/api-reference.md`. Fix `continue: true/false` inconsistency → standardize on `decision: "allow"/"deny"`.

**Dependency check required before writing:**
- Confirm `HookEventName.PreCompress` and `HookEventName.Notification` exist in code (from R4)
- Confirm `/hooks panel` command exists (from R5) before documenting it
- Check `docs/sidebar.json` structure before modifying

**Requires:** R4 and R5 complete first.

**R6-verify:** Full suite (build check even for doc-only changes)

---

#### Batch R7: eb3312e7baaf — Extension Hooks with Security Warning
Phase ID: `PLAN-20250219-GMERGE021.R7`
**Plan:** [eb3312e7baaf-plan.md](./eb3312e7baaf-plan.md) | **Critique:** [eb3312e7baaf-critique.md](./eb3312e7baaf-critique.md)

**Action:** Add `loadExtensionHooks()` to `extension.ts`. Update `maybeRequestConsentOrFail()` with `hasHooks` / `previousHasHooks` parameters. Add security warning to consent string when extension contains hooks.

**Critical risks (from critique):**
- Define merge/precedence between `hooks` in extension config JSON and `hooks/hooks.json` — document explicitly
- Invalid `hooks/hooks.json` must produce a user-facing error, not silent fail or crash
- Consent change detection: presence-only check misses risk-increasing updates (new commands added to existing hooks)
- All install/update/reinstall paths must be covered, not just fresh install

**Requires:** Extension loading stable (R14, R15, R16 done or at least R14).

**R7-verify:** `npm run lint && npm run typecheck`

---

#### Batch R8: 3da4fd5f7dc6 — ACP credential cache
Phase ID: `PLAN-20250219-GMERGE021.R8`
**Plan:** [3da4fd5f7dc6-plan.md](./3da4fd5f7dc6-plan.md) | **Critique:** [3da4fd5f7dc6-critique.md](./3da4fd5f7dc6-critique.md)

**Action:** In `zedIntegration.ts` `authenticate()`, only clear credential cache when switching to a different profile (not on same-profile re-auth). Use `getActiveProfileName()` as current profile source.

**Key decision:** Map upstream's "auth method changed" to "profile changed" — but note the critique's concern that two profiles can share the same auth method. If switching profiles but auth method is same, skipping cache clear may be correct; document this as an intentional deviation.

**No deps on other R batches.**

**R8-verify:** `npm run lint && npm run typecheck`

---

#### Batch R9: 470f3b057f59 — Remove example extension
Phase ID: `PLAN-20250219-GMERGE021.R9`
**Plan:** [470f3b057f59-plan.md](./470f3b057f59-plan.md) | **Critique:** [470f3b057f59-critique.md](./470f3b057f59-critique.md)

**Action:** Delete `examples/custom-commands/commands/fs/grep-code.toml` and `examples/custom-commands/llxprt-extension.json`. Update `docs/cli/commands.md` to remove the reference. Verify no code references the removed example path.

**Pre-change scan (per critique):** `grep -r "custom-commands\|grep-code.toml" .` — check code, tests, docs, and scripts before deleting.

**No deps on other R batches.**

**R9-verify:** `npm run lint && npm run typecheck`

---

#### Batch R10: e0a2227faf8a — Per-extension settings commands - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.R10`
**Plan:** [e0a2227faf8a-plan.md](./e0a2227faf8a-plan.md)

**Action:** Add `promptForSetting`, `getEnvContents`, `updateSetting`, `formatEnvContent` to `extensionSettings.ts`. Create `commands/extensions/utils.ts` with `getExtensionAndConfig()`. Create `commands/extensions/settings.ts` with `list` and `set` subcommands. Register under `extensions settings` in `extensions.tsx`.

**No deps on other R batches** (can run in parallel with R8, R9 if desired).

**R10-verify:** Full suite

---

#### Batch R11: d5e5f58737a0 — Setting search UX
Phase ID: `PLAN-20250219-GMERGE021.R11`
**Plan:** [d5e5f58737a0-plan.md](./d5e5f58737a0-plan.md)

**Action:** Replace R2's `/`-trigger search mode with an always-visible `TextInput` search field in SettingsDialog. Create `TextInput.tsx` shared component using `useTextBuffer`. Remove `/` hotkey search trigger. Update Escape behavior (now closes dialog, doesn't just exit search). Regenerate snapshots.

**Requires:** R2 complete first (search state and fzf filtering logic from R2 is the foundation this upgrades).

**R11-verify:** `npm run lint && npm run typecheck`

---

#### Batch R12: 6a3b56c5b6a8 — Retry logic fetch errors (verify-only)
Phase ID: `PLAN-20250219-GMERGE021.R12`
**Plan:** [6a3b56c5b6a8-plan.md](./6a3b56c5b6a8-plan.md) | **Critique:** [6a3b56c5b6a8-critique.md](./6a3b56c5b6a8-critique.md)

**Action:** The plan concludes NO CODE ACTION REQUIRED — LLxprt's `retry.ts` already supersedes the upstream changes. **However**, the critique identifies that this conclusion is asserted not proven.

**Required verification steps before closing as no-op:**
1. Confirm `ENOTFOUND` is in `TRANSIENT_ERROR_CODES`
2. Confirm case-insensitive "fetch failed" matching is tested
3. Confirm `retryFetchErrors` option has documented semantics (LLxprt always-on vs upstream gated)
4. Add negative-case tests: non-auth errors with "401" in message should NOT be misclassified as network errors
5. If any gap is found, add the missing test or code and document the deviation in NOTES.md

**No deps on other R batches.**

**R12-verify:** `npm run lint && npm run typecheck`

---

#### Batch R13: dd3fd73ffe9a — API response error handling - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.R13`
**Plan:** [dd3fd73ffe9a-plan.md](./dd3fd73ffe9a-plan.md) | **Critique:** [dd3fd73ffe9a-critique.md](./dd3fd73ffe9a-critique.md)

**Action:** 5-phase implementation:
- Phase 1: Fix `retry.ts` — rename/export `isRetryableError`, fix network-code check order (check codes FIRST, before `retryFetchErrors` flag)
- Phase 2: Update `geminiChat.ts` — add `isConnectionPhase` flag; add network retry during stream iteration when `retryFetchErrors=true`
- Phase 3: Add retry to `direct-web-fetch.ts` — wrap with `retryWithBackoff`, pass `retryFetchErrors` from config
- Phase 4: Fix `fetch.ts` — add `ErrorOptions` parameter to preserve error cause chain
- Phase 5: Add targeted tests including `geminiChat_network_retry.test.ts`

**Critical risks (from critique):**
- `AbortError` / user cancellation must NEVER be retried — add explicit guard
- Connection-phase detection must be precise: errors after headers but before first chunk are tricky
- Retry adds latency to tool fetches — define per-attempt timeout vs total timeout budget
- HTTP non-idempotent methods in `direct-web-fetch` would be dangerous to retry; verify GET-only

**Requires:** R12 complete first (establishes retry baseline and verifies no-code-change claim before R13 modifies retry.ts).

**R13-verify:** Full suite

---

#### Batch R14: 205d0f456e9c — Extensions GitHub API 415 fix - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.R14`
**Plan:** [205d0f456e9c-plan.md](./205d0f456e9c-plan.md) | **Critique:** [205d0f456e9c-critique.md](./205d0f456e9c-critique.md)

**Action:** Fix GitHub download 415 error. Add internal `DownloadOptions` interface. Update `downloadFile()` to accept optional headers, respect redirect depth limit (10), resolve relative `Location` URLs, and add write-stream error handling. Update `downloadFromGitHubRelease()` to pass `Accept: application/vnd.github+json` for tarball/zipball downloads vs `application/octet-stream` for binary assets.

**TDD required:** The plan has a detailed 14-test TDD sequence (Tests 1–14). Follow the fail-first workflow for each test group.

**Key additions from critique:**
- Test 5: resolve relative Location URL against current request URL
- Test 4: follow 307 and 308 redirects (not just 301/302)
- Test 6: off-by-one boundary test for redirect limit (exactly 10 allowed, reject at 11th)
- Test 9: write-stream error causes promise rejection
- Test 10: GITHUB_TOKEN auth header

**No deps on other R batches.**

**R14-verify:** Full suite

---

#### Batch R15: ec9a8c7a7293 — User-scoped extension settings
Phase ID: `PLAN-20250219-GMERGE021.R15`
**Plan:** [ec9a8c7a7293-plan.md](./ec9a8c7a7293-plan.md) | **Critique:** [ec9a8c7a7293-critique.md](./ec9a8c7a7293-critique.md)

**Action:** Add `SettingsScope` enum. Add scope support to settings storage (workspace scope uses `process.cwd()/.env`). Update `getExtensionEnvironment()` to merge user+workspace settings with workspace taking precedence. Add `--scope` flag to `extensions settings set`. Update `extensions settings list` to show scope provenance.

**Critical risks (from critique):**
- `process.cwd()` instability: invocation from subdirectory creates different scope key — define canonical workspace identity (repo root vs cwd) and canonicalize paths
- Writing to workspace `.env` may collide with project env — consider extension-specific prefix or separate file
- Existing stored settings become unreachable if keychain naming changes — add fallback lookup for pre-scope keys
- Redaction: sensitive settings must not appear in list output regardless of scope

**Requires:** R10 complete first (settings commands foundation).

**R15-verify:** `npm run lint && npm run typecheck`

---

#### Batch R16: d35a1fdec71b — Missing extension config, skip hooks - FULL VERIFY
Phase ID: `PLAN-20250219-GMERGE021.R16`
**Plan:** [d35a1fdec71b-plan.md](./d35a1fdec71b-plan.md)

**Action:** In `github.ts`, change `ExtensionUpdateState.ERROR` to `ExtensionUpdateState.NOT_UPDATABLE` when local extension cannot be loaded (it's not an error — it's just not updatable). Log a warning instead of an error. Optionally gate hook loading in extension loading when `enableHooks: false` (if LLxprt loads hooks anywhere — verify first).

**Straightforward change.** No major risks beyond confirming the right LLxprt state before applying (the plan already does this analysis well).

**Requires:** R15 and R14 complete first (extension loading must be stable).

**R16-verify:** Full suite

---

## Todo List

```javascript
todo_write({
  todos: [
    // PICK batches
    { id: "B1-exec",   content: "Batch 1 PICK: cherry-pick 035bea36..f588219b (5 commits) (Subagent: cherrypicker)", status: "pending" },
    { id: "B1-verify", content: "Batch 1 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "B1-review", content: "Batch 1 REVIEW: lint + typecheck (Subagent: reviewer)", status: "pending" },
    { id: "B2-exec",   content: "Batch 2 PICK: cherry-pick 9bc5a4d6..0a2971f9 (5 commits) (Subagent: cherrypicker)", status: "pending" },
    { id: "B2-verify", content: "Batch 2 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "B2-review", content: "Batch 2 REVIEW: FULL VERIFY (Subagent: reviewer)", status: "pending" },
    { id: "B3-exec",   content: "Batch 3 PICK: cherry-pick b27cf0b0..2d1c1ac5 (5 commits) (Subagent: cherrypicker)", status: "pending" },
    { id: "B3-verify", content: "Batch 3 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "B3-review", content: "Batch 3 REVIEW: lint + typecheck (Subagent: reviewer)", status: "pending" },
    { id: "B4-exec",   content: "Batch 4 PICK: cherry-pick 0c7ae22f..d284fa66 (5 commits) (Subagent: cherrypicker)", status: "pending" },
    { id: "B4-verify", content: "Batch 4 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "B4-review", content: "Batch 4 REVIEW: FULL VERIFY (Subagent: reviewer)", status: "pending" },
    { id: "B5-exec",   content: "Batch 5 PICK: cherry-pick 934b309b..025e450a (5 commits) (Subagent: cherrypicker)", status: "pending" },
    { id: "B5-verify", content: "Batch 5 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "B5-review", content: "Batch 5 REVIEW: lint + typecheck (Subagent: reviewer)", status: "pending" },
    { id: "B6-exec",   content: "Batch 6 PICK: cherry-pick 389cadb0..560550f5 (5 commits) (Subagent: cherrypicker)", status: "pending" },
    { id: "B6-verify", content: "Batch 6 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "B6-review", content: "Batch 6 REVIEW: FULL VERIFY (Subagent: reviewer)", status: "pending" },
    { id: "B7-exec",   content: "Batch 7 PICK: cherry-pick afd4829f..674494e8 (5 commits) (Subagent: cherrypicker)", status: "pending" },
    { id: "B7-verify", content: "Batch 7 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "B7-review", content: "Batch 7 REVIEW: lint + typecheck (Subagent: reviewer)", status: "pending" },
    { id: "B8-exec",   content: "Batch 8 PICK: cherry-pick 1f813f6a (1 commit - a2a restore) (Subagent: cherrypicker)", status: "pending" },
    { id: "B8-verify", content: "Batch 8 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "B8-review", content: "Batch 8 REVIEW: FULL VERIFY (Subagent: reviewer)", status: "pending" },

    // REIMPLEMENT batches (in dependency order)
    { id: "R1-exec",   content: "REIMPLEMENT 533a3fb3: MessageBus always true (Subagent: typescriptexpert)", status: "pending" },
    { id: "R1-verify", content: "R1 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R1-review", content: "R1 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R8-exec",   content: "REIMPLEMENT 3da4fd5f: ACP credential cache (Subagent: typescriptexpert)", status: "pending" },
    { id: "R8-verify", content: "R8 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R8-review", content: "R8 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R9-exec",   content: "REIMPLEMENT 470f3b05: Remove example extension (pre-scan then delete) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R9-verify", content: "R9 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R9-review", content: "R9 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R12-exec",  content: "REIMPLEMENT 6a3b56c5: Retry logic fetch errors (verify-only with targeted tests) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R12-verify","content": "R12 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R12-review", content: "R12 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R13-exec",  content: "REIMPLEMENT dd3fd73f: API response error handling (5-phase) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R13-verify", content: "R13 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "R13-review", content: "R13 REVIEW: FULL VERIFY (Subagent: deepthinker)", status: "pending" },
    { id: "R3-exec",   content: "REIMPLEMENT bdbbe923: MCP url consolidation (major rewrite) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R3-verify", content: "R3 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R3-review", content: "R3 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R14-exec",  content: "REIMPLEMENT 205d0f45: Extensions GitHub 415 fix (TDD, 14 tests) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R14-verify", content: "R14 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "R14-review", content: "R14 REVIEW: FULL VERIFY (Subagent: deepthinker)", status: "pending" },
    { id: "R10-exec",  content: "REIMPLEMENT e0a2227f: Per-extension settings commands (Subagent: typescriptexpert)", status: "pending" },
    { id: "R10-verify", content: "R10 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "R10-review", content: "R10 REVIEW: FULL VERIFY (Subagent: deepthinker)", status: "pending" },
    { id: "R15-exec",  content: "REIMPLEMENT ec9a8c7a: User-scoped extension settings (Subagent: typescriptexpert)", status: "pending" },
    { id: "R15-verify", content: "R15 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R15-review", content: "R15 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R16-exec",  content: "REIMPLEMENT d35a1fde: Missing extension config handling (Subagent: typescriptexpert)", status: "pending" },
    { id: "R16-verify", content: "R16 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "R16-review", content: "R16 REVIEW: FULL VERIFY (Subagent: deepthinker)", status: "pending" },
    { id: "R7-exec",   content: "REIMPLEMENT eb3312e7: Extension Hooks Security Warning (Subagent: typescriptexpert)", status: "pending" },
    { id: "R7-verify", content: "R7 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R7-review", content: "R7 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R4-exec",   content: "REIMPLEMENT 1c12da1f: Hook Session Lifecycle (flushTelemetry, PreCompress, clearCommand) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R4-verify", content: "R4 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "R4-review", content: "R4 REVIEW: FULL VERIFY (Subagent: deepthinker)", status: "pending" },
    { id: "R5-exec",   content: "REIMPLEMENT b8c038f4: Hooks Commands Panel (slash cmd + HooksList + CLI hooks cmd) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R5-verify", content: "R5 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R5-review", content: "R5 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R2-exec",   content: "REIMPLEMENT 344f2f26: Fuzzy search in settings (Fzf, press / to search) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R2-verify", content: "R2 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "R2-review", content: "R2 REVIEW: FULL VERIFY (Subagent: deepthinker)", status: "pending" },
    { id: "R11-exec",  content: "REIMPLEMENT d5e5f587: Setting search UX (TextInput, always-visible search field) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R11-verify", content: "R11 VERIFY: npm run lint && npm run typecheck", status: "pending" },
    { id: "R11-review", content: "R11 REVIEW: lint + typecheck (Subagent: deepthinker)", status: "pending" },
    { id: "R6-exec",   content: "REIMPLEMENT 8d4082ef: Hook System Documentation (5 phases) (Subagent: typescriptexpert)", status: "pending" },
    { id: "R6-verify", content: "R6 VERIFY: FULL VERIFY suite", status: "pending" },
    { id: "R6-review", content: "R6 REVIEW: FULL VERIFY (Subagent: deepthinker)", status: "pending" },

    // Final
    { id: "FINAL-progress", content: "UPDATE PROGRESS.md with all commit hashes", status: "pending" },
    { id: "FINAL-audit",    content: "UPDATE AUDIT.md with all outcomes", status: "pending" },
    { id: "FINAL-notes",    content: "UPDATE NOTES.md with conflicts/deviations", status: "pending" },
  ]
})
```

---

## Failure Recovery

### Cherry-pick conflict
```bash
git cherry-pick --abort
# Fix the issue, then retry the batch
```

### Review fails
1. Fix the issues
2. `git add -A && git commit -m "fix: post-batch N verification"`
3. Re-run review
4. Loop up to 5 times, then escalate

### Full verify fails
1. Check which step failed
2. Fix and commit
3. Re-run full verify
4. Continue to next batch only when green

---

## Context Recovery

If you lose context:
1. `git branch --show-current` → should be `gmerge/0.21.3`
2. `todo_read()` → find first pending item
3. Read this PLAN.md for batch details
4. Read the individual `<sha>-plan.md` for the current batch
5. Read the individual `<sha>-critique.md` for risks and gaps to close
6. Read PROGRESS.md for completed batches
7. Read NOTES.md for any conflicts/deviations
8. Resume from first pending todo item

---

## Execution Tracker

Update this table after completing each phase. "Semantic?" tracks whether semantic verification (feature actually works) was performed, not just structural verification (files exist).

| Phase | Phase ID | Status | Started | Completed | Verified | Semantic? | Notes |
|-------|----------|--------|---------|-----------|----------|-----------|-------|
| B1-exec   | PLAN-20250219-GMERGE021.B1  | [ ] | - | - | - | N/A | cherry-pick 035bea36..f588219b |
| B1-verify | —                           | [ ] | - | - | - | N/A | lint + typecheck |
| B1-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| B2-exec   | PLAN-20250219-GMERGE021.B2  | [ ] | - | - | - | N/A | cherry-pick 9bc5a4d6..0a2971f9 |
| B2-verify | —                           | [ ] | - | - | - | N/A | FULL VERIFY |
| B2-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| B3-exec   | PLAN-20250219-GMERGE021.B3  | [ ] | - | - | - | N/A | cherry-pick b27cf0b0..2d1c1ac5 |
| B3-verify | —                           | [ ] | - | - | - | N/A | lint + typecheck |
| B3-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| B4-exec   | PLAN-20250219-GMERGE021.B4  | [ ] | - | - | - | N/A | cherry-pick 0c7ae22f..d284fa66 |
| B4-verify | —                           | [ ] | - | - | - | N/A | FULL VERIFY |
| B4-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| B5-exec   | PLAN-20250219-GMERGE021.B5  | [ ] | - | - | - | N/A | cherry-pick 934b309b..025e450a |
| B5-verify | —                           | [ ] | - | - | - | N/A | lint + typecheck |
| B5-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| B6-exec   | PLAN-20250219-GMERGE021.B6  | [ ] | - | - | - | N/A | cherry-pick 389cadb0..560550f5 |
| B6-verify | —                           | [ ] | - | - | - | N/A | FULL VERIFY |
| B6-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| B7-exec   | PLAN-20250219-GMERGE021.B7  | [ ] | - | - | - | N/A | cherry-pick afd4829f..674494e8 |
| B7-verify | —                           | [ ] | - | - | - | N/A | lint + typecheck |
| B7-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| B8-exec   | PLAN-20250219-GMERGE021.B8  | [ ] | - | - | - | N/A | cherry-pick 1f813f6a |
| B8-verify | —                           | [ ] | - | - | - | N/A | FULL VERIFY |
| B8-review | —                           | [ ] | - | - | - | N/A | reviewer sign-off |
| R1-exec   | PLAN-20250219-GMERGE021.R1  | [ ] | - | - | - | [ ] | MessageBus always true |
| R1-verify | —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R1-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R8-exec   | PLAN-20250219-GMERGE021.R8  | [ ] | - | - | - | [ ] | ACP credential cache |
| R8-verify | —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R8-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R9-exec   | PLAN-20250219-GMERGE021.R9  | [ ] | - | - | - | [ ] | Remove example extension |
| R9-verify | —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R9-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R12-exec  | PLAN-20250219-GMERGE021.R12 | [ ] | - | - | - | [ ] | Retry logic (verify-only) |
| R12-verify| —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R12-review| —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R13-exec  | PLAN-20250219-GMERGE021.R13 | [ ] | - | - | - | [ ] | API response error handling |
| R13-verify| —                           | [ ] | - | - | - | [ ] | FULL VERIFY |
| R13-review| —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R3-exec   | PLAN-20250219-GMERGE021.R3  | [ ] | - | - | - | [ ] | MCP url consolidation |
| R3-verify | —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R3-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R14-exec  | PLAN-20250219-GMERGE021.R14 | [ ] | - | - | - | [ ] | Extensions GitHub 415 fix |
| R14-verify| —                           | [ ] | - | - | - | [ ] | FULL VERIFY |
| R14-review| —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R10-exec  | PLAN-20250219-GMERGE021.R10 | [ ] | - | - | - | [ ] | Per-extension settings commands |
| R10-verify| —                           | [ ] | - | - | - | [ ] | FULL VERIFY |
| R10-review| —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R15-exec  | PLAN-20250219-GMERGE021.R15 | [ ] | - | - | - | [ ] | User-scoped extension settings |
| R15-verify| —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R15-review| —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R16-exec  | PLAN-20250219-GMERGE021.R16 | [ ] | - | - | - | [ ] | Missing extension config |
| R16-verify| —                           | [ ] | - | - | - | [ ] | FULL VERIFY |
| R16-review| —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R7-exec   | PLAN-20250219-GMERGE021.R7  | [ ] | - | - | - | [ ] | Extension Hooks Security |
| R7-verify | —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R7-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R4-exec   | PLAN-20250219-GMERGE021.R4  | [ ] | - | - | - | [ ] | Hook Session Lifecycle |
| R4-verify | —                           | [ ] | - | - | - | [ ] | FULL VERIFY |
| R4-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R5-exec   | PLAN-20250219-GMERGE021.R5  | [ ] | - | - | - | [ ] | Hooks Commands Panel |
| R5-verify | —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R5-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R2-exec   | PLAN-20250219-GMERGE021.R2  | [ ] | - | - | - | [ ] | Fuzzy search in settings |
| R2-verify | —                           | [ ] | - | - | - | [ ] | FULL VERIFY |
| R2-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R11-exec  | PLAN-20250219-GMERGE021.R11 | [ ] | - | - | - | [ ] | Setting search UX |
| R11-verify| —                           | [ ] | - | - | - | [ ] | lint + typecheck |
| R11-review| —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| R6-exec   | PLAN-20250219-GMERGE021.R6  | [ ] | - | - | - | [ ] | Hook System Documentation |
| R6-verify | —                           | [ ] | - | - | - | [ ] | FULL VERIFY |
| R6-review | —                           | [ ] | - | - | - | [ ] | deepthinker sign-off |
| FINAL     | —                           | [ ] | - | - | - | N/A | PROGRESS + AUDIT + NOTES |
