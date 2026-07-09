#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 Vybestack LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * agents-neutral-gate.ts — AST-based enforcement gate for #2349
 * (PLAN-20260707-AGENTNEUTRAL.P02).
 *
 * Detects Google-shaped structural envelopes and cheap #2424 re-introduction
 * vectors. Implements AST-context-aware --count/--by-file ratchet (checkF
 * F1/F3/F5 + checkG-call) and REAL fail-mode for cheap vectors (checkA/B/C/E)
 * behind --enforce-imports. EXPENSIVE checks (checkD/checkG-barrel/checkH)
 * and full checkF/checkG-call FAIL gate are STUBBED — full fail-mode
 * implemented at P31 (extends this skeleton).
 *
 * @plan:PLAN-20260707-AGENTNEUTRAL.P02
 * @requirement:REQ-012.1
 * @pseudocode lines 9-44
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, relative, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { isErrnoException } from './utils/error-guards.ts';

// ─── Constants ──────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SCAN_ROOT = 'packages/agents/src';

/** Substrings identifying a BANNED module (banned-symbol provenance). */
const BANNED_MODULE_PATTERNS: readonly string[] = [
  '@google/genai',
  'clientContract',
  'geminiContent',
];

/** §1.3 banned Google symbols — flagged ONLY when from a banned module. */
const BANNED_SYMBOLS: ReadonlySet<string> = new Set([
  'GenerateContentResponse',
  'Candidate',
  'Part',
  'PartListUnion',
  'FunctionCall',
  'Content',
  'SendMessageParameters',
  'GenerateContentConfig',
  'FinishReason',
  'Type',
  'Schema',
  'Tool',
  'FunctionDeclaration',
  'ApiError',
  'GoogleGenAI',
  'GenerateContentResponseUsageMetadata',
  'createUserContent',
]);

/** Contract* payload aliases (the #2424 aliasing bypass). */
const CONTRACT_PREFIX_TYPES: readonly string[] = [
  'ContractPart',
  'ContractContent',
  'ContractContentUnion',
  'ContractPartListUnion',
  'ContractGenerateContentResponse',
  'ContractSendMessageParameters',
  'ContractGenerateContentConfig',
  'ContractUsageMetadata',
];

/** Google enum names whose local re-declaration is flagged. */
const GOOGLE_ENUM_NAMES: ReadonlySet<string> = new Set(['FinishReason']);

/** Domain *Candidate[] suffixes EXCLUDED from checkF (false-positive guard). */
const DOMAIN_CANDIDATE_SUFFIXES: readonly string[] = [
  'Candidate[]',
  'PublicProfileCandidate[]',
  'CompressionLoadBalancerCandidate[]',
];

// ─── Types ──────────────────────────────────────────────────────────────────

type CheckSubkind =
  | 'A-raw-genai-import'
  | 'B-banned-symbol'
  | 'C-contract-alias'
  | 'D-roundtrip-symbol'
  | 'E-enum-redeclaration'
  | 'F1-candidates-content'
  | 'F3-role-parts'
  | 'F5-parts-access'
  | 'G-call-toGeminiContent'
  | 'G-barrel-GeminiContent'
  | 'H-usage-key';

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly subkind: CheckSubkind;
  readonly contextSnippet: string;
  readonly reason: string;
}

interface AllowlistEntry {
  readonly file: string;
  readonly subkind: string;
  readonly contextPattern: string;
  readonly justification: string;
}

// ─── File discovery ─────────────────────────────────────────────────────────

const FILE_EXCLUSION_GLOBS: readonly string[] = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/*-test-helpers*',
  '**/*test-helper*',
];
const DIR_EXCLUSION_GLOBS: readonly string[] = ['**/__tests__/**'];
const PRUNED_DIR_BASE_NAMES = new Set([
  '__tests__',
  'node_modules',
  'dist',
  'build',
  '.turbo',
  'coverage',
]);

