import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const libraries = JSON.parse(fs.readFileSync('config/vendor-libraries.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const output = path.join(root, 'public/vendor');
fs.mkdirSync(output, { recursive: true });
const previousPath = path.join(output, 'manifest.json');
const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, 'utf8')) : {};
const manifest = {};
for (const [name, library] of Object.entries(libraries)) {
  const folder = path.join(root, 'node_modules', library.package);
  const installed = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
  if (installed.version !== library.version || pkg.dependencies[library.package] !== library.version) {
    throw new Error(`Vendor version mismatch: ${name}`);
  }
  const source = fs.readFileSync(path.join(folder, library.source));
  fs.writeFileSync(path.join(output, library.file), source);
  fs.copyFileSync(path.join(folder, library.license), path.join(output, `${library.file}.LICENSE.txt`));
  if (fs.existsSync(path.join(folder, 'NOTICE'))) fs.copyFileSync(path.join(folder, 'NOTICE'), path.join(output, `${library.file}.NOTICE.txt`));
  manifest[name] = { file: library.file, version: library.version, bytes: source.length, sha256: crypto.createHash('sha256').update(source).digest('hex') };
}
// Remove only previously generated files that this manifest no longer uses.
for (const { file } of Object.values(previous)) {
  if (Object.values(manifest).some(entry => entry.file === file)) continue;
  if (path.basename(file) !== file) throw new Error('Invalid previous vendor filename');
  for (const name of [file, `${file}.LICENSE.txt`, `${file}.NOTICE.txt`]) {
    const obsolete = path.resolve(output, name);
    if (path.dirname(obsolete) !== output) throw new Error('Vendor cleanup outside output directory');
    if (fs.existsSync(obsolete)) fs.unlinkSync(obsolete);
  }
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Local vendors prepared from locked npm packages.');
