import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFeatureSemantics } from '../../scripts/check-feature-semantics.mjs';

const roots=[];
afterEach(()=>roots.splice(0).forEach(root=>fs.rmSync(root,{recursive:true,force:true})));
function fixture(sources){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tb-feature-lint-'));roots.push(root);
 for(const [name,source] of Object.entries(sources)){const file=path.join(root,'src/features',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);}
 return root;
}
it('rejects feature typos, dead code and unsafe finally, including nested modules',()=>{
 const result=checkFeatureSemantics(fixture({'nested/repository.js':'export async function save() { try { return await unknownClient.save(); } finally { return true; } }',
 'dead.js':'export function read() { return []; throw new Error(); }','unused.js':'const obsolete=1; export const rows=[];'}));
 expect(result.ok).toBe(false);
 expect(JSON.parse(result.output).diagnostics.map(d=>d.code)).toEqual(expect.arrayContaining(['no-undef','no-unsafe-finally','no-unreachable','no-unused-vars']));
});
it('accepts browser DOM access without executing code or resolving imports',()=>{
 const result=checkFeatureSemantics(fixture({'adapter.js':"import { read } from 'https://example.invalid/never-fetch.js'; export const load=()=>typeof window==='undefined'?null:read(globalThis.document.body); throw new Error('never execute');"}));
 expect(result.ok,result.output).toBe(true);
});
it('fails closed for absent and empty source directories',()=>{
 const root=fixture({});expect(()=>checkFeatureSemantics(root)).toThrow();fs.mkdirSync(path.join(root,'src/features'),{recursive:true});expect(()=>checkFeatureSemantics(root)).toThrow('No JavaScript sources');
});
it('covers all feature modules and stays mandatory in quality',()=>{
 const result=checkFeatureSemantics();expect(result.ok,result.output).toBe(true);
 expect(result.files.map(f=>path.relative('src/features',f)).sort()).toEqual(fs.readdirSync('src/features',{recursive:true}).filter(f=>f.endsWith('.js')).sort());
 const scripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;
 expect(scripts.quality.split(' && ')).toContain('npm run lint:features');
 expect(scripts['lint:features']).toBe('node scripts/check-feature-semantics.mjs');
 const core=JSON.parse(fs.readFileSync('config/deno-core-lint.json','utf8')).lint.rules.include;
 const data=JSON.parse(fs.readFileSync('config/deno-data-lint.json','utf8')).lint.rules.include;
 expect(data).toEqual(core.filter(rule=>rule!=='no-window'));
});
