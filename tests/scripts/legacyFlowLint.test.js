import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLegacyFlowSemantics } from '../../scripts/check-legacy-flow-semantics.mjs';

const roots=[];
afterEach(()=>roots.splice(0).forEach(root=>fs.rmSync(root,{recursive:true,force:true})));
function fixture(code) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tb-legacy-flow-')); roots.push(root);
  const dir=path.join(root,'public/legacy/js/nested'); fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'flow.js'),code); return root;
}
it('rejects a finally return and unreachable code in nested legacy scripts',()=>{
  const result=checkLegacyFlowSemantics(fixture('function refresh(){try{return run();}finally{return queued();}} function dead(){return; run();}'));
  expect(result.ok).toBe(false);
  expect(JSON.parse(result.output).diagnostics.map(d=>d.code)).toEqual(expect.arrayContaining(['no-unsafe-finally','no-unreachable']));
});
it('accepts shared classic-script globals without running the script',()=>{
  const result=checkLegacyFlowSemantics(fixture('function render(){ return renderAll(state); } throw new Error("never run");'));
  expect(result.ok,result.output).toBe(true);
});
it('covers all legacy scripts and is required in quality',()=>{
  const result=checkLegacyFlowSemantics(); expect(result.ok,result.output).toBe(true);
  expect(result.files.map(file=>path.relative('public/legacy/js',file)).sort()).toEqual(fs.readdirSync('public/legacy/js',{recursive:true}).filter(file=>file.endsWith('.js')).sort());
  const scripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;
  expect(scripts.quality.split(' && ')).toContain('npm run lint:legacy-flow');
  expect(scripts['lint:legacy-flow']).toBe('node scripts/check-legacy-flow-semantics.mjs');
});
