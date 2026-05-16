// Bridge: expose selected core modules to legacy globals
import * as money from '../core/money.js';
import * as tripRules from '../core/tripRules.js';
import * as transactionRules from '../core/transactionRules.js';
import * as transactionGuards from '../core/transactionGuards.js';
import * as transactionRpcPayload from '../core/transactionRpcPayload.js';
import * as fxRules from '../core/fxRules.js';
import * as fxDecisionRules from '../core/fxDecisionRules.js';
import * as inboxRules from '../core/inboxRules.js';
import * as documentRules from '../core/documentRules.js';
import * as walletBalanceRules from '../core/walletBalanceRules.js';
import * as assetRules from '../core/assetRules.js';
import * as assistantRules from '../core/assistantRules.js';

window.Core = window.Core || {};
window.Core.money = money;
window.Core.tripRules = tripRules;
window.Core.transactionRules = transactionRules;
window.Core.transactionGuards = transactionGuards;
window.Core.transactionRpcPayload = transactionRpcPayload;
window.Core.fxRules = fxRules;
window.Core.fxDecisionRules = fxDecisionRules;
window.Core.inboxRules = inboxRules;
window.Core.documentRules = documentRules;
window.Core.walletBalanceRules = walletBalanceRules;
window.Core.assetRules = assetRules;
window.Core.assistantRules = assistantRules;

// Optional: expose money helpers directly for convenience (legacy may redefine later; that's OK)
window.moneyRound = window.moneyRound || money.moneyRound;
window.moneyAdd = window.moneyAdd || money.moneyAdd;
window.fmtMoney = window.fmtMoney || money.fmtMoney;
