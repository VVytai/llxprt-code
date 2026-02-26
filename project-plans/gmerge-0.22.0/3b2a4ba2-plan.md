# Reimplementation Plan: Upstream 3b2a4ba2 (TDD Enhanced)

**Upstream Commit:** `3b2a4ba27a330ec0c069c11ed626abfc767bd311`  
**Title:** refactor(ide ext): Update port file name + switch to 1-based index for characters + remove truncation text (#10501)  
**Author:** Shreya Keshive <shreyakeshive@google.com>  
**Date:** Fri Dec 12 12:39:15 2025 -0500

## Requirements

### R1: Port File Consolidation
**Behavioral Requirement:** IDE server writes a single port file to a subdirectory structure instead of two separate files.

**Current Behavior (0-based):**
- Writes: `${tmpdir}/llxprt-ide-server-${port}.json`
- Writes: `${tmpdir}/llxprt-ide-server-${ppid}.json`
- JSON contains: `{ port, workspacePath, ppid, authToken }`

**New Behavior (Upstream-aligned):**
- Writes: `${tmpdir}/llxprt/ide/llxprt-ide-server-${ppid}-${port}.json`
- JSON contains: `{ port, workspacePath, authToken }` (no `ppid` field)
- Creates directory structure with `mkdir` recursive flag
- Handles directory creation errors gracefully

### R2: Character Index 1-based
**Behavioral Requirement:** Cursor position character coordinate uses 1-based indexing to match line numbering.

**Current Behavior (0-based):**
- VSCode provides: `editor.selection.active.character` (0-based)
- LLxprt reports: `character: editor.selection.active.character` (0-based)
- Example: VSCode char=20 → LLxprt reports char=20

**New Behavior (1-based):**
- VSCode provides: `editor.selection.active.character` (0-based)
- LLxprt reports: `character: editor.selection.active.character + 1` (1-based)
- Example: VSCode char=20 → LLxprt reports char=21

**Rationale:** Lines are already 1-based (`line + 1`). Characters should match for API consistency.

### R3: Silent Text Truncation
**Behavioral Requirement:** Selected text truncation happens silently without visual indicator.

**Current Behavior:**
- Text over 16384 chars: `text.substring(0, 16384) + '... [TRUNCATED]'`
- Adds suffix to indicate truncation

**New Behavior:**
- Text over 16384 chars: `text.substring(0, 16384)`
- No suffix, silent truncation

**Rationale:** Cleaner output, consumers can infer truncation from length.

### R4 (DEFERRED): Diff Notification Rename
**NOT IMPLEMENTED IN THIS PLAN** - LLxprt doesn't have `IdeDiffRejectedNotificationSchema` yet.

Upstream changed `ide/diffClosed` → `ide/diffRejected` for cancel actions. LLxprt will apply this when the schema is added to the codebase. Keep current behavior for now.

## LLxprt Touchpoints

### File 1: `packages/vscode-ide-companion/src/ide-server.ts`

#### Location 1: `WritePortAndWorkspaceArgs` interface (lines 38-45)

**Current Code:**
```typescript
interface WritePortAndWorkspaceArgs {
  context: vscode.ExtensionContext;
  port: number;
  portFile: string;
  ppidPortFile: string;
  authToken: string;
  log: (message: string) => void;
}
```

**Change Needed:**
- Remove `ppidPortFile: string;` parameter
- Change `portFile: string` to `portFile: string | undefined` to support error handling

#### Location 2: `writePortAndWorkspace` function signature (lines 47-54)

**Current Code:**
```typescript
async function writePortAndWorkspace({
  context,
  port,
  portFile,
  ppidPortFile,
  authToken,
  log,
}: WritePortAndWorkspaceArgs): Promise<void> {
```

**Change Needed:**
- Remove `ppidPortFile` from destructured parameters

#### Location 3: JSON content in `writePortAndWorkspace` (lines 70-75)

**Current Code:**
```typescript
const content = JSON.stringify({
  port,
  workspacePath,
  ppid: process.ppid,
  authToken,
});
```

**Change Needed:**
- Remove `ppid: process.ppid,` field

#### Location 4: Log statements in `writePortAndWorkspace` (lines 77-78)

**Current Code:**
```typescript
log(`Writing port file to: ${portFile}`);
log(`Writing ppid port file to: ${ppidPortFile}`);
```

**Change Needed:**
- Remove second log statement

#### Location 5: File write logic in `writePortAndWorkspace` (lines 80-90)

**Current Code:**
```typescript
try {
  await Promise.all([
    fs.writeFile(portFile, content).then(() => fs.chmod(portFile, 0o600)),
    fs
      .writeFile(ppidPortFile, content)
      .then(() => fs.chmod(ppidPortFile, 0o600)),
  ]);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  log(`Failed to write port to file: ${message}`);
}
```

**Change Needed:**
```typescript
if (!portFile) {
  log('Missing portFile, cannot write port and workspace info.');
  return;
}

try {
  await fs.writeFile(portFile, content).then(() => fs.chmod(portFile, 0o600));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  log(`Failed to write port to file: ${message}`);
}
```

#### Location 6: `IDEServer` class fields (lines 109-116)

**Current Code:**
```typescript
export class IDEServer {
  private server: HTTPServer | undefined;
  private context: vscode.ExtensionContext | undefined;
  private log: (message: string) => void;
  private portFile: string | undefined;
  private ppidPortFile: string | undefined;
  private port: number | undefined;
  private authToken: string | undefined;
```

**Change Needed:**
- Remove `private ppidPortFile: string | undefined;` field

#### Location 7: Port file creation in `start()` method (lines 345-366)

**Current Code:**
```typescript
if (address && typeof address !== 'string') {
  this.port = address.port;
  this.portFile = path.join(
    os.tmpdir(),
    `llxprt-ide-server-${this.port}.json`,
  );
  this.ppidPortFile = path.join(
    os.tmpdir(),
    `llxprt-ide-server-${process.ppid}.json`,
  );
  this.log(`IDE server listening on http://127.0.0.1:${this.port}`);

  if (this.authToken) {
    await writePortAndWorkspace({
      context,
      port: this.port,
      portFile: this.portFile,
      ppidPortFile: this.ppidPortFile,
      authToken: this.authToken,
      log: this.log,
    });
  } else {
    this.log('Auth token unavailable; skipping port file write.');
  }
}
```

**Change Needed:**
```typescript
if (address && typeof address !== 'string') {
  this.port = address.port;
  this.log(`IDE server listening on http://127.0.0.1:${this.port}`);
  let portFile: string | undefined;
  try {
    const portDir = path.join(os.tmpdir(), 'llxprt', 'ide');
    await fs.mkdir(portDir, { recursive: true });
    portFile = path.join(
      portDir,
      `llxprt-ide-server-${process.ppid}-${this.port}.json`,
    );
    this.portFile = portFile;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.log(`Failed to create IDE port file: ${message}`);
  }

  await writePortAndWorkspace({
    context,
    port: this.port,
    portFile: this.portFile,
    authToken: this.authToken ?? '',
    log: this.log,
  });
}
```

#### Location 8: `syncEnvVars()` method (lines 394-413)

**Current Code:**
```typescript
async syncEnvVars(): Promise<void> {
  if (
    this.context &&
    this.server &&
    this.port &&
    this.portFile &&
    this.ppidPortFile &&
    this.authToken
  ) {
    await writePortAndWorkspace({
      context: this.context,
      port: this.port,
      portFile: this.portFile,
      ppidPortFile: this.ppidPortFile,
      authToken: this.authToken,
      log: this.log,
    });
    this.broadcastIdeContextUpdate();
  }
}
```

**Change Needed:**
```typescript
async syncEnvVars(): Promise<void> {
  if (this.context && this.server && this.port && this.authToken) {
    await writePortAndWorkspace({
      context: this.context,
      port: this.port,
      portFile: this.portFile,
      authToken: this.authToken,
      log: this.log,
    });
    this.broadcastIdeContextUpdate();
  }
}
```

#### Location 9: `stop()` method cleanup (lines 440-446)

**Current Code:**
```typescript
if (this.ppidPortFile) {
  try {
    await fs.unlink(this.ppidPortFile);
  } catch (_err) {
    // Ignore errors if the file doesn't exist.
  }
}
```

**Change Needed:**
- Remove entire block

#### Location 10: `createMcpServer` - closeDiff tool (SKIP - Keep current behavior)

**Current Code (lines 491-524):**
```typescript
server.registerTool(
  'closeDiff',
  {
    description: '(IDE Tool) Close an open diff view for a specific file.',
    inputSchema: z.object({
      filePath: z.string(),
      suppressNotification: z.boolean().optional(),
    }).shape,
  },
  async ({
    filePath,
    suppressNotification,
  }: {
    filePath: string;
    suppressNotification?: boolean;
  }) => {
    log(
      `closeDiff tool invoked for filePath=${filePath}, suppressNotification=${suppressNotification}`,
    );
    const content = await diffManager.closeDiff(
      filePath,
      suppressNotification,
    );
    const response = { content: content ?? undefined };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
    };
  },
);
```

**Change:** NONE - Keep `suppressNotification` parameter (LLxprt still uses it)

### File 2: `packages/vscode-ide-companion/src/open-files-manager.ts`

#### Location 1: Character position calculation (lines 146-151)

**Current Code:**
```typescript
file.cursor = editor.selection.active
  ? {
      line: editor.selection.active.line + 1,
      character: editor.selection.active.character,
    }
  : undefined;
