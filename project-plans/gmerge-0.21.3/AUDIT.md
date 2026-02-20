# Audit: v0.20.2 → v0.21.3

## Post-Implementation Reconciliation

| Upstream SHA | Decision | LLxprt Commit(s) | Notes |
|--------------|----------|------------------|-------|
| 828afe113ea8 | SKIP | - | Already REIMPLEMENT'd in 0.20.2 |
| ed10edbf0d12 | SKIP | - | Release churn |
| 344f2f26e78e | REIMPLEMENT | | Fuzzy search in settings |
| 533a3fb312ad | REIMPLEMENT | | MessageBus always true |
| 145fb246a661 | SKIP | - | Docs --debug vs --verbose |
| bdbbe9232d23 | REIMPLEMENT | | MCP url consolidation |
| 035bea3699f1 | PICK | | Restrict integration tests tools |
| 92e95ed8062e | SKIP | - | Google telemetry |
| b9b3b8050d48 | SKIP | - | Google telemetry |
| 08573459450b | PICK | | refactor(editor): const assertion |
| 54c62d580c05 | PICK | | fix(security): npm audit |
| 7a6d3067c647 | PICK | | Enterprise instructions |
| 1c12da1fad14 | REIMPLEMENT | | Hook Session Lifecycle |
| 08067acc7173 | SKIP | - | LLxprt has own banner |
| b8c038f41f82 | REIMPLEMENT | | Hooks Commands Panel |
| f588219bb9bf | PICK | | Bundle default policies |
| 8d4082ef2e38 | REIMPLEMENT | | Hook System Documentation |
| 00705b14bdb7 | SKIP | - | Test files don't exist |
| 939cb67621e1 | SKIP | - | GitHub workflow |
| eb3312e7baaf | REIMPLEMENT | | Extension Hooks Security |
| 153d01a01e76 | SKIP | - | enableAgents - model routing |
| a28be4a4e0e3 | SKIP | - | todos.md doesn't exist |
| 1e6243045e14 | SKIP | - | Emoji-related |
| 3da4fd5f7dc6 | REIMPLEMENT | | ACP credential cache |
| 518e73ac9f8b | PICK | | CJK word navigation |
| 470f3b057f59 | REIMPLEMENT | | Remove example extension |
| e0a2227faf8a | REIMPLEMENT | | Per-extension settings |
| 7b811a38a679 | SKIP | - | Memory test naming |
| 9bc5a4d64f4c | PICK | | OSC52 copy support |
| d5e5f58737a0 | REIMPLEMENT | | Setting search UX |
| 46bb07e4b779 | SKIP | - | Gemini branding |
| b745d46395a7 | PICK | | Setting toggle fix |
| 6f3b56c5b6a8 | REIMPLEMENT | | Retry logic fetch errors |
| 48e8c12476b6 | PICK | | Remove unused isSearching |
| 0a2971f9d30c | PICK | | MCP --type alias |
| b27cf0b0a8dd | PICK | | Key restore logic to core |
| 1040c246f5a0 | PICK | | MCP auto-execute Enter |
| 84f521b1c62b | PICK | | Cursor visibility |
| 8b0a8f47c1b2 | PICK | | Session id in json |
| 205d0f456e9c | REIMPLEMENT | | Extensions GitHub 415 |
| 2d1c1ac5672e | PICK | | Compression attempt flag |
| 0c7ae22f5def | PICK | | Disable flaky test |
| 5f60281d2528 | PICK | | MCP dynamic tool update |
| ae8694b30f6e | PICK | | Privacy screen fix |
| 7db5abdecfdf | PICK | | API error fix |
| d284fa66c015 | PICK | | Shell truncation fix |
| 934b309b4cc6 | PICK | | Terminal wrapping fix |
| 616d6f666705 | NO_OP (out-of-range) | - | Ancestor of v0.20.2; not in v0.20.2..v0.21.3 scope |
| dd3fd73ffe9a | REIMPLEMENT | | API response error handling |
| 996cbcb680fd | PICK | | Model routing docs |
| 2c4ec31ed170 | SKIP | - | previewFeatures - model routing |
| bdd15e8911ba | PICK | | Detach autoupgrade |
| 025e450ac247 | PICK | | Floating promises lint |
| 389cadb06ad6 | PICK | | Non-interactive freeze fix |
| 84c07c8fa174 | PICK | | Audio file reading |
| 89570aef0633 | PICK | | Slash command auto-execute |
| ec9a8c7a7293 | REIMPLEMENT | | User-scoped ext settings |
| 171103aedc9f | PICK | | Env var handling |
| d35a1fdec71b | REIMPLEMENT | | Missing ext config |
| 560550f5df78 | PICK | | MCP Resources |
| afd4829f1096 | PICK | | Clipboard image formats |
| 1f813f6a060e | PICK | | a2a restore command |
| 674494e80b66 | PICK | | a2a final:true |
| 364b12e2fae5 | PICK | | Express 5.2.0 |
| 6e51bbc21570 | PICK | | a2a prompt_id |
| d591140f62ff | PICK | | Prompt and chat code fix |
| 9b571d42b10d | SKIP | - | "skyhawk" codename |
| 17bf02b90183 | SKIP | - | ModelDialog diverged |
| 86a777865f5b | SKIP | - | Gemini 3 banner |
| (releases) | SKIP | - | Release churn (18 commits) |
| (workflows) | SKIP | - | GitHub workflows (15 commits) |
| (telemetry) | SKIP | - | Google telemetry (5 commits) |
| (model routing) | SKIP | - | Model routing (9 commits) |

## Summary

- **PICK:** 35 commits
- **SKIP:** 68 commits  
- **REIMPLEMENT:** 18 commits
- **NO_OP (out-of-range):** 1 commit
- **Total:** 122 commits
