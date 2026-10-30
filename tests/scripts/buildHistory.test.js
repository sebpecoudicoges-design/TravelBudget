import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { ensureBuildHistory } from '../../scripts/ensure-build-history.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-history-'));
  roots.push(root);
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(source, ['init']);
  git(source, ['config', 'user.name', 'Fixture']);
  git(source, ['config', 'user.email', 'fixture@example.invalid']);
  git(source, ['commit', '--allow-empty', '-m', 'old']);
  const old = git(source, ['rev-parse', 'HEAD']);
  git(source, ['commit', '--allow-empty', '-m', 'new']);
  const clone = path.join(root, 'clone');
  git(root, ['clone', '--depth=1', pathToFileURL(source).href, clone]);
  return { source, clone, git, old };
}

it('restores historical commits without changing HEAD or local files', () => {
  const { clone, git, old } = fixture();
  const head = git(clone, ['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(clone, 'local.txt'), 'keep');
  expect(() => git(clone, ['cat-file', '-e', old])).toThrow();
  expect(ensureBuildHistory(clone)).toBe(true);
  expect(git(clone, ['cat-file', '-t', old])).toBe('commit');
  expect(git(clone, ['rev-parse', 'HEAD'])).toBe(head);
  expect(fs.readFileSync(path.join(clone, 'local.txt'), 'utf8')).toBe('keep');
}, 20000);

it('does not need a remote for a complete repository', () => {
  const { source } = fixture();
  expect(ensureBuildHistory(source)).toBe(false);
}, 20000);

it('fails the process when a shallow checkout cannot fetch its history', () => {
  const { clone, git } = fixture();
  git(clone, ['remote', 'remove', 'origin']);
  const result = spawnSync(process.execPath, [path.resolve('scripts/ensure-build-history.mjs')], { cwd: clone, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Build history failed');
}, 20000);

it('requires installation, complete history, dependency audit and quality before Netlify publication', () => {
  const config = fs.readFileSync('netlify.toml', 'utf8');
  const command = config.match(/^\s*command = "([^"]+)"/m)?.[1];
  expect(command).toBe('npm ci && node scripts/ensure-build-history.mjs && npm run audit:dependencies && npm run quality');
  expect(config.match(/^\s*command\s*=/gm)).toHaveLength(1);
  expect(config).toContain('publish = "dist"');
});
