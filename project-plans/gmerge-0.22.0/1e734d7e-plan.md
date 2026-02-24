# Reimplementation Plan: Multi-file Image Drag/Drop (upstream 1e734d7e)

## Upstream Commit Summary

**Commit:** 1e734d7e60ee1a69d9ee2b57c6c32a78aa491ec1  
**Author:** Jack Wotherspoon <jackwoth@google.com>  
**Date:** Fri Dec 12 12:14:35 2025 -0500  
**Title:** feat: support multi-file drag and drop of images (#14832)

### What Upstream Does

The upstream commit adds support for handling multiple file paths that are pasted/dropped simultaneously (e.g., from dragging multiple images from a file browser). The key changes:

1. **New utility functions in `clipboardUtils.ts`:**
   - `splitEscapedPaths()`: Splits space-separated paths while respecting escaped spaces (e.g., `/path/to/my\ file.png`)
   - `parsePastedPaths()`: Processes pasted text containing file paths, adding `@` prefix to valid paths and handling:
     - Single and multiple space-separated paths
     - Paths with escaped spaces
     - Windows paths (drive letters, UNC paths)
     - Mixed valid/invalid paths (only prefixes valid ones)
     - Automatic escaping of unescaped spaces in valid paths

2. **Updates to `text-buffer.ts`:**
   - Imports the new `parsePastedPaths()` function
   - Removes direct import of `unescapePath` from core (now handled by `parsePastedPaths`)
   - Replaces single-path validation logic with multi-path processing:
     ```typescript
     // OLD (lines 1678-1684 upstream):
     if (isValidPath(unescapePath(potentialPath))) {
       ch = `@${potentialPath} `;
     }
     
     // NEW:
     const processed = parsePastedPaths(potentialPath, isValidPath);
     if (processed) {
       ch = processed;
     }
     ```

3. **Comprehensive test coverage:**
   - Tests for `splitEscapedPaths()` covering edge cases
   - Tests for `parsePastedPaths()` covering various path formats
   - Integration tests in `text-buffer.test.ts` for multi-file paste behavior

## Why We Can't Cherry-Pick

1. **Different import paths:** LLxprt uses `@vybestack/llxprt-code-core` instead of `@google/gemini-cli-core`
2. **Structural differences in text-buffer.ts:** The file has undergone independent development with different line numbers and potentially different surrounding context
3. **Test infrastructure differences:** Test utilities and setup may differ between codebases
4. **License headers differ:** LLxprt uses Vybestack LLC copyright vs. Google LLC

## Implementation Plan

### Step 1: Add utility functions to `clipboardUtils.ts`

**File:** `packages/cli/src/ui/utils/clipboardUtils.ts`

Add the following after the existing `cleanupOldClipboardImages()` function:

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
      // Escaped space - part of filename, preserve the escape sequence
      current += '\\ ';
      i += 2;
    } else if (char === ' ') {
      // Unescaped space - path separator
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

  // Don't forget the last segment
  if (current.trim()) {
    paths.push(current.trim());
  }

  return paths;
}

