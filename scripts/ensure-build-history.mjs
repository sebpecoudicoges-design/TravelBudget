import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// docs:check validates historical commit references; never silently skip them.
export function ensureBuildHistory(cwd = process.cwd()) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git(['rev-parse', '--is-shallow-repository']) === 'false') return false;
  git(['fetch', '--unshallow', '--no-tags', 'origin']);
  if (git(['rev-parse', '--is-shallow-repository']) !== 'false') {
    throw new Error('Build history is still shallow; documentation validation cannot proceed.');
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(ensureBuildHistory() ? 'Build history restored.' : 'Build history already complete.');
  } catch (error) {
    console.error(`Build history failed: ${error.message}`);
    process.exitCode = 1;
  }
}
