// Isolated review UI, never imported by a production entry point.
const copy = {
  fr: {
    title: 'Comparer les versions du repas', local: 'Saisie sur cet appareil', remote: 'Version synchronisée',
    choice: 'Que veux-tu garder ?', keep: 'Laisser ma saisie en attente', accept: 'Garder la version synchronisée',
    deletedTitle: 'Repas supprimé', deleted: 'Le repas synchronisé a été supprimé. Ta saisie est conservée sur cet appareil et n’a pas été renvoyée.',
    caution: 'Ce choix retire uniquement cette saisie de cet appareil.',
    submit: 'Confirmer le choix', refresh: 'Actualiser la comparaison',
    pending: 'Ta saisie reste en attente.', done: 'Version synchronisée gardée. Saisie locale retirée.',
    stale: 'La saisie locale ou le compte a changé. Rien n’a été retiré.',
    changed: 'Le repas synchronisé a changé. Actualise la comparaison avant de choisir.',
    error: 'Impossible de vérifier les versions. Aucun retrait confirmé.',
    nutrients: ['Protéines', 'Glucides', 'Lipides', 'Fibres'],
    types: { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Collation', meal: 'Repas' },
    notes: 'Notes', noItems: 'Aucun aliment', water: 'Eau', loading: 'Chargement des versions…',
  },
  en: {
    title: 'Compare meal versions', local: 'Draft on this device', remote: 'Synced version',
    choice: 'Which version do you want to keep?', keep: 'Leave my draft pending', accept: 'Keep the synced version',
    deletedTitle: 'Meal deleted', deleted: 'The synced meal was deleted. Your draft is still on this device and has not been resubmitted.',
    caution: 'This choice removes only this draft from this device.',
    submit: 'Confirm choice', refresh: 'Refresh comparison',
    pending: 'Your draft stays pending.', done: 'Synced version kept. Local draft removed.',
    stale: 'The local draft or account changed. Nothing was removed.',
    changed: 'The synced meal changed. Refresh the comparison before choosing.',
    error: 'Could not verify the versions. No removal was confirmed.',
    nutrients: ['Protein', 'Carbs', 'Fat', 'Fibre'],
    types: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', meal: 'Meal' },
    notes: 'Notes', noItems: 'No foods', water: 'Water', loading: 'Loading versions…',
  },
};

export async function mountMealConflictReview(host, { locale = 'fr', load, resolve }) {
  const language = locale === 'en' ? 'en' : 'fr';
  const t = copy[language];
  const count = new Intl.NumberFormat(language, { maximumFractionDigits: 6 });
  const doc = host.ownerDocument;
  const node = (tag, text) => {
    const element = doc.createElement(tag);
    if (text != null) element.textContent = text;
    return element;
  };
  host.lang = language;
  const title = node('h1', t.title);
  title.tabIndex = -1;
  const versions = node('div');
  versions.className = 'conflict-versions';
  const status = node('p');
  status.setAttribute('role', 'status');
  status.tabIndex = -1;
  const form = node('form');
  const choices = node('fieldset');
  choices.append(node('legend', t.choice));
  const radios = ['keep-pending', 'accept-remote'].map((value, index) => {
    const label = node('label');
    const radio = node('input');
    Object.assign(radio, { type: 'radio', name: 'meal-conflict-choice', value });
    label.append(radio, doc.createTextNode(' ' + [t.keep, t.accept][index]));
    choices.append(label);
    return radio;
  });
  const submit = node('button', t.submit);
  submit.type = 'submit';
  const refresh = node('button', t.refresh);
  refresh.type = 'button';
  refresh.hidden = true;
  form.append(choices, node('p', t.caution), submit);
  host.replaceChildren(title, versions, form, refresh, status);

  function render(label, snapshot) {
    if (!snapshot?.header || !Array.isArray(snapshot.items)) throw new Error('Unavailable meal review');
    const section = node('section');
    const { header, items } = snapshot;
    const type = Object.hasOwn(t.types, header.meal_type) ? t.types[header.meal_type] : '';
    const visible = [header.label, type, header.meal_date, header.consumed_time].filter(Boolean).join(' · ');
    section.append(node('h2', label), node('p', visible), node('p', t.water + ': ' + count.format(header.water_ml ?? 0) + ' mL'));
    if (header.notes) section.append(node('p', t.notes + ': ' + header.notes));
    if (!items.length) section.append(node('p', t.noItems));
    else {
      const list = node('ul');
      for (const item of items) {
        const amount = item.grams == null ? '' : ' · ' + count.format(item.grams) + ' g';
        const energy = item.kcal == null ? '' : ' · ' + count.format(item.kcal) + ' kcal';
        const macros = ['protein_g', 'carbs_g', 'fat_g', 'fiber_g'].flatMap((field, index) =>
          item[field] == null ? [] : [t.nutrients[index] + ': ' + count.format(item[field]) + ' g']);
        list.append(node('li', (item.label || item.food_key || '…') + amount + energy
          + (macros.length ? ' · ' + macros.join(' · ') : '')));
      }
      section.append(list);
    }
    return section;
  }

  let preview;
  let busy = false;
  async function reload({ focus = false } = {}) {
    if (busy) return;
    busy = true;
    preview = null;
    title.textContent = t.title;
    form.hidden = true;
    refresh.hidden = true;
    versions.replaceChildren();
    status.textContent = t.loading;
    try {
      const result = await load();
      // Only a matching local record explicitly marked by the audit replay
      // may use this view. Missing remote data alone is not proof of deletion.
      if (result?.entry?.status === 'deleted-conflict') {
        versions.replaceChildren(render(t.local, result.entry.snapshot));
        title.textContent = t.deletedTitle;
        status.textContent = t.deleted;
        if (focus) title.focus();
        return;
      }
      if (!result?.preview) throw new Error('Unavailable meal review');
      versions.replaceChildren(render(t.local, result.local), render(t.remote, result.remote));
      preview = result.preview;
      radios[0].checked = true;
      form.hidden = false;
      status.textContent = '';
      if (focus) title.focus();
    } catch {
      status.textContent = t.error;
      refresh.hidden = false;
      if (focus) status.focus();
    } finally {
      busy = false;
    }
  }
  refresh.addEventListener('click', () => { void reload({ focus: true }); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !preview) return;
    const choice = radios[1].checked ? 'accept-remote' : 'keep-pending';
    busy = true;
    choices.disabled = true;
    submit.disabled = true;
    try {
      const outcome = await resolve(preview, choice);
      const message = new Map([
        ['pending', t.pending], ['accepted-remote', t.done],
        ['refresh-preview', t.changed], ['stale-local', t.stale],
      ]).get(outcome);
      if (!message) throw new Error('Unconfirmed meal outcome');
      status.textContent = message;
      if (outcome !== 'pending') form.hidden = true;
      if (outcome === 'refresh-preview' || outcome === 'stale-local') refresh.hidden = false;
    } catch {
      form.hidden = true;
      refresh.hidden = false;
      status.textContent = t.error;
    } finally {
      choices.disabled = false;
      submit.disabled = false;
      busy = false;
      status.focus();
    }
  });
  await reload();
}
