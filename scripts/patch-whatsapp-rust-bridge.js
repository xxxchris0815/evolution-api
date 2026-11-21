#!/usr/bin/env node
/**
 * Baileys >= 7.0.0-rc10 depends on whatsapp-rust-bridge, which only declares
 * ESM `exports.import`. Evolution API is CommonJS + tsx, so Node resolves via
 * the CJS loader and fails with ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * This postinstall patch adds main/require/default without changing runtime
 * behavior (tsx still transforms the ESM module).
 */
const fs = require('node:fs');
const path = require('node:path');

const packagePath = path.join(
  process.cwd(),
  'node_modules',
  'whatsapp-rust-bridge',
  'package.json',
);

// Safe no-op when dependency is not installed yet (e.g. partial Docker COPY layers)
if (!fs.existsSync(packagePath)) {
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const entry = './dist/index.js';
const types = './dist/index.d.ts';

pkg.main = entry;
pkg.exports = {
  '.': {
    types,
    import: entry,
    require: entry,
    default: entry,
  },
};

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 4)}\n`);
console.log('[patch-whatsapp-rust-bridge] patched exports for CommonJS/tsx');
