import { it, expect } from 'vitest';
import { financialIndicators } from '../../../src/features/accounting/accountingIndicators.js';
it('reconciles operating, financial, exceptional results and guards ratio denominators',()=>{
 const entries=[{kind:'income',account:'758110',amount:2000},{kind:'income',account:'762100',amount:50},{kind:'expense',account:'625710',amount:500},{kind:'expense',account:'661100',amount:20},{kind:'expense',account:'671100',amount:30},{kind:'expense',account:'681120',amount:100}];
 const result=financialIndicators({entries,income:2050,expenses:650,depreciation:100,result:1400,totalAssets:10000,liabilities:2000,confirmedEquity:8000,cash:3000,availableCash:3100,netAssets:6900});
 expect(result).toMatchObject({financialIncome:50,financialExpense:20,financialResult:30,exceptionalExpense:30,operatingResult:1400,selfFinancing:1500,equityRatio:80,debtRatio:20,cashDebtCoverage:1.55,netDebt:-1000,fixedAssetWeight:69,interestCoverage:70,operatingMargin:70,classificationRate:100});
 const empty=financialIndicators({entries:[],income:0,result:0,depreciation:0,totalAssets:0,liabilities:0,confirmedEquity:null,availableCash:0});
 expect(empty).toMatchObject({netMargin:null,equityRatio:null,debtRatio:null,cashDebtCoverage:null,interestCoverage:null});
});
