import { spawn } from 'node:child_process';
import path from 'node:path';

const bin = process.execPath;
const playwrightCli = path.join(process.cwd(), 'node_modules', 'playwright', 'cli.js');
const args = [playwrightCli, 'test', ...process.argv.slice(2)];

const child = spawn(bin, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '.ms-playwright',
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
