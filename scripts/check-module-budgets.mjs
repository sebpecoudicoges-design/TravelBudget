import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = process.cwd();
const configPath = path.join(root, 'config/module-size-budgets.json');

function bytesToKiB(bytes) {
  return Number((bytes / 1024).toFixed(1));
}

function fileBytes(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return { relativePath, bytes: 0, missing: true };
  return { relativePath, bytes: fs.statSync(fullPath).size, missing: false };
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function measureSourceGroups(config = readConfig()) {
  return config.sourceGroups.map((group) => {
    const files = group.paths.map(fileBytes);
    const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
    return {
      name: group.name,
      maxKiB: group.maxKiB,
      sizeKiB: bytesToKiB(bytes),
      overKiB: bytesToKiB(Math.max(0, bytes - group.maxKiB * 1024)),
      missing: files.filter((file) => file.missing).map((file) => file.relativePath),
      files,
    };
  });
}

function measureDist(config = readConfig()) {
  const assetsDir = path.join(root, 'dist/assets');
  if (!fs.existsSync(assetsDir)) {
    return { available: false, reason: 'dist/assets absent. Lance npm run build avant la mesure dist.' };
  }
  const files = fs.readdirSync(assetsDir).map((name) => {
    const fullPath = path.join(assetsDir, name);
    const buffer = fs.readFileSync(fullPath);
    return {
      name,
      bytes: buffer.length,
      gzipBytes: zlib.gzipSync(buffer).length,
      type: name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : 'other',
    };
  });
  const js = files.filter((file) => file.type === 'js');
  const css = files.filter((file) => file.type === 'css');
  const mainJs = js.slice().sort((a, b) => b.bytes - a.bytes)[0] || null;
  const totalJsBytes = js.reduce((sum, file) => sum + file.bytes, 0);
  const initialJsBytes = mainJs ? mainJs.bytes : 0;
  const lazyJsBytes = Math.max(0, totalJsBytes - initialJsBytes);
  return {
    available: true,
    initialJsKiB: bytesToKiB(initialJsBytes),
    lazyJsKiB: bytesToKiB(lazyJsBytes),
    totalJsKiB: bytesToKiB(totalJsBytes),
    totalCssKiB: bytesToKiB(css.reduce((sum, file) => sum + file.bytes, 0)),
    mainJsGzipKiB: mainJs ? bytesToKiB(mainJs.gzipBytes) : 0,
    budgets: config.dist,
    files,
  };
}

function collectBudgetReport(config = readConfig()) {
  const sourceGroups = measureSourceGroups(config);
  const dist = measureDist(config);
  const failures = [];

  for (const group of sourceGroups) {
    if (group.missing.length) failures.push(`${group.name}: fichier manquant ${group.missing.join(', ')}`);
    if (group.sizeKiB > group.maxKiB) failures.push(`${group.name}: ${group.sizeKiB} KiB > ${group.maxKiB} KiB`);
  }

  if (dist.available) {
    if (dist.initialJsKiB > dist.budgets.initialJsMaxKiB) failures.push(`initial js: ${dist.initialJsKiB} KiB > ${dist.budgets.initialJsMaxKiB} KiB`);
    if (dist.lazyJsKiB > dist.budgets.lazyJsMaxKiB) failures.push(`lazy js: ${dist.lazyJsKiB} KiB > ${dist.budgets.lazyJsMaxKiB} KiB`);
    if (dist.totalJsKiB > dist.budgets.totalJsMaxKiB) failures.push(`dist js: ${dist.totalJsKiB} KiB > ${dist.budgets.totalJsMaxKiB} KiB`);
    if (dist.totalCssKiB > dist.budgets.totalCssMaxKiB) failures.push(`dist css: ${dist.totalCssKiB} KiB > ${dist.budgets.totalCssMaxKiB} KiB`);
    if (dist.mainJsGzipKiB > dist.budgets.mainJsGzipMaxKiB) failures.push(`main js gzip: ${dist.mainJsGzipKiB} KiB > ${dist.budgets.mainJsGzipMaxKiB} KiB`);
  }

  return { sourceGroups, dist, failures };
}

function formatReport(report) {
  const lines = ['Module size budget report', ''];
  lines.push('Source groups:');
  for (const group of report.sourceGroups) {
    const status = group.sizeKiB <= group.maxKiB && !group.missing.length ? 'OK' : 'OVER';
    lines.push(`- ${status} ${group.name}: ${group.sizeKiB} / ${group.maxKiB} KiB`);
    if (group.missing.length) lines.push(`  missing: ${group.missing.join(', ')}`);
  }
  lines.push('');
  if (report.dist.available) {
    lines.push(`Initial JS: ${report.dist.initialJsKiB} / ${report.dist.budgets.initialJsMaxKiB} KiB`);
    lines.push(`Lazy JS: ${report.dist.lazyJsKiB} / ${report.dist.budgets.lazyJsMaxKiB} KiB`);
    lines.push(`Dist JS: ${report.dist.totalJsKiB} / ${report.dist.budgets.totalJsMaxKiB} KiB`);
    lines.push(`Dist CSS: ${report.dist.totalCssKiB} / ${report.dist.budgets.totalCssMaxKiB} KiB`);
    lines.push(`Main JS gzip: ${report.dist.mainJsGzipKiB} / ${report.dist.budgets.mainJsGzipMaxKiB} KiB`);
  } else {
    lines.push(report.dist.reason);
  }
  return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = collectBudgetReport();
  console.log(formatReport(report));
  if (report.failures.length) {
    console.error(`\nBudget failures:\n- ${report.failures.join('\n- ')}`);
    process.exitCode = 1;
  }
}

export { bytesToKiB, collectBudgetReport, formatReport, measureDist, measureSourceGroups };
