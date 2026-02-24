# Reimplementation Plan: Fix Tool Output Fragmentation (d236df5b)

**Upstream Commit:** d236df5b21b810bfa86a024f0c59871c35de1f2a  
**Risk Level:** HIGH (Core tool execution flow)  
**Estimated Scope:** ~150-200 LoC across 4 files  
**Author:** Abhi

## Summary

**CONFIRMED BUG:** Tool outputs containing multimodal data (images, files) are incorrectly fragmented into separate sibling parts instead of being properly encapsulated within the functionResponse object. This causes the API to reject or misinterpret tool results.

## The Problem

When tools return multimodal content (text + images/files), the current implementation sends:
```typescript
[
  { functionResponse: { id, name, response: { output: "Tool execution succeeded" } } },
  { inlineData: { ... } },  // Sibling - WRONG for some models
  { fileData: { ... } }      // Sibling - WRONG for some models
]
```

But **Gemini 3 models** require inlineData nested inside functionResponse:
```typescript
[
  { functionResponse: { 
      id, 
      name, 
      response: { output: "..." },
      parts: [{ inlineData: {...} }]  // Nested inside functionResponse
    } 
  },
  { fileData: { ... } }  // fileData stays as sibling (always)
]
```

## Root Cause

`convertToFunctionResponse()` in `packages/core/src/core/coreToolScheduler.ts` doesn't properly handle multimodal responses. It treats all binary content as siblings and lacks model-specific logic.

## Current State Analysis

### Key File: `packages/core/src/core/coreToolScheduler.ts`

**Function:** `convertToFunctionResponse()` (around line 172-231 based on upstream)

Current implementation likely:
1. Creates simple text response
2. Appends all binary parts as siblings
3. No model-specific handling

### Model Detection: `packages/core/src/config/models.ts`

Need to add:
```typescript
export function supportsMultimodalFunctionResponse(model: string): boolean {
  return model.startsWith('gemini-3-');
}
```

Currently has:
- `isGemini2Model()`
- `isGemini3Model()`

## Implementation Steps

### 1. Add Model Support Detection

**File:** `packages/core/src/config/models.ts`

Add function after existing `isGemini3Model()`:
```typescript
/**
 * Checks if the model supports multimodal function responses (multimodal data nested within function response).
 * This is supported in Gemini 3.
 *
 * @param model The model name to check.
 * @returns True if the model supports multimodal function responses.
 */
export function supportsMultimodalFunctionResponse(model: string): boolean {
  return model.startsWith('gemini-3-');
}
```

**Test:** `packages/core/src/config/models.test.ts`

Add test suite:
```typescript
describe('supportsMultimodalFunctionResponse', () => {
  it('should return true for gemini-3 models', () => {
    expect(supportsMultimodalFunctionResponse('gemini-3-pro')).toBe(true);
    expect(supportsMultimodalFunctionResponse('gemini-3-flash')).toBe(true);
  });

  it('should return false for gemini-2 models', () => {
    expect(supportsMultimodalFunctionResponse('gemini-2.5-pro')).toBe(false);
    expect(supportsMultimodalFunctionResponse('gemini-2.5-flash')).toBe(false);
  });

  it('should return false for other models', () => {
    expect(supportsMultimodalFunctionResponse('some-other-model')).toBe(false);
    expect(supportsMultimodalFunctionResponse('')).toBe(false);
  });
});
```

### 2. Refactor `convertToFunctionResponse()`

**File:** `packages/core/src/core/coreToolScheduler.ts`

**Current signature (line ~242):**
```typescript
export function convertToFunctionResponse(
  toolName: string,
  callId: string,
  llmContent: PartListUnion,
): Part[]
```

**New signature:**
```typescript
export function convertToFunctionResponse(
  toolName: string,
  callId: string,
  llmContent: PartListUnion,
  model: string,  // NEW PARAMETER
): Part[]
```

