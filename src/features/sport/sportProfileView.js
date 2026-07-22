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
    force: h.txt('Score composite des grands mouvements : squat, souleve de terre, developpes, tractions et core.', 'Composite score from main lifts: squat, deadlift, presses, pull-ups and core.'),
    endurance: h.txt('Score construit depuis gainage, volume musculaire, regularite et condition continue.', 'Built from core holds, muscular volume, consistency and sustained conditioning.'),
    explosive: h.txt('Score issu des efforts rapides : corde, boxe, HIIT, sprints ou mouvements explosifs quand disponibles.', 'Built from fast efforts: jump rope, boxing, HIIT, sprints or explosive lifts when available.'),
    mobility: h.txt('Axe volontairement bas tant que les tests simples de mobilite ne sont pas saisis.', 'Intentionally low until simple mobility tests are recorded.'),
  };
  return map[axis] || '';
}

function renderAthleticProfile(profile, h) {
  if (!profile) return '';
  const insights = profile.insights || [];
  const warnings = profile.warnings || [];
  const archetypes = profile.archetypes || [];
  const metrics = profile.keyMetrics || [];
  const balances = profile.balances || [];
  const bar = (value) => `${Math.max(4, Math.min(99, h.n(value, 0)))}%`;
  return `<div class="tb-sport-athletic">
    <div class="tb-sport-athletic-head">
      <div>
        <strong>${h.esc(h.txt('Ton profil automatique', 'Your automatic profile'))}</strong>
        <small>${h.esc(h.txt('Performance brute, ratios poids du corps, equilibres et potentiel detecte.', 'Raw performance, bodyweight ratios, balance and detected potential.'))}</small>
      </div>
      <div class="tb-sport-athletic-priority">${h.esc(h.txt('Priorite', 'Priority'))}: ${h.esc(profile.priority || '-')}</div>
    </div>
    <div class="tb-sport-athletic-grid">
      <div class="tb-sport-athletic-panel">
        <b>${h.esc(h.txt('Forces detectees', 'Detected strengths'))}</b>
        ${insights.length ? insights.map((row) => `<span class="ok">OK ${h.esc(row)}</span>`).join('') : `<span>${h.esc(h.txt('Encore trop peu de donnees fiables.', 'Still too little reliable data.'))}</span>`}
      </div>
      <div class="tb-sport-athletic-panel">
        <b>${h.esc(h.txt('Points a surveiller', 'Watch points'))}</b>
        ${warnings.map((row) => `<span class="warn">! ${h.esc(row)}</span>`).join('')}
      </div>
    </div>
    <div class="tb-sport-athletic-metrics">
      ${metrics.map((row) => `<div><span>${h.esc(row.label)}</span><strong>${h.esc(row.value)}</strong><small>${h.esc(row.detail || '')}</small></div>`).join('') || `<div><span>${h.esc(h.txt('Ratios', 'Ratios'))}</span><strong>-</strong><small>${h.esc(h.txt('Ajoute des charges dans les series', 'Add loads in sets'))}</small></div>`}
    </div>
    <div class="tb-sport-athletic-balance">
      ${balances.map((row) => `<div><span>${h.esc(row.label)}</span><strong>${h.esc(row.text)}</strong></div>`).join('')}
    </div>
    <div class="tb-sport-archetypes">
      ${archetypes.map((row) => `<div><span>${h.esc(row.label)}</span><b><i style="width:${bar(row.value)}"></i></b><em>${h.n(row.value, 0)}</em></div>`).join('')}
    </div>
  </div>`;
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
  const athleticProfile = data.athleticProfile || null;
  const loads = (data.bestLoads || []).length
    ? data.bestLoads.map((row) => `<span class="tb-sport-chip">${h.esc(row.name)} ${Math.round(h.n(row.estimate, 0))} kg e1RM</span>`).join('')
    : `<span class="tb-sport-chip">${h.esc(h.txt('Charges a renseigner dans les series', 'Enter loads in sets'))}</span>`;
  return `<div class="tb-sport-profile-grid">
      <div class="tb-sport-card tb-sport-radar-card">
        <div class="tb-sport-card-head">
          <div>
            <h3>${h.esc(h.txt('Profil forces / faiblesses', 'Strengths / weaknesses profile'))}</h3>
            <div class="muted">${h.esc(h.txt('Profil athletique sur 28 jours : percentiles, ratios PDC, equilibres et potentiel.', '28-day athletic profile: percentiles, BW ratios, balance and potential.'))}</div>
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
            <small>${h.esc(h.txt('Lecture en percentiles : 50 intermediaire, 70 confirme, 85 avance, 95 tres avance, 99 elite naturel. Repere de suivi, pas diagnostic.', 'Percentile reading: 50 intermediate, 70 confirmed, 85 advanced, 95 very advanced, 99 natural elite. Tracking guidance, not a diagnosis.'))}</small>
            <div class="tb-sport-radar-bars">
              ${axes.map((axis) => `<div title="${h.esc(`${axisBasis(axis.key, h)} ${axis.basis || ''}`)}"><span>${h.esc(axis.label)} - ${h.esc(axis.raw)}${axis.basis ? ` - ${h.esc(axis.basis)}` : ''}</span><b style="width:${Math.max(6, Math.min(99, h.n(axis.value, 0)))}%"></b><em>P${h.n(axis.value, 0)}</em></div>`).join('')}
            </div>
          </div>
        </div>
        ${renderAthleticProfile(athleticProfile, h)}
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

function progressionLabel(value = '') {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function renderExerciseProgressionAnalysis({ analysis = {}, selectedExercise = '', api = {} } = {}) {
  const h = helpers(api);
  const rows = Array.isArray(analysis.exercises) ? analysis.exercises : [];
  const options = Array.isArray(analysis.options) && analysis.options.length
    ? analysis.options
    : rows.map((row) => ({ key: row.key, label: row.label }));
  const selected = String(selectedExercise || analysis.selectedExercise || '');
  const visible = selected ? rows.filter((row) => String(row.key) === selected) : rows.slice(0, 6);
  const maxValue = Math.max(1, ...visible.flatMap((row) => (row.rows || []).map((point) => h.n(point.estimated_1rm_kg, 0))));
  const sparkline = (points = []) => {
    const clean = points.slice(-12);
    if (!clean.length) return '';
    return clean.map((point, idx) => {
      const height = Math.max(6, Math.round((h.n(point.estimated_1rm_kg, 0) / maxValue) * 54));
      return `<i title="${h.esc(`${point.date} - ${h.n(point.estimated_1rm_kg, 0)} kg e1RM`)}" style="height:${height}px" data-idx="${idx}"></i>`;
    }).join('');
  };
  return `<div class="tb-sport-card tb-sport-progress-card">
    <div class="tb-sport-card-head">
      <div>
        <h3>${h.esc(h.txt('Analyse progression charges', 'Load progression analysis'))}</h3>
        <div class="muted">${h.esc(h.txt('e1RM estime par date, calcule avec Epley depuis les series chargees. Priorite aux gros mouvements.', 'Estimated e1RM by date, calculated with Epley from loaded sets. Main lifts first.'))}</div>
      </div>
      <div class="tb-sport-progress-filter">
        <label>${h.esc(h.txt('Exercice', 'Exercise'))}</label>
        <select id="sport-progress-exercise">
          <option value="">${h.esc(h.txt('Priorite gros lifts', 'Main lifts first'))}</option>
          ${options.map((row) => `<option value="${h.esc(row.key)}" ${selected === String(row.key) ? 'selected' : ''}>${h.esc(progressionLabel(row.label))}</option>`).join('')}
        </select>
      </div>
    </div>
    ${visible.length ? `<div class="tb-sport-progress-list">
      ${visible.map((row) => {
        const last = row.last || {};
        const best = row.best || {};
        const positive = h.n(row.delta, 0) >= 0;
        return `<article class="tb-sport-progress-row">
          <div class="tb-sport-progress-main">
            <strong>${h.esc(progressionLabel(row.label))}</strong>
            <span>${h.esc(h.txt('Dernier', 'Latest'))}: ${h.n(last.estimated_1rm_kg, 0)} kg · ${h.esc(h.txt('Meilleur', 'Best'))}: ${h.n(best.estimated_1rm_kg, 0)} kg</span>
            <small>${h.esc((row.rows || []).length)} ${h.esc(h.txt('point(s)', 'point(s)'))} · ${h.esc(firstLastDate(row))}</small>
          </div>
          <div class="tb-sport-progress-bars">${sparkline(row.rows || [])}</div>
          <div class="tb-sport-progress-delta ${positive ? 'up' : 'down'}">${positive ? '+' : ''}${h.n(row.delta, 0)} kg<br><small>${positive ? '+' : ''}${h.n(row.deltaPct, 0)}%</small></div>
        </article>`;
      }).join('')}
    </div>` : `<div class="tb-sport-empty">${h.esc(h.txt('Pas encore assez de series chargees pour tracer une progression.', 'Not enough loaded sets yet to chart progression.'))}</div>`}
  </div>`;
}

function firstLastDate(row = {}) {
  const first = row.first?.date || '';
  const last = row.last?.date || '';
  return first && last && first !== last ? `${first} -> ${last}` : (last || first || '');
}

function bodyInput(id, label, value, step, h) {
  return `<div class="tb-sport-field"><label>${h.esc(label)}</label><input id="${id}" type="number" step="${h.esc(step || '0.1')}" value="${h.esc(value ?? '')}"></div>`;
}

export function bodyMeasurementQuality(input = {}, api = {}) {
  const h = helpers(api);
  const time = String(input.measurement_time || input.measurementTime || 'morning');
  let score = 0;
  if (time === 'morning') score += 25;
  else if (time === 'after_breakfast') score += 12;
  else if (time === 'after_sport') score -= 5;
  else if (time === 'evening') score += 0;
  ['after_toilet', 'before_food', 'before_drink', 'before_activity', 'same_scale', 'hard_flat_floor', 'dry_feet'].forEach((key) => {
    if (input[key] === true || input[key] === 'on') score += key === 'same_scale' || key === 'hard_flat_floor' ? 10 : 9;
  });
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 88
    ? h.txt('Reference', 'Reference')
    : score >= 65
      ? h.txt('Moyenne', 'Average')
      : score >= 40
        ? h.txt('Faible', 'Low')
        : h.txt('Tres faible', 'Very low');
  return { score, label };
}

export function renderBodyMeasurementModal({ editor = null, api = {} } = {}) {
  if (!editor) return '';
  const h = helpers(api);
  const quality = bodyMeasurementQuality(editor, api);
  const timeOptions = [
    ['morning', h.txt('Matin au reveil', 'Morning on waking')],
    ['after_breakfast', h.txt('Matin apres petit-dejeuner', 'Morning after breakfast')],
    ['after_sport', h.txt('Apres sport', 'After sport')],
    ['evening', h.txt('Soir apres diner', 'Evening after dinner')],
  ];
  const check = (key) => editor[key] !== false ? 'checked' : '';
  return `<div class="tb-sport-modal-backdrop tb-sport-body-modal-backdrop" role="dialog" aria-modal="true">
      <div class="tb-sport-modal tb-sport-body-modal">
        <h3>${h.esc(h.txt('Mesure impedancemetre', 'Body composition measurement'))}</h3>
        <div class="muted">${h.esc(h.txt('Saisie datee, enregistree en SQL si connecte, sinon gardee localement. 1 mesure par jour maximum.', 'Dated entry, saved in SQL when online, otherwise kept locally. One measurement per day max.'))}</div>
        <div class="tb-sport-body-quality">
          <strong>${h.esc(h.txt('Qualite mesure', 'Measurement quality'))}: ${h.esc(quality.label)}</strong>
          <span>${quality.score}/100 · ${h.esc(h.txt('Reference = reveil, toilettes, avant boire/manger/sport, meme balance, sol dur, pieds secs.', 'Reference = waking, toilet, before drinking/eating/sport, same scale, hard floor, dry feet.'))}</span>
        </div>
        <div class="tb-sport-fields" style="margin-top:12px;">
          <div class="tb-sport-field"><label>${h.esc(h.txt('Date', 'Date'))}</label><input id="sport-body-date" type="date" value="${h.esc(editor.measured_on || h.todayISO())}"></div>
          <div class="tb-sport-field"><label>${h.esc(h.txt('Moment', 'Timing'))}</label><select id="sport-body-time">${timeOptions.map(([value, label]) => `<option value="${h.esc(value)}" ${String(editor.measurement_time || 'morning') === value ? 'selected' : ''}>${h.esc(label)}</option>`).join('')}</select></div>
          ${bodyInput('sport-body-weight', h.txt('Poids kg', 'Weight kg'), editor.weight_kg, '0.1', h)}
          ${bodyInput('sport-body-bmi', 'IMC', editor.bmi, '0.1', h)}
          ${bodyInput('sport-body-fat', h.txt('Masse grasse %', 'Body fat %'), editor.body_fat_pct, '0.1', h)}
          ${bodyInput('sport-body-fat-mass', h.txt('Masse graisseuse kg', 'Fat mass kg'), editor.fat_mass_kg, '0.1', h)}
          ${bodyInput('sport-body-muscle', h.txt('Masse musculaire kg', 'Muscle mass kg'), editor.muscle_mass_kg, '0.1', h)}
          ${bodyInput('sport-body-lean', h.txt('Masse maigre kg', 'Lean mass kg'), editor.lean_mass_kg, '0.1', h)}
          ${bodyInput('sport-body-water', h.txt('Eau corporelle %', 'Body water %'), editor.body_water_pct, '0.1', h)}
          ${bodyInput('sport-body-water-kg', h.txt('Eau corporelle kg', 'Body water kg'), editor.body_water_kg, '0.1', h)}
          ${bodyInput('sport-body-bone', h.txt('Masse osseuse kg', 'Bone mass kg'), editor.bone_mass_kg, '0.1', h)}
          ${bodyInput('sport-body-visceral', h.txt('Graisse viscerale', 'Visceral fat'), editor.visceral_fat_rating, '0.1', h)}
          ${bodyInput('sport-body-bmr', 'BMR kcal', editor.bmr_kcal, '1', h)}
          ${bodyInput('sport-body-age', h.txt('Age metabolique', 'Metabolic age'), editor.metabolic_age, '1', h)}
          ${bodyInput('sport-body-protein-pct', h.txt('Proteines %', 'Protein %'), editor.protein_pct, '0.1', h)}
          ${bodyInput('sport-body-protein-mass', h.txt('Masse proteique kg', 'Protein mass kg'), editor.protein_mass_kg, '0.1', h)}
          ${bodyInput('sport-body-subfat', h.txt('Graisse sous-cutanee %', 'Subcutaneous fat %'), editor.subcutaneous_fat_pct, '0.1', h)}
          ${bodyInput('sport-body-ideal-weight', h.txt('Poids ideal kg', 'Ideal weight kg'), editor.ideal_weight_kg, '0.1', h)}
          <div class="tb-sport-field"><label>${h.esc(h.txt('Body Type', 'Body Type'))}</label><input id="sport-body-type" type="text" value="${h.esc(editor.body_type || '')}"></div>
          <div class="tb-sport-protocol" style="grid-column:1/-1;">
            ${[
              ['after_toilet', h.txt('Apres toilettes', 'After toilet')],
              ['before_food', h.txt('Avant manger', 'Before eating')],
              ['before_drink', h.txt('Avant boire', 'Before drinking')],
              ['before_activity', h.txt('Avant activite physique', 'Before activity')],
              ['same_scale', h.txt('Meme balance', 'Same scale')],
              ['hard_flat_floor', h.txt('Sol dur et plat', 'Hard flat floor')],
              ['dry_feet', h.txt('Pieds secs', 'Dry feet')],
            ].map(([key, label]) => `<label><input id="sport-body-${h.esc(key.replace(/_/g, '-'))}" type="checkbox" ${check(key)}> ${h.esc(label)}</label>`).join('')}
          </div>
          <div class="tb-sport-field" style="grid-column:1/-1;"><label>Notes</label><textarea id="sport-body-notes" rows="3">${h.esc(editor.notes || '')}</textarea></div>
        </div>
        <div class="tb-sport-actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btn" type="button" data-sport-body-close>${h.esc(h.txt('Annuler', 'Cancel'))}</button>
          <button class="btn primary" type="button" id="sport-body-save">${h.esc(h.txt('Enregistrer', 'Save'))}</button>
        </div>
      </div>
    </div>`;
}
