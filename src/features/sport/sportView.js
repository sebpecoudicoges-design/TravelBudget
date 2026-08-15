function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export const SPORT_SECTIONS = ['session', 'program', 'profile', 'history'];

export function normalizeSportSection(value) {
  const section = String(value || '').trim().toLowerCase();
  return SPORT_SECTIONS.includes(section) ? section : 'session';
}

export function renderSportSectionTabs({ activeSection = 'session', escapeHTML = fallbackEscape } = {}) {
  const active = normalizeSportSection(activeSection);
  const labels = {
    session: ['Seance', 'Construire et lancer'],
    program: ['Programme', 'Planning et favoris'],
    profile: ['Profil & progression', 'Mesures et evolution'],
    history: ['Historique', 'Seances enregistrees'],
  };
  return `<div class="tb-sport-section-tabs" role="tablist" aria-label="Espaces Sport">
    ${SPORT_SECTIONS.map((section) => {
      const selected = section === active;
      const [label, hint] = labels[section];
      return `<button class="tb-sport-section-tab${selected ? ' active' : ''}" type="button" role="tab" id="sport-tab-${section}" data-sport-section="${section}" aria-selected="${selected}" aria-controls="sport-panel-${section}" tabindex="${selected ? '0' : '-1'}"><strong>${escapeHTML(label)}</strong><span>${escapeHTML(hint)}</span></button>`;
    }).join('')}
  </div>`;
}

export function renderSportShell({
  title = 'Seances et timer guide',
  subtitle = '',
  planSummary = '',
  statsHTML = '',
  profileHTML = '',
  progressionHTML = '',
  programHTML = '',
  builderHTML = '',
  timerHTML = '',
  historyHTML = '',
  escapeHTML = fallbackEscape,
  activeSection = 'session',
}) {
  const active = normalizeSportSection(activeSection);
  const panel = (section, content) => `<section class="tb-sport-section-panel" id="sport-panel-${section}" role="tabpanel" aria-labelledby="sport-tab-${section}" data-sport-panel="${section}" ${section === active ? '' : 'hidden'}>${content}</section>`;
  return `
      <div class="tb-sport-shell">
        <div class="tb-sport-hero">
          <div>
            <div class="tb-sport-eyebrow">Sport</div>
            <h2>${escapeHTML(title)}</h2>
            <p>${escapeHTML(subtitle)}</p>
          </div>
          <div class="tb-sport-pill">${escapeHTML(planSummary)}</div>
        </div>
        ${renderSportSectionTabs({ activeSection: active, escapeHTML })}
        ${panel('session', `${statsHTML}<div class="tb-sport-grid">${builderHTML}${timerHTML}</div>`)}
        ${panel('program', programHTML)}
        ${panel('profile', `${profileHTML}${progressionHTML}`)}
        ${panel('history', historyHTML)}
      </div>`;
}
