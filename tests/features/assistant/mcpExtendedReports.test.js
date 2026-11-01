import {it,expect,vi} from 'vitest';
import {budgetReport,accountingReport,tripReport,reportDates} from '../../../src/features/assistant/mcpExtendedReports.js';
import {createMcpExtensionAccess,createMcpSharingHandler} from '../../../supabase/functions/_shared/mcp-extensions.js';
import {createMcpReadToolDispatcher} from '../../../src/features/assistant/mcpReadTools.js';
const noFx=async()=>({series:{}});
const U='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222',T='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444';
function data(){return {periods:[{id:P,travel_id:T,start_date:'2026-11-01',end_date:'2026-11-03',daily_budget_base:50,base_currency:'AUD'}],travels:[{id:T}],segments:[],transactions:[],assets:[],owners:[],links:[],categories:[],wallets:[{id:'wallet',currency:'AUD',balance:1000,travel_id:T}]};}
function tx(extra={}){return {id:'tx',type:'expense',amount:100,currency:'AUD',date_start:'2026-11-01',date_end:'2026-11-01',budget_date_start:'2026-11-02',budget_date_end:'2026-11-03',pay_now:true,wallet_id:'wallet',travel_id:T,category:'Logement',...extra};}
const args={period_id:P,as_of:'2026-11-01'};
it('excludes skipped recurring expenses and income from accounting recognition',async()=>{
 const input=data();input.transactions=[tx({amount:25}),tx({id:'skipped-expense',amount:800,recurring_instance_status:'skipped'}),tx({id:'skipped-income',type:'income',amount:2000,recurring_instance_status:'skipped'})];
 const report=await accountingReport(input,{travel_id:T,date_from:'2026-11-01',date_to:'2026-11-30',as_of:'2026-11-30',currency:'AUD'},{},null,noFx);
 expect(report).toMatchObject({income:0,charges_excluding_depreciation:25,result:-25});
});
it('does not subtract prepaid future daily budget twice or carry an excess to another day',async()=>{
 const input=data();input.transactions=[tx()];
 let report=await budgetReport(input,args,noFx);
 expect(report).toMatchObject({complete:true,budget:150,allocated_spending:100,remaining_budget:50,projection:{current_wallet_total:900,remaining_cash_budget:50,projected_wallet_total:850}});
 input.transactions=[tx({amount:80,budget_date_end:'2026-11-02'})];
 report=await budgetReport(input,args,noFx);
 expect(report.projection).toMatchObject({current_wallet_total:920,remaining_cash_budget:100,projected_wallet_total:820});
});
it('counts a personal Trip share and asset charge instead of gross advance and linked asset purchase',async()=>{
 const input=data();input.transactions=[tx({id:'gross',amount:200,out_of_budget:true}),tx({id:'share',amount:50,is_internal:true,pay_now:false,trip_expense_id:'expense'}),tx({id:'purchase',amount:1200})];
 input.assets=[{id:'asset',travel_id:T,name:'Matériel',purchase_value:1200,residual_value:0,currency:'AUD',purchase_date:'2026-11-01',depreciation_months:12,budget_day:1}];
 input.links=[{asset_id:'asset',transaction_id:'purchase',relation_type:'purchase',exclude_from_budget:true}];
 const report=await budgetReport(input,args,noFx);
 expect(report.allocated_spending).toBe(150);
 expect(report.categories).toContainEqual({category:'Patrimoine',amount:100});
});
it('refuses to expose partial totals if any required FX rate is missing',async()=>{
 const input=data();input.transactions=[tx({currency:'USD'})];
 const report=await budgetReport(input,args,noFx);
 expect(report.complete).toBe(false);expect(report.allocated_spending).toBeNull();expect(report.categories).toBeNull();expect(report.projection).toBeNull();expect(report.warnings.length).toBeGreaterThan(0);
});
it('uses segment overrides, dated FX and bounded ranges',async()=>{
 const input=data();input.segments=[{id:'s',period_id:P,start_date:'2026-11-02',end_date:'2026-11-03',base_currency:'EUR',daily_budget_base:20,fx_mode:'fixed',eur_base_rate_fixed:2}];
 expect((await budgetReport(input,{...args,currency:'EUR'},async()=>({series:{'AUD:EUR':[{date:'2026-11-01',rate:0.5}]}}))).budget).toBe(65);
 expect(()=>reportDates('2020-01-01','2026-11-01')).toThrow();
});
it('reuses accounting recognition and depreciation without treating an asset purchase as an expense',async()=>{
 const input=data();input.transactions=[tx({id:'income',type:'income',amount:1000,budget_date_start:'2026-11-01',budget_date_end:'2026-11-01',category:'Salaire'}),tx({id:'expense',amount:100,budget_date_start:'2026-11-01',budget_date_end:'2026-11-01'}),tx({id:'purchase',amount:1200})];
 input.assets=[{id:'asset',travel_id:T,name:'Matériel',purchase_value:1200,residual_value:0,currency:'AUD',purchase_date:'2026-11-01',depreciation_months:12}];input.links=[{asset_id:'asset',transaction_id:'purchase',relation_type:'purchase'}];
 const report=await accountingReport(input,{travel_id:T,date_from:'2026-11-01',date_to:'2026-11-30',as_of:'2026-11-30',currency:'AUD'},{},null,noFx);
 expect(report).toMatchObject({income:1000,charges_excluding_depreciation:100,depreciation:100,result:800,settings_synced_at:null});expect(report.warnings.join(' ')).toContain('Local accounting settings');
});
it('keeps Trip currencies separate and ignores cancelled reimbursements',()=>{
 const report=tripReport({id:T},[{id:'me',name:'Moi',is_me:true},{id:'other',name:'Autre'}],[{id:'e',amount:100,currency:'AUD',paid_by_member_id:'me'}],[{expense_id:'e',member_id:'me',share_amount:50},{expense_id:'e',member_id:'other',share_amount:50}],
 [{amount:20,currency:'AUD',from_member_id:'other',to_member_id:'me'},{amount:30,currency:'AUD',from_member_id:'other',to_member_id:'me',cancelled_at:'2026-11-01'}]);
 expect(report.by_currency[0].participants.find(p=>p.isMe).net).toBe(30);
});
it('denies extended tools before any data read without owner opt-in and validates required arguments',async()=>{
 const from=vi.fn();const dispatch=createMcpReadToolDispatcher({userId:U,client:{from},extensionContext:async()=>({finance_enabled:false})});
 await expect(dispatch('get_budget_analysis',{period_id:P})).rejects.toThrow('Enable extended');expect(from).not.toHaveBeenCalled();
 await expect(dispatch('get_accounting_report',{travel_id:T})).rejects.toThrow('Missing');
});
it('reads only a selected owner file, rechecks selection after download and returns content not storage credentials',async()=>{
 const doc={id:D,user_id:U,storage_bucket:'personal-documents',storage_path:U+'/'+D+'/note.txt',mime_type:'text/plain',size_bytes:5,name:'Note'};
 const rpc=vi.fn(async()=>({data:doc}));const download=vi.fn(async()=>({data:new Blob(['hello'])}));
 const access=createMcpExtensionAccess({rpc,storage:{from:()=>({download})}},{userId:U,tokenHash:'hash',resource:'resource'});
 const result=await access.readDocument(D);
 expect(result.mcpContent[1].resource.text).toBe('hello');expect(rpc).toHaveBeenCalledTimes(2);expect(JSON.stringify(result)).not.toContain('storage_path');
 rpc.mockResolvedValueOnce({data:doc}).mockResolvedValueOnce({data:null});await expect(access.readDocument(D)).rejects.toThrow();
 rpc.mockResolvedValue({data:{...doc,storage_path:'another-user/file.txt'}});await expect(access.readDocument(D)).rejects.toThrow('Storage path');
});
it('requires a real owner session and correct origin for sharing preferences, never a model supplied user id',async()=>{
 const rpc=vi.fn(async()=>({data:{finance_enabled:true}}));
 const identity={verifySession:async header=>header==='Bearer session'?U:null,isUserAllowed:async()=>true};
 const sharing=createMcpSharingHandler({rpc},identity,'https://budget.example');
 expect((await sharing(new Request('https://budget.example/sharing',{headers:{authorization:'Bearer opaque-mcp'}}))).status).toBe(403);
 expect((await sharing(new Request('https://budget.example/sharing',{method:'POST',headers:{authorization:'Bearer session','content-type':'application/json'},body:'{}'}))).status).toBe(403);
 expect(rpc).not.toHaveBeenCalled();
});
