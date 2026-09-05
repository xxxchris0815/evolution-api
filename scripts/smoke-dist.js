#!/usr/bin/env node
/**
 * Smoke-test the production dist bundle without requiring Postgres/Redis.
 * Validates that dist/main.js loads and starts bootstrap far enough to init modules.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const distMain = path.join(process.cwd(), 'dist', 'main.js');
const translations = path.join(process.cwd(), 'dist', 'translations', 'en.json');

if (!fs.existsSync(distMain)) {
  console.error(`[smoke-dist] missing ${distMain}`);
  process.exit(1);
}

if (!fs.existsSync(translations)) {
  console.error(`[smoke-dist] missing ${translations}`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [distMain],
  {
    env: {
      ...process.env,
      SERVER_NAME: 'evolution',
      SERVER_TYPE: 'http',
      SERVER_PORT: '8099',
      SERVER_URL: 'http://localhost:8099',
      AUTHENTICATION_API_KEY: 'smoke-test-key',
      DATABASE_ENABLED: 'true',
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_CONNECTION_URI: 'postgresql://evolution:secret@127.0.0.1:5432/evolution_db?schema=public',
      DATABASE_CONNECTION_CLIENT_NAME: 'evolution_smoke',
      REDIS_ENABLED: 'false',
      CACHE_REDIS_ENABLED: 'false',
      CACHE_LOCAL_ENABLED: 'true',
      LOG_LEVEL: 'ERROR',
      LANGUAGE: 'en',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let output = '';
const append = (chunk) => {
  output += chunk.toString();
};

child.stdout.on('data', append);
child.stderr.on('data', append);

const timer = setTimeout(() => {
  // Still running after timeout => modules loaded and server likely listening/retrying.
  child.kill('SIGTERM');
  console.log('[smoke-dist] bundle stayed alive (OK)');
  console.log('[smoke-dist] passed');
  process.exit(0);
}, 4000);

child.on('exit', (code, signal) => {
  clearTimeout(timer);

  const text = output;
  const dbUnreachable =
    text.includes("Can't reach database server") || text.includes('P1001') || text.includes('PrismaClientInitializationError');

  if (dbUnreachable) {
    console.log('[smoke-dist] bundle load OK (prisma unreachable as expected without DB)');
    console.log('[smoke-dist] passed');
    process.exit(0);
  }

  if (signal === 'SIGTERM') {
    console.log('[smoke-dist] bundle load OK');
    console.log('[smoke-dist] passed');
    process.exit(0);
  }

  console.error('[smoke-dist] unexpected exit', { code, signal });
  console.error(text.slice(-4000));
  process.exit(code || 1);
});
