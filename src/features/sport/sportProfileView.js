function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function helpers(api = {}) {
  return {
    esc: api.escapeHTML || fallbackEscape,
    txt: api.translate || ((fr, en) => fr || en || ''),
    n: api.numberValue || numberValue,
    todayISO: api.todayISO || (() => new Date().toISOString().slice(0, 10)),
    bodyWeight: api.bodyWeight || (() => 0),
  };
}

function axisBasis(axis, h) {
  const map = {
    lower: h.txt('Compare surtout squat/souleve de terre a un repere exigeant : squat 1,75 x PDC ou souleve de terre 2,15 x PDC.', 'Mostly compares squat/deadlift against a demanding benchmark: squat 1.75 x BW or deadlift 2.15 x BW.'),
    push: h.txt('Priorite aux mouvements de poussee complets : developpe couche, incline, militaire, dips ou pompes. Les isolations triceps ne servent qu en secours.', 'Prioritizes full push movements: bench, incline press, overhead press, dips or push-ups. Triceps isolation is fallback only.'),
    pull: h.txt('Compare tractions et rowing/tirages ; les curls ne servent qu en absence de vrai mouvement de tirage.', 'Compares pull-ups and rows/pulls; curls are fallback only when no main pull movement exists.'),
    core: h.txt('Compare gainage et abdos a un repere plus strict : 120 s ou 35 reps propres.', 'Compares planks and abs against a stricter benchmark: 120 s or 35 clean reps.'),
    cardio: h.txt('Compare l intensite observee a 14 kcal/min pour eviter de surnoter une seance moderee.', 'Compares observed intensity against 14 kcal/min to avoid overrating moderate sessions.'),
    recovery: h.txt('Compare le sommeil recent a 8,5 h ou la regularite recente si le sommeil manque.', 'Compares recent sleep against 8.5 h, or recent consistency when sleep is missing.'),
  };
  return map[axis] || '';
}

export function radarPoints(axes = [], radius = 104, cx = 140, cy = 140) {
  const count = Math.max(1, axes.length);
  return (axes || []).map((axis, idx) => {
    const angle = (-90 + idx * 360 / count) * Math.PI / 180;
    const r = radius * Math.max(0, Math.min(100, numberValue(axis?.value, 0))) / 100;
    return `${Math.round((cx + Math.cos(angle) * r) * 10) / 10},${Math.round((cy + Math.sin(angle) * r) * 10) / 10}`;
  }).join(' ');
}

