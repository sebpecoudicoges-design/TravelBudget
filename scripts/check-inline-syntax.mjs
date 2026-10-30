import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const JS_TYPES = new Set(['application/ecmascript', 'application/javascript', 'application/x-ecmascript',
  'application/x-javascript', 'text/ecmascript', 'text/javascript', 'text/javascript1.0',
  'text/javascript1.1', 'text/javascript1.2', 'text/javascript1.3', 'text/javascript1.4',
  'text/javascript1.5', 'text/jscript', 'text/livescript', 'text/x-ecmascript', 'text/x-javascript']);

export function collectHtmlFiles(root = process.cwd()) {
  const files = [];
  const walk = (dir, recursive) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && recursive) walk(file, true);
      else if (entry.isFile() && /\.html?$/i.test(entry.name)) files.push(file);
    }
  };
  walk(root, false);
  walk(path.join(root, 'public'), true);
  return files.sort();
}

export function inlineSources(html) {
  const sources = [];
  const visit = node => {
    const attrs = new Map((node.attrs || []).map(attr => [attr.name, attr.value]));
    for (const [name, code] of attrs) {
      if (/^on[a-z]+$/.test(name)) sources.push({ kind: 'handler', name, code,
        line: node.sourceCodeLocation?.attrs?.[name]?.startLine || 1 });
    }
    if (node.tagName === 'script' && !attrs.has('src')) {
      const type = (attrs.get('type') ?? (attrs.get('language') ? `text/${attrs.get('language')}` : '')).trim().toLowerCase();
      if (!type || type === 'module' || JS_TYPES.has(type)) sources.push({
        kind: type === 'module' ? 'module' : 'script', name: 'script',
        code: (node.childNodes || []).map(child => child.value || '').join(''),
        line: node.sourceCodeLocation?.startTag?.endLine || 1,
      });
    }
    for (const child of node.childNodes || []) visit(child);
    if (node.content) visit(node.content); // Templates can be inserted by application code.
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return sources;
}

export function checkInlineSyntax(root = process.cwd()) {
  const files = collectHtmlFiles(root);
  const failures = [];
  let count = 0;
  for (const file of files) for (const source of inlineSources(fs.readFileSync(file, 'utf8'))) {
    count++;
    try {
      // Compile only: no function call, evaluation, import resolution or browser globals.
      if (source.kind === 'handler') vm.compileFunction(source.code, ['event'], { filename: file });
      else if (source.kind === 'script') new vm.Script(source.code, { filename: file });
      else {
        const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
          input: source.code, encoding: 'utf8', timeout: 15000,
        });
        if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Module syntax check failed');
      }
    } catch (error) {
      failures.push({ file: path.relative(root, file), line: source.line, kind: source.name, message: error.message });
    }
  }
  return { files, count, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkInlineSyntax();
  for (const failure of result.failures) console.error(`${failure.file}:${failure.line} (${failure.kind}): ${failure.message}`);
  console.log(`Inline syntax: ${result.count} scripts/handlers in ${result.files.length} HTML files, ${result.failures.length} error(s).`);
  if (result.failures.length) process.exitCode = 1;
}
