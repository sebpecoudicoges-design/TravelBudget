import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDataSemantics } from '../../scripts/check-data-semantics.mjs';

const roots=[];
afterEach(()=>roots.splice(0).forEach(root=>fs.rmSync(root,{recursive:true,force:true})));
function fixture(sources){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tb-data-lint-'));roots.push(root);
 for(const [name,source] of Object.entries(sources)){const file=path.join(root,'src/data',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);}
 return root;
}
it('rejects repository typos, dead code and unsafe finally, including nested modules',()=>{
 const result=checkDataSemantics(fixture({'nested/repository.js':'export async function save() { try { return await unknownClient.save(); } finally { return true; } }',
 'dead.js':'export function read() { return []; throw new Error(); }','unused.js':'const obsolete=1; export const rows=[];'}));
 expect(result.ok).toBe(false);
 expect(JSON.parse(result.output).diagnostics.map(d=>d.code)).toEqual(expect.arrayContaining(['no-undef','no-unsafe-finally','no-unreachable','no-unused-vars']));
});
it('accepts browser storage adapters without executing code or resolving imports',()=>{
 const result=checkDataSemantics(fixture({'adapter.js':"import { read } from 'https://example.invalid/never-fetch.js'; export const load=()=>typeof window==='undefined'?null:read(window.localStorage); throw new Error('never execute');"}));
 expect(result.ok,result.output).toBe(true);
});
it('fails closed for absent and empty source directories',()=>{
 const root=fixture({});expect(()=>checkDataSemantics(root)).toThrow();fs.mkdirSync(path.join(root,'src/data'),{recursive:true});expect(()=>checkDataSemantics(root)).toThrow('No JavaScript sources');
});
it('covers all repositories and stays mandatory in quality',()=>{
 const result=checkDataSemantics();expect(result.ok,result.output).toBe(true);
 expect(result.files.map(f=>path.relative('src/data',f)).sort()).toEqual(fs.readdirSync('src/data',{recursive:true}).filter(f=>f.endsWith('.js')).sort());
 const scripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;
 expect(scripts.quality.split(' && ')).toContain('npm run lint:data');
 expect(scripts['lint:data']).toBe('node scripts/check-data-semantics.mjs');
 const core=JSON.parse(fs.readFileSync('config/deno-core-lint.json','utf8')).lint.rules.include;
 const data=JSON.parse(fs.readFileSync('config/deno-data-lint.json','utf8')).lint.rules.include;
 expect(data).toEqual(core.filter(rule=>rule!=='no-window'));
});