export function renderSportProfileDashboard({
  data = {},
  latest = null,
  bodyWeightKg = 0,
  api = {},
} = {}) {
  const h = helpers(api);
  const axes = data.axes || [];
  const cx = 140;
  const cy = 140;
  const rings = [40, 70, 100].map((p) => `<polygon points="${radarPoints(axes.map((a) => Object.assign({}, a, { value: p })), 104, cx, cy)}" fill="none" stroke="rgba(148,163,184,.28)" stroke-width="1"/>`).join('');
  const spokes = axes.map((axis, idx) => {
    const angle = (-90 + idx * 360 / Math.max(1, axes.length)) * Math.PI / 180;
    const x = cx + Math.cos(angle) * 112;
    const y = cy + Math.sin(angle) * 112;
    const lx = cx + Math.cos(angle) * 128;
    const ly = cy + Math.sin(angle) * 128;
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(148,163,184,.24)"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${h.esc(axis.label)}</text>`;
  }).join('');
  const weakest = data.weakest || axes[0] || { label: '-' };
  const loads = (data.bestLoads || []).length
    ? data.bestLoads.map((row) => `<span class="tb-sport-chip">${h.esc(row.name)} ${Math.round(h.n(row.estimate, 0))} kg e1RM</span>`).join('')
    : `<span class="tb-sport-chip">${h.esc(h.txt('Charges a renseigner dans les series', 'Enter loads in sets'))}</span>`;
  return `<div class="tb-sport-profile-grid">
      <div class="tb-sport-card tb-sport-radar-card">
        <div class="tb-sport-card-head">
          <div>
            <h3>${h.esc(h.txt('Profil forces / faiblesses', 'Strengths / weaknesses profile'))}</h3>
            <div class="muted">${h.esc(h.txt('Radar indicatif sur 28 jours : meilleures capacites observees, pas volume de travail.', 'Indicative 28-day radar: best observed capacities, not work volume.'))}</div>
          </div>
          <button class="btn" type="button" id="sport-open-body-measurement">${h.esc(h.txt('Mesures', 'Metrics'))}</button>
        </div>
        <div class="tb-sport-radar-wrap">
          <svg class="tb-sport-radar" viewBox="0 0 280 280" role="img" aria-label="${h.esc(h.txt('Radar du profil sportif', 'Sport profile radar'))}">
            ${rings}${spokes}
            <polygon points="${radarPoints(axes, 104, cx, cy)}" fill="rgba(37,99,235,.26)" stroke="#2563eb" stroke-width="3"/>
            ${axes.map((axis, idx) => {
              const angle = (-90 + idx * 360 / Math.max(1, axes.length)) * Math.PI / 180;
              const r = 104 * h.n(axis.value, 0) / 100;
              return `<circle cx="${cx + Math.cos(angle) * r}" cy="${cy + Math.sin(angle) * r}" r="4" fill="#0ea5e9"/>`;
            }).join('')}
          </svg>
          <div class="tb-sport-radar-side">
            <strong>${h.esc(h.txt('Axe a renforcer', 'Focus axis'))}: ${h.esc(weakest.label)}</strong>
            <small>${h.esc(h.txt('Base : meilleures capacites observees sur 28 jours, comparees a des reperes intermediaires exigeants par poids du corps. Repere de suivi, pas diagnostic.', 'Basis: best observed 28-day capacities, compared with demanding intermediate bodyweight benchmarks. Tracking guidance, not a diagnosis.'))}</small>
            <div class="tb-sport-radar-bars">
              ${axes.map((axis) => `<div title="${h.esc(`${axisBasis(axis.key, h)} ${axis.basis || ''}`)}"><span>${h.esc(axis.label)} · ${h.esc(axis.raw)}${axis.basis ? ` · ${h.esc(axis.basis)}` : ''}</span><b style="width:${Math.max(6, h.n(axis.value, 0))}%"></b><em>${h.n(axis.value, 0)}</em></div>`).join('')}
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:10px;">
          ${axes.map((axis) => `<div class="tb-sport-profile-note"><strong>${h.esc(axis.label)}</strong><br><small>${h.esc(axisBasis(axis.key, h))}</small></div>`).join('')}
        </div>
        <div class="tb-sport-meta" style="margin-top:10px;">${loads}</div>
      </div>
      <div class="tb-sport-card tb-sport-body-card">
        <div class="tb-sport-card-head">
          <div>
            <h3>${h.esc(h.txt('Impedancemetre', 'Body composition'))}</h3>
            <div class="muted">${h.esc(latest ? h.txt(`Derniere mesure : ${String(latest.measured_on).slice(0, 10)}`, `Latest: ${String(latest.measured_on).slice(0, 10)}`) : h.txt('Aucune mesure saisie', 'No measurement yet'))}</div>
          </div>
          <button class="btn primary" type="button" id="sport-open-body-measurement-2">+ ${h.esc(h.txt('Saisir', 'Add'))}</button>
        </div>
        <div class="tb-sport-body-kpis">
          <div><span>${h.esc(h.txt('Poids', 'Weight'))}</span><strong>${latest?.weight_kg ? `${h.n(latest.weight_kg, 0)} kg` : `${h.n(bodyWeightKg || h.bodyWeight(), 0)} kg`}</strong></div>
          <div><span>${h.esc(h.txt('Masse grasse', 'Body fat'))}</span><strong>${latest?.body_fat_pct ? `${h.n(latest.body_fat_pct, 0)}%` : '-'}</strong></div>
          <div><span>${h.esc(h.txt('Muscle', 'Muscle'))}</span><strong>${latest?.muscle_mass_kg ? `${h.n(latest.muscle_mass_kg, 0)} kg` : '-'}</strong></div>
          <div><span>${h.esc(h.txt('Eau', 'Water'))}</span><strong>${latest?.body_water_pct ? `${h.n(latest.body_water_pct, 0)}%` : '-'}</strong></div>
        </div>
        <div class="muted" style="margin-top:10px;">${h.esc(h.txt('Champs limites : poids, masse grasse, muscle, eau, os, graisse viscerale, BMR, age metabolique et notes.', 'Focused fields: weight, fat, muscle, water, bone, visceral fat, BMR, metabolic age and notes.'))}</div>
      </div>
    </div>`;
}

