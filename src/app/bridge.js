// Bridge: expose selected core modules to legacy globals
import * as money from '../core/money.js';
import * as tripRules from '../core/tripRules.js';

window.Core = window.Core || {};
window.Core.money = money;
window.Core.tripRules = tripRules;

// Optional: expose money helpers directly for convenience (legacy may redefine later; that's OK)
window.moneyRound = window.moneyRound || money.moneyRound;
window.moneyAdd = window.moneyAdd || money.moneyAdd;
window.fmtMoney = window.fmtMoney || money.fmtMoney;
