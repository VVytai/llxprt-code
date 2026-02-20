# Notes: v0.20.2 → v0.21.3

## Running Notes

*(Add notes after each batch)*

---

## Pre-Execution Notes

### Key Decisions Made During Planning

1. **Model routing commits** - All SKIP per user directive. LLxprt lets users control models.

2. **Flash 3 config (9b571d42)** - SKIP. Contains Google internal codename "skyhawk" with TODO saying "SHOULD NOT be merged".

3. **ModelDialog (17bf02b9)** - SKIP. LLxprt's is 628 lines vs upstream's 209 lines. Completely diverged with hardcoded Gemini model names.

4. **MessageBus (533a3fb3)** - REIMPLEMENT as hardcoded `true`. No setting, just always on.

5. **A2A commits** - Now included (removed "A2A stays private" from runbook).

6. **previewFeatures in a2a (2c4ec31ed)** - SKIP. Related to model routing stuff.

### Files to Watch

- `packages/core/src/config/config.ts` - MessageBus change
- `packages/core/src/hooks/` - LLxprt's reimplemented hooks
- `packages/cli/src/config/extensions/` - LLxprt's reimplemented extensions
- `packages/core/src/utils/retry.ts` - LLxprt's retry logic

### cherrypicking.md Updates Made

Added to "Features Completely Removed" section:
- Model Routing / Availability Service
- Hooks System Commits (reimplemented)
- Extensions System Commits (reimplemented)
- Settings UI Commits (diverged)
- Banner/Static Refresh Commits
- Stdio Patching Commits

### cherrypicking-runbook.md Updates Made

- Removed "A2A server stays private" constraint

---

## Batch Notes

### Batch 1
*(pending)*

### Batch 2
*(pending)*

...
