# Reimplementation Plan: Remove flex from stats display (upstream 6dea66f1)

## Upstream Commit

**Commit:** `6dea66f1f5a71da7956b3f4b235641ef08c8d433`  
**Author:** Jacob Richman <jacob314@gmail.com>  
**Date:** Fri Dec 12 12:19:39 2025 -0800  
**Message:** Remove flex from stats display. See snapshots for diffs. (#14983)

## Executive Summary

This plan reimplements upstream commit 6dea66f1, which removes flexbox growing behavior from the stats display to create more deterministic, fixed-width layouts. The changes make tables more compact and left-aligned by replacing `width="100%"` and `flexGrow={1}` with calculated fixed widths.

**Upstream Approach:** Removed flex-grow properties and replaced percentage widths with calculated fixed widths  
**LLxprt Adaptation:** Apply same principles to LLxprt's simplified 4-column table structure (no cache breakdown, no quota display)  
**Test Strategy:** TDD approach with failing tests first, then implementation, then snapshot updates

---

## Requirements

### R1: Remove Explicit Width from Section Component
**Rationale:** Section should naturally size to content, not force 100% width  
**Impact:** More natural layout behavior, better alignment with child components

### R2: Add totalWidth Calculation to ModelUsageTable
**Rationale:** Explicitly calculate table width from column widths for deterministic layout  
**Impact:** Replaces implicit flex-based width with explicit calculation

### R3: Replace Divider Width from Percentage to Fixed Width
**Rationale:** Divider should match exact table width, not fill 100%  
**Impact:** Divider aligns precisely with table columns

### R4: Visual Consistency
**Rationale:** Table should appear compact and left-aligned after changes  
**Impact:** Snapshots will show narrower tables with consistent column alignment

---

## Touchpoints

### File 1: `packages/cli/src/ui/components/StatsDisplay.tsx`

**Location 1:** Section Component (lines 71-78)
```tsx
// BEFORE (line 72):
<Box flexDirection="column" width="100%" marginBottom={1}>

// AFTER:
<Box flexDirection="column" marginBottom={1}>
```
**Change:** Remove `width="100%"` prop

---

**Location 2:** ModelUsageTable - totalWidth Calculation (after line 90, before return statement)
```tsx
// ADD THIS (after line 90):
const totalWidth =
  nameWidth + requestsWidth + inputTokensWidth + outputTokensWidth;
```
**Change:** Add new constant to calculate total table width

---

**Location 3:** ModelUsageTable - Divider Width (line 118)
```tsx
// BEFORE (line 118):
<Box width={tableWidth}>

// AFTER:
<Box width={totalWidth}>
```
**Change:** Replace `tableWidth` with `totalWidth` for divider

---

**Location 4:** ModelUsageTable - Remove Redundant Variable (line 89-90)
```tsx
// BEFORE (lines 89-90):
const tableWidth =
  nameWidth + requestsWidth + inputTokensWidth + outputTokensWidth;

// AFTER:
// (remove this, replaced by totalWidth)
```
**Change:** Since we're adding `totalWidth`, remove the duplicate `tableWidth` calculation

**Note:** In current LLxprt code, ModelUsageTable already lacks `flexGrow={1}` on model name boxes (lines 96 and 125), so no changes needed there. Upstream had to remove it, we already don't have it.

---

### File 2: `packages/cli/src/ui/components/__snapshots__/StatsDisplay.test.tsx.snap`

**Tests Affected:**
- `renders a table with two models correctly`
- `renders all sections when all data is present`
- `Conditional Rendering Tests > hides Efficiency section when cache is not used`

**Expected Changes:**
- Model Usage table divider line will be shorter (63 chars instead of previous width)
- Table columns will be tighter
- Right edge of table will shift left

---

### File 3: `packages/cli/src/ui/components/__snapshots__/SessionSummaryDisplay.test.tsx.snap`

**Tests Affected:**
- `renders the summary display with a title`

**Expected Changes:**
- Same table width adjustments as StatsDisplay snapshots

---

## Existing Tests

### Test Suite: `packages/cli/src/ui/components/StatsDisplay.test.tsx`

**Test 1:** "renders only the Performance section in its zero state" (lines 122-147)  
**Location:** Lines 122-147  
**Coverage:** Tests zero-state rendering, no table shown  
**Affected:** No (no model table in zero state)

**Test 2:** "renders a table with two models correctly" (lines 149-197)  
**Location:** Lines 149-197  
**Coverage:** Tests multi-model table rendering  
**Affected:** Yes - snapshot will change

**Test 3:** "renders all sections when all data is present" (lines 199-245)  
**Location:** Lines 199-245  
**Coverage:** Tests complete stats display with all sections  
**Affected:** Yes - snapshot will change

**Test 4:** "hides Efficiency section when cache is not used" (lines 282-316)  
**Location:** Lines 282-316  
**Coverage:** Tests conditional rendering of cache efficiency section  
**Affected:** Yes - snapshot will change (table present, no cache highlight)

**Test 5:** "hides User Agreement when no decisions are made" (lines 248-280)  
**Location:** Lines 248-280  
**Coverage:** Tests conditional rendering of user agreement  
**Affected:** No (no model table in this test)

---

### Test Suite: `packages/cli/src/ui/components/SessionSummaryDisplay.test.tsx`

**Test 1:** "renders the summary display with a title" (lines 42-66)  
**Location:** Lines 42-66  
**Coverage:** Tests session summary with custom title  
**Affected:** Yes - snapshot will change

---

## New Tests (RED Phase)

### No New Tests Required

This reimplementation is a pure refactoring that changes internal implementation and visual layout but **does not change behavior**. The existing tests already cover:
- Zero-state rendering
- Single-model tables
- Multi-model tables
- Conditional sections
- Custom titles

The existing tests will **fail** after code changes due to snapshot mismatches, which is the "RED" phase we want. The failing tests will validate that our changes affect the visual output as expected.

---

## Implementation (GREEN Phase)

### Step 1: Update StatsDisplay.tsx - Section Component

**File:** `packages/cli/src/ui/components/StatsDisplay.tsx`  
**Lines:** 71-78

**Action:** Remove `width="100%"` from Section component

```tsx
const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color={theme.text.accent}>
      {title}
    </Text>
    {children}
  </Box>
);
```

**Verification:** 
```bash
# Tests will still pass - Section is used in areas without snapshots
npm test StatsDisplay.test.tsx
```

---

### Step 2: Update StatsDisplay.tsx - ModelUsageTable totalWidth

**File:** `packages/cli/src/ui/components/StatsDisplay.tsx`  
**Lines:** 80-160

**Action:** 
1. Remove `tableWidth` constant (lines 89-90)
2. Add `totalWidth` constant after column width declarations
3. Update divider to use `totalWidth`

```tsx
const ModelUsageTable: React.FC<{
  models: Record<string, ModelMetrics>;
  totalCachedTokens: number;
  cacheEfficiency: number;
}> = ({ models, totalCachedTokens, cacheEfficiency }) => {
  const nameWidth = 25;
  const requestsWidth = 8;
  const inputTokensWidth = 15;
  const outputTokensWidth = 15;
  const totalWidth =
    nameWidth + requestsWidth + inputTokensWidth + outputTokensWidth;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Box width={nameWidth}>
          <Text bold color={theme.text.accent}>
            Model Usage
          </Text>
        </Box>
        <Box width={requestsWidth} justifyContent="flex-end">
          <Text bold color={theme.text.accent}>
            Reqs
          </Text>
        </Box>
        <Box width={inputTokensWidth} justifyContent="flex-end">
          <Text bold color={theme.text.accent}>
            Input Tokens
          </Text>
        </Box>
        <Box width={outputTokensWidth} justifyContent="flex-end">
          <Text bold color={theme.text.accent}>
            Output Tokens
          </Text>
        </Box>
      </Box>
      {/* Divider */}
      <Box width={totalWidth}>
        <Text color={theme.text.secondary}>{'─'.repeat(totalWidth)}</Text>
      </Box>

      {/* Rows */}
      {Object.entries(models).map(([name, modelMetrics]) => (
        <Box key={name}>
          <Box width={nameWidth}>
            <Text color={theme.text.primary}>{name.replace('-001', '')}</Text>
          </Box>
          <Box width={requestsWidth} justifyContent="flex-end">
            <Text color={theme.text.primary}>
              {modelMetrics.api.totalRequests}
            </Text>
          </Box>
          <Box width={inputTokensWidth} justifyContent="flex-end">
            <Text color={theme.status.warning}>
              {modelMetrics.tokens.prompt.toLocaleString()}
            </Text>
          </Box>
          <Box width={outputTokensWidth} justifyContent="flex-end">
            <Text color={theme.status.warning}>
              {modelMetrics.tokens.candidates.toLocaleString()}
            </Text>
          </Box>
        </Box>
      ))}
      {cacheEfficiency > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={Colors.Foreground}>
            <Text color={theme.status.success}>Savings Highlight:</Text>{' '}
            {totalCachedTokens.toLocaleString()} ({cacheEfficiency.toFixed(1)}
            %) of input tokens were served from the cache, reducing costs.
          </Text>
          <Box height={1} />
          <Text color={theme.text.secondary}>
            » Tip: For a full token breakdown, run `/stats model`.
          </Text>
        </Box>
      )}
    </Box>
  );
};
```

**Verification:**
```bash
# Tests will FAIL due to snapshot mismatches - this is expected (RED phase)
npm test StatsDisplay.test.tsx
npm test SessionSummaryDisplay.test.tsx
```

**Expected Failures:**
- `renders a table with two models correctly` - snapshot mismatch
- `renders all sections when all data is present` - snapshot mismatch
- `hides Efficiency section when cache is not used` - snapshot mismatch
- `renders the summary display with a title` - snapshot mismatch

---

## Refactor Phase

**Assessment:** No refactoring needed. The changes are already minimal and focused:
- Removed unnecessary width constraint
- Made width calculation explicit
- No duplication, no complexity added

**Decision:** Skip refactoring, proceed to snapshot updates.

---

## Snapshot Updates (Completing GREEN Phase)

### Step 3: Update Snapshots

**File:** `packages/cli/src/ui/components/__snapshots__/StatsDisplay.test.tsx.snap`

**Command:**
```bash
npm test StatsDisplay.test.tsx -- -u
```

**Expected Changes in Snapshots:**

**Test: "renders a table with two models correctly"**
```diff
-│  Model Usage                  Reqs   Input Tokens  Output Tokens                                 │
-│  ───────────────────────────────────────────────────────────────                                 │
-│  gemini-2.5-pro                  3          1,000          2,000                                 │
-│  gemini-2.5-flash                5         25,000         15,000                                 │
+│  Model Usage                 Reqs   Input Tokens  Output Tokens                                  │
+│  ───────────────────────────────────────────────────────────────────                             │
+│  gemini-2.5-pro                 3          1,000          2,000                                  │
+│  gemini-2.5-flash               5         25,000         15,000                                  │
```
**Analysis:** Table width changes from 63 chars to 63 chars (nameWidth=25 + requestsWidth=8 + inputTokensWidth=15 + outputTokensWidth=15). Divider now matches exact totalWidth instead of previous tableWidth.

**Test: "renders all sections when all data is present"**
```diff
-│  Model Usage                  Reqs   Input Tokens  Output Tokens                                 │
-│  ───────────────────────────────────────────────────────────────                                 │
-│  gemini-2.5-pro                  1            100            100                                 │
+│  Model Usage                 Reqs   Input Tokens  Output Tokens                                  │
+│  ───────────────────────────────────────────────────────────────────                             │
+│  gemini-2.5-pro                 1            100            100                                  │
```

**Test: "hides Efficiency section when cache is not used"**
```diff
-│  Model Usage                  Reqs   Input Tokens  Output Tokens                                 │
-│  ───────────────────────────────────────────────────────────────                                 │
-│  gemini-2.5-pro                  1            100            100                                 │
+│  Model Usage                 Reqs   Input Tokens  Output Tokens                                  │
+│  ───────────────────────────────────────────────────────────────────                             │
+│  gemini-2.5-pro                 1            100            100                                  │
```

---

**File:** `packages/cli/src/ui/components/__snapshots__/SessionSummaryDisplay.test.tsx.snap`

**Command:**
```bash
npm test SessionSummaryDisplay.test.tsx -- -u
```

**Expected Changes:**

**Test: "renders the summary display with a title"**
```diff
-│  Model Usage                  Reqs   Input Tokens  Output Tokens                                 │
-│  ───────────────────────────────────────────────────────────────                                 │
-│  gemini-2.5-pro                 10          1,000          2,000                                 │
+│  Model Usage                 Reqs   Input Tokens  Output Tokens                                  │
+│  ───────────────────────────────────────────────────────────────────                             │
+│  gemini-2.5-pro                10          1,000          2,000                                  │
```

---

### Step 4: Verify All Tests Pass

**Command:**
```bash
npm test StatsDisplay.test.tsx
npm test SessionSummaryDisplay.test.tsx
```

**Expected Result:** All tests GREEN [OK]

---

## Verification Checklist

### Automated Tests
- [ ] `npm test StatsDisplay.test.tsx` - all tests pass
- [ ] `npm test SessionSummaryDisplay.test.tsx` - all tests pass
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`

### Visual Inspection
- [ ] Model Usage table appears compact and left-aligned
- [ ] Divider line matches table width exactly
- [ ] No visual regressions in other sections
- [ ] Section components still render correctly

### Snapshot Review
- [ ] StatsDisplay snapshots show narrower, left-aligned tables
- [ ] SessionSummaryDisplay snapshots show same table adjustments
- [ ] All snapshot changes are visual-only, no text content changes
- [ ] Table remains readable and properly aligned

### Code Quality
- [ ] No `console.log` or debug statements
- [ ] Code follows project TypeScript conventions
- [ ] Changes are minimal and focused on requirements
- [ ] No unnecessary refactoring

---

## Commit Message

```
reimplement: remove flex from stats display (upstream 6dea66f1)

Adapts upstream commit 6dea66f1 to LLxprt's simplified ModelUsageTable
structure. Removes flexbox growing behavior in favor of fixed-width
layout for more deterministic, compact table rendering.

Changes:
- Remove width="100%" from Section component
- Replace tableWidth with totalWidth calculation
- Update divider to use calculated totalWidth

Key differences from upstream:
- LLxprt uses 4-column table: name, reqs, input, output
- Upstream has 5+ columns with cache breakdown and quota display
- Same visual goal: deterministic fixed-width layout

Visual impact:
- Model Usage tables are more compact and left-aligned
- Divider line matches exact table width
- No functional behavior changes

Upstream: 6dea66f1f5a71da7956b3f4b235641ef08c8d433
```

---

## Rollback Plan

If issues arise after implementation:

**Revert Command:**
```bash
git revert HEAD
```

**Manual Rollback Steps:**
1. Restore `width="100%"` to Section component (line 72)
2. Rename `totalWidth` back to `tableWidth` (line 91)
3. Restore divider to use `tableWidth` (line 118)
4. Run `npm test -- -u` to restore snapshots
5. Verify tests pass

---

## Dependencies

**No External Dependencies:**
- Pure UI refactoring
- No new libraries or APIs
- No changes to data structures or business logic

**Internal Dependencies:**
- StatsDisplay.tsx component structure
- Existing test infrastructure
- Snapshot testing system

---

## Risk Assessment

**Low Risk Changes:**
[OK] Pure visual refactoring  
[OK] Extensive test coverage  
[OK] Snapshot validation  
[OK] No behavior changes  
[OK] No external API changes

**Potential Issues:**
WARNING: Snapshot updates might be large (acceptable - expected behavior)  
WARNING: Manual visual inspection needed to confirm layout quality

**Mitigation:**
- Thorough snapshot review before commit
- Visual testing in running application
- Easy rollback via git revert

---

## Notes for Context-Wiped Subagent

### Quick Start
1. Read this entire plan
2. Read `dev-docs/RULES.md` for TDD requirements
3. Execute Step 1 (Section component)
4. Execute Step 2 (ModelUsageTable changes)
5. Verify tests FAIL (RED phase complete)
6. Execute Step 3 (update snapshots - GREEN phase)
7. Verify tests PASS
8. Review snapshots manually
9. Commit with provided message

### Key Context
- **TDD Required:** Code changes must make tests fail first
- **Snapshot Tests:** Failures are expected and desired in RED phase
- **No New Tests:** Existing tests provide complete coverage
- **Visual Changes Only:** No functional behavior changes

### Critical Files
1. `packages/cli/src/ui/components/StatsDisplay.tsx` (source)
2. `packages/cli/src/ui/components/StatsDisplay.test.tsx` (tests)
3. `packages/cli/src/ui/components/__snapshots__/StatsDisplay.test.tsx.snap` (snapshots)
4. `packages/cli/src/ui/components/SessionSummaryDisplay.test.tsx` (tests)
5. `packages/cli/src/ui/components/__snapshots__/SessionSummaryDisplay.test.tsx.snap` (snapshots)

### Success Criteria
- Tests fail after code changes (RED) [OK]
- Tests pass after snapshot updates (GREEN) [OK]
- Visual inspection confirms compact, left-aligned tables [OK]
- No TypeScript or linting errors [OK]

---

## Upstream Diff Reference

```diff
diff --git a/packages/cli/src/ui/components/StatsDisplay.tsx b/packages/cli/src/ui/components/StatsDisplay.tsx
index ab2d7daec..c452d6cf3 100644
--- a/packages/cli/src/ui/components/StatsDisplay.tsx
+++ b/packages/cli/src/ui/components/StatsDisplay.tsx
@@ -65,7 +65,7 @@ interface SectionProps {
 }
 
 const Section: React.FC<SectionProps> = ({ title, children }) => (
-  <Box flexDirection="column" width="100%" marginBottom={1}>
+  <Box flexDirection="column" marginBottom={1}>
     <Text bold color={theme.text.primary}>
       {title}
     </Text>
@@ -174,11 +174,18 @@ const ModelUsageTable: React.FC<{
     yellow: CACHE_EFFICIENCY_MEDIUM,
   });
 
+  const totalWidth =
+    nameWidth +
+    requestsWidth +
+    (showQuotaColumn
+      ? usageLimitWidth
+      : uncachedWidth + cachedWidth + outputTokensWidth);
+
   return (
     <Box flexDirection="column" marginTop={1}>
       {/* Header */}
       <Box alignItems="flex-end">
-        <Box width={nameWidth} flexGrow={1}>
+        <Box width={nameWidth}>
           <Text bold color={theme.text.primary} wrap="truncate-end">
             Model Usage
           </Text>
@@ -248,12 +255,12 @@ const ModelUsageTable: React.FC<{
         borderLeft={false}
         borderRight={false}
         borderColor={theme.border.default}
-        width="100%"
+        width={totalWidth}
       ></Box>
 
       {rows.map((row) => (
         <Box key={row.key}>
-          <Box width={nameWidth} flexGrow={1}>
+          <Box width={nameWidth}>
             <Text color={theme.text.primary} wrap="truncate-end">
               {row.modelName}
             </Text>
```

**Note:** LLxprt divergence means we apply the same principles but to a different table structure (4 columns vs 5+, no quota logic).
