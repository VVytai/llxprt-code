# REIMPLEMENT: 8b0a8f47c1b2 - Session ID in JSON output

## Summary
Upstream added `session_id` to all JSON output formats (both regular JSON and error JSON). LLxprt has significantly different architecture: it doesn't use a `JsonFormatter.format()` method in `nonInteractiveCli.ts` but instead constructs JSON directly with `JSON.stringify()`, and lacks error handling with `JsonFormatter.formatError()` in `errors.ts`.

## Upstream Changes

### Modified Files:
1. **packages/core/src/output/types.ts**
   - Added `session_id?: string` to `JsonOutput` interface

2. **packages/core/src/output/json-formatter.ts**
   - Updated `format()` signature: added `sessionId?: string` as first parameter
   - Added logic to include `session_id` in output if provided
   - Updated `formatError()` signature: added `sessionId?: string` as third parameter
   - Passes `sessionId` through to `format()` when formatting errors

3. **packages/cli/src/nonInteractiveCli.ts**
   - Changed single call to `formatter.format()` to include `config.getSessionId()`
   - Updated call from: `formatter.format(responseText, stats)`
   - To: `formatter.format(config.getSessionId(), responseText, stats)`

4. **packages/cli/src/utils/errors.ts**
   - Updated 4 calls to `formatter.formatError()` to include `config.getSessionId()`
   - In: `handleError()`, `handleToolError()`, `handleCancellationError()`, `handleMaxTurnsExceededError()`

5. **Test files (for validation only, not reimplementation)**
   - `integration-tests/json-output.test.ts`: Added assertions for `session_id` in all JSON outputs
   - `packages/cli/src/nonInteractiveCli.test.ts`: Added `session_id: 'test-session-id'` to all JSON expectations
   - `packages/cli/src/utils/errors.test.ts`: Added `session_id` to all JSON error expectations
   - `packages/core/src/output/json-formatter.test.ts`: Added tests for session_id parameter

## LLxprt Adaptation

### Key Differences from Upstream:
1. **No JsonFormatter.format() usage in nonInteractiveCli.ts**
   - LLxprt uses inline `JSON.stringify()` directly (line 536-543)
   - Upstream uses `formatter.format(config.getSessionId(), responseText, stats)`

2. **No JsonFormatter.formatError() usage in errors.ts**
   - LLxprt uses simple `console.error()` with plain text messages
   - Upstream has comprehensive JSON error formatting

3. **StreamJsonFormatter already includes session_id**
   - LLxprt's `StreamJsonFormatter` already emits `session_id` in `INIT` event (line 216)
   - No changes needed for streaming JSON mode

### Adaptation Strategy:
- **Option A (Minimal)**: Add `session_id` only to the inline JSON.stringify() in nonInteractiveCli.ts
- **Option B (Proper)**: Implement JsonFormatter.format() and formatError() methods, use them everywhere
- **Recommended**: Option B - aligns with upstream architecture and makes future merges easier

## Implementation Steps

### Step 1: Update core types
1. Edit `packages/core/src/utils/output-format.ts`
2. Add `session_id?: string` field to `JsonOutput` interface (line ~22)

### Step 2: Update JsonFormatter class
1. Edit `packages/core/src/utils/output-format.ts`
2. Add `format()` method to `JsonFormatter` class:
   ```typescript
   format(
     sessionId?: string,
     response?: string,
     stats?: SessionMetrics,
     error?: JsonError,
   ): string {
     const output: JsonOutput = {};
     
     if (sessionId) {
       output.session_id = sessionId;
     }
     
     if (response !== undefined) {
       output.response = response;
     }
     
     if (stats !== undefined) {
       output.stats = stats;
     }
     
     if (error !== undefined) {
       output.error = error;
     }
     
     return JSON.stringify(output, null, 2);
   }
   ```

3. Update `formatError()` method signature to accept `sessionId?`:
   ```typescript
   formatError(error: Error, code?: string | number, sessionId?: string): string {
     const jsonError: JsonError = {
       type: error.constructor.name,
       message: error.message,
       ...(code !== undefined && { code }),
     };
     
     return this.format(sessionId, undefined, undefined, jsonError);
   }
   ```

### Step 3: Update nonInteractiveCli.ts
1. Import `JsonFormatter` from `@vybestack/llxprt-code-core`
2. Replace inline `JSON.stringify()` (lines 536-543) with:
   ```typescript
   const formatter = new JsonFormatter();
   const payload = formatter.format(
     config.getSessionId(),
     jsonResponseText.trimEnd(),
     uiTelemetryService.getMetrics(),
   );
   process.stdout.write(`${payload}\n`);
   ```

