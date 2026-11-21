import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function collectTests(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTests(fullPath, acc);
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const files = collectTests(join(process.cwd(), 'test')).filter((file) => !file.endsWith('all.test.ts'));

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
