#!/usr/bin/env node
/* Lint: forbid raw DB identifiers in UI code.
   Scope:
   - src/**
   - public/legacy/js/**
   - index.html
   Rules:
   - No .from("table") or .rpc("fn") string literals outside constants.
   - No hard-coded /rest/v1/<table> endpoints.
*/
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const TARGETS = [
  path.join(ROOT, "src"),
  path.join(ROOT, "public", "legacy", "js"),
  path.join(ROOT, "index.html"),
];

const ALLOW_FILES = new Set([
  path.join(ROOT, "public", "legacy", "js", "00_constants.js"),
]);

const PATTERNS = [
  { re: /\.from\(\s*["']([^"']+)["']\s*\)/g, label: ".from(\"...\")" },
  { re: /\.rpc\(\s*["']([^"']+)["']\s*\)/g, label: ".rpc(\"...\")" },
  { re: /\/rest\/v1\/([a-zA-Z0-9_]+)/g, label: "/rest/v1/<...>" },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const stat = fs.statSync(dir);
  if (stat.isFile()) return out.concat([dir]);
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && /\.(js|ts|jsx|tsx|html)$/.test(p)) out.push(p);
  }
  return out;
}

function posToLineCol(text, idx) {
  const pre = text.slice(0, idx);
  const lines = pre.split("\n");
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

let failures = [];

for (const t of TARGETS) {
  for (const file of walk(t)) {
    if (ALLOW_FILES.has(file)) continue;
    const txt = fs.readFileSync(file, "utf8");
    for (const pat of PATTERNS) {
      let m;
      while ((m = pat.re.exec(txt))) {
        const hit = m[0];
        const { line, col } = posToLineCol(txt, m.index);
        failures.push({
          file: path.relative(ROOT, file),
          pattern: pat.label,
          match: hit,
          line,
          col,
        });
      }
    }
  }
}

if (failures.length) {
  console.error("DB identifier lint failed. Use TB_CONST.TABLES / TB_CONST.COLS and avoid hardcoded REST paths.");
  for (const f of failures.slice(0, 50)) {
    console.error(`- ${f.file}:${f.line}:${f.col}  ${f.pattern}  ${f.match}`);
  }
  if (failures.length > 50) console.error(`... and ${failures.length - 50} more`);
  process.exit(1);
}

console.log("DB identifier lint OK");
