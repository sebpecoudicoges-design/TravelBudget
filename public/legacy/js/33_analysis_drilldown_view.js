(function(){
  function escapeHTML(value){
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getTransactionDrilldownStyles(){
    return `
    .tb-analysis-clickable{cursor:pointer;transition:transform .16s ease, background .16s ease, border-color .16s ease;}
    .tb-analysis-clickable:hover{transform:translateY(-1px);background:rgba(59,130,246,.06)!important;border-color:rgba(59,130,246,.22)!important;}
    .tb-analysis-detail-btn{border:1px solid rgba(148,163,184,.28);background:rgba(255,255,255,.64);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;color:rgba(15,23,42,.68);cursor:pointer;white-space:nowrap;}
    .tb-analysis-detail-btn:hover{background:rgba(59,130,246,.10);border-color:rgba(59,130,246,.28);color:#0f172a;}
    .tb-analysis-tx-overlay{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.42);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:18px;}
    .tb-analysis-tx-drawer{width:min(980px,100%);max-height:min(82vh,760px);overflow:hidden;border-radius:28px 28px 20px 20px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.96));border:1px solid rgba(255,255,255,.78);box-shadow:0 28px 80px rgba(15,23,42,.28);display:flex;flex-direction:column;color:#0f172a;}
    .tb-analysis-tx-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:20px 22px 14px;border-bottom:1px solid rgba(148,163,184,.18);}
    .tb-analysis-tx-title{font-size:20px;font-weight:950;line-height:1.15;margin:0;}
    .tb-analysis-tx-meta{margin-top:6px;font-size:12px;color:rgba(15,23,42,.58);display:flex;flex-wrap:wrap;gap:8px;}
    .tb-analysis-tx-close{border:0;background:rgba(15,23,42,.07);color:#0f172a;width:34px;height:34px;border-radius:999px;cursor:pointer;font-size:20px;line-height:1;}
    .tb-analysis-tx-body{overflow:auto;padding:8px 22px 20px;display:grid;gap:10px;}
    .tb-analysis-tx-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:flex-start;padding:13px 0;border-bottom:1px solid rgba(148,163,184,.18);}
    .tb-analysis-tx-label{font-size:14px;font-weight:850;line-height:1.25;}
    .tb-analysis-tx-sub{margin-top:5px;font-size:12px;color:rgba(15,23,42,.56);display:flex;flex-wrap:wrap;gap:7px;}
    .tb-analysis-tx-pill{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;background:rgba(148,163,184,.12);font-size:11px;font-weight:750;color:rgba(15,23,42,.62);}
    .tb-analysis-tx-amount{text-align:right;white-space:nowrap;}
    .tb-analysis-tx-visible{font-size:15px;font-weight:950;}
    .tb-analysis-tx-original{margin-top:4px;font-size:12px;color:rgba(15,23,42,.52);}
    @media (max-width:640px){.tb-analysis-tx-overlay{padding:0;align-items:stretch}.tb-analysis-tx-drawer{max-height:100vh;border-radius:0}.tb-analysis-tx-row{grid-template-columns:1fr}.tb-analysis-tx-amount{text-align:left}}
  `;
  }

  function buildTransactionDrilldownTitle(kind, key){
    if (kind !== 'subcategory') return String(key || 'Catégorie');
    const [cat, sub] = String(key || '').split('|||');
    return `${sub || 'Sans sous-catégorie'} · ${cat || 'Autre'}`;
  }

  function renderTransactionDrilldown({
    title = 'Catégorie',
    rows = [],
    total = '',
    start = '',
    end = '',
  } = {}){
    const count = Array.isArray(rows) ? rows.length : 0;
    return `
    <div class="tb-analysis-tx-drawer" role="dialog" aria-modal="true" aria-label="Transactions correspondantes">
      <div class="tb-analysis-tx-head">
        <div>
          <h3 class="tb-analysis-tx-title">${escapeHTML(title)}</h3>
          <div class="tb-analysis-tx-meta">
            <span>${escapeHTML(count + ' transaction' + (count > 1 ? 's' : ''))}</span>
            <span>•</span>
            <span>Total visible : <strong>${escapeHTML(total)}</strong></span>
            <span>•</span>
            <span>${escapeHTML(start || '—')} → ${escapeHTML(end || '—')}</span>
          </div>
        </div>
        <button type="button" class="tb-analysis-tx-close" data-close="1" aria-label="Fermer">×</button>
      </div>

      <div class="tb-analysis-tx-body">
        ${count ? rows.map((row) => `
            <div class="tb-analysis-tx-row" data-tx-row="${escapeHTML(row.id)}">
              <div style="min-width:0;">
                <div class="tb-analysis-tx-label">${escapeHTML(row.label || 'Transaction')}</div>
                <div class="tb-analysis-tx-sub">
                  <span class="tb-analysis-tx-pill">Budget : ${escapeHTML(row.budgetRange || '—')}</span>
                  <span class="tb-analysis-tx-pill">Visible : ${escapeHTML(row.visibleRange || '—')}</span>
                  <span class="tb-analysis-tx-pill">Cash : ${escapeHTML(row.cashDate || '—')}</span>
                  <span class="tb-analysis-tx-pill">${escapeHTML(row.paidLabel || '')}</span>
                  <span class="tb-analysis-tx-pill">${escapeHTML(row.budgetLabel || '')}</span>
                  <span class="tb-analysis-tx-pill">${escapeHTML(row.tripLabel || '')}</span>
                </div>
              </div>
              <div class="tb-analysis-tx-amount">
                <div class="tb-analysis-tx-visible">${escapeHTML(row.visibleAmount || '')}</div>
                <div class="tb-analysis-tx-original">${escapeHTML(row.originalAmount || '')}</div>
              </div>
            </div>`).join('') : `<div class="muted" style="padding:18px 0;">Aucune transaction correspondante dans le modèle courant.</div>`}
      </div>
    </div>`;
  }

  window.TBAnalysisDrilldownView = {
    ...(window.TBAnalysisDrilldownView || {}),
    buildTransactionDrilldownTitle,
    getTransactionDrilldownStyles,
    renderTransactionDrilldown,
  };
})();