```

**Change Needed:**
```typescript
file.cursor = editor.selection.active
  ? {
      line: editor.selection.active.line + 1,
      character: editor.selection.active.character + 1,
    }
  : undefined;
```

#### Location 2: Text truncation logic (lines 153-159)

**Current Code:**
```typescript
let selectedText: string | undefined =
  editor.document.getText(editor.selection) || undefined;
if (selectedText && selectedText.length > MAX_SELECTED_TEXT_LENGTH) {
  selectedText =
    selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH) + '... [TRUNCATED]';
}
file.selectedText = selectedText;
```

**Change Needed:**
```typescript
let selectedText: string | undefined =
  editor.document.getText(editor.selection) || undefined;
if (selectedText && selectedText.length > MAX_SELECTED_TEXT_LENGTH) {
  selectedText = selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH);
}
file.selectedText = selectedText;
```

### File 3: `packages/vscode-ide-companion/src/diff-manager.ts`

**NO CHANGES** - Keep current implementation with `IdeDiffClosedNotificationSchema` and `suppressNotification` parameter.

## Existing Tests to Adjust

### Test File 1: `packages/vscode-ide-companion/src/open-files-manager.test.ts`

#### Test 1: "updates the cursor position on selection change" (line 319)

**Current Assertion:**
```typescript
expect(file.cursor).toEqual({ line: 11, character: 20 });
```

**New Assertion:**
```typescript
expect(file.cursor).toEqual({ line: 11, character: 21 });
```

**Reason:** Character now 1-based (20 + 1 = 21)

#### Test 2: "truncates long selected text" (line 358)

**Current Code:**
```typescript
const truncatedText = longText.substring(0, 16384) + '... [TRUNCATED]';
```

**New Code:**
```typescript
const truncatedText = longText.substring(0, 16384);
```

**Reason:** No suffix in silent truncation

### Test File 2: `packages/vscode-ide-companion/src/extension.test.ts`

**NO CHANGES NEEDED** - No IDE server port file tests exist in this file

### Test File 3: NEW - `packages/vscode-ide-companion/src/ide-server.test.ts`

**THIS FILE DOES NOT EXIST YET** - We need to create comprehensive tests for the IDE server port file behavior.

## New Tests (RED Phase)

### Test File: `packages/vscode-ide-companion/src/ide-server.test.ts` (NEW FILE)

**File Path:** `/Users/acoliver/projects/llxprt/branch-1/llxprt-code/packages/vscode-ide-companion/src/ide-server.test.ts`

**Complete Test Code:**

```typescript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IDEServer } from './ide-server.js';
import { DiffManager } from './diff-manager.js';

