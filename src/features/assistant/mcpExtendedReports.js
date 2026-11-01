import { transactionAmountForDate, transactionAffectsDailyBudget, remainingCashBudgetForDate, inclusiveDayCount, transactionBudgetStart, transactionBudgetEnd } from '../../core/dailyBudgetRules.js';
import { applyAssetTransactionLinksToBudget, buildAssetBudgetTransactions } from '../../core/assetRules.js';
import { computeWalletBalanceRows } from '../../core/walletBalanceRules.js';
import { computeTripAnalysis } from '../../core/tripRules.js';
import { buildAccountingReport } from '../accounting/accountingRules.js';
import { loadAccountingFx, convertAccountingAmount } from '../accounting/accountingFx.js';
import { accountingFxDate } from '../accounting/accountingRecognition.js';

const round=value=>Math.round(value*100)/100;
const dayMs=86400000;
export function reportDates(start,end) {
  const count=inclusiveDayCount(start,end);
  if(!count || count>1096)throw new Error('Choose a range of at most three years');
  return Array.from({length:count},(_,i)=>new Date(Date.parse(start+'T00:00:00Z')+i*dayMs).toISOString().slice(0,10));
}

export function tripReport(group, members, expenses, shares, settlements) {
  if([...expenses,...settlements].some(r=>!Number.isFinite(Number(r.amount))) || shares.some(r=>!Number.isFinite(Number(r.share_amount))))throw new Error('Invalid Trip amounts');
  const memberIds=new Set(members.map(row=>row.id));
  const expenseIds=new Set(expenses.map(row=>row.id));
  if(expenses.some(e=>!memberIds.has(e.paid_by_member_id)) || shares.some(s=>!memberIds.has(s.member_id)||!expenseIds.has(s.expense_id)))throw new Error('Incomplete Trip relationships');
  const currencies=[...new Set([...expenses,...settlements].map(row=>row.currency))].sort();
  return {group,expenses,shares,settlements,by_currency:currencies.map(currency=>({currency,...computeTripAnalysis({
    pivot:currency,members:members.map(m=>({id:m.id,name:m.name,isMe:m.is_me})),
    expenses:expenses.filter(e=>e.currency===currency).map(e=>({...e,paidByMemberId:e.paid_by_member_id})),
    shares:shares.map(s=>({expenseId:s.expense_id,memberId:s.member_id,shareAmount:s.share_amount})),
    settlementEvents:settlements.filter(s=>s.currency===currency),
  })})),basis:'Native currencies, no FX sum. Cancelled settlements do not affect balances. Participant names belong to this owned group; no email or account identifier is disclosed.'};
}