**New implementation logic:**
```typescript
export function convertToFunctionResponse(
  toolName: string,
  callId: string,
  llmContent: PartListUnion,
  model: string,
): Part[] {
  // 1. Normalize input to array of parts
  if (typeof llmContent === 'string') {
    return [createFunctionResponsePart(callId, toolName, llmContent)];
  }

  const parts = toParts(llmContent);

  // 2. Separate text from binary types
  const textParts: string[] = [];
  const inlineDataParts: Part[] = [];
  const fileDataParts: Part[] = [];

  for (const part of parts) {
    if (part.text !== undefined) {
      textParts.push(part.text);
    } else if (part.inlineData) {
      inlineDataParts.push(part);
    } else if (part.fileData) {
      fileDataParts.push(part);
    } else if (part.functionResponse) {
      // Passthrough case - preserve existing response
      if (parts.length > 1) {
        debugLogger.warn('Multiple parts with functionResponse, ignoring others');
      }
      return [{
        functionResponse: {
          id: callId,
          name: toolName,
          response: part.functionResponse.response,
        },
      }];
    }
  }

  // 3. Build response part
  const part: Part = {
    functionResponse: {
      id: callId,
      name: toolName,
      response: textParts.length > 0 ? { output: textParts.join('\n') } : {},
    },
  };

  // 4. Handle binary content based on model support
  const isMultimodalFRSupported = supportsMultimodalFunctionResponse(model);
  const siblingParts: Part[] = [...fileDataParts];

  if (inlineDataParts.length > 0) {
    if (isMultimodalFRSupported) {
      // Nest inlineData if supported by the model
      (part.functionResponse as unknown as { parts: Part[] }).parts = inlineDataParts;
    } else {
      // Otherwise treat as siblings (backward compat)
      siblingParts.push(...inlineDataParts);
    }
  }

  // 5. Add descriptive text if response object is empty but we have binary
  if (textParts.length === 0 && (inlineDataParts.length > 0 || fileDataParts.length > 0)) {
    const totalBinaryItems = inlineDataParts.length + fileDataParts.length;
    part.functionResponse!.response = {
      output: `Binary content provided (${totalBinaryItems} item(s)).`,
    };
  }

  if (siblingParts.length > 0) {
    return [part, ...siblingParts];
  }

  return [part];
}
```

**Add import at top of file:**
```typescript
import { supportsMultimodalFunctionResponse } from '../config/models.js';
```

### 3. Update All Call Sites

**File:** `packages/core/src/core/coreToolScheduler.ts`

Search for all calls to `convertToFunctionResponse()` and add model parameter.

Around line 1638 (in success handler):
```typescript
// Before
const response = convertToFunctionResponse(
  toolName,
  callId,
  content,
);

// After
const response = convertToFunctionResponse(
  toolName,
  callId,
  content,
  this.config.getActiveModel(),  // ADD THIS
);
```

**File:** `packages/cli/src/zed-integration/zedIntegration.ts`

Around line 500 in Session class:
```typescript
// Before
return convertToFunctionResponse(fc.name, callId, toolResult.llmContent);

// After
return convertToFunctionResponse(
  fc.name,
  callId,
  toolResult.llmContent,
  this.config.getActiveModel(),  // ADD THIS
);
```

### 4. Update Test Files

**File:** `packages/core/src/core/coreToolScheduler.test.ts`

Update all test calls to include model parameter. Add comprehensive tests for:

1. **Basic text handling** (existing tests)
2. **Gemini 3 with inlineData** (NEW - should nest):
```typescript
it('should handle llmContent with inlineData for Gemini 3 model (should be nested)', () => {
  const llmContent: Part = {
    inlineData: { mimeType: 'image/png', data: 'base64...' },
  };
  const result = convertToFunctionResponse(
    toolName,
    callId,
    llmContent,
    'gemini-3-pro',  // Gemini 3
  );
  expect(result).toEqual([
    {
      functionResponse: {
        name: toolName,
        id: callId,
        response: { output: 'Binary content provided (1 item(s)).' },
        parts: [llmContent],  // NESTED
      },
    },
  ]);
});
```

3. **Gemini 2 with inlineData** (NEW - should be sibling):
```typescript
it('should handle llmContent with inlineData for non-Gemini 3 models', () => {
  const llmContent: Part = {
    inlineData: { mimeType: 'image/png', data: 'base64...' },
  };
  const result = convertToFunctionResponse(
    toolName,
    callId,
    llmContent,
    'gemini-2.5-pro',  // Gemini 2
  );
  expect(result).toEqual([
    {
      functionResponse: {
        name: toolName,
        id: callId,
        response: { output: 'Binary content provided (1 item(s)).' },
      },
    },
    llmContent,  // SIBLING
  ]);
});
```

4. **fileData handling** (always siblings)
5. **Mixed text + binary**
6. **functionResponse passthrough**

Update all existing tests to include model parameter (use `DEFAULT_GEMINI_MODEL` or `PREVIEW_GEMINI_MODEL` as appropriate).

**File:** `packages/core/src/core/nonInteractiveToolExecutor.test.ts`

Update mock config to include:
```typescript
getActiveModel: () => PREVIEW_GEMINI_MODEL,
```

Update test expectations for multimodal responses.

**File:** `packages/a2a-server/src/utils/testing_utils.ts`

Add to mock config:
```typescript
getActiveModel: vi.fn().mockReturnValue(DEFAULT_GEMINI_MODEL),
```

