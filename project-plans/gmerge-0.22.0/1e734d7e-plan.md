# TDD Implementation Plan: Multi-file Image Drag/Drop (upstream 1e734d7e)

**CRITICAL**: This plan is a COMPLETE, SELF-CONTAINED guide. Execute it with NO other context.

## Upstream Commit Reference

**Commit:** 1e734d7e60ee1a69d9ee2b57c6c32a78aa491ec1  
**Author:** Jack Wotherspoon <jackwoth@google.com>  
**Date:** Fri Dec 12 12:14:35 2025 -0500  
**Title:** feat: support multi-file drag and drop of images (#14832)

**What it does:** Adds support for handling multiple file paths pasted/dropped simultaneously (e.g., from dragging multiple images from a file browser), with proper handling of escaped spaces and cross-platform path formats.

## Requirements

**R1**: Split space-separated file paths while respecting escaped spaces (`\ `)  
**R2**: Process pasted text to add `@` prefix to valid file paths  
**R3**: Support single and multiple paths in a single paste operation  
**R4**: Handle paths with escaped spaces correctly (preserve `\ `)  
**R5**: Handle paths with unescaped spaces by auto-escaping them  
**R6**: Support Windows paths (drive letters like `C:`, UNC paths like `\\server\share`)  
**R7**: Only add `@` prefix to valid paths, leave invalid ones unchanged  
**R8**: Return null when no paths are valid  
**R9**: Integrate with existing text-buffer paste logic without breaking single-path behavior  
**R10**: Maintain backward compatibility with existing drag/drop behavior

## LLxprt Touchpoints

### Files to Modify

1. **`packages/cli/src/ui/utils/clipboardUtils.ts`**
   - Current state: Has `clipboardHasImage`, `saveClipboardImage`, `cleanupOldClipboardImages`
   - Add: `splitEscapedPaths()`, `parsePastedPaths()`
   - Imports needed: `escapePath`, `unescapePath` from `@vybestack/llxprt-code-core`
   - Lines: ~150 (current end of file is around line 156)

2. **`packages/cli/src/ui/components/shared/text-buffer.ts`**
   - Current paste logic: Lines 1662-1704
   - Single-path validation: Lines 1675-1684
   - Current imports: Line 12-16 has `unescapePath` from core
   - Add import: `parsePastedPaths` from `'../../utils/clipboardUtils.js'`
   - Replace: Lines 1681-1684 (single-path validation logic)

3. **`packages/cli/src/ui/utils/clipboardUtils.test.ts`**
   - Current state: Tests for clipboard image functions
   - Add: Two new describe blocks for `splitEscapedPaths` and `parsePastedPaths`
   - Add imports: `splitEscapedPaths`, `parsePastedPaths`

4. **`packages/cli/src/ui/components/shared/text-buffer.test.ts`**
   - Current paste tests: Lines 604-640 ("Drag and Drop File Paths" describe block)
   - Add: 3 new integration tests after line 639

### Core Dependencies

- **`@vybestack/llxprt-code-core`** exports `escapePath` and `unescapePath` from `utils/paths.ts`
- `escapePath(filePath: string): string` - Escapes shell special chars including spaces
- `unescapePath(filePath: string): string` - Removes backslash escaping

### Current Paste Logic (text-buffer.ts:1662-1704)

```typescript
const insert = useCallback(
  (ch: string, { paste = false }: { paste?: boolean } = {}): void => {
    if (!singleLine && /[\n\r]/.test(ch)) {
      dispatch({ type: 'insert', payload: ch });
      return;
    }

    const minLengthToInferAsDragDrop = 3;
    if (
      ch.length >= minLengthToInferAsDragDrop &&
      !shellModeActive &&
      paste
    ) {
      let potentialPath = ch.trim();
      const quoteMatch = potentialPath.match(/^'(.*)'$/);
      if (quoteMatch) {
        potentialPath = quoteMatch[1];
      }

      potentialPath = potentialPath.trim();
      if (isValidPath(unescapePath(potentialPath))) {  // LINE 1682
        ch = `@${potentialPath} `;                      // LINE 1683
      }                                                 // LINE 1684
    }

    let currentText = '';
    for (const char of toCodePoints(ch)) {
      if (char.codePointAt(0) === 127) {
        if (currentText.length > 0) {
          dispatch({ type: 'insert', payload: currentText });
          currentText = '';
        }
        dispatch({ type: 'backspace' });
      } else {
        currentText += char;
      }
    }
    if (currentText.length > 0) {
      dispatch({ type: 'insert', payload: currentText });
    }
  },
  [isValidPath, shellModeActive, singleLine],
);
```

### Existing Test Structure (text-buffer.test.ts:604-640)

```typescript
describe('Drag and Drop File Paths', () => {
  it('should prepend @ to a valid file path on insert', () => {
    const { result } = renderHook(() =>
      useTextBuffer({ viewport, isValidPath: () => true }),
    );
    const filePath = '/path/to/a/valid/file.txt';
    act(() => result.current.insert(filePath, { paste: true }));
    expect(getBufferState(result).text).toBe(`@${filePath} `);
  });

  it('should not prepend @ to an invalid file path on insert', () => {
    const { result } = renderHook(() =>
      useTextBuffer({ viewport, isValidPath: () => false }),
    );
    const notAPath = 'this is just some long text';
    act(() => result.current.insert(notAPath, { paste: true }));
    expect(getBufferState(result).text).toBe(notAPath);
  });

  it('should handle quoted paths', () => {
    const { result } = renderHook(() =>
      useTextBuffer({ viewport, isValidPath: () => true }),
    );
    const filePath = "'/path/to/a/valid/file.txt'";
    act(() => result.current.insert(filePath, { paste: true }));
    expect(getBufferState(result).text).toBe(`@/path/to/a/valid/file.txt `);
  });

  it('should not prepend @ to short text that is not a path', () => {
    const { result } = renderHook(() =>
      useTextBuffer({ viewport, isValidPath: () => true }),
    );
    const shortText = 'ab';
    act(() => result.current.insert(shortText, { paste: true }));
    expect(getBufferState(result).text).toBe(shortText);
  });
});
```

## TDD Implementation Steps

### PHASE 1: RED - Write Tests for `splitEscapedPaths`

**File:** `packages/cli/src/ui/utils/clipboardUtils.test.ts`

**Step 1.1:** Add imports at the top (around line 12, after existing imports):

```typescript
import {
  clipboardHasImage,
  saveClipboardImage,
  cleanupOldClipboardImages,
  splitEscapedPaths,
  parsePastedPaths,
} from './clipboardUtils.js';
```

**Step 1.2:** Add test suite at end of file (before closing brace of main describe block):

```typescript
  describe('splitEscapedPaths', () => {
    it('should return single path when no spaces', () => {
      expect(splitEscapedPaths('/path/to/image.png')).toEqual([
        '/path/to/image.png',
      ]);
    });

    it('should split simple space-separated paths', () => {
      expect(splitEscapedPaths('/img1.png /img2.png')).toEqual([
        '/img1.png',
        '/img2.png',
      ]);
    });

    it('should split three paths', () => {
      expect(splitEscapedPaths('/a.png /b.jpg /c.heic')).toEqual([
        '/a.png',
        '/b.jpg',
        '/c.heic',
      ]);
    });

    it('should preserve escaped spaces within filenames', () => {
      expect(splitEscapedPaths('/my\\ image.png')).toEqual(['/my\\ image.png']);
    });

    it('should handle multiple paths with escaped spaces', () => {
      expect(splitEscapedPaths('/my\\ img1.png /my\\ img2.png')).toEqual([
        '/my\\ img1.png',
        '/my\\ img2.png',
      ]);
    });

    it('should handle path with multiple escaped spaces', () => {
      expect(splitEscapedPaths('/path/to/my\\ cool\\ image.png')).toEqual([
        '/path/to/my\\ cool\\ image.png',
      ]);
    });

    it('should handle multiple consecutive spaces between paths', () => {
      expect(splitEscapedPaths('/img1.png   /img2.png')).toEqual([
        '/img1.png',
        '/img2.png',
      ]);
    });

    it('should handle trailing and leading whitespace', () => {
      expect(splitEscapedPaths('  /img1.png /img2.png  ')).toEqual([
        '/img1.png',
        '/img2.png',
      ]);
    });

    it('should return empty array for empty string', () => {
      expect(splitEscapedPaths('')).toEqual([]);
    });

    it('should return empty array for whitespace only', () => {
      expect(splitEscapedPaths('   ')).toEqual([]);
    });
  });
```

**Step 1.3:** Run tests - MUST FAIL

```bash
npm test clipboardUtils.test.ts
```

Expected: All `splitEscapedPaths` tests fail because function doesn't exist.

### PHASE 2: GREEN - Implement `splitEscapedPaths`

**File:** `packages/cli/src/ui/utils/clipboardUtils.ts`

**Step 2.1:** Add function at end of file (after `cleanupOldClipboardImages`):

```typescript
/**
 * Splits text into individual path segments, respecting escaped spaces.
 * Unescaped spaces act as separators between paths, while "\ " is preserved
 * as part of a filename.
 *
 * Example: "/img1.png /path/my\ image.png" → ["/img1.png", "/path/my\ image.png"]
 *
 * @param text The text to split
 * @returns Array of path segments (still escaped)
 */
export function splitEscapedPaths(text: string): string[] {
  const paths: string[] = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === '\\' && i + 1 < text.length && text[i + 1] === ' ') {
      current += '\\ ';
      i += 2;
    } else if (char === ' ') {
      if (current.trim()) {
        paths.push(current.trim());
      }
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  if (current.trim()) {
    paths.push(current.trim());
  }

  return paths;
}
```

**Step 2.2:** Run tests - MUST PASS

```bash
npm test clipboardUtils.test.ts
```

Expected: All `splitEscapedPaths` tests pass.

### PHASE 3: RED - Write Tests for `parsePastedPaths`

**File:** `packages/cli/src/ui/utils/clipboardUtils.test.ts`

**Step 3.1:** Add test suite after `splitEscapedPaths` describe block:

```typescript
  describe('parsePastedPaths', () => {
    it('should return null for empty string', () => {
      const result = parsePastedPaths('', () => true);
      expect(result).toBe(null);
    });

    it('should add @ prefix to single valid path', () => {
      const result = parsePastedPaths('/path/to/file.txt', () => true);
      expect(result).toBe('@/path/to/file.txt ');
    });

    it('should return null for single invalid path', () => {
      const result = parsePastedPaths('/path/to/file.txt', () => false);
      expect(result).toBe(null);
    });

    it('should add @ prefix to all valid paths', () => {
      const validPaths = new Set(['/path/to/file1.txt', '/path/to/file2.txt']);
      const result = parsePastedPaths(
        '/path/to/file1.txt /path/to/file2.txt',
        (p) => validPaths.has(p),
      );
      expect(result).toBe('@/path/to/file1.txt @/path/to/file2.txt ');
    });

    it('should only add @ prefix to valid paths', () => {
      const result = parsePastedPaths(
        '/valid/file.txt /invalid/file.jpg',
        (p) => p.endsWith('.txt'),
      );
      expect(result).toBe('@/valid/file.txt /invalid/file.jpg ');
    });

    it('should return null if no paths are valid', () => {
      const result = parsePastedPaths(
        '/path/to/file1.txt /path/to/file2.txt',
        () => false,
      );
      expect(result).toBe(null);
    });

    it('should handle paths with escaped spaces', () => {
      const validPaths = new Set(['/path/to/my file.txt', '/other/path.txt']);
      const result = parsePastedPaths(
        '/path/to/my\\ file.txt /other/path.txt',
        (p) => validPaths.has(p),
      );
      expect(result).toBe('@/path/to/my\\ file.txt @/other/path.txt ');
    });

    it('should unescape paths before validation', () => {
      const validPaths = new Set(['/my file.txt', '/other.txt']);
      const validatedPaths: string[] = [];
      parsePastedPaths('/my\\ file.txt /other.txt', (p) => {
        validatedPaths.push(p);
        return validPaths.has(p);
      });
      expect(validatedPaths).toEqual([
        '/my\\ file.txt /other.txt',
        '/my file.txt',
        '/other.txt',
      ]);
    });

    it('should handle single path with unescaped spaces from copy-paste', () => {
      const result = parsePastedPaths('/path/to/my file.txt', () => true);
      expect(result).toBe('@/path/to/my\\ file.txt ');
    });

    it('should handle Windows path', () => {
      const result = parsePastedPaths('C:\\Users\\file.txt', () => true);
      expect(result).toBe('@C:\\Users\\file.txt ');
    });

    it('should handle Windows path with unescaped spaces', () => {
      const result = parsePastedPaths('C:\\My Documents\\file.txt', () => true);
      expect(result).toBe('@C:\\My\\ Documents\\file.txt ');
    });

    it('should handle multiple Windows paths', () => {
      const validPaths = new Set(['C:\\file1.txt', 'D:\\file2.txt']);
      const result = parsePastedPaths('C:\\file1.txt D:\\file2.txt', (p) =>
        validPaths.has(p),
      );
      expect(result).toBe('@C:\\file1.txt @D:\\file2.txt ');
    });

    it('should handle Windows UNC path', () => {
      const result = parsePastedPaths(
        '\\\\server\\share\\file.txt',
        () => true,
      );
      expect(result).toBe('@\\\\server\\share\\file.txt ');
    });
  });
```

**Step 3.2:** Run tests - MUST FAIL

```bash
npm test clipboardUtils.test.ts
```

Expected: All `parsePastedPaths` tests fail because function doesn't exist.

### PHASE 4: GREEN - Implement `parsePastedPaths`

**File:** `packages/cli/src/ui/utils/clipboardUtils.ts`

**Step 4.1:** Add imports at top of file (after existing imports, around line 11):

```typescript
import {
  escapePath,
  unescapePath,
} from '@vybestack/llxprt-code-core';
```

**Step 4.2:** Add constant before `parsePastedPaths` function:

```typescript
/** Matches strings that start with a path prefix (/, ~, ., Windows drive letter, or UNC path) */
const PATH_PREFIX_PATTERN = /^([/~.]|[a-zA-Z]:|\\\\)/;
```

**Step 4.3:** Add function after `splitEscapedPaths`:

```typescript
/**
 * Processes pasted text containing file paths, adding @ prefix to valid paths.
 * Handles both single and multiple space-separated paths.
 *
 * @param text The pasted text (potentially space-separated paths)
 * @param isValidPath Function to validate if a path exists/is valid
 * @returns Processed string with @ prefixes on valid paths, or null if no valid paths
 */
export function parsePastedPaths(
  text: string,
  isValidPath: (path: string) => boolean,
): string | null {
  if (PATH_PREFIX_PATTERN.test(text) && isValidPath(text)) {
    return `@${escapePath(text)} `;
  }

  const segments = splitEscapedPaths(text);
  if (segments.length === 0) {
    return null;
  }

  let anyValidPath = false;
  const processedPaths = segments.map((segment) => {
    if (!PATH_PREFIX_PATTERN.test(segment)) {
      return segment;
    }
    const unescaped = unescapePath(segment);
    if (isValidPath(unescaped)) {
      anyValidPath = true;
      return `@${segment}`;
    }
    return segment;
  });

  return anyValidPath ? processedPaths.join(' ') + ' ' : null;
}
```

**Step 4.4:** Run tests - MUST PASS

```bash
npm test clipboardUtils.test.ts
```

Expected: All `parsePastedPaths` tests pass.

### PHASE 5: RED - Write Integration Tests

**File:** `packages/cli/src/ui/components/shared/text-buffer.test.ts`

**Step 5.1:** Add tests at end of "Drag and Drop File Paths" describe block (after line 639):

```typescript
    it('should prepend @ to multiple valid file paths on insert', () => {
      const validPaths = new Set(['/path/to/file1.txt', '/path/to/file2.txt']);
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: (p) => validPaths.has(p) }),
      );
      const filePaths = '/path/to/file1.txt /path/to/file2.txt';
      act(() => result.current.insert(filePaths, { paste: true }));
      expect(getBufferState(result).text).toBe(
        '@/path/to/file1.txt @/path/to/file2.txt ',
      );
    });

    it('should handle multiple paths with escaped spaces', () => {
      const validPaths = new Set(['/path/to/my file.txt', '/other/path.txt']);
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: (p) => validPaths.has(p) }),
      );
      const filePaths = '/path/to/my\\ file.txt /other/path.txt';
      act(() => result.current.insert(filePaths, { paste: true }));
      expect(getBufferState(result).text).toBe(
        '@/path/to/my\\ file.txt @/other/path.txt ',
      );
    });

    it('should only prepend @ to valid paths in multi-path paste', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: (p) => p.endsWith('.txt'),
        }),
      );
      const filePaths = '/valid/file.txt /invalid/file.jpg';
      act(() => result.current.insert(filePaths, { paste: true }));
      expect(getBufferState(result).text).toBe(
        '@/valid/file.txt /invalid/file.jpg ',
      );
    });
```

**Step 5.2:** Run tests - MUST FAIL

```bash
npm test text-buffer.test.ts
```

Expected: The 3 new integration tests fail because text-buffer doesn't use `parsePastedPaths` yet.

### PHASE 6: GREEN - Integrate `parsePastedPaths` into text-buffer

**File:** `packages/cli/src/ui/components/shared/text-buffer.ts`

**Step 6.1:** Add import at top (around line 23, after textUtils import):

```typescript
import { parsePastedPaths } from '../../utils/clipboardUtils.js';
```

**Step 6.2:** Replace lines 1681-1684 in the `insert` callback:

BEFORE:
```typescript
      potentialPath = potentialPath.trim();
      if (isValidPath(unescapePath(potentialPath))) {
        ch = `@${potentialPath} `;
      }
```

AFTER:
```typescript
      potentialPath = potentialPath.trim();

      const processed = parsePastedPaths(potentialPath, isValidPath);
      if (processed) {
        ch = processed;
      }
```

**Step 6.3:** Run tests - MUST PASS

```bash
npm test text-buffer.test.ts
npm test clipboardUtils.test.ts
```

Expected: ALL tests pass, including existing tests (backward compatibility).

### PHASE 7: REFACTOR - Assess and Improve

**Step 7.1:** Review code for potential improvements:

1. **Code duplication?** No - functions are single-purpose
2. **Complex logic?** No - algorithms are straightforward
3. **Naming clarity?** Yes - function names clearly describe behavior
4. **Performance concerns?** No - string processing is linear
5. **Error handling?** Adequate - returns empty array or null for edge cases

**Decision:** No refactoring needed. Code is clean and maintainable as-is.

**Step 7.2:** Run full test suite:

```bash
npm test
```

Expected: All tests pass.

### PHASE 8: VERIFICATION

**Step 8.1:** Run type check:

```bash
npm run typecheck
```

Expected: No TypeScript errors.

**Step 8.2:** Run linter:

```bash
npm run lint
```

Expected: No linting errors. If any, fix them.

**Step 8.3:** Manual testing scenarios:

1. **Single file drag:** Drag one file → should add `@` prefix (existing behavior preserved)
2. **Multiple files drag:** Drag 3 files → should add `@` prefix to all valid ones
3. **File with spaces:** Drag file named "my image.png" → should escape space as `my\ image.png`
4. **Mixed valid/invalid:** Paste "/valid.txt /invalid.jpg" where only .txt is valid → only .txt gets `@`
5. **Short text:** Type "ab" → should not add `@` (length check still works)
6. **Shell mode:** Enable shell mode → should not add `@` to any paths

**Step 8.4:** Verify test coverage:

```bash
npm run test:coverage -- clipboardUtils
npm run test:coverage -- text-buffer
```

Expected: 100% coverage of new functions.

## Verification Checklist

Before committing, ensure:

- [ ] All unit tests pass (`npm test clipboardUtils.test.ts`)
- [ ] All integration tests pass (`npm test text-buffer.test.ts`)
- [ ] Full test suite passes (`npm test`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)
- [ ] Existing single-path drag/drop still works
- [ ] Multiple paths are correctly processed
- [ ] Escaped spaces are preserved
- [ ] Unescaped spaces are auto-escaped
- [ ] Windows paths work correctly
- [ ] Shell mode bypass still works
- [ ] Short text (<3 chars) is not processed

## Commit Message

```
reimplement: multi-file image drag/drop (upstream 1e734d7e)

Add support for handling multiple file paths pasted/dropped simultaneously.

New utilities:
- splitEscapedPaths(): Parse space-separated paths with escape handling
- parsePastedPaths(): Process and validate multi-path input with @ prefix

Features:
- Support multiple space-separated file paths in single paste
- Preserve escaped spaces in filenames (e.g., /my\ file.txt)
- Auto-escape unescaped spaces in valid paths
- Support Windows paths (drive letters, UNC paths)
- Only prefix valid paths with @, leave invalid ones unchanged

Integration:
- Updated text-buffer insert logic to use new multi-path processing
- Maintains backward compatibility with single-path drag/drop
- Shell mode bypass continues to work

Testing: 23 new test cases, 100% coverage, all existing tests pass

Reimplemented from upstream commit 1e734d7e adapted for LLxprt's
codebase structure (@vybestack/llxprt-code-core imports).
```

## Files Modified

1. `packages/cli/src/ui/utils/clipboardUtils.ts` (+75 lines)
   - Added `splitEscapedPaths()` function
   - Added `parsePastedPaths()` function
   - Added imports: `escapePath`, `unescapePath` from core
   - Added constant: `PATH_PREFIX_PATTERN`

2. `packages/cli/src/ui/components/shared/text-buffer.ts` (+5 lines, -3 lines)
   - Added import: `parsePastedPaths`
   - Replaced single-path validation with multi-path processing

3. `packages/cli/src/ui/utils/clipboardUtils.test.ts` (+162 lines)
   - Added 10 tests for `splitEscapedPaths`
   - Added 13 tests for `parsePastedPaths`
   - Added imports for new functions

4. `packages/cli/src/ui/components/shared/text-buffer.test.ts` (+24 lines)
   - Added 3 integration tests for multi-path paste behavior

## Implementation Notes

### Why This Approach?

1. **Separation of concerns:** Path splitting and validation are separate utilities
2. **Testability:** Pure functions are easy to test in isolation
3. **Reusability:** `splitEscapedPaths` could be used elsewhere
4. **Minimal changes:** Only replaces 4 lines in text-buffer
5. **Type safety:** TypeScript enforces correct usage

### Edge Cases Handled

1. **Empty input:** Returns `[]` or `null`
2. **Whitespace only:** Returns `[]` or `null`
3. **Single path:** Works exactly like before
4. **Mixed valid/invalid:** Processes independently
5. **Consecutive spaces:** Normalized by trim
6. **Leading/trailing spaces:** Removed by trim
7. **Escaped spaces at path boundaries:** Preserved correctly
8. **Windows paths with backslashes:** Not confused with escape chars (context-aware)

### Performance Characteristics

- **splitEscapedPaths:** O(n) where n = text length
- **parsePastedPaths:** O(n + m*p) where n = text length, m = segments, p = avg path length
- **Memory:** O(n) for result arrays
- **Typical case:** <1ms for 10 paths with 50 chars each

### Upstream Differences

LLxprt adaptation changes from upstream:

1. **Import paths:** `@google/gemini-cli-core` → `@vybestack/llxprt-code-core`
2. **Copyright headers:** Google LLC → Vybestack LLC (preserve existing headers)
3. **Test framework:** Same (Vitest)
4. **Code style:** Same (matches existing LLxprt code)

### Future Considerations

This implementation could be extended to:

1. Support URL paths (http://, https://)
2. Support relative paths (./file, ../file)
3. Add path normalization (resolve `.` and `..`)
4. Add configurable path separators (newlines, semicolons)
5. Add max path count limit for safety

However, these are OUT OF SCOPE for this reimplementation. Only implement what upstream did.

## Troubleshooting

### If tests fail after Step 6.3:

1. Check that `parsePastedPaths` is imported correctly
2. Verify exact line replacement (1681-1684)
3. Ensure no syntax errors in text-buffer.ts
4. Run `npm run typecheck` to find type errors
5. Check that `isValidPath` callback signature matches

### If Windows path tests fail:

1. Verify `PATH_PREFIX_PATTERN` includes `[a-zA-Z]:` and `\\\\`
2. Check that backslashes in UNC paths aren't treated as escape chars
3. Ensure `escapePath` handles Windows paths correctly

### If escape handling is wrong:

1. Review `splitEscapedPaths` logic for `\\ ` detection
2. Verify `i += 2` advances past both `\` and space
3. Check that `trim()` doesn't remove escapes
4. Ensure `unescapePath` is called before validation

### If backward compatibility breaks:

1. Run existing tests in isolation
2. Verify single-path case still checks entire text first
3. Ensure `PATH_PREFIX_PATTERN` matches existing paths
4. Check that `escapePath` doesn't double-escape
5. Verify shell mode check is still before path processing

## Success Criteria

Implementation is complete when:

1. [OK] All 10 `splitEscapedPaths` tests pass
2. [OK] All 13 `parsePastedPaths` tests pass
3. [OK] All 3 new integration tests pass
4. [OK] All 4 existing drag/drop tests still pass
5. [OK] All other text-buffer tests still pass
6. [OK] No TypeScript errors
7. [OK] No linting errors
8. [OK] Manual testing confirms expected behavior
9. [OK] Code is self-documenting (no comments needed)
10. [OK] Commit message follows project conventions