export async function budgetReport(data,{period_id,date_from,date_to,as_of,currency},fxLoader=loadAccountingFx) {
  const period=data.periods.find(p=>p.id===period_id);
  if(!period)throw new Error('Period not found');
  const start=date_from||period.start_date,end=date_to||period.end_date;
  if(start<period.start_date||end>period.end_date)throw new Error('Range outside period');
  const dates=reportDates(start,end);
  const segments=data.segments.filter(s=>s.period_id===period.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.id.localeCompare(b.id));
  const segment=date=>segments.find(s=>s.start_date<=date&&s.end_date>=date)||period;
  const inTravel=row=>!row.travel_id||row.travel_id===period.travel_id;
  const raw=data.transactions.filter(inTravel);
  const assets=data.assets.filter(inTravel);
  const txs=applyAssetTransactionLinksToBudget(raw,data.links);
  const assetTxs=buildAssetBudgetTransactions({assets,owners:data.owners,rangeStart:start,rangeEnd:end});
  const target=currency||period.base_currency;
  const currencies=[...new Set([...txs,...assetTxs,...segments,period,...data.wallets.filter(inTravel)].map(r=>r.currency||r.base_currency))];
  const fx=await fxLoader({currencies,target,dates:[as_of,...dates.map(d=>d>as_of?as_of:d)],today:as_of});
  const missing=new Set();
  const rateCache=new Map();
  const convert=(amount,from,date)=>{
    if(!amount || from===target)return Number(amount);
    const key=from+':'+date;
    if(rateCache.has(key)){const rate=rateCache.get(key);return rate===null?null:amount*rate;}
    const seg=segment(date),base=seg.base_currency||period.base_currency;
    const rate=Number(seg.eur_base_rate_fixed||seg.fx_rate_eur_to_base||period.eur_base_rate);
    if((!seg.fx_mode||seg.fx_mode==='fixed') && rate>0 && [from,target].every(c=>c==='EUR'||c===base)){
      const conversion=(target==='EUR'?1:rate)/(from==='EUR'?1:rate);rateCache.set(key,conversion);return amount*conversion;
    }
    const result=convertAccountingAmount(amount,from,target,date>as_of?as_of:date,fx);
    if(result.amount===null){missing.add(`${from}/${target} ${date}`);rateCache.set(key,null);return null;}
    rateCache.set(key,result.fxRate);
    return amount*result.fxRate;
  };
  const categories=new Map(),daily=[];
  const expenseCategories=data.categories.map(c=>c.name);
  const byDay=new Map(dates.map(date=>[date,[]]));let allocationCount=0;
  for(const tx of [...txs,...assetTxs]){
    if(!transactionAffectsDailyBudget(tx,{expenseCategories}))continue;
    const txStart=transactionBudgetStart(tx),txEnd=transactionBudgetEnd(tx);
    if(!txStart||!txEnd)throw new Error('Invalid budget dates');
    const first=txStart>start?txStart:start,last=txEnd<end?txEnd:end;
    if(first>last)continue;
    allocationCount+=inclusiveDayCount(first,last);
    if(allocationCount>200000)throw new Error('Narrow the budget analysis range');
    for(const date of reportDates(first,last))byDay.get(date).push(tx);
  }
  for(const date of dates){
    const seg=segment(date),budget=convert(Number(seg.daily_budget_base)||0,seg.base_currency||period.base_currency,date);
    let used=0,assetUsed=0;
    for(const tx of byDay.get(date)){
      const share=transactionAmountForDate(tx,date)*(tx.type==='income'?-1:1);
      if(!share)continue;
      const value=convert(share,tx.currency,date);
      used+=value||0;if(tx.assetBudget)assetUsed+=value||0;
      const category=tx.category||'Sans catégorie';categories.set(category,(categories.get(category)||0)+(value||0));
    }
    daily.push({date,budget,used:round(used),asset_used:round(assetUsed),remaining:budget===null?null:round(budget-used)});
  }
  const walletRows=computeWalletBalanceRows(data.wallets.filter(inTravel),raw);
  let cash=0;
  for(const row of walletRows)cash+=convert(row.effective_balance,row.wallet_currency,as_of)||0;
  let futureCashBudget=0;
  for(const day of daily.filter(d=>d.date>=as_of)){
    if(day.date===as_of)futureCashBudget+=Math.max(0,day.remaining||0);
    else futureCashBudget+=remainingCashBudgetForDate({transactions:byDay.get(day.date).filter(tx=>!tx.assetBudget),dateISO:day.date,dailyBudget:day.budget,convertAmount:(amount,cur,date)=>convert(amount,cur,date)});
  }
  const complete=missing.size===0;
  const totalBudget=daily.reduce((sum,d)=>sum+(d.budget||0),0),used=daily.reduce((sum,d)=>sum+d.used,0);
  return {period_id,travel_id:period.travel_id,currency:target,start,end,as_of,complete,
    budget:complete?round(totalBudget):null,allocated_spending:complete?round(used):null,remaining_budget:complete?round(totalBudget-used):null,
    categories:complete?[...categories].map(([category,amount])=>({category,amount:round(amount)})):null,daily:complete?daily:null,
    projection:complete&&end>=as_of?{current_wallet_total:round(cash),remaining_cash_budget:round(futureCashBudget),projected_wallet_total:round(cash-futureCashBudget),includes_unpaid:false}:null,
    warnings:[...missing].map(pair=>'Missing FX: '+pair),
    basis:'Budget dates and daily proration; personal Trip shares, asset budget charges and linked purchase exclusions use TravelBudget rules. Projection uses current wallets, daily remaining budget today, prepaid deductions on future days without carrying overspend to another day. Unpaid transactions and future Trip settlements are excluded. Future FX uses the as-of rate unless a fixed segment rate applies. This is a projection, not a promised balance.',
  };
}

export async function accountingReport(data,{travel_id,date_from,date_to,as_of,currency},settings={},settingsAt=null,fxLoader=loadAccountingFx){
  reportDates(date_from,date_to);
  if(!data.travels.some(t=>t.id===travel_id))throw new Error('Travel not found');
  const inTravel=r=>!r.travel_id||r.travel_id===travel_id;
  const transactions=data.transactions.filter(r=>r.travel_id===travel_id),wallets=data.wallets.filter(r=>r.travel_id===travel_id),assets=data.assets.filter(inTravel);
  const fx=await fxLoader({currencies:[...transactions,...wallets,...assets,...(settings.debts||[]),...(settings.positions||[])].map(r=>r.currency),target:currency,
    dates:[as_of,...assets.map(a=>a.purchase_date),...transactions.map(t=>accountingFxDate(t,as_of))],today:as_of});
  const report=buildAccountingReport({transactions,wallets,assets,links:data.links,owners:data.owners,walletBalances:computeWalletBalanceRows(wallets,transactions),tripBalances:null,fx},
    {start:date_from,end:date_to,currency,today:as_of,travelId:travel_id,settings});
  return {...report,charges_excluding_depreciation:report.cashExpenses,settings_synced_at:settingsAt,settings_basis:settingsAt?'Last settings explicitly shared from the browser; resync after editing them.':'Automatic classification only: personal accounting settings have not been shared.',
    warnings:[...report.warnings,...(!settingsAt?['Local accounting settings unavailable: result may differ from your configured accounting screen.']:[])],
    basis:'Personal management accounts, not statutory accounts. Charges exclude linked asset purchases and gross Trip advances. Month-end accounting depreciation differs from the Patrimoine current-value convention. Missing Trip balance sheet positions remain explicitly unavailable.'};
}
