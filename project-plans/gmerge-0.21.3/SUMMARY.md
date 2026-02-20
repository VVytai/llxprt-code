# Cherry-Pick Summary: v0.20.2 → v0.21.3 (FINAL)

## Overview

Syncing LLxprt Code from upstream gemini-cli **v0.20.2** to **v0.21.3**.

- **Date range:** 2025-12-02 to 2025-12-19 (17 days)
- **Total commits:** 122

## Decision Counts (Final - Verified)

| Decision | Count | % |
|----------|-------|---|
| **PICK** | 34 | 28% |
| **SKIP** | 71 | 58% |
| **REIMPLEMENT** | 17 | 14% |

## Verification Performed

| Commit | Verified By | Result |
|--------|-------------|--------|
| 035bea36 (integration tests) | File check | PICK - files exist |
| 205d0f45 (extensions 415 fix) | Subagent | REIMPLEMENT - extensions diverged |
| 9b571d42 (flash 3 config) | Diff review | SKIP - "skyhawk" codename, TODO says don't merge |
| 17bf02b9 (ModelDialog) | Line count | SKIP - 628 vs 209 lines, hardcoded Gemini models |
| 86a77786 (banner text) | Diff review | SKIP - Gemini 3 preview banner |
| 344f2f26 (fuzzy search) | Line count | REIMPLEMENT - SettingsDialog diverged |
| 6f3b56c5 (retry logic) | File review | REIMPLEMENT - own retry.ts |

## Major Features Being Picked

1. **MCP Resources** (`560550f5`) - Major new MCP capability
2. **MCP Dynamic Tools** (`5f60281d`) - `notifications/tools/list_changed`
3. **Shell bug fixes** (`d284fa66`, `84f521b1`) - Truncation fix, cursor visibility
4. **Security** (`54c62d58`) - npm audit vulnerabilities
5. **Floating promises lint rule** (`025e450a`)
6. **Audio improvements** (`84c07c8f`)
7. **Auto-execute slash commands** (`89570aef`)
8. **Session summaries** (`616d6f66`)
9. **OSC52 copy for remote sessions** (`9bc5a4d6`) - New feature
10. **MessageBus enabled by default** (`533a3fb3`)

## Why 71 SKIPs?

| Category | Count | Examples |
|----------|-------|----------|
| Release churn | 18 | Version bumps, preview releases |
| GitHub workflows | 15 | e2e chains, triage, labeler |
| Model routing/availability | 9 | availabilityService, preview access |
| Hooks/Extensions divergence | 8 | All touch reimplemented systems |
| Google telemetry | 5 | ClearcutLogger, OTEL events |
| Gemini-specific docs | 4 | Gemini 3 docs, homebrew |
| UI divergence | 3 | ModelDialog, banner text, flash 3 config |
| Emoji-related | 2 | Markdown emoji, debug console |
| Already done (0.20.2) | 1 | stdio patching |
| Test files don't exist | 1 | GeminiRespondingSpinner.test.tsx |
| Partial commits | 3 | "Address feedback", "checkpoint" |
| Other | 2 | Misc |

## REIMPLEMENT Summary

These 17 commits touch systems LLxprt reimplemented:

- **Hooks (4):** 1c12da1f, b8c038f4, 8d4082ef, eb3312e7
- **Extensions (4):** 470f3b05, e0a2227f, 205d0f45, ec9a8c7a
- **Settings UI (3):** 344f2f26, d5e5f58, d35a1fde
- **Retry logic (2):** 6f3b56c5, dd3fd73f
- **MCP config (1):** bdbbe923
- **Auth (1):** 3da4fd5f
- **A2A (2):** 2c4ec31e, 1f813f6a

## Tracking

- **Branch:** `gmerge/0.21.3`
- **Plan folder:** `project-plans/gmerge-0.21.3/`
- **cherrypicking.md updated:** Added model routing, hooks, extensions, banner, stdio to Skip section
