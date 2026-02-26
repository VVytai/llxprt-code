# PICK Batch 1 cherry-pick safety review (gmerge/0.22.0)

Branch reviewed: `gmerge/0.22.0`

## 1) `68ebf5d655ef94b364e8d97f955d3011423d4221`
**Summary:** typo fix in `packages/cli/src/nonInteractiveCli.ts` comment (`fall` -> `falls`)

**Target file exists:** YES (`packages/cli/src/nonInteractiveCli.ts`)

**Context comparison:**
- LLxprt currently has the exact old comment text:
  - `// Otherwise, slashCommandResult fall through to the default prompt`
- Upstream commit only changes that comment grammar.

**Assessment:** **CLEAN**
- Expected to apply with no conflicts.
- No functional behavior changes.

**Branding issues:** None.

---

## 2) `22e6af414a9c273052bb07facfdaf0fe7543de4f`
**Summary:** improved Google error parsing in:
- `packages/core/src/utils/googleErrors.ts`
- `packages/core/src/utils/googleQuotaErrors.ts`
- plus corresponding tests

**Target files exist:** YES

**Context comparison:**
- `googleErrors.ts` in LLxprt already appears to include the upstream logic:
  - `if (code && message)` (not gated by `Array.isArray(errorDetails)`)
  - optional array handling for `errorDetails`
  - fallback brace-based JSON extraction (`firstBrace/lastBrace`) in `fromApiError`
- `googleQuotaErrors.ts` is **not** identical to upstream:
  - LLxprt still has fallback regex parsing and `return error; // Not a 429 error we can handle.`
  - It does **not** show upstream’s additional condition `googleApiError.details.length === 0` or use `googleApiError?.message` for fallback parsing.
- Test files from upstream may not apply cleanly if local test structure diverged.

**Assessment:** **CONFLICT** (partial already-present code + partial divergence)
- `googleErrors.ts` portion likely already applied/cherry-picked previously (risk of duplicate/empty hunks).
- `googleQuotaErrors.ts` likely needs manual merge for the exact fallback behavior change.
- Test hunks may conflict depending on local test drift.

**Branding issues:** None.

---

## 3) `2d3db9706785ab6b4f699d2e3133f90627d8db65`
**Summary:** detect MCP tool errors when `isError` is top-level on response in `packages/core/src/tools/mcp-tool.ts` (+ test)

**Target file exists:** YES (`packages/core/src/tools/mcp-tool.ts`)

**Context comparison:**
- LLxprt currently has legacy nested check:
  - `const error = (response as { error?: McpError })?.error;`
- LLxprt does **not** currently include upstream top-level `isError` check block.

**Assessment:** **CLEAN**
- Likely applies cleanly (context around nested check matches).
- Functional improvement is additive and backward-compatible.

**Branding issues:** None.

---

## 4) `bb33e281c09cd240f023e4bc5c85aa8df31f4f84`
**Summary:** IDE extension writes auth token env var in `packages/vscode-ide-companion/src/ide-server.ts` (+ test updates)

**Target file exists:** YES

**Context comparison:**
- LLxprt already uses rebranded env vars:
  - `LLXPRT_CODE_IDE_SERVER_PORT`
  - `LLXPRT_CODE_IDE_WORKSPACE_PATH`
- Upstream commit introduces Gemini-branded token var:
  - `GEMINI_CLI_IDE_AUTH_TOKEN`
- LLxprt file currently has no auth token env var constant or write call.

**Assessment:** **NEEDS_ADAPTATION**
- Code likely merges mechanically with conflicts or semantic mismatch due to branding divergence.
- Must adapt constant name to LLxprt branding (`LLXPRT_CODE_IDE_AUTH_TOKEN`) rather than upstream Gemini name.
- Tests must likewise assert LLxprt-branded variable, not Gemini-branded one.

**Branding issues:** **YES (critical)**
- `GEMINI_CLI_IDE_AUTH_TOKEN` must not be carried over unchanged.

---

## 5) `12cbe320e44b236919eead036c5e326c4d167100`
**Summary:** allow `codebase_investigator` in read-only policy (`packages/core/src/policy/policies/read-only.toml`)

**Target file exists:** YES

**Context comparison:**
- LLxprt `read-only.toml` already has many tool allow rules beyond upstream baseline (e.g., `exa_web_search`, todo tools, `list_subagents`).
- File ending differs from upstream, so exact trailing hunk placement may not match.
- `codebase_investigator` is not currently present.

**Assessment:** **NEEDS_ADAPTATION**
- Semantic change is straightforward (add allow rule), but patch may not apply at exact line offsets due to local tail divergence.
- Manual insertion is low-risk.

**Branding issues:** None.

---

## Overall batch verdict
**NEEDS_SPLITTING**

Recommended cherry-pick strategy:
1. Cherry-pick `68ebf5d...` and `2d3db97...` directly (low risk).
2. Handle `22e6af4...` separately with manual review (partially already present + partial divergence).
3. Apply `bb33e28...` with explicit LLxprt branding adaptation (`LLXPRT_CODE_IDE_AUTH_TOKEN`) and test adjustments.
4. Apply `12cbe320...` as manual policy edit if hunk fails due to file-tail drift.

Net: batch is **not fully safe as one-shot**, primarily due to commit #2 partial overlap and commit #4 branding adaptation requirements.