function bodyInput(id, label, value, step, h) {
  return `<div class="tb-sport-field"><label>${h.esc(label)}</label><input id="${id}" type="number" step="${h.esc(step || '0.1')}" value="${h.esc(value ?? '')}"></div>`;
}

export function renderBodyMeasurementModal({ editor = null, api = {} } = {}) {
  if (!editor) return '';
  const h = helpers(api);
  return `<div class="tb-sport-modal-backdrop tb-sport-body-modal-backdrop" role="dialog" aria-modal="true">
      <div class="tb-sport-modal tb-sport-body-modal">
        <h3>${h.esc(h.txt('Mesure impedancemetre', 'Body composition measurement'))}</h3>
        <div class="muted">${h.esc(h.txt('Saisie datee, enregistree en SQL si connecte, sinon gardee localement.', 'Dated entry, saved in SQL when online, otherwise kept locally.'))}</div>
        <div class="tb-sport-fields" style="margin-top:12px;">
          <div class="tb-sport-field"><label>${h.esc(h.txt('Date', 'Date'))}</label><input id="sport-body-date" type="date" value="${h.esc(editor.measured_on || h.todayISO())}"></div>
          ${bodyInput('sport-body-weight', h.txt('Poids kg', 'Weight kg'), editor.weight_kg, '0.1', h)}
          ${bodyInput('sport-body-fat', h.txt('Masse grasse %', 'Body fat %'), editor.body_fat_pct, '0.1', h)}
          ${bodyInput('sport-body-muscle', h.txt('Masse musculaire kg', 'Muscle mass kg'), editor.muscle_mass_kg, '0.1', h)}
          ${bodyInput('sport-body-water', h.txt('Eau corporelle %', 'Body water %'), editor.body_water_pct, '0.1', h)}
          ${bodyInput('sport-body-bone', h.txt('Masse osseuse kg', 'Bone mass kg'), editor.bone_mass_kg, '0.1', h)}
          ${bodyInput('sport-body-visceral', h.txt('Graisse viscerale', 'Visceral fat'), editor.visceral_fat_rating, '0.1', h)}
          ${bodyInput('sport-body-bmr', 'BMR kcal', editor.bmr_kcal, '1', h)}
          ${bodyInput('sport-body-age', h.txt('Age metabolique', 'Metabolic age'), editor.metabolic_age, '1', h)}
          <div class="tb-sport-field" style="grid-column:1/-1;"><label>Notes</label><textarea id="sport-body-notes" rows="3">${h.esc(editor.notes || '')}</textarea></div>
        </div>
        <div class="tb-sport-actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btn" type="button" data-sport-body-close>${h.esc(h.txt('Annuler', 'Cancel'))}</button>
          <button class="btn primary" type="button" id="sport-body-save">${h.esc(h.txt('Enregistrer', 'Save'))}</button>
        </div>
      </div>
    </div>`;
}