function matchGlob(glob: string, relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  const escaped = glob.replace(/[\\^$.|?*+(){}[\]]/g, (ch) => '\\' + ch);
  const body = escaped
    .replace(/\\\*\\\*\//g, '(?:.*/)?')
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*');
  return new RegExp('^' + body + '$').test(normalized);
}

function isExcludedFile(repoRoot: string, filePath: string): boolean {
  const rel = relative(repoRoot, filePath).replace(/\\/g, '/');
  return FILE_EXCLUSION_GLOBS.some((g) => matchGlob(g, rel));
}

function isExcludedDir(
  repoRoot: string,
  dirPath: string,
  isStart: boolean,
): boolean {
  if (isStart) return false;
  const rel = relative(repoRoot, dirPath).replace(/\\/g, '/');
  return DIR_EXCLUSION_GLOBS.some((g) => matchGlob(g, rel));
}

/** Whether a subdirectory entry should be pruned (test-infra/non-source). */
function isPrunableDir(
  repoRoot: string,
  name: string,
  full: string,
  isStart: boolean,
): boolean {
  if (!isStart && PRUNED_DIR_BASE_NAMES.has(name)) return true;
  return isExcludedDir(repoRoot, full, false);
}
/** Walk a directory tree for production .ts/.tsx files. The START directory
 *  is never pruned (so --root scripts/__tests__/fixtures evaluates fixtures). */
function walkDir(repoRoot: string, dir: string): string[] {
  const results: string[] = [];
  function walk(d: string, isStart: boolean): void {
    let entries: Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch (err) {
      if (isErrnoException(err, 'ENOENT') || isErrnoException(err, 'ENOTDIR'))
        return;
      throw err;
    }
    for (const entry of entries) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (isPrunableDir(repoRoot, entry.name, full, isStart)) continue;
        walk(full, false);
      } else if (
        !isExcludedFile(repoRoot, full) &&
        entry.isFile() &&
        (extname(entry.name) === '.ts' || extname(entry.name) === '.tsx')
      ) {
        results.push(full);
      }
    }
  }
  walk(resolve(dir), true);
  return results;
}

function productionFilesUnder(repoRoot: string, rootRel: string): string[] {
  const absRoot = join(repoRoot, rootRel);
  if (!existsSync(absRoot)) return [];
  return walkDir(repoRoot, absRoot);
}

// ─── Allow-list ─────────────────────────────────────────────────────────────

const ALLOWLIST_PATH = join(
  REPO_ROOT,
  'dev-docs/agents-neutral-gate-allowlist.md',
);

/** Parse the central allow-list artifact (markdown table rows).
 *  Inline // gate-exempt comments grant NOTHING (OQ-17). */
function parseAllowlist(path: string): AllowlistEntry[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf-8');
  const entries: AllowlistEntry[] = [];
  for (const line of content.split('\n')) {
    const parsed = parseAllowlistLine(line);
    if (parsed !== null) entries.push(parsed);
  }
  return entries;
}

