# Reimplementation Plan: Remove flex from stats display (upstream 6dea66f1)

## Upstream Commit

**Commit:** `6dea66f1f5a71da7956b3f4b235641ef08c8d433`  
**Author:** Jacob Richman <jacob314@gmail.com>  
**Date:** Fri Dec 12 12:19:39 2025 -0800  
**Message:** Remove flex from stats display. See snapshots for diffs. (#14983)

## What Upstream Does

The upstream commit makes layout improvements to the stats display by removing flexbox growing behavior from certain elements to create more deterministic, fixed-width layouts:

### Code Changes

1. **Section component** (line 68):
   - **Before:** `<Box flexDirection="column" width="100%" marginBottom={1}>`
   - **After:** `<Box flexDirection="column" marginBottom={1}>`
   - Removes explicit `width="100%"` from Section wrapper

2. **ModelUsageTable component** (lines 177-255):
   
   a. **Adds totalWidth calculation** (new lines 177-183):
   ```tsx
   const totalWidth =
     nameWidth +
     requestsWidth +
     (showQuotaColumn
       ? usageLimitWidth
       : uncachedWidth + cachedWidth + outputTokensWidth);
   ```
   
   b. **Header - Model Usage label** (line 187):
   - **Before:** `<Box width={nameWidth} flexGrow={1}>`
   - **After:** `<Box width={nameWidth}>`
   - Removes `flexGrow={1}` to prevent expanding
   
   c. **Divider line** (line 251):
   - **Before:** `width="100%"`
   - **After:** `width={totalWidth}`
   - Changes from percentage to calculated fixed width
   
   d. **Row - Model name column** (line 258):
   - **Before:** `<Box width={nameWidth} flexGrow={1}>`
   - **After:** `<Box width={nameWidth}>`
   - Removes `flexGrow={1}` to prevent expanding

### Visual Impact

The snapshots show that removing flex-grow creates more compact, left-aligned tables:
- Model Usage header and rows no longer stretch across full width
- Spacing becomes more predictable and consistent
- Tables have fixed widths based on actual column needs

## Why Can't Cherry-Pick

The LLxprt fork has **diverged significantly** from upstream in the `ModelUsageTable` implementation:

### Upstream Structure (from commit)
- Uses columns: `nameWidth`, `requestsWidth`, `uncachedWidth`, `cachedWidth`, `outputTokensWidth`
- Has conditional quota display with `showQuotaColumn` flag and `usageLimitWidth`
- Column headers: "Model Usage", "Reqs", "Input Tokens", "Cache Reads", "Output Tokens" (or "Usage left" for quota)

### LLxprt Structure (current)
- Uses columns: `nameWidth`, `requestsWidth`, `inputTokensWidth`, `outputTokensWidth`
- **No cache column breakdown** - simplified 3-column layout
- **No quota display logic** - different feature set
- Column headers: "Model Usage", "Reqs", "Input Tokens", "Output Tokens"

The table structure incompatibility makes direct cherry-pick impossible. The upstream `totalWidth` calculation references columns that don't exist in LLxprt's simplified table.

## Reimplementation Plan

### 1. Section Component (StatsDisplay.tsx, line ~68)

**Change:** Remove `width="100%"` from Section component:

```tsx
// Before
const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box flexDirection="column" width="100%" marginBottom={1}>
    <Text bold color={theme.text.accent}>
      {title}
    </Text>
    {children}
  </Box>
);

// After
const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color={theme.text.accent}>
      {title}
    </Text>
    {children}
  </Box>
);
```

### 2. ModelUsageTable Component (StatsDisplay.tsx, lines ~76-161)

**Changes:**

a. **Add totalWidth calculation** (after existing width constants, around line 84):
```tsx
const nameWidth = 25;
const requestsWidth = 8;
const inputTokensWidth = 15;
const outputTokensWidth = 15;
const tableWidth =
  nameWidth + requestsWidth + inputTokensWidth + outputTokensWidth;

// Add this:
const totalWidth = tableWidth;
```

b. **Remove flexGrow from header Model Usage box** (around line 90):
```tsx
// Before
<Box width={nameWidth}>
  <Text bold color={theme.text.accent}>
    Model Usage
  </Text>
</Box>

// After (remove flexGrow={1} if present, or keep as-is if already without)
<Box width={nameWidth}>
  <Text bold color={theme.text.accent}>
    Model Usage
  </Text>
</Box>
```

c. **Change divider width** (around line 114):
```tsx
// Before
<Box width={tableWidth}>
  <Text color={theme.text.secondary}>{'─'.repeat(tableWidth)}</Text>
</Box>

// After
<Box width={totalWidth}>
  <Text color={theme.text.secondary}>{'─'.repeat(totalWidth)}</Text>
</Box>
```

d. **Remove flexGrow from row model name box** (around line 119):
```tsx
// Before
<Box width={nameWidth}>
  <Text color={theme.text.primary}>{name.replace('-001', '')}</Text>
</Box>

// After (remove flexGrow={1} if present, or keep as-is if already without)
<Box width={nameWidth}>
  <Text color={theme.text.primary}>{name.replace('-001', '')}</Text>
</Box>
```

**Note:** Since LLxprt's current code already doesn't have `flexGrow={1}` on these boxes (based on the file read), the primary changes are:
1. Remove `width="100%"` from Section
2. Add `const totalWidth = tableWidth;`
3. Change divider from `width={tableWidth}` to `width={totalWidth}`

### 3. Snapshot Updates

Update the following snapshot files to match the new layout (tables will be narrower, more left-aligned):

- `packages/cli/src/ui/components/__snapshots__/StatsDisplay.test.tsx.snap`
- `packages/cli/src/ui/components/__snapshots__/SessionSummaryDisplay.test.tsx.snap`

**Expected changes in snapshots:**
- Model Usage tables will have shorter divider lines
- Column spacing will be tighter
- Right padding will be removed from table rows

**Tests to regenerate:**
- `<StatsDisplay /> > Conditional Rendering Tests > hides Efficiency section when cache is not used`
- `<StatsDisplay /> > renders a table with two models correctly`
- `<StatsDisplay /> > renders all sections when all data is present`
- `<SessionSummaryDisplay /> > renders the summary display with a title`

## Implementation Steps

1. **Edit StatsDisplay.tsx:**
   - Remove `width="100%"` from Section component (line ~68)
   - Add `const totalWidth = tableWidth;` in ModelUsageTable (after line ~88)
   - Change divider width from `tableWidth` to `totalWidth` (line ~114)

2. **Run tests:**
   ```bash
   npm test -- StatsDisplay.test.tsx --update-snapshots
   npm test -- SessionSummaryDisplay.test.tsx --update-snapshots
   ```

3. **Verify snapshots:**
   - Review snapshot diffs to ensure tables are more compact
   - Check that all tests pass

4. **Commit:**
   ```
   reimplement: remove flex from stats display (upstream 6dea66f1)
   
   Adapts upstream commit 6dea66f1 to LLxprt's simplified ModelUsageTable
   structure. Changes layout to use fixed-width columns instead of flexbox
   growing behavior for more predictable, compact table rendering.
   
   Key differences from upstream:
   - LLxprt uses 3-column table (no cache breakdown, no quota display)
   - totalWidth calculation simplified to match LLxprt's column structure
   - Same visual goal: remove flex-grow for deterministic layouts
   
   Upstream: 6dea66f1f5a71da7956b3f4b235641ef08c8d433
   ```

## Testing Checklist

- [ ] All StatsDisplay tests pass
- [ ] All SessionSummaryDisplay tests pass
- [ ] Snapshot changes show narrower, left-aligned tables
- [ ] No regression in existing functionality
- [ ] Visual inspection of stats display in running app confirms compact layout
