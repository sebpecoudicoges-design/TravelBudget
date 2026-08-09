function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function renderSportShell({
  title = 'Seances et timer guide',
  subtitle = '',
  planSummary = '',
  statsHTML = '',
  profileHTML = '',
  progressionHTML = '',
  builderHTML = '',
  timerHTML = '',
  historyHTML = '',
  escapeHTML = fallbackEscape,
}) {
  return `
      <div class="tb-sport-shell">
        <div class="tb-sport-hero">
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;color:rgba(255,255,255,.72);">Sport</div>
            <h2>${escapeHTML(title)}</h2>
            <p>${escapeHTML(subtitle)}</p>
          </div>
          <div class="tb-sport-pill">${escapeHTML(planSummary)}</div>
        </div>
        ${statsHTML}
        ${profileHTML}
        ${progressionHTML}
        <div class="tb-sport-grid">
          ${builderHTML}
          ${timerHTML}
        </div>
        ${historyHTML}
      </div>`;
}
