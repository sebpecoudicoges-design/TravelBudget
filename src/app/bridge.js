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
import * as notificationRules from '../core/notificationRules.js';
import * as workRules from '../core/workRules.js';
import * as bodyEnergyRules from '../core/bodyEnergyRules.js';
import * as sportLibraryRules from '../core/sportLibraryRules.js';
import * as nutritionRules from '../core/nutritionRules.js';
import * as dailyBudgetRules from '../core/dailyBudgetRules.js';
import * as canonicalRecords from '../core/canonicalRecords.js';
import { createEntityStore } from '../data/entityStore.js';
import { createMutationQueueStore, flushMutationQueue } from '../data/mutationQueueStore.js';
import { createSupabaseRepository } from '../data/supabaseRepository.js';
import { storageQuota } from '../data/storageQuota.js';
import * as sportRules from '../core/sportRules.js';
import * as uiComponents from '../ui/components.js';
import '../ui/shared.css';

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
window.Core.notificationRules = notificationRules;
window.Core.workRules = workRules;
window.Core.bodyEnergyRules = bodyEnergyRules;
window.Core.sportLibraryRules = sportLibraryRules;
window.Core.nutritionRules = nutritionRules;
window.Core.dailyBudgetRules = dailyBudgetRules;
window.Core.canonicalRecords = canonicalRecords;
window.Core.sportRules = sportRules;

window.Data = window.Data || {};
window.Data.appStore = window.Data.appStore || createEntityStore();
window.Data.createMutationQueueStore = createMutationQueueStore;
window.Data.flushMutationQueue = flushMutationQueue;
window.Data.supabaseRepository = window.Data.supabaseRepository || createSupabaseRepository(() => window.sb);
window.Data.storageQuota = storageQuota;
window.tbSafeLocalStorageSet = (key, value, options) => storageQuota.safeSet(window.localStorage, key, value, options);

window.UI = window.UI || {};
Object.assign(window.UI, uiComponents);

// Optional: expose money helpers directly for convenience (legacy may redefine later; that's OK)
window.moneyRound = window.moneyRound || money.moneyRound;
window.moneyAdd = window.moneyAdd || money.moneyAdd;
window.fmtMoney = window.fmtMoney || money.fmtMoney;