function parseAllowlistLine(line: string): AllowlistEntry | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || trimmed.includes('---')) return null;
  if (trimmed.includes('File') && trimmed.includes('Subkind')) return null;
  const cells = trimmed
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (cells.length < 4) return null;
  return {
    file: cells[0].replace(/`/g, ''),
    subkind: cells[1].replace(/`/g, ''),
    contextPattern: cells[2].replace(/`/g, ''),
    justification: cells.slice(3).join(' | ').trim(),
  };
}

/** AST-context allow-list match: file AND subkind AND context-pattern. */
function matchesAstContext(
  hit: Hit,
  allowlist: readonly AllowlistEntry[],
): boolean {
  return allowlist.some(
    (entry) =>
      fileMatches(hit.file, entry.file) &&
      subkindMatches(hit.subkind, entry.subkind) &&
      contextMatches(hit.contextSnippet, entry.contextPattern),
  );
}
function fileMatches(hitFile: string, entryFile: string): boolean {
  return hitFile.endsWith(entryFile) || entryFile === '*';
}
function subkindMatches(
  hitSubkind: CheckSubkind,
  entrySubkind: string,
): boolean {
  return entrySubkind === hitSubkind || entrySubkind === '*';
}
function contextMatches(snippet: string, pattern: string): boolean {
  return pattern === '' || pattern === '*' || snippet.includes(pattern);
}

// ─── AST helpers ────────────────────────────────────────────────────────────

function getLine(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}
function relRepo(filePath: string): string {
  return relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}
function snippetOf(sf: ts.SourceFile, node: ts.Node): string {
  const start = node.getStart();
  return sf.text
    .slice(start, Math.min(start + 80, node.getEnd()))
    .replace(/\n/g, ' ')
    .trim();
}
function parseFile(filePath: string): ts.SourceFile | null {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  return ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Collect all import declarations from a source file. */
function collectImportDecls(sf: ts.SourceFile): ts.ImportDeclaration[] {
  const decls: ts.ImportDeclaration[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) decls.push(node);
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return decls;
}

/** Collect all imported names (local + property) from an import declaration. */
function collectImportedNames(node: ts.ImportDeclaration): string[] {
  const names: string[] = [];
  const clause = node.importClause;
  if (clause === undefined) return names;
  if (clause.name !== undefined) names.push('default');
  if (clause.namedBindings === undefined) return names;
  if (ts.isNamedImports(clause.namedBindings)) {
    for (const el of clause.namedBindings.elements) {
      names.push(el.name.text);
      const prop = el.propertyName?.text;
      if (prop !== undefined) names.push(prop);
    }
  } else if (ts.isNamespaceImport(clause.namedBindings)) {
    names.push(clause.namedBindings.name.text);
  }
  return names;
}

function isBannedModule(specifier: string): boolean {
  return BANNED_MODULE_PATTERNS.some((p) => specifier.includes(p));
}

// ─── Input resolution (Critical 2 — resolveInputFiles) ──────────────────────

interface ParsedArgs {
  readonly count: boolean;
  readonly byFile: boolean;
  readonly enforceImports: boolean;
  readonly explain: boolean;
  readonly files: string[];
  readonly root: string | null;
  readonly positional: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const files: string[] = [];
  const positional: string[] = [];
  let root: string | null = null;
  let count = false;
  let byFile = false;
  let enforceImports = false;
  let explain = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--count') count = true;
    else if (arg === '--by-file') byFile = true;
    else if (arg === '--enforce-imports') enforceImports = true;
    else if (arg === '--explain') explain = true;
    else if (arg === '--files') {
      i++;
      while (i < argv.length && !argv[i].startsWith('-')) {
        files.push(argv[i]);
        i++;
      }
      i--;
    } else if (arg === '--root') {
      i++;
      if (i < argv.length && !argv[i].startsWith('-')) root = argv[i];
    } else if (!arg.startsWith('-')) positional.push(arg);
    i++;
  }
  return { count, byFile, enforceImports, explain, files, root, positional };
}

/** resolveInputFiles (pseudocode lines 9-9e): --files/positional OVERRIDE
 *  the default scan; --root overrides the scan root; default = DEFAULT_SCAN_ROOT. */
function resolveInputFiles(args: ParsedArgs): string[] {
  const explicit = [...args.files, ...args.positional];
  if (explicit.length > 0) {
    const seen = new Set<string>();
    const resolved: string[] = [];
    for (const p of explicit) {
      const abs = resolve(REPO_ROOT, p);
      if (existsSync(abs) && !seen.has(abs)) {
        seen.add(abs);
        resolved.push(abs);
      }
    }
    return resolved;
  }
  return productionFilesUnder(REPO_ROOT, args.root ?? DEFAULT_SCAN_ROOT);
}

// ─── Cheap #2424 vector checks (checkA/B/C/E — REAL fail-mode) ──────────────

/** checkA_rawGenaiImports: flag `import ... from '@google/genai'`. */
function checkA_rawGenaiImports(sf: ts.SourceFile, filePath: string): Hit[] {
  const rel = relRepo(filePath);
  const hits: Hit[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const spec = node.moduleSpecifier;
      if (ts.isStringLiteral(spec) && spec.text === '@google/genai') {
        hits.push({
          file: rel,
          line: getLine(sf, node.getStart()),
          subkind: 'A-raw-genai-import',
          contextSnippet: snippetOf(sf, node),
          reason: 'raw import from @google/genai (#2424 vector)',
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return hits;
}

/** Shared import scanner for checkB/checkC: walks banned-module imports and
 *  applies a predicate to each imported name. */
function scanBannedImports(
  sf: ts.SourceFile,
  filePath: string,
  subkind: CheckSubkind,
  predicate: (name: string, specifier: string) => string | null,
): Hit[] {
  const rel = relRepo(filePath);
  const hits: Hit[] = [];
  for (const decl of collectImportDecls(sf)) {
    const specNode = decl.moduleSpecifier;
    if (!ts.isStringLiteral(specNode) || !isBannedModule(specNode.text))
      continue;
    for (const name of collectImportedNames(decl)) {
      const reason = predicate(name, specNode.text);
      if (reason !== null) {
        hits.push({
          file: rel,
          line: getLine(sf, decl.getStart()),
          subkind,
          contextSnippet: snippetOf(sf, decl),
          reason,
        });
      }
    }
  }
  return hits;
}

/** Predicate for checkB: banned symbol from banned module. */
function isBannedSymbolPred(name: string, specifier: string): string | null {
  if (!BANNED_SYMBOLS.has(name)) return null;
  return `banned symbol '${name}' from banned module '${specifier}'`;
}

/** checkB_bannedSymbols: flag banned Google symbols ONLY from banned modules
 *  (provenance, NOT bare name — Major 4). */
function checkB_bannedSymbols(sf: ts.SourceFile, filePath: string): Hit[] {
  return scanBannedImports(sf, filePath, 'B-banned-symbol', isBannedSymbolPred);
}

/** Predicate for checkC: Contract* alias from banned module. */
function isContractAliasPred(name: string, specifier: string): string | null {
  if (!CONTRACT_PREFIX_TYPES.includes(name)) return null;
  return `Contract* alias '${name}' from '${specifier}'`;
}

/** checkC_contractAliases: flag Contract* payload aliases (#2424 vector). */
function checkC_contractAliases(sf: ts.SourceFile, filePath: string): Hit[] {
  return scanBannedImports(
    sf,
    filePath,
    'C-contract-alias',
    isContractAliasPred,
  );
}

/** checkE_enumRedeclarations: flag local enum/const FinishReason/Type. */
function checkE_enumRedeclarations(sf: ts.SourceFile, filePath: string): Hit[] {
  const rel = relRepo(filePath);
  const hits: Hit[] = [];
  function visit(node: ts.Node): void {
    if (ts.isEnumDeclaration(node) && GOOGLE_ENUM_NAMES.has(node.name.text)) {
      hits.push({
        file: rel,
        line: getLine(sf, node.getStart()),
        subkind: 'E-enum-redeclaration',
        contextSnippet: snippetOf(sf, node),
        reason: `local enum '${node.name.text}' re-declares a Google enum`,
      });
    }
    if (ts.isVariableStatement(node)) {
      const isConst = (node.modifiers ?? []).some(
        (m) => m.kind === ts.SyntaxKind.ConstKeyword,
      );
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          GOOGLE_ENUM_NAMES.has(decl.name.text)
        ) {
          hits.push({
            file: rel,
            line: getLine(sf, node.getStart()),
            subkind: 'E-enum-redeclaration',
            contextSnippet: snippetOf(sf, node),
            reason: `local ${isConst ? 'const' : 'variable'} '${decl.name.text}' shadows a Google enum`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return hits;
}

// ─── checkF structural matchers (F1/F3/F5 — count mode) ────────────────────

function isDomainCandidateType(text: string): boolean {
  const normalized = text
    .trim()
    .replace(/[,;)]$/, '')
    .trim();
  return DOMAIN_CANDIDATE_SUFFIXES.some((suffix) =>
    normalized.endsWith(suffix),
  );
}

/** F1: `candidates: [{ content: { role?, parts? } }]` — structural Gemini envelope. */
function checkF1_candidatesContent(sf: ts.SourceFile, rel: string): Hit[] {
  const hits: Hit[] = [];
  function visit(node: ts.Node): void {
    if (isCandidatesContentAssignment(node)) {
      hits.push({
        file: rel,
        line: getLine(sf, node.getStart()),
        subkind: 'F1-candidates-content',
        contextSnippet: snippetOf(sf, node),
        reason: 'structural {candidates:[{content:{role?,parts?}}]} envelope',
      });
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return filterDomainCandidates(sf, hits);
}

/** Whether node is a `candidates: [{ content: ... }]` property assignment. */
function isCandidatesContentAssignment(node: ts.Node): boolean {
  if (!ts.isPropertyAssignment(node) || !ts.isIdentifier(node.name))
    return false;
  if (node.name.text !== 'candidates') return false;
  if (!ts.isArrayLiteralExpression(node.initializer)) return false;
  if (node.initializer.elements.length === 0) return false;
  const first = node.initializer.elements[0];
  if (!ts.isObjectLiteralExpression(first)) return false;
  return first.properties.some(
    (p) =>
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === 'content',
  );
}

/** F3: `{ role: 'user'|'model', parts: ... }` — structural Gemini envelope. */
function checkF3_roleParts(sf: ts.SourceFile, rel: string): Hit[] {
  const hits: Hit[] = [];
  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      let roleNode: ts.PropertyAssignment | null = null;
      let hasParts = false;
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name))
          continue;
        if (
          prop.name.text === 'role' &&
          ts.isStringLiteral(prop.initializer) &&
          (prop.initializer.text === 'user' ||
            prop.initializer.text === 'model')
        ) {
          roleNode = prop;
        }
        if (prop.name.text === 'parts') hasParts = true;
      }
      if (roleNode !== null && hasParts) {
        hits.push({
          file: rel,
          line: getLine(sf, roleNode.getStart()),
          subkind: 'F3-role-parts',
          contextSnippet: snippetOf(sf, node),
          reason: "structural {role:'user'|'model', parts} envelope",
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return hits;
}

/** F5: spread + parts mutation on non-neutral value. */
function checkF5_partsAccess(sf: ts.SourceFile, rel: string): Hit[] {
  const hits: Hit[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isSpreadAssignment(node) &&
      ts.isObjectLiteralExpression(node.parent) &&
      node.parent.properties.some(
        (p) =>
          ts.isPropertyAssignment(p) &&
          ts.isIdentifier(p.name) &&
          p.name.text === 'parts',
      )
    ) {
      hits.push({
        file: rel,
        line: getLine(sf, node.getStart()),
        subkind: 'F5-parts-access',
        contextSnippet: snippetOf(sf, node),
        reason: 'spread assignment with sibling parts property',
      });
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return hits;
}

/** EXCLUDE guard: remove hits on the specific line whose text contains a
 *  domain *Candidate[] type annotation (false-positive guard). Only the
 *  hit's own line is checked to avoid false-negatives from unrelated
 *  Candidate[] references on adjacent lines. */
function filterDomainCandidates(sf: ts.SourceFile, hits: Hit[]): Hit[] {
  const lines = sf.text.split('\n');
  return hits.filter((hit) => {
    const lineText = lines[hit.line - 1] ?? '';
    return !isDomainCandidateType(lineText);
  });
}

/** checkF_structuralEnvelopes (pseudocode lines 26-35): F1/F3/F5 + EXCLUDE. */
function checkF_structuralEnvelopes(
  sf: ts.SourceFile,
  filePath: string,
): Hit[] {
  const rel = relRepo(filePath);
  return [
    ...checkF1_candidatesContent(sf, rel),
    ...checkF3_roleParts(sf, rel),
    ...checkF5_partsAccess(sf, rel),
  ];
}

/** Extract the callee name from a call-expression's expression node. */
function calleeName(expr: ts.Expression): string {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return '';
}

/** checkG_converterCalls: `toGeminiContent(s)(` call matcher. */
function checkG_converterCalls(sf: ts.SourceFile, filePath: string): Hit[] {
  const rel = relRepo(filePath);
  const hits: Hit[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node.expression);
      if (callee === 'toGeminiContent' || callee === 'toGeminiContents') {
        hits.push({
          file: rel,
          line: getLine(sf, node.getStart()),
          subkind: 'G-call-toGeminiContent',
          contextSnippet: snippetOf(sf, node),
          reason: `toGeminiContent(s) converter call (${callee})`,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);
  return hits;
}

// ─── Deferred EXPENSIVE checks (stubs — full fail-mode implemented at P31) ─

/** checkD round-trip symbols — full fail-mode implemented at P31. */
export function checkD_roundtripSymbols(
  _sf: ts.SourceFile,
  _filePath: string,
): Hit[] {
  return [];
}
/** checkG-barrel GeminiContent* barrel imports — full fail-mode at P31. */
export function checkG_barrelImports(
  _sf: ts.SourceFile,
  _filePath: string,
): Hit[] {
  return [];
}
/** checkH usage keys — full fail-mode implemented at P31. */
export function checkH_usageKeys(_sf: ts.SourceFile, _filePath: string): Hit[] {
  return [];
}

// ─── Hit collection ─────────────────────────────────────────────────────────

/** Collect structural hits (checkF + checkG-call) for --count/--by-file.
 *  Deferred checks invoked as no-ops to keep signatures live for P31. */
function collectStructuralHits(files: readonly string[]): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const sf = parseFile(file);
    if (sf === null) continue;
    hits.push(...checkF_structuralEnvelopes(sf, file));
    hits.push(...checkG_converterCalls(sf, file));
    // checkD_roundtripSymbols / checkG_barrelImports / checkH_usageKeys
    // join the metric at P31 via the documented re-baseline step.
  }
  return hits;
}

/** Collect import/alias/enum hits (checkA/B/C/E) for --enforce-imports. */
function collectImportHits(files: readonly string[]): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const sf = parseFile(file);
    if (sf === null) continue;
    hits.push(...checkA_rawGenaiImports(sf, file));
    hits.push(...checkB_bannedSymbols(sf, file));
    hits.push(...checkC_contractAliases(sf, file));
    hits.push(...checkE_enumRedeclarations(sf, file));
  }
  return hits;
}

// ─── CLI modes ──────────────────────────────────────────────────────────────

function compareByFileThenLine(a: Hit, b: Hit): number {
  if (a.file < b.file) return -1;
  if (a.file > b.file) return 1;
  return a.line - b.line;
}

/** runCount (lines 40-44): print ONLY the integer non-exempt total. Exit 0. */
function runCount(args: ParsedArgs): number {
  const allowlist = parseAllowlist(ALLOWLIST_PATH);
  const hits = collectStructuralHits(resolveInputFiles(args));
  const unexempted = hits.filter((h) => !matchesAstContext(h, allowlist));
  console.log(unexempted.length);
  return 0;
}

/** runByFile (lines 45-48): per-site identity lines. Shares runCount detection. */
function runByFile(args: ParsedArgs): number {
  const allowlist = parseAllowlist(ALLOWLIST_PATH);
  const hits = collectStructuralHits(resolveInputFiles(args));
  const unexempted = hits
    .filter((h) => !matchesAstContext(h, allowlist))
    .sort(compareByFileThenLine);
  for (const h of unexempted) {
    console.log(`${h.file}:${h.line}:${h.subkind}  ${h.contextSnippet}`);
  }
  return 0;
}

/** runEnforceImports (lines 25a-25h): checkA/B/C/E fail-mode. GREEN/RED. */
function runEnforceImports(args: ParsedArgs): number {
  const allowlist = parseAllowlist(ALLOWLIST_PATH);
  const hits = collectImportHits(resolveInputFiles(args));
  const unexempted = hits.filter((h) => !matchesAstContext(h, allowlist));
  if (unexempted.length === 0) return 0;
  for (const h of unexempted.sort(compareByFileThenLine)) {
    console.error(`${h.file}:${h.line}:${h.subkind} — ${h.reason}`);
    console.error(`    ${h.contextSnippet}`);
  }
  return 1;
}

/** runExplain: structural hits with reasons for auditability. */
function runExplain(args: ParsedArgs): number {
  const allowlist = parseAllowlist(ALLOWLIST_PATH);
  const hits = collectStructuralHits(resolveInputFiles(args));
  const unexempted = hits
    .filter((h) => !matchesAstContext(h, allowlist))
    .sort(compareByFileThenLine);
  for (const h of unexempted) {
    console.log(`${h.file}:${h.line}:${h.subkind} — ${h.reason}`);
    console.log(`    ${h.contextSnippet}`);
  }
  console.log(`total: ${unexempted.length}`);
  return 0;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.enforceImports) process.exit(runEnforceImports(args));
  if (args.byFile) process.exit(runByFile(args));
  if (args.explain) process.exit(runExplain(args));
  process.exit(runCount(args));
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
