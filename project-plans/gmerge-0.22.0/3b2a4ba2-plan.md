# Reimplementation Plan: Upstream 3b2a4ba2

**Upstream Commit:** `3b2a4ba27a330ec0c069c11ed626abfc767bd311`  
**Title:** refactor(ide ext): Update port file name + switch to 1-based index for characters + remove truncation text (#10501)  
**Author:** Shreya Keshive <shreyakeshive@google.com>  
**Date:** Fri Dec 12 12:39:15 2025 -0500

## What Upstream Does

This commit makes three independent refactoring changes to the IDE extension:

### 1. Port File Consolidation
- **Before:** Wrote two port files:
  - `${tmpdir}/gemini-ide-server-${port}.json`
  - `${tmpdir}/gemini-ide-server-${ppid}.json`
- **After:** Writes single port file:
  - `${tmpdir}/gemini/ide/gemini-ide-server-${ppid}-${port}.json`
- **Changes:**
  - Creates subdirectory structure (`gemini/ide/`)
  - Combines ppid and port in single filename
  - Removes `ppid` field from JSON content (redundant with filename)
  - Removes `ppidPortFile` variable and all dual-file write logic
  - Adds `fs.mkdir` with `{ recursive: true }` for directory creation
  - Makes `portFile` optional (can be `undefined`) with guard check

### 2. Character Index Switch (0-based → 1-based)
- **File:** `open-files-manager.ts`
- **Change:** `character: editor.selection.active.character` → `character: editor.selection.active.character + 1`
- **Reason:** Align with 1-based line numbers already used (`line + 1`)
- **Test Update:** Expected cursor character changes from `20` to `21` in test assertion

### 3. Remove Truncation Suffix
- **Before:** `selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH) + '... [TRUNCATED]'`
- **After:** `selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH)`
- **Rationale:** Silent truncation without visual indicator (cleaner output)
- **Test Update:** Remove `'... [TRUNCATED]'` suffix from expected value

### 4. Diff Notification Rename (Bonus Change)
- **Before:** `ide/diffClosed` notification sent when user cancels
- **After:** `ide/diffRejected` notification (semantic clarity)
- **Schema:** `IdeDiffClosedNotificationSchema` → `IdeDiffRejectedNotificationSchema`
- **Note:** `closeDiff()` method still sends `ide/diffClosed` (manual close) but `suppressNotification` parameter removed

## Why Can't Cherry-Pick

LLxprt's IDE companion has architectural differences:

1. **Different branding:** Uses `llxprt-ide-server` prefix vs `gemini-ide-server`
2. **Schema divergence:** LLxprt uses `IdeDiffClosedNotificationSchema` for cancellation (doesn't have `IdeDiffRejectedNotificationSchema`)
3. **Method signatures:** LLxprt's `closeDiff()` has `suppressNotification` parameter still in use
4. **File structure:** Upstream changes span multiple files that may have different line numbers/context in LLxprt

## Adaptations for LLxprt

### Change 1: Port File Consolidation

**File:** `packages/vscode-ide-companion/src/ide-server.ts`

#### In `WritePortAndWorkspaceArgs` interface (line ~40):
```typescript
// Remove:
  ppidPortFile: string;

// Keep portFile, change authToken to required (not part of upstream, but fix guard logic)
```

#### In `writePortAndWorkspace()` function (line ~50):
```typescript
// Remove parameter from destructure:
-  ppidPortFile,

// Remove from JSON content (line ~80):
-    ppid: process.ppid,

// Remove log statement:
-  log(`Writing ppid port file to: ${ppidPortFile}`);

// Change Promise.all to single write (line ~90):
-  await Promise.all([
-    fs.writeFile(portFile, content).then(() => fs.chmod(portFile, 0o600)),
-    fs
-      .writeFile(ppidPortFile, content)
-      .then(() => fs.chmod(ppidPortFile, 0o600)),
-  ]);
+  if (!portFile) {
+    log('Missing portFile, cannot write port and workspace info.');
+    return;
+  }
+  
+  await fs.writeFile(portFile, content).then(() => fs.chmod(portFile, 0o600));
```

#### In `IDEServer` class (line ~120):
```typescript
// Remove field:
-  private ppidPortFile: string | undefined;

// Keep portFile as-is (already defined)
```

#### In `start()` method (line ~340):
```typescript
// Replace port file creation logic:
-          this.portFile = path.join(
-            os.tmpdir(),
-            `llxprt-ide-server-${this.port}.json`,
-          );
-          this.ppidPortFile = path.join(
-            os.tmpdir(),
-            `llxprt-ide-server-${process.ppid}.json`,
-          );
-          this.log(`IDE server listening on http://127.0.0.1:${this.port}`);
-
-          if (this.authToken) {
-            await writePortAndWorkspace({
-              context,
-              port: this.port,
-              portFile: this.portFile,
-              ppidPortFile: this.ppidPortFile,
-              authToken: this.authToken,
-              log: this.log,
-            });
-          } else {
-            this.log('Auth token unavailable; skipping port file write.');
-          }

+          this.log(`IDE server listening on http://127.0.0.1:${this.port}`);
+          let portFile: string | undefined;
+          try {
+            const portDir = path.join(os.tmpdir(), 'llxprt', 'ide');
+            await fs.mkdir(portDir, { recursive: true });
+            portFile = path.join(
+              portDir,
+              `llxprt-ide-server-${process.ppid}-${this.port}.json`,
+            );
+            this.portFile = portFile;
+          } catch (err) {
+            const message = err instanceof Error ? err.message : String(err);
+            this.log(`Failed to create IDE port file: ${message}`);
+          }
+
+          await writePortAndWorkspace({
+            context,
+            port: this.port,
+            portFile: this.portFile,
+            authToken: this.authToken ?? '',
+            log: this.log,
+          });
```

Note: Directory name is `llxprt` not `gemini`

#### In `syncEnvVars()` method (line ~390):
```typescript
// Remove ppidPortFile condition and parameter:
-    if (
-      this.context &&
-      this.server &&
-      this.port &&
-      this.portFile &&
-      this.ppidPortFile &&
-      this.authToken
-    ) {
+    if (this.context && this.server && this.port && this.authToken) {

// Remove parameter from writePortAndWorkspace call:
-        ppidPortFile: this.ppidPortFile,
```

#### In `stop()` method (line ~437):
```typescript
// Remove ppid port file cleanup:
-    if (this.ppidPortFile) {
-      try {
-        await fs.unlink(this.ppidPortFile);
-      } catch (_err) {
-        // Ignore errors if the file doesn't exist.
-      }
-    }
```

#### In `createMcpServer()` function (line ~477):
**SKIP THIS CHANGE** - LLxprt still uses `suppressNotification` parameter:
- Keep `suppressNotification` in inputSchema
- Keep parameter in async handler
- Keep passing to `diffManager.closeDiff()`

### Change 2: Character Index (0-based → 1-based)

**File:** `packages/vscode-ide-companion/src/open-files-manager.ts`

Location: Inside `updateFileInfo()` method, cursor assignment (line ~152)

```typescript
// Change:
-          character: editor.selection.active.character,
+          character: editor.selection.active.character + 1,
```

**Why:** VSCode uses 0-based character positions internally, but LLxprt API should use 1-based (matching line numbers).

### Change 3: Remove Truncation Suffix

**File:** `packages/vscode-ide-companion/src/open-files-manager.ts`

Location: Inside `updateFileInfo()` method, selectedText truncation (line ~160)

```typescript
// Change:
-      selectedText =
-        selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH) + '... [TRUNCATED]';
+      selectedText = selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH);
```

### Change 4: Diff Notifications

**File:** `packages/vscode-ide-companion/src/diff-manager.ts`

**SKIP THIS CHANGE** - LLxprt doesn't have `IdeDiffRejectedNotificationSchema`:
- Keep using `IdeDiffClosedNotificationSchema` in `cancelDiff()`
- Keep `suppressNotification` parameter in `closeDiff()`
- Keep notification emission in `closeDiff()` when not suppressed

**Reasoning:** Upstream split diffClosed into diffClosed (manual) and diffRejected (cancel). LLxprt hasn't made this semantic distinction yet. Apply only when schema is available.

## Test Updates

**File:** `packages/vscode-ide-companion/src/open-files-manager.test.ts`

### Test: "updates the cursor position on selection change" (line ~320)
```typescript
// Change expected character:
-    expect(file.cursor).toEqual({ line: 11, character: 20 });
+    expect(file.cursor).toEqual({ line: 11, character: 21 });
```

### Test: "truncates long selected text" (line ~360)
```typescript
// Change expected truncated text:
-    const truncatedText = longText.substring(0, 16384) + '... [TRUNCATED]';
+    const truncatedText = longText.substring(0, 16384);
```

### File: `packages/vscode-ide-companion/src/ide-server.test.ts`

**SKIP TEST CHANGES** - These test the port file logic which LLxprt keeps different (different branding). Update manually if implementation changes work.

However, add `mkdir` mock if not present:

```typescript
// In mock setup (around line 27):
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve(undefined)),
  unlink: vi.fn(() => Promise.resolve(undefined)),
  chmod: vi.fn(() => Promise.resolve(undefined)),
+ mkdir: vi.fn(() => Promise.resolve(undefined)),
}));
```

## Implementation Order

1. **Phase 1 - Port file consolidation:**
   - Update `ide-server.ts` interface, function, and class
   - Add `mkdir` mock to test setup
   - Verify tests pass

2. **Phase 2 - Character indexing:**
   - Update `open-files-manager.ts` cursor calculation
   - Update corresponding test assertion
   - Verify tests pass

3. **Phase 3 - Truncation suffix:**
   - Update `open-files-manager.ts` truncation logic
   - Update corresponding test assertion
   - Verify tests pass

4. **Verification:**
   - Run full test suite: `npm test`
   - Manual test: Start extension, verify port file location and content
   - Manual test: Select text in editor, verify cursor position (character should be 1-based)
   - Manual test: Select >16KB text, verify truncation has no suffix

## Commit Message

```
reimplement: IDE extension port + character indexing (upstream 3b2a4ba2)

Port upstream refactor with LLxprt adaptations:

1. Port file consolidation:
   - Write single port file to llxprt/ide/ subdirectory
   - Filename includes both ppid and port
   - Remove ppid field from JSON (redundant)
   - Add mkdir with recursive flag

2. Switch to 1-based character indexing:
   - Cursor position now reports character + 1
   - Aligns with 1-based line numbers
   - Updates test expectations

3. Remove truncation suffix:
   - Silent truncation without "... [TRUNCATED]"
   - Cleaner output for large selections

Skipped upstream diff notification rename (IdeDiffRejectedNotificationSchema)
as LLxprt schema doesn't include this yet. Will apply when schema available.

Upstream: 3b2a4ba27a330ec0c069c11ed626abfc767bd311
```

## Notes

- **Brand consistency:** All `gemini` references changed to `llxprt`
- **Schema compatibility:** Deferred `IdeDiffRejectedNotificationSchema` until LLxprt defines it
- **Backward compatibility:** Port file location changes - clients must be updated to look in new location
- **Directory safety:** `mkdir` with `recursive: true` is safe if directory exists
- **Error handling:** Port file creation wrapped in try/catch, logs error but continues
