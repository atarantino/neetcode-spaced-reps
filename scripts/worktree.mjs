import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root } from './lib/dev-server.mjs';
const [branch, destination] = process.argv.slice(2);
if (!branch || !destination || branch.startsWith('-')) throw new Error('Usage: npm run worktree -- branch ../directory');
const target = path.resolve(root, destination);
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run('git', ['worktree', 'add', '-b', branch, target], root);
run('npm', ['ci'], target);
run('npm', ['run', 'setup'], target);
console.log(`Ready: ${target}\nRun npm run dev there. Stop with Ctrl-C; remove later with git worktree remove.\nOnly committed files are included in a new worktree.`);
