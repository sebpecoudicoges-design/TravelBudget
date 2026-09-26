import { it, expect } from 'vitest';
import { budgetWindow, allocateBudgetAmount, internalAccounting, needsAccountingTransaction } from '../../../src/features/accounting/accountingRecognition.js';
it('uses camel and snake budget dates with legacy cash fallback and rejects invalid periods',()=>{
 expect(budgetWindow({budgetDateStart:'2026-01-01',budgetDateEnd:'2026-02-28',date_start:'2025-12-01'})).toEqual({start:'2026-01-01',end:'2026-02-28'});
 expect(budgetWindow({date_start:'2026-01-01'})).toEqual({start:'2026-01-01',end:'2026-01-01'});
 expect(budgetWindow({budget_date_start:'2026-02-31',budget_date_end:'2026-03-01'})).toBeNull();
});
it('conserves cents across periods, leap years and signed reversals',()=>{
 const w={start:'2024-02-01',end:'2024-03-31'};
 for(const value of [0.01,1,100,-0.01,-1,-100]) {
  const a=allocateBudgetAmount(value,w,'2024-02-01','2024-02-29'),b=allocateBudgetAmount(value,w,'2024-03-01','2024-03-31');
  expect(Math.round((a+b)*100)).toBe(Math.round(value*100));
 }
 expect(allocateBudgetAmount(600,w,'2024-02-01','2024-02-29')).toBe(290);
 expect(allocateBudgetAmount(null,w,'2024-02-01','2024-02-29')).toBeNull();
 expect(allocateBudgetAmount(null,w,'2023-01-01','2023-01-31')).toBe(0);
});
it('excludes internal shares without modifying the separate budget Analysis policy',()=>{
 expect(internalAccounting({is_internal:true,trip_share_link_id:'share',affects_budget:true})).toBe(true);
 expect(internalAccounting({internalTransferId:'transfer'})).toBe(true);
 expect(internalAccounting({type:'expense',pay_now:false})).toBe(false);
});

it('loads historical cash-date FX only for relevant budget intervals or outstanding balance items',()=>{
 const tx={date_start:'2020-01-01',budget_date_start:'2020-01-01',budget_date_end:'2020-01-31'};
 expect(needsAccountingTransaction(tx,'2026-01-01','2026-01-31','2026-01-31')).toBe(false);
 expect(needsAccountingTransaction({...tx,pay_now:false},'2026-01-01','2026-01-31','2026-01-31')).toBe(true);
 expect(needsAccountingTransaction({...tx,budget_date_end:'2026-02-28'},'2026-01-01','2026-01-31','2026-01-31')).toBe(true);
});
