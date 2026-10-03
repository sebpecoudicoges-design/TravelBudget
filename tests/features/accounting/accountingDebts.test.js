import { it, expect } from 'vitest';
import { debtLedger, repaymentEligible, operationSearchText, matchesOperationSearch } from '../../../src/features/accounting/accountingDebts.js';
import { buildAccountingReport } from '../../../src/features/accounting/accountingRules.js';
const today = '2026-01-31';
const tx = (id, amount, patch = {}) => ({id, amount, type:'expense', currency:'EUR', date_start:'2026-01-15', pay_now:true, category:'Intérêts emprunt', ...patch});
const loan = (patch = {}) => ({id:'d', name:'Prêt', currency:'EUR', openingAmount:4000, openingDate:'2026-01-01', repayments:[], ...patch});
const options = {start:'2026-01-01',end:today,today,currency:'EUR',settings:{balances:{EUR:{debt:0,receivable:0,equity:0,asOf:today,evidence:'Relevés'}}}};
const report = (transactions, debts, patch={}) => buildAccountingReport({transactions, ...patch}, {...options, settings:{...options.settings,debts}});
it('recognizes loan funding as debt and only repayment interest as budget expense', () => {
 const transactions = [tx('fund',4000,{type:'income',date_start:'2026-01-01'}),tx('pay',110)];
 const r = report(transactions,[loan({originTransactionId:'fund',repayments:[{transactionId:'pay',principal:100}]})],{wallets:[{id:'w',currency:'EUR'}],walletBalances:[{walletId:'w',effectiveBalance:3890}]});
 expect(r).toMatchObject({income:0,expenses:10,trackedDebt:3900,cash:3890,totalFunding:3900,balanceGap:-10});
 expect(r.entries[0]).toMatchObject({sourceAmount:110,principalRepaid:100,amount:10});
 expect(r.debtRows[0]).toMatchObject({paid:100,remaining:3900});
 expect(r.excluded.some(e=>e.reason.includes('Emprunt reçu'))).toBe(true);
});
it('dates adjustments and repayments, preserves signed cents and rejects historical negative balances', () => {
 const d=loan({openingAmount:100,repayments:[{transactionId:'p',principal:50}],adjustments:[{id:'up',amount:20.11,date:'2026-01-10',reason:'Correction'},{id:'down',amount:-10.01,date:'2026-01-20',reason:'Remise'}]});
 const r=debtLedger({debts:[d]},[tx('p',50)],today).rows[0];
 expect(r).toMatchObject({paid:50,remaining:60.1,adjusted:10.1});
 expect(r.history.map(e=>e.balance)).toEqual([120.11,70.11,60.1]);
 d.adjustments=[{id:'a',amount:-110,date:'2026-01-02',reason:'Erreur'},{id:'b',amount:200,date:'2026-01-20',reason:'Correction tardive'}];
 expect(debtLedger({debts:[d]},[tx('p',50)],today).rows[0].remaining).toBeNull();
});
it('manual adjustments change only debt, never cash, income or expenses', () => {
 const r=report([], [loan({adjustments:[{id:'a',amount:-100,date:'2026-01-03',reason:'Remise'}]})]);
 expect(r).toMatchObject({trackedDebt:3900,income:0,expenses:0,cash:0,balanceGap:-3900});
});
it('rejects duplicate assignment, unavailable sources, excess principal and currency mismatches', () => {
 const p=tx('p',100), d=loan({repayments:[{transactionId:'p',principal:100}]});
 for(const transactions of [[],[tx('p',99)],[tx('p',100,{currency:'AUD'})],[tx('p',100,{pay_now:false})]]) {
   const r=debtLedger({debts:[d]},transactions,today);
   expect(r.rows[0].remaining).toBeNull();expect(r.principalByTransaction.size).toBe(0);
 }
 expect(debtLedger({debts:[d,loan({...d,id:'d2'})]},[p],today).rows.every(r=>r.remaining===null)).toBe(true);
 for(const patch of [{is_internal:true},{internal_transfer_id:'i'},{date_start:'2026-02-01'},{date_start:'2025-12-01'},{virtualBudgetOnly:true},{trip_expense_id:'t'}]) expect(repaymentEligible({...p,...patch},d,today)).toBe(false);
});
it('uses budget dates for remaining interest and payment dates for principal history', () => {
 const r=report([tx('p',131,{budget_date_start:'2026-01-01',budget_date_end:'2026-01-31'})],[loan({repayments:[{transactionId:'p',principal:100}]})]);
 expect(r.expenses).toBe(31);
 expect(r.debtRows[0].history[0].date).toBe('2026-01-15');
 const before=buildAccountingReport({transactions:[tx('p',131,{budget_date_start:'2026-01-01',budget_date_end:'2026-01-31'})]}, {...options,end:'2026-01-10',settings:{...options.settings,debts:[loan({repayments:[{transactionId:'p',principal:100}]})]}});
 expect(before.expenses).toBe(10);
});
it('uses closing FX for debt and excludes unknown amounts from known portions', () => {
 const d=loan({currency:'AUD'});
 const data={wallets:[{id:'w',currency:'EUR'}],walletBalances:[{walletId:'w',effectiveBalance:100}],fx:{series:{'AUD:EUR':[{date:today,rate:0.6}]}}};
 const r=report([], [d], data);
 expect(r.trackedDebt).toBe(2400);expect(r.knownFunding).toBe(2400);expect(r.balanceGap).toBeNull();expect(r.knownAssets).toBe(100);
 delete data.fx;
 expect(report([], [d], data)).toMatchObject({trackedDebt:null,knownFunding:0,knownAssets:100,totalFunding:null});
});
it('optional asset and expense references do not create new assets or duplicate charges', () => {
 const r=report([tx('e',4000,{date_start:'2026-01-01'})],[loan({assetId:'car',originTransactionId:'e'})]);
 expect(r).toMatchObject({expenses:4000,trackedDebt:4000,netAssets:0});
});

it('searches combined labels, categories, amounts and payment or budget dates',()=>{
 const text=operationSearchText(tx('s',4000.50,{label:'Prêt été',category:'Financement',subcategory:'Famille',date_start:'2026-10-03',budget_date_start:'2026-10-01'}));
 for(const query of ['pret famille','4 000,50','4000.50 03/10/2026','financement 2026-10','01/10/2026','']) expect(matchesOperationSearch(text,query)).toBe(true);
 expect(matchesOperationSearch(text,'4001')).toBe(false);
});
