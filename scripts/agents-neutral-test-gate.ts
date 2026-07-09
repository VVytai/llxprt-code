#!/usr/bin/env node
/**
 * Agents neutral test gate — bans @google/genai imports in agents test files.
 *
 * The ONLY exception is the named characterization allow-list
 * (dev-docs/agents-neutral-gate-allowlist.md), which must use LOCAL
 * structural fixtures (zero @google/genai import).
 *
 * @plan PLAN-20260707-AGENTNEUTRAL.P29
 * @requirement REQ-012.3
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const AGENTS_SRC = join(ROOT, 'packages', 'agents', 'src');

/** Recursively find all test/spec files under a directory. */
function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (
      /\.(test|spec)\.(ts|js)$/.test(entry) ||
      /test-helpers\.(ts|js)$/.test(entry) ||
      entry.includes('__tests__')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

const GENAI_IMPORT_PATTERN =
  /(?:import\s[^;]*from\s+['"]@google\/genai['"])|(?:require\s*\(\s*['"]@google\/genai['"]\s*\))/;

const files = findTestFiles(AGENTS_SRC);
const offenders: string[] = [];

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  if (GENAI_IMPORT_PATTERN.test(content)) {
    offenders.push(relative(ROOT, file));
  }
}

if (offenders.length > 0) {
  console.error(
    `FAIL: agents test files still import @google/genai (${offenders.length}):`,
  );
  for (const f of offenders) {
    console.error(`  ${f}`);
  }
  console.error(
    '\nAll agents test files must use LOCAL structural fixtures (zero @google/genai import).',
  );
  console.error(
    'See dev-docs/agents-neutral-gate-allowlist.md for the characterization allow-list.',
  );
  process.exit(1);
}

console.log(
  `OK: zero @google/genai imports in ${files.length} agents test files`,
);
