# Progress: gmerge/0.22.0

| Batch | Type | Upstream SHA(s) | Status | LLxprt Commit | Notes |
|------:|------|-----------------|--------|---------------|-------|
| 1A | PICK x2 | 68ebf5d6, 2d3db970 | DONE | fabaa7805, 6ff6ae665 | Minor conflict on typo fix; pre-existing typecheck failures |
| 1B | PICK x3 | 22e6af41, bb33e281, 12cbe320 | DONE | 0d359bd31, 6d0015557, 1824063ed | Conflicts resolved; branding fixed |
| 2 | REIMPLEMENT | d4506e0f (transcript_path) | DONE | 01d0258b2 | Config getter/setter + hookEventHandler integration |
| 3 | REIMPLEMENT | 54de6753 (stats polish) | DONE | 31cc66f0f | Labels, colors, uncached math; snapshot gap for StatsDisplay |
| 4 | REIMPLEMENT | 86134e99 (settings validation) | DONE | 4ec5634d7 | Zod schema from SETTINGS_SCHEMA; 51 new tests |
| 5 | REIMPLEMENT | 299cc9be (A2A /init) | DONE | 95e0a738f | A2A /init command + streaming + auto-execute |
| 6 | REIMPLEMENT | 1e734d7e (drag/drop) | DONE | faa2af9ba | Multi-file drag/drop with escaped space handling |
| 7 | REIMPLEMENT | 3b2a4ba2 (IDE ext refactor) | DONE | b50c3ac33+ebbdb642f | Port file, 1-based chars, truncation + lint fix + reader compat |
| 8 | PICK x5 | e84c4bfb, edbe5480, 20164ebc, d2a1a456, d9f94103 | DONE | 2f2a008b1..777736d10 | All clean; clearcut properly excluded |
| 9 | REIMPLEMENT | 6dea66f1 (stats flex) | DONE | 552a7e72a | Remove flex from stats; test gap persists from B3 |
| 10 | REIMPLEMENT | 5f298c17 (always-allow) | TODO | | HIGH RISK |
| 11 | REIMPLEMENT | a47af8e2 (commandPrefix) | TODO | | |
| 12 | REIMPLEMENT | 126c32ac (hook refresh) | TODO | | |
| 13 | REIMPLEMENT | 942bcfc6 (typecasts) | TODO | | |
| 14 | PICK x4 | ec665ef4, bb0c0d8e, 79f664d5, ed4b440b | TODO | | |
| 15 | REIMPLEMENT | 217e2b0e (non-interactive) | TODO | | |
| 16 | REIMPLEMENT | d236df5b (tool fragmentation) | TODO | | HIGH RISK |
| 17 | REIMPLEMENT | 0c3eb826 (A2A interactive) | TODO | | |
| 18 | CLEANUP | findFiles removal | TODO | | |
