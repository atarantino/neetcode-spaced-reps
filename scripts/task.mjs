import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { root } from './lib/dev-server.mjs';
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const task = process.argv[2];
if (task === 'setup') {
  run('npm', ['ci', '--prefix', 'backend']);
  run('npx', ['playwright', 'install', 'chromium']);
} else if (task === 'doctor') {
  const checks = {
    'Node 24': process.versions.node.split('.')[0] === '24',
    'Backend dependencies': existsSync(new URL('../backend/node_modules/typescript', import.meta.url)),
    'Chromium installed': existsSync(chromium.executablePath()),
  };
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  console.log(`Worktree: ${root}\nSync: ${process.env.INTERVAL_SYNC_URL ? 'explicitly configured' : 'disabled by default'}\nRun npm run setup to install missing dependencies.`);
  if (Object.values(checks).some(ok => !ok)) process.exitCode = 1;
} else if (task === 'verify' || task === 'check') {
  run(process.execPath, ['scripts/check-state-merge.mjs']);
  run(process.execPath, ['scripts/check-key-rotation.mjs']);
  run(process.execPath, ['backend/node_modules/typescript/bin/tsc', '--noEmit', '-p', 'backend/tsconfig.json']);
  if (task === 'verify') run('npx', ['playwright', 'test']);
} else throw new Error(`Unknown task: ${task}`);
