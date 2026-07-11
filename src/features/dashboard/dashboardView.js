function defaultEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fallbackT(key, vars) {
  let out = String(key || '');
  if (vars && typeof vars === 'object') {
    Object.keys(vars).forEach((name) => {
      out = out.replaceAll(`{${name}}`, String(vars[name]));
    });
  }
  return out;
}

export function renderDashboardOnboardingPanel({
  rows = [],
  done = 0,
  total = 0,
  t = fallbackT,
  esc = defaultEsc,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const list = Array.isArray(rows) ? rows : [];
  const rowTotal = Number(total) || list.length;
  const rowDone = Number(done) || list.filter((row) => row?.ok).length;

  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">
      <div>
        <div class="muted" style="margin-bottom:6px;">${esc(tr('onboarding.subtitle'))}</div>
        <div class="pill" style="display:inline-flex;font-weight:900;">${esc(tr('onboarding.progress', { done: rowDone, total: rowTotal }))}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn primary" type="button" onclick="if(typeof tbStartGuidedTour==='function')tbStartGuidedTour({mode:'dashboard'});">${esc(tr('onboarding.action.guide'))}</button>
        <button class="btn" type="button" onclick="hideOnboardingPanel()">${esc(tr('onboarding.hide'))}</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px;">
      ${list.map((row) => {
        const isOk = !!row?.ok;
        return `
        <div style="border:1px solid ${isOk ? 'rgba(16,185,129,.28)' : 'rgba(148,163,184,.25)'};background:${isOk ? 'rgba(16,185,129,.08)' : 'rgba(255,255,255,.62)'};border-radius:16px;padding:12px;">
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <span style="width:24px;height:24px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-weight:950;background:${isOk ? 'rgba(16,185,129,.18)' : 'rgba(37,99,235,.12)'};color:${isOk ? '#047857' : '#1d4ed8'};">${isOk ? '&#10003;' : '&bull;'}</span>
            <div style="min-width:0;flex:1;">
              <div style="font-weight:800;line-height:1.3;">${esc(row?.text || '')}</div>
              ${isOk ? '' : `<button class="btn" type="button" style="margin-top:10px;padding:7px 10px;font-size:12px;" onclick="${esc(row?.action || '')}">${esc(row?.label || '')}</button>`}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:10px; opacity:.82;" class="muted">${esc(tr('onboarding.tip'))}</div>
  `;
}

export default {
  renderDashboardOnboardingPanel,
};