### Step 4: Update errors.ts for JSON error output
1. Edit `packages/cli/src/utils/errors.ts`
2. Import `JsonFormatter` and `OutputFormat` from `@vybestack/llxprt-code-core`
3. Update `handleError()` to use JsonFormatter when in JSON mode:
   ```typescript
   export function handleError(
     error: unknown,
     config: Config,
     customErrorCode?: string | number,
   ): never {
     const outputFormat = config.getOutputFormat?.() ?? OutputFormat.TEXT;
     
     if (outputFormat === OutputFormat.JSON) {
       const formatter = new JsonFormatter();
       const errorCode = customErrorCode ?? extractErrorCode(error);
       const formattedError = formatter.formatError(
         error instanceof Error ? error : new Error(getErrorMessage(error)),
         errorCode,
         config.getSessionId(),
       );
       console.error(formattedError);
     } else {
       const errorMessage = parseAndFormatApiError(error);
       console.error(errorMessage);
     }
     
     // Exit logic remains the same...
   }
   ```

4. Apply similar pattern to:
   - `handleToolError()` - check JSON mode, use formatter
   - `handleCancellationError()` - check JSON mode, use formatter
   - `handleMaxTurnsExceededError()` - check JSON mode, use formatter

### Step 5: Write tests
1. Create `packages/core/src/utils/output-format.test.ts`
2. Add tests for `JsonFormatter.format()` with session_id:
   - Test with session_id present
   - Test with session_id undefined
   - Test with response and stats
   - Test with error
3. Add tests for `JsonFormatter.formatError()` with session_id
4. Update existing integration tests if any exist for JSON output

### Step 6: Verify
1. Run full test suite: `npm run test`
2. Run typecheck: `npm run typecheck`
3. Run lint: `npm run lint`
4. Run format: `npm run format`
5. Run build: `npm run build`
6. Manual test: `node scripts/start.js --output-format json "write me a haiku"`
7. Verify session_id appears in JSON output
8. Manual error test: trigger an error in JSON mode, verify session_id in error output

## Files to Create/Modify

### Create:
- `packages/core/src/utils/output-format.test.ts` - New test file for JsonFormatter

### Modify:
- `packages/core/src/utils/output-format.ts` - Add `session_id` to interface, implement `format()` and update `formatError()`
- `packages/cli/src/nonInteractiveCli.ts` - Replace inline JSON.stringify with JsonFormatter.format()
- `packages/cli/src/utils/errors.ts` - Add JSON-aware error handling using JsonFormatter.formatError()

## Testing

### Unit Tests:
1. JsonFormatter.format() with/without session_id
2. JsonFormatter.formatError() with/without session_id
3. Verify JSON structure matches expected shape

### Integration Tests:
1. Run CLI with `--output-format json` and verify session_id in output
2. Trigger error in JSON mode and verify session_id in error output
3. Verify streaming JSON (should already work, has session_id in INIT event)

### Manual Verification:
```bash
# Success case
node scripts/start.js --output-format json "write me a haiku"
# Should see: { "session_id": "...", "response": "...", "stats": {...} }

# Error case (if applicable)
node scripts/start.js --output-format json "invalid command"
# Should see: { "session_id": "...", "error": {...} }
```

## Estimated Effort

**3-4 hours**

Breakdown:
- 1 hour: Implement JsonFormatter.format() and update formatError()
- 1 hour: Refactor nonInteractiveCli.ts to use JsonFormatter
- 1 hour: Refactor errors.ts to support JSON error output
- 0.5-1 hour: Write comprehensive tests
- 0.5 hour: Manual testing and verification

## Notes

### Architectural Alignment:
This change aligns LLxprt's JSON output handling with upstream architecture. Currently, LLxprt has a bare-bones `JsonFormatter` that only handles errors. Upstream has a full-featured formatter that handles both success and error cases uniformly.

### Future Benefits:
- Easier upstream merges
- Consistent JSON formatting across all output paths
- Better testability (can test formatter in isolation)
- Centralized place to add future JSON output features

### Risk Assessment:
**Low Risk** - Changes are additive and isolated:
- New optional field in interface (backward compatible)
- New method on existing class
- Refactoring inline JSON to use class method (same output)
- Error handling enhancement (only affects JSON mode)

### Dependencies:
- ✅ `config.getSessionId()` method already exists (verified in packages/core/src/index.ts and runtime/AgentRuntimeState.ts)
- ✅ Method is already used in `StreamJsonFormatter` for INIT event (line 216 in nonInteractiveCli.ts)
- No new dependencies required
