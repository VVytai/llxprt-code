# Audit: gmerge/0.22.0 (v0.21.3 → v0.22.0)

## Reconciliation Table

| Upstream SHA | Decision | LLxprt Commit(s) | Notes |
|-------------|----------|-------------------|-------|
| `3f5f030d` | SKIPPED | — | Already LLXPRT_CODE_IDE_AUTH_TOKEN |
| `28001873` | SKIPPED | — | Gemini-specific quota API |
| `aced4010` | SKIPPED | — | CodebaseInvestigator removed |
| `d90356e8` | SKIPPED | — | GitHub workflow |
| `d2a6b303` | SKIPPED | — | ClearcutLogger |
| `ee6556cb` | SKIPPED | — | readFirstUserMessage superior |
| `1954f45c` | SKIPPED | — | pathCorrector never adopted |
| `68ebf5d6` | PICKED | fabaa7805 | B1A: typo fix |
| `c8b68865` | SKIPPED | — | Gemini 3 model config |
| `22e6af41` | PICKED | 0d359bd31 | B1B: error parsing (conflict resolved) |
| `648041c6` | SKIPPED | — | extensionSettings completely different |
| `d4506e0f` | REIMPLEMENTED | 01d0258b2 | B2: transcript_path hooks |
| `91b15fc9` | SKIPPED | — | Gemini DelegateToAgentTool |
| `8c83e1ea` | SKIPPED | — | availabilityService doesn't exist |
| `24fca1b7` | SKIPPED | — | Nightly release |
| `2d3db970` | PICKED | 6ff6ae665 | B1A: MCP tool error detection |
| `927102ea` | SKIPPED | — | GitHub workflow |
| `d818fb1d` | SKIPPED | — | Gemini frontend command |
| `54de6753` | REIMPLEMENTED | 31cc66f0f | B3: stats display polish |
| `86134e99` | REIMPLEMENTED | 4ec5634d7 | B4: Zod settings validation |
| `bb33e281` | PICKED | 6d0015557 | B1B: IDE auth env var (branding fixed) |
| `a02abcf5` | SKIPPED | — | Express already 5.2.1 |
| `299cc9be` | REIMPLEMENTED | 95e0a738f | B5: A2A /init command |
| `1e734d7e` | REIMPLEMENTED | faa2af9ba | B6: multi-file drag/drop |
| `12cbe320` | PICKED | 1824063ed | B1B: policy codebase_investigator |
| `3b2a4ba2` | REIMPLEMENTED | b50c3ac33+ebbdb642f | B7: IDE ext refactor (with remediation) |
| `e84c4bfb` | PICKED | 2f2a008b1 | B8: IDE license generation |
| `edbe5480` | PICKED | a2dfa48ac | B8: subagent policy fix |
| `20164ebc` | PICKED | bff0d1c73 | B8: IDE detection tests (clearcut excluded) |
| `6dea66f1` | REIMPLEMENTED | 552a7e72a | B9: stats flex removal |
| `d2a1a456` | PICKED | 04b201c6b | B8: license field |
| `5f298c17` | REIMPLEMENTED | 42ee44f76 | B10: persistent always-allow policies [HIGH RISK] |
| `5b56920f` | SKIPPED | — | Nightly release |
| `a47af8e2` | REIMPLEMENTED | 37046bac1..af9fe6e23 | B11: commandPrefix safety [SECURITY] |
| `977248e0` | SKIPPED | — | Gemini contributing docs |
| `126c32ac` | REIMPLEMENTED | b3e72bc93..19549a05b | B12: hook refresh + disposal |
| `ad60cbfc` | SKIPPED | — | Gemini UI tips |
| `d9f94103` | PICKED | 777736d10 | B8: error message clarity |
| `fcc3b2b5` | SKIPPED | — | Nightly release |
| `942bcfc6` | REIMPLEMENTED | 3bc229f10 | B13: redundant typecasts |
| `57c7b9cc` | SKIPPED | — | Gemini-specific auth |
| `fc2a5a42` | SKIPPED | — | Safety checker → #1612 |
| `d030a1f6` | SKIPPED | — | ClearcutLogger |
| `217e2b0e` | REIMPLEMENTED | 20d74e40b | B15: non-interactive confirmation |
| `ec665ef4` | PICKED | 0902e6f58 | B14: integration test cleanup |
| `13944b9b` | SKIPPED | — | Policy docs don't exist |
| `d236df5b` | REIMPLEMENTED | 739a86cc2 | B16: tool output fragmentation fix [HIGH RISK] |
| `bb0c0d8e` | PICKED | 59cf3330f | B14: method sig simplify |
| `79f664d5` | PICKED | 85862e923 | B14: raw token counts (PARTIAL — skip stream-json-formatter) |
| `0c3eb826` | REIMPLEMENTED | 7254da254 | B17: A2A interactive config |
| `2995af6a` | SKIPPED | — | Gemini 3 model routing |
| `5ea5107d` | SKIPPED | — | V2 migration → #1613 |
| `06dcf216` | SKIPPED | — | Release |
| `562d8454` | SKIPPED | — | Gemini 3 Flash config |
| `5eb817c4` | SKIPPED | — | Gemini 3 checkpoint |
| `ad994cfe` | SKIPPED | — | Gemini 3 model dialog |
| `48ad6983` | SKIPPED | — | Gemini 3 availabilityService |
| `16e06adb` | SKIPPED | — | Gemini 3 preview Flash |
| `9ab79b71` | SKIPPED | — | Gemini 3 fallback |
| `20e67c7b` | SKIPPED | — | Gemini 3 todos |
| `4a83eb24` | SKIPPED | — | Gemini 3 model string |
| `f25944bd` | SKIPPED | — | Gemini 3 prompt/chat |
| `4c0a2411` | SKIPPED | — | Gemini 3 access |
| `dbeda91e` | SKIPPED | — | Gemini 3 mocks |
| `c5109d75` | SKIPPED | — | Gemini branding |
| `ce2eba28` | SKIPPED | — | Gemini 3 docs |
| `d1e040aa` | SKIPPED | — | Gemini 3 schema |
| `76414c1c` | SKIPPED | — | Gemini 3 goldens |
| `c1554715` | SKIPPED | — | Release |
| `a585bfa9` | SKIPPED | — | Release patch |
| `a6841f41` | SKIPPED | — | Release |
| `ed4b440b` | PICKED | aa78bffe7 | B14: quota error fix |
| `f9331b16` | SKIPPED | — | Release |
| `994edeb9` | SKIPPED | — | Release |

## Summary

| Decision | Count |
|----------|-------|
| PICKED | 14 |
| SKIPPED | 46 |
| REIMPLEMENTED | 14 |
| **Total** | **74** |

## Execution Status: COMPLETE

All 18 batches executed. 17 had changes applied; B18 was a no-op (findFiles already removed).
- 14 PICKED commits: all applied (1 partial — 79f664d5 skipped stream-json-formatter)
- 14 REIMPLEMENTED commits: all implemented with TDD (RED→GREEN→REFACTOR)
- 46 SKIPPED commits: verified not applicable to LLxprt
- Remediations needed: B7 (lint+reader compat), B11 (rm/rmdir test), B14 (branding+syntax)
