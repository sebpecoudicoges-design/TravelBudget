// 22_budget_consistency_audit.js
// ----------------------------------------------------
// Audit automatique de cohérence budgétaire
// ----------------------------------------------------

(function(){

  function getStateSafe(){
    if(!window.state) return null;
    return window.state;
  }

  function approxEqual(a,b,epsilon=0.01){
    return Math.abs(a-b) < epsilon;
  }

  function runBudgetAudit(){

    const state = getStateSafe();
    if(!state) return;

    const warnings = [];

    const wallets = state.wallets || [];
    const transactions = state.transactions || [];
    const periods = state.periods || [];
    const fx = state.fxRates || {};

    // 1. Wallet sans devise
    wallets.forEach(w=>{
      if(!w.currency){
        warnings.push(`Wallet "${w.name}" sans devise définie`);
      }
    });

    // 2. Transaction hors période
    transactions.forEach(t=>{
      const date = new Date(t.date);
      const valid = periods.some(p=>{
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return date >= start && date <= end;
      });
      if(!valid){
        warnings.push(`Transaction ${t.id} hors période active`);
      }
    });

    // 3. FX manquant
    transactions.forEach(t=>{
      const wallet = wallets.find(w=>w.id === t.wallet_id);
      if(!wallet) return;
      if(wallet.currency !== state.baseCurrency){
        const rateKey = `${wallet.currency}_${state.baseCurrency}`;
        if(!fx[rateKey]){
          warnings.push(`Taux FX manquant: ${rateKey}`);
        }
      }
    });

    // 4. Cohérence total wallets vs total transactions
    const totalWallets = wallets.reduce((sum,w)=>sum+(w.balance||0),0);
    const totalTx = transactions.reduce((sum,t)=>sum+(t.amount||0),0);

    if(!approxEqual(totalWallets,totalTx)){
      warnings.push(`Écart entre wallets (${totalWallets}) et transactions (${totalTx})`);
    }

    renderAuditBadge(warnings);
  }

  function renderAuditBadge(warnings){

    let badge = document.getElementById("budgetAuditBadge");

    if(!badge){
      badge = document.createElement("div");
      badge.id = "budgetAuditBadge";
      badge.style.position = "fixed";
      badge.style.bottom = "20px";
      badge.style.right = "20px";
      badge.style.padding = "8px 14px";
      badge.style.borderRadius = "999px";
      badge.style.fontSize = "13px";
      badge.style.zIndex = "9999";
      badge.style.cursor = "pointer";
      badge.style.boxShadow = "0 8px 20px rgba(0,0,0,.2)";
      document.body.appendChild(badge);
    }

    if(warnings.length === 0){
      badge.textContent = "Budget OK";
      badge.style.background = "var(--good)";
      badge.onclick = ()=>alert("Aucune incohérence détectée.");
    } else {
      badge.textContent = `⚠ ${warnings.length} anomalies`;
      badge.style.background = "var(--warn)";
      badge.onclick = ()=>alert(warnings.join("\n"));
      console.warn("Budget audit warnings:", warnings);
    }
  }

  // Hook refresh global si existant
  function hookRefresh(){
    if(window.refreshAll){
      const original = window.refreshAll;
      window.refreshAll = async function(){
        await original();
        runBudgetAudit();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    hookRefresh();
    setTimeout(runBudgetAudit, 1500);
  });

})();