**File:** `packages/cli/src/ui/hooks/useToolScheduler.test.ts`

Add to mock config:
```typescript
getActiveModel: () => PREVIEW_GEMINI_MODEL,
```

### 5. Verification Steps

```bash
# 1. Type check
npm run typecheck

# 2. Run affected unit tests
npm test -- coreToolScheduler.test.ts
npm test -- models.test.ts
npm test -- nonInteractiveToolExecutor.test.ts

# 3. Run full test suite
npm test

# 4. Lint
npm run lint

# 5. Manual test with multimodal tool
# Create a test tool that returns image data and verify response structure
```

## Provider-Agnostic Gating [REVIEWER AMENDMENT]

The `supportsMultimodalFunctionResponse()` check must be **provider-agnostic**:
- Non-Gemini models (Claude, GPT, etc.) get `false` → sibling behavior (safe default)
- Only Gemini 3+ models get `true` → nested inlineData
- This is correct because `model.startsWith('gemini-3-')` returns false for all non-Gemini model strings

**Required additional tests for non-Gemini models:**
```typescript
it('should use sibling behavior for Claude models', () => {
  expect(supportsMultimodalFunctionResponse('claude-3-opus')).toBe(false);
});
it('should use sibling behavior for GPT models', () => {
  expect(supportsMultimodalFunctionResponse('gpt-4o')).toBe(false);
});
```

## Edge-Case Tests [REVIEWER AMENDMENT]

The following edge cases MUST be tested:
1. **Empty tool output**: `convertToFunctionResponse(name, id, '', 'gemini-3-pro')` → valid functionResponse with empty output
2. **Text-only output**: No binary parts → simple functionResponse (both model types)
3. **Image-only output**: No text parts → functionResponse with binary description placeholder
4. **Mixed text + image + fileData**: Text in response, inlineData nested (Gemini 3) or sibling (others), fileData always sibling
5. **Multiple images**: Array of inlineData parts → all nested or all siblings

## Risk Mitigation

1. **Model detection:** Use defensive check - default to sibling behavior for unknown models
2. **Backward compatibility:** Gemini 2 models maintain existing behavior (siblings)
3. **Provider safety:** Non-Gemini providers always get sibling behavior (safe default)
4. **Test coverage:** Comprehensive tests for all model types × all content types × edge cases
5. **Gradual rollout:** Can gate behind model version check

## Files Modified

- `packages/core/src/config/models.ts` (+10 lines)
- `packages/core/src/config/models.test.ts` (+20 lines)
- `packages/core/src/core/coreToolScheduler.ts` (+60 lines modified, ~30 original)
- `packages/core/src/core/coreToolScheduler.test.ts` (+100 lines tests)
- `packages/core/src/core/nonInteractiveToolExecutor.test.ts` (+3 lines)
- `packages/cli/src/zed-integration/zedIntegration.ts` (+5 lines)
- `packages/a2a-server/src/utils/testing_utils.ts` (+1 line)
- `packages/cli/src/ui/hooks/useToolScheduler.test.ts` (+1 line)

**Total:** ~200 LoC changed/added

## Testing Strategy

### Unit Tests
- Model detection function (3 test cases)
- `convertToFunctionResponse()` with all input types × 2 models = ~20 test cases
- Test existing functionality unchanged for Gemini 2 models

### Integration Tests
- Run full tool scheduler test suite
- Verify no regressions in tool execution flow

### Manual Testing
1. Create tool returning image + text
2. Test with Gemini 2.5 model (should use siblings)
3. Test with Gemini 3 model (should nest inlineData)
4. Verify API accepts response in both cases

## Success Criteria

- [ ] Model detection function added and tested
- [ ] `convertToFunctionResponse()` refactored with model parameter
- [ ] All call sites updated
- [ ] All tests passing (existing + new)
- [ ] Type checking passes
- [ ] Multimodal tool responses correctly formatted per model
- [ ] No regressions in existing tool execution

## Commit Message

```
reimplement: fix tool output fragmentation (upstream d236df5b)

Fix critical bug where multimodal tool outputs (text + images/files) were
incorrectly sent as separate sibling parts instead of being encapsulated
within functionResponse object.

Add model-specific handling:
- Gemini 3: nest inlineData within functionResponse.parts
- Gemini 2: maintain backward-compatible sibling behavior
- fileData: always sent as siblings (all models)

Changes:
- Add supportsMultimodalFunctionResponse() model detection
- Refactor convertToFunctionResponse() with model parameter
- Update all call sites in scheduler and Zed integration
- Add comprehensive test coverage for both model types

Upstream: d236df5b21b810bfa86a024f0c59871c35de1f2a
Author: Abhi <43648792+abhipatel12@users.noreply.github.com>
```
