import { it, expect } from 'vitest';
import { positionLedger, assetRattachements } from '../../../src/features/accounting/accountingPositions.js';
import { buildAccountingReport } from '../../../src/features/accounting/accountingRules.js';
const tx=(id,type,amount,date='2026-01-10')=>({id,type,amount,currency:'EUR',date_start:date,pay_now:true,category:'Caution'});
const transactions=[tx('deposit','expense',800),tx('refund','income',300,'2026-01-20')];
const p={id:'p',name:'Logement',currency:'EUR',account:'275000',transactionIds:['deposit','refund']};
const settings={positions:[p]};
const options={start:'2026-01-01',end:'2026-01-31',today:'2026-01-31',currency:'EUR',travelId:'t',settings};
it('keeps a 500 deposit receivable after refund, excludes capital from result and reconciles balance',()=>{
 const r=buildAccountingReport({transactions,assets:[],wallets:[],links:[],tripBalances:[]},options);
 expect(r.positionRows[0].amount).toBe(500); expect(r.result).toBe(0);
 expect(r.totalAssets).toBe(500);expect(r.totalFunding).toBe(500);expect(r.excluded).toHaveLength(2);
});
it.each([
 ['overpayment',[tx('deposit','expense',800),tx('refund','income',900)]],
 ['refund before funding',[tx('deposit','expense',800,'2026-01-20'),tx('refund','income',300)]],
 ['missing source',[transactions[0]]],
 ['other currency',[transactions[0],{...transactions[1],currency:'AUD'}]],
 ['internal',[{...transactions[0],is_internal:true},transactions[1]]],
 ['unpaid',[{...transactions[0],pay_now:false},transactions[1]]],
 ['Trip',[{...transactions[0],trip_expense_id:'trip'},transactions[1]]]
])('rejects %s without inventing a zero balance',(_,rows)=>{
 const r=positionLedger(settings,rows,[],'2026-01-31');expect(r.rows[0].amount).toBeNull();expect(r.errors.length).toBeGreaterThan(0);expect(r.claimed.size).toBe(0);
});
it('rejects duplicate attachment, debt funding and asset purchases',()=>{
 for(const s of [{positions:[p,p]}, {...settings,debts:[{originTransactionId:'deposit'}]}, {positions:[{...p,transactionIds:['deposit','deposit']}]}]) expect(positionLedger(s,transactions,[],'2026-01-31').errors.length).toBeGreaterThan(0);
 expect(positionLedger(settings,transactions,[{transaction_id:'deposit'}],'2026-01-31').rows[0].amount).toBeNull();
});
it('retains unknown FX instead of reporting zero',()=>{
 const r=buildAccountingReport({transactions:transactions.map(t=>({...t,currency:'AUD'})),assets:[],wallets:[],links:[],tripBalances:[]},{...options,settings:{positions:[{...p,currency:'AUD'}]}});
 expect(r.positionRows[0].amount).toBeNull();expect(r.netWorth).toBeNull();
});
it('attaches an existing asset without adding another asset and refuses duplicate purchases',()=>{
 const data={transactions:[tx('a','expense',1200)],assets:[{id:'asset',name:'Computer',currency:'EUR',purchase_value:1200,purchase_date:'2026-01-01',depreciation_months:12,residual_value:0}],links:[],wallets:[],tripBalances:[]};
 const settings={assetLinks:[{asset_id:'asset',transaction_id:'a'}]};
 const r=buildAccountingReport(data,{...options,settings});
 expect(r.netAssets).toBe(1100);expect(r.result).toBe(-100);expect(r.assetRows).toHaveLength(1);
 expect(assetRattachements(settings,{...data,links:[{asset_id:'asset',transaction_id:'other',relation_type:'purchase'}]},'2026-01-31').errors).toHaveLength(1);
 expect(assetRattachements({...settings,positions:[{transactionIds:['a']}]},data,'2026-01-31').errors).toHaveLength(1);
});
