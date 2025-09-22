/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'node:module';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

// Try to import esbuild, gracefully handle if not available
let esbuild;
try {
  esbuild = (await import('esbuild')).default;
} catch (error) {
  console.error('Failed to import esbuild:', error);
  process.exit(1);
}

// Plugin to redirect module imports to node:module
const nodeModulePlugin = {
  name: 'node-module-plugin',
  setup(build) {
    build.onResolve({ filter: /^module$/ }, () => ({
      path: 'node:module',
      external: true,
    }));
  },
};

// ESBuild config

esbuild
  .build({
    entryPoints: ['packages/cli/index.ts'],
    bundle: true,
    outfile: 'bundle/llxprt.js',
    platform: 'node',
    format: 'esm',
    plugins: [nodeModulePlugin],
    external: [
      '@lydell/node-pty',
      'node-pty',
      '@lydell/node-pty-darwin-arm64',
      '@lydell/node-pty-darwin-x64',
      '@lydell/node-pty-linux-x64',
      '@lydell/node-pty-win32-arm64',
      '@lydell/node-pty-win32-x64',
      'node:module',
    ],
    alias: {
      'is-in-ci': path.resolve(
        __dirname,
        'packages/cli/src/patches/is-in-ci.ts',
      ),
    },
    define: {
      'process.env.CLI_VERSION': JSON.stringify(pkg.version),
    },
    banner: {
      js: `import * as nodeModule from 'node:module'; const require = nodeModule.createRequire(import.meta.url); globalThis.__filename = require('url').fileURLToPath(import.meta.url); globalThis.__dirname = require('path').dirname(globalThis.__filename);`,
    },
    loader: { '.node': 'file' },
    metafile: true,
    write: true,
  })
  .then(() => {
    // ESBuild completed successfully
    fs.chmodSync('bundle/llxprt.js', 0o755);
  })
  .catch((err) => {
    console.error('ESBuild failed:', err);
    process.exit(1);
  });