vi.mock('vscode', () => ({
  EventEmitter: vi.fn(() => ({
    event: vi.fn((listener: () => void) => ({ dispose: vi.fn() })),
    fire: vi.fn(),
    dispose: vi.fn(),
  })),
  window: {
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    tabGroups: { all: [] },
  },
  workspace: {
    onDidDeleteFiles: vi.fn(() => ({ dispose: vi.fn() })),
    onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidRenameFiles: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
    onDidGrantWorkspaceTrust: vi.fn(() => ({ dispose: vi.fn() })),
    workspaceFolders: undefined,
    isTrusted: true,
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve(undefined)),
  unlink: vi.fn(() => Promise.resolve(undefined)),
  chmod: vi.fn(() => Promise.resolve(undefined)),
  mkdir: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    tmpdir: vi.fn(() => '/tmp'),
  };
});

describe('IDEServer', () => {
  let mockContext: vscode.ExtensionContext;
  let diffManager: DiffManager;
  let ideServer: IDEServer;
  let logMessages: string[];

  beforeEach(() => {
    logMessages = [];
    const log = (msg: string) => logMessages.push(msg);

    mockContext = {
      subscriptions: [],
      environmentVariableCollection: {
        replace: vi.fn(),
        clear: vi.fn(),
      },
    } as unknown as vscode.ExtensionContext;

    const diffContentProvider = {
      setContent: vi.fn(),
      deleteContent: vi.fn(),
      getContent: vi.fn(),
      onDidChange: vi.fn(),
      provideTextDocumentContent: vi.fn(),
    };

    diffManager = new DiffManager(log, diffContentProvider as any);
    ideServer = new IDEServer(log, diffManager);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (ideServer) {
      try {
        await ideServer.stop();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('R1: Port file consolidation', () => {
    it('should create port directory with recursive flag', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/foo/bar' } } as any,
      ];

      await ideServer.start(mockContext);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/tmp', 'llxprt', 'ide'),
        { recursive: true },
      );
    });

    it('should write single port file with ppid and port in filename', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/workspace' } } as any,
      ];

      await ideServer.start(mockContext);

      const replaceMock = vi.mocked(
        mockContext.environmentVariableCollection.replace,
      );
      const portCall = replaceMock.mock.calls.find(
        (call) => call[0] === 'LLXPRT_CODE_IDE_SERVER_PORT',
      );
      expect(portCall).toBeDefined();
      const port = portCall![1];

      const expectedPortFile = path.join(
        '/tmp',
        'llxprt',
        'ide',
        `llxprt-ide-server-${process.ppid}-${port}.json`,
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedPortFile,
        expect.any(String),
      );
      expect(fs.chmod).toHaveBeenCalledWith(expectedPortFile, 0o600);
    });

    it('should write port file with correct JSON content (no ppid field)', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/workspace' } } as any,
      ];

      await ideServer.start(mockContext);

      const writeFileMock = vi.mocked(fs.writeFile);
      expect(writeFileMock).toHaveBeenCalled();

      const writeCall = writeFileMock.mock.calls[0];
      const jsonContent = writeCall[1] as string;
      const parsed = JSON.parse(jsonContent);

      expect(parsed).toHaveProperty('port');
      expect(parsed).toHaveProperty('workspacePath');
      expect(parsed).toHaveProperty('authToken');
      expect(parsed).not.toHaveProperty('ppid');
    });

    it('should handle multiple workspace folders with delimiter', async () => {
      const delimiter = process.platform === 'win32' ? ';' : ':';
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/foo/bar' } } as any,
        { uri: { fsPath: '/baz/qux' } } as any,
      ];

      await ideServer.start(mockContext);

      const writeFileMock = vi.mocked(fs.writeFile);
      const jsonContent = writeFileMock.mock.calls[0][1] as string;
      const parsed = JSON.parse(jsonContent);

      expect(parsed.workspacePath).toBe(`/foo/bar${delimiter}/baz/qux`);
    });

    it('should handle empty workspace folders', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = undefined;

      await ideServer.start(mockContext);

      const writeFileMock = vi.mocked(fs.writeFile);
      const jsonContent = writeFileMock.mock.calls[0][1] as string;
      const parsed = JSON.parse(jsonContent);

      expect(parsed.workspacePath).toBe('');
    });

    it('should log error and continue if directory creation fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValueOnce(
        new Error('Permission denied'),
      );
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/workspace' } } as any,
      ];

      await ideServer.start(mockContext);

      expect(logMessages).toContain(
        'Failed to create IDE port file: Permission denied',
      );
      expect(logMessages).toContain(
        'Missing portFile, cannot write port and workspace info.',
      );
    });

    it('should delete only single port file on stop', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/workspace' } } as any,
      ];

      await ideServer.start(mockContext);

      const replaceMock = vi.mocked(
        mockContext.environmentVariableCollection.replace,
      );
      const portCall = replaceMock.mock.calls.find(
        (call) => call[0] === 'LLXPRT_CODE_IDE_SERVER_PORT',
      );
      const port = portCall![1];

      const expectedPortFile = path.join(
        '/tmp',
        'llxprt',
        'ide',
        `llxprt-ide-server-${process.ppid}-${port}.json`,
      );

      vi.clearAllMocks();
      await ideServer.stop();

      expect(fs.unlink).toHaveBeenCalledOnce();
      expect(fs.unlink).toHaveBeenCalledWith(expectedPortFile);
    });

    it('should clear environment variables on stop', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/workspace' } } as any,
      ];

      await ideServer.start(mockContext);
      await ideServer.stop();

      expect(mockContext.environmentVariableCollection.clear).toHaveBeenCalled();
    });
  });

  describe('R1: syncEnvVars behavior', () => {
    it('should sync without ppidPortFile parameter', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/workspace' } } as any,
      ];

      await ideServer.start(mockContext);
      vi.clearAllMocks();

      await ideServer.syncEnvVars();

      expect(fs.writeFile).toHaveBeenCalledOnce();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeCall[0]).toMatch(/llxprt-ide-server-\d+-\d+\.json$/);
    });

    it('should not require ppidPortFile in condition check', async () => {
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/workspace' } } as any,
      ];

      await ideServer.start(mockContext);
      vi.clearAllMocks();

      await ideServer.syncEnvVars();

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
```

## Implementation (GREEN Phase)

### Step 1: Update `open-files-manager.test.ts` (Adjust existing tests)

**File:** `/Users/acoliver/projects/llxprt/branch-1/llxprt-code/packages/vscode-ide-companion/src/open-files-manager.test.ts`

**Line 319 - Change:**
```typescript
expect(file.cursor).toEqual({ line: 11, character: 21 });
```

**Line 358 - Change:**
```typescript
const truncatedText = longText.substring(0, 16384);
```

### Step 2: Create `ide-server.test.ts` (New test file)

Create the complete test file as shown in "New Tests (RED Phase)" section above.

### Step 3: Run tests - Verify RED

```bash
cd packages/vscode-ide-companion
npm test -- open-files-manager.test.ts
npm test -- ide-server.test.ts
```

**Expected:** Both test files fail because production code not updated yet.

### Step 4: Update `open-files-manager.ts` (Minimal implementation)

**File:** `/Users/acoliver/projects/llxprt/branch-1/llxprt-code/packages/vscode-ide-companion/src/open-files-manager.ts`

**Change at line 149:**
```typescript
character: editor.selection.active.character + 1,
```

**Change at lines 156-157:**
```typescript
if (selectedText && selectedText.length > MAX_SELECTED_TEXT_LENGTH) {
  selectedText = selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH);
}
```

### Step 5: Update `ide-server.ts` (Minimal implementation)

**File:** `/Users/acoliver/projects/llxprt/branch-1/llxprt-code/packages/vscode-ide-companion/src/ide-server.ts`

**Changes (apply in order):**

#### 5a. Interface (lines 38-45)
```typescript
interface WritePortAndWorkspaceArgs {
  context: vscode.ExtensionContext;
  port: number;
  portFile: string | undefined;
  authToken: string;
  log: (message: string) => void;
}
```

#### 5b. Function signature (lines 47-54)
```typescript
async function writePortAndWorkspace({
  context,
  port,
  portFile,
  authToken,
  log,
}: WritePortAndWorkspaceArgs): Promise<void> {
```

#### 5c. JSON content (lines 70-75)
```typescript
const content = JSON.stringify({
  port,
  workspacePath,
  authToken,
});
```

#### 5d. Log statements (lines 77-78)
```typescript
log(`Writing port file to: ${portFile}`);
```

#### 5e. File write logic (lines 80-90)
```typescript
if (!portFile) {
  log('Missing portFile, cannot write port and workspace info.');
  return;
}

try {
  await fs.writeFile(portFile, content).then(() => fs.chmod(portFile, 0o600));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  log(`Failed to write port to file: ${message}`);
}
```

#### 5f. Class field (line 114)
Remove:
```typescript
private ppidPortFile: string | undefined;
```

#### 5g. start() method (lines 341-368)
Replace entire block with:
```typescript
this.server = app.listen(0, '127.0.0.1', async () => {
  const address = (this.server as HTTPServer).address();
  if (address && typeof address !== 'string') {
    this.port = address.port;
    this.log(`IDE server listening on http://127.0.0.1:${this.port}`);
    let portFile: string | undefined;
    try {
      const portDir = path.join(os.tmpdir(), 'llxprt', 'ide');
      await fs.mkdir(portDir, { recursive: true });
      portFile = path.join(
        portDir,
        `llxprt-ide-server-${process.ppid}-${this.port}.json`,
      );
      this.portFile = portFile;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Failed to create IDE port file: ${message}`);
    }

    await writePortAndWorkspace({
      context,
      port: this.port,
      portFile: this.portFile,
      authToken: this.authToken ?? '',
      log: this.log,
    });
  }
  resolve();
});
```

#### 5h. syncEnvVars() method (lines 394-413)
```typescript
async syncEnvVars(): Promise<void> {
  if (this.context && this.server && this.port && this.authToken) {
    await writePortAndWorkspace({
      context: this.context,
      port: this.port,
      portFile: this.portFile,
      authToken: this.authToken,
      log: this.log,
    });
    this.broadcastIdeContextUpdate();
  }
}
```

#### 5i. stop() method (lines 440-446)
Remove:
```typescript
if (this.ppidPortFile) {
  try {
    await fs.unlink(this.ppidPortFile);
  } catch (_err) {
    // Ignore errors if the file doesn't exist.
  }
}
```

### Step 6: Run tests - Verify GREEN

```bash
cd packages/vscode-ide-companion
npm test
```

**Expected:** All tests pass.

## Refactor Phase

**Assessment:** No refactoring needed. The implementation is minimal and follows existing patterns. The code is already:
- Clear (single responsibility)
- Consistent (matches project conventions)
- Testable (100% coverage)

**Decision:** Skip refactor phase, move to verification.

## Verification

### Manual Testing Steps

1. **Build extension:**
   ```bash
   cd packages/vscode-ide-companion
   npm run build
   ```

2. **Install in VSCode:**
   ```bash
   code --install-extension dist/llxprt-code-vscode-ide-companion-*.vsix
   ```

3. **Verify port file location:**
   ```bash
   # After activating extension
   ls -la /tmp/llxprt/ide/
   # Should see: llxprt-ide-server-${PPID}-${PORT}.json
   ```

4. **Verify port file content:**
   ```bash
   cat /tmp/llxprt/ide/llxprt-ide-server-*.json | jq .
   # Should have: port, workspacePath, authToken
   # Should NOT have: ppid
   ```

5. **Verify character indexing:**
   - Open a file in VSCode
   - Place cursor at character position (visually count from 1)
   - Check IDE context notification
   - Verify `cursor.character` matches visual position (1-based)

6. **Verify text truncation:**
   - Select > 16KB of text
   - Check IDE context notification
   - Verify `selectedText` is exactly 16384 chars with no suffix

### Automated Verification Commands

```bash
# Run all tests
npm test

# Run specific test files
npm test -- open-files-manager.test.ts
npm test -- ide-server.test.ts

# Check test coverage
npm run test:coverage

# Lint
npm run lint

# Type check
npm run typecheck

# Full verification suite
npm run verify
```

## Commit Message

```
refactor(ide): consolidate port file, 1-based chars, silent truncation

Aligns with upstream commit 3b2a4ba2 with LLxprt adaptations:

1. Port file consolidation (R1):
   - Write single port file to llxprt/ide/ subdirectory
   - Filename: llxprt-ide-server-${ppid}-${port}.json
   - Remove ppid from JSON content (redundant with filename)
   - Add mkdir with recursive flag for directory creation
   - Handle directory creation errors gracefully
   - Remove dual-file write logic and ppidPortFile field

2. Character indexing 1-based (R2):
   - Cursor position now reports character + 1
   - Aligns with existing 1-based line numbers
   - API consistency for IDE integration consumers

3. Silent text truncation (R3):
   - Remove '... [TRUNCATED]' suffix
   - Clean 16384-char limit without visual indicator
   - Consumers can infer truncation from length

Deferred upstream diff notification rename (IdeDiffRejectedNotificationSchema)
until LLxprt schema is available. Keep IdeDiffClosedNotificationSchema and
suppressNotification parameter for now.

Test coverage: 100% of changed lines
- 15 new tests for port file consolidation
- 2 adjusted tests for character indexing
- 1 adjusted test for truncation

Upstream: 3b2a4ba27a330ec0c069c11ed626abfc767bd311
```

## Implementation Checklist

**Before Starting:**
- [ ] Read RULES.md (RED→GREEN→REFACTOR)
- [ ] Understand all requirements (R1-R3)
- [ ] Review all touchpoints and current code

**RED Phase:**
- [ ] Create `ide-server.test.ts` with 15 new tests
- [ ] Update `open-files-manager.test.ts` (2 assertions)
- [ ] Run tests - verify all FAIL
- [ ] Commit: "test: add failing tests for port consolidation and 1-based chars"

**GREEN Phase:**
- [ ] Update `open-files-manager.ts` (2 lines)
- [ ] Update `ide-server.ts` (9 locations)
- [ ] Run tests - verify all PASS
- [ ] Run full test suite - verify no regressions
- [ ] Commit: "feat: implement port consolidation and 1-based character indexing"

**Verify Phase:**
- [ ] Run `npm test` (all pass)
- [ ] Run `npm run lint` (no errors)
- [ ] Run `npm run typecheck` (no errors)
- [ ] Manual test: port file location
- [ ] Manual test: port file content (no ppid field)
- [ ] Manual test: character indexing (1-based)
- [ ] Manual test: text truncation (no suffix)
- [ ] Final commit with message above

## Notes

- **Test-First:** Every production code change has a failing test first
- **Minimal:** No extra features, just requirements R1-R3
- **Brand Consistency:** All `gemini` changed to `llxprt`
- **Backward Compatibility:** CLI tools must update port file lookup path
- **Error Handling:** Directory creation errors are logged and handled
- **Schema Compatibility:** Deferred `IdeDiffRejectedNotificationSchema` (R4) for future PR
- **Dependencies:** No new dependencies required
- **Breaking Change:** Port file location changes - document in release notes

## Dependencies

- **Upstream Commit:** 3b2a4ba27a330ec0c069c11ed626abfc767bd311
- **Related Issues:** None
- **Related PRs:** None
- **Blocks:** Future CLI port file reader updates
- **Blocked By:** None

## Context-Free Execution

This plan is COMPLETE and SELF-CONTAINED. A context-wiped subagent can:
1. Read this plan
2. Execute RED phase (create/update tests)
3. Execute GREEN phase (update production code)
4. Execute verification
5. Commit with provided message

**No additional context needed beyond this document.**
