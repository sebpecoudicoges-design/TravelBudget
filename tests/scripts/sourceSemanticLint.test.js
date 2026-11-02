import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSourceSemantics } from '../../scripts/check-source-semantics.mjs';

const roots=[];
afterEach(()=>roots.splice(0).forEach(root=>fs.rmSync(root,{recursive:true,force:true})));
function fixture(sources){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tb-source-lint-'));roots.push(root);
 for(const [name,source] of Object.entries(sources)){const file=path.join(root,'src',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);}
 return root;
}
it('rejects startup and UI typos, dead code and unsafe finally, including nested modules',()=>{
 const result=checkSourceSemantics(fixture({'app/nested/loader.js':'export async function save() { try { return await unknownClient.save(); } finally { return true; } }',
 'main.js':'export function read() { return []; throw new Error(); }','ui/unused.js':'const obsolete=1; export const rows=[];'}));
 expect(result.ok).toBe(false);
 expect(JSON.parse(result.output).diagnostics.map(d=>d.code)).toEqual(expect.arrayContaining(['no-undef','no-unsafe-finally','no-unreachable','no-unused-vars']));
});
it('accepts browser DOM access without executing code or resolving imports',()=>{
 const result=checkSourceSemantics(fixture({'adapter.js':"import { read } from 'https://example.invalid/never-fetch.js'; export const load=()=>typeof window==='undefined'?null:read(globalThis.document.body); throw new Error('never execute');"}));
 expect(result.ok,result.output).toBe(true);
});
it('fails closed for absent and empty source directories',()=>{
 const root=fixture({});expect(()=>checkSourceSemantics(root)).toThrow();fs.mkdirSync(path.join(root,'src'),{recursive:true});expect(()=>checkSourceSemantics(root)).toThrow('No JavaScript sources');
});
it('covers all modern sources and stays mandatory in quality',()=>{
 const result=checkSourceSemantics();expect(result.ok,result.output).toBe(true);
 expect(result.files.map(f=>path.relative('src',f)).sort()).toEqual(fs.readdirSync('src',{recursive:true}).filter(f=>f.endsWith('.js')).sort());
 const scripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;
 expect(scripts.quality.split(' && ')).toContain('npm run lint:src');
 expect(scripts['lint:src']).toBe('node scripts/check-source-semantics.mjs');
 const core=JSON.parse(fs.readFileSync('config/deno-core-lint.json','utf8')).lint.rules.include;
 const data=JSON.parse(fs.readFileSync('config/deno-data-lint.json','utf8')).lint.rules.include;
 expect(data).toEqual(core.filter(rule=>rule!=='no-window'));
});