/** Matches strings that start with a path prefix (/, ~, ., Windows drive letter, or UNC path) */
const PATH_PREFIX_PATTERN = /^([/~.]|[a-zA-Z]:|\\\\)/;

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
  // Import escapePath and unescapePath from core
  const { escapePath, unescapePath } = require('@vybestack/llxprt-code-core');
  
  // First, check if the entire text is a single valid path
  if (PATH_PREFIX_PATTERN.test(text) && isValidPath(text)) {
    return `@${escapePath(text)} `;
  }

  // Otherwise, try splitting on unescaped spaces
  const segments = splitEscapedPaths(text);
  if (segments.length === 0) {
    return null;
  }

  let anyValidPath = false;
  const processedPaths = segments.map((segment) => {
    // Quick rejection: skip segments that can't be paths
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

**Import modifications needed:**
Add `escapePath` and `unescapePath` imports at the top of the function or refactor to import them at module level:

```typescript
import {
  escapePath,
  unescapePath,
} from '@vybestack/llxprt-code-core';
```

### Step 2: Update `text-buffer.ts`

**File:** `packages/cli/src/ui/components/shared/text-buffer.ts`

**2a. Update imports (around line 11-17):**

Add import for `parsePastedPaths`:
```typescript
import { parsePastedPaths } from '../../utils/clipboardUtils.js';
```

Keep the existing import of `unescapePath` from core for now (it may be used elsewhere).

**2b. Modify the `insert` callback (around lines 1662-1703):**

Replace the single-path validation logic:

```typescript
// FIND (around lines 1675-1684):
        let potentialPath = ch.trim();
        const quoteMatch = potentialPath.match(/^'(.*)'$/);
        if (quoteMatch) {
          potentialPath = quoteMatch[1];
        }

        potentialPath = potentialPath.trim();
        if (isValidPath(unescapePath(potentialPath))) {
          ch = `@${potentialPath} `;
        }

// REPLACE WITH:
        let potentialPath = ch.trim();
        const quoteMatch = potentialPath.match(/^'(.*)'$/);
        if (quoteMatch) {
          potentialPath = quoteMatch[1];
        }

        potentialPath = potentialPath.trim();

        const processed = parsePastedPaths(potentialPath, isValidPath);
        if (processed) {
          ch = processed;
        }
```

**Important:** Verify the exact line numbers by checking the current state of the file before making changes.

### Step 3: Add comprehensive tests

**File:** `packages/cli/src/ui/utils/clipboardUtils.test.ts`

Add test suite at the end of the file (before the closing of the main describe block):

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
      // Use Set to model reality: individual paths exist, combined string doesn't
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
      // Use Set to model reality: individual paths exist, combined string doesn't
      const validPaths = new Set(['/path/to/my file.txt', '/other/path.txt']);
      const result = parsePastedPaths(
        '/path/to/my\\ file.txt /other/path.txt',
        (p) => validPaths.has(p),
      );
      expect(result).toBe('@/path/to/my\\ file.txt @/other/path.txt ');
    });

    it('should unescape paths before validation', () => {
      // Use Set to model reality: individual paths exist, combined string doesn't
      const validPaths = new Set(['/my file.txt', '/other.txt']);
      const validatedPaths: string[] = [];
      parsePastedPaths('/my\\ file.txt /other.txt', (p) => {
        validatedPaths.push(p);
        return validPaths.has(p);
      });
      // First checks entire string, then individual unescaped segments
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

**Import additions needed:**
Add `splitEscapedPaths` and `parsePastedPaths` to the imports at the top:

```typescript
import {
  clipboardHasImage,
  saveClipboardImage,
  cleanupOldClipboardImages,
  splitEscapedPaths,
  parsePastedPaths,
} from './clipboardUtils.js';
```

**File:** `packages/cli/src/ui/components/shared/text-buffer.test.ts`

Add integration tests within the existing paste tests section (look for the describe block that tests paste behavior, likely around line 600-650):

```typescript
    it('should prepend @ to multiple valid file paths on insert', () => {
      // Use Set to model reality: individual paths exist, combined string doesn't
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
      // Use Set to model reality: individual paths exist, combined string doesn't
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

### Step 4: Verify and test

1. Run the test suite to ensure all new tests pass:
   ```bash
   npm test clipboardUtils.test.ts
   npm test text-buffer.test.ts
   ```

2. Manual testing:
   - Test with single file drag/drop (should work as before)
   - Test with multiple files drag/drop
   - Test with files containing spaces in names
   - Test with mixed valid/invalid paths

3. Check for any TypeScript compilation errors:
   ```bash
   npm run typecheck
   ```

4. Run linter:
   ```bash
   npm run lint
   ```

## Expected Behavior After Implementation

1. **Single file path:** Works as before - adds `@` prefix and trailing space
2. **Multiple file paths:** All valid paths get `@` prefix, separated by spaces
3. **Escaped spaces:** Preserved in file paths (e.g., `/my\ file.txt`)
4. **Unescaped spaces:** Automatically escaped for valid paths
5. **Mixed valid/invalid:** Only valid paths get `@` prefix
6. **Windows paths:** Properly handled (drive letters, UNC paths)

## Potential Issues and Solutions

### Issue 1: Import of escapePath/unescapePath in clipboardUtils

**Problem:** The `parsePastedPaths` function needs `escapePath` and `unescapePath` but they may not be exported from core.

**Solution:** 
- Check if these are available in `@vybestack/llxprt-code-core`
- If not, implement simple versions inline:
  ```typescript
  function escapePath(path: string): string {
    return path.replace(/ /g, '\\ ');
  }
  
  function unescapePath(path: string): string {
    return path.replace(/\\ /g, ' ');
  }
  ```

### Issue 2: PATH_PREFIX_PATTERN may need adjustment

**Problem:** The regex may not cover all path formats in LLxprt's context.

**Solution:** Test with actual paths and adjust if needed. The current pattern covers:
- Unix absolute paths (`/`)
- Home directory (`~`)
- Relative paths (`.`)
- Windows drive letters (`C:`)
- UNC paths (`\\`)

### Issue 3: Test environment differences

**Problem:** Test utilities might differ between upstream and LLxprt.

**Solution:** Adjust test syntax to match LLxprt's testing patterns, particularly:
- Import paths for test utilities
- Matcher functions (e.g., custom matchers)
- Setup/teardown patterns

## Commit Message

```
reimplement: multi-file image drag/drop (upstream 1e734d7e)

Add support for handling multiple file paths pasted/dropped simultaneously,
particularly useful when dragging multiple images from a file browser.

Changes:
- Add splitEscapedPaths() to parse space-separated paths with escape handling
- Add parsePastedPaths() to process and validate multi-path input
- Update text-buffer insert logic to use new multi-path processing
- Add comprehensive test coverage for new functionality
- Support Windows paths (drive letters, UNC paths)
- Properly handle files with spaces in names (escaped and unescaped)

This is a reimplementation of upstream commit 1e734d7e adapted for
LLxprt's codebase structure and import paths.

Testing: All new tests pass, existing functionality preserved
```

## Files Modified

1. `packages/cli/src/ui/utils/clipboardUtils.ts` - Add utility functions
2. `packages/cli/src/ui/components/shared/text-buffer.ts` - Update insert logic
3. `packages/cli/src/ui/utils/clipboardUtils.test.ts` - Add unit tests
4. `packages/cli/src/ui/components/shared/text-buffer.test.ts` - Add integration tests

## Estimated Scope

- **Lines of code added:** ~200
- **Lines of code modified:** ~10
- **Test cases added:** ~23
- **Complexity:** Medium (requires careful handling of escape sequences and path validation)
