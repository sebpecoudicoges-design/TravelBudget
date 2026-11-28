export function addCurrencySearch(select, language = 'fr') {
  if (!select) return;
  const english = language === 'en';
  const label = document.createElement('label');
  label.className = 'field tb-currency-search';
  label.textContent = english ? 'Search for a currency' : 'Rechercher une devise';
  const search = document.createElement('input');
  search.type = 'search';
  search.autocomplete = 'off';
  search.placeholder = english ? 'Code or name, e.g. AUD' : 'Code ou nom, ex. AUD';
  const status = document.createElement('small');
  status.className = 'muted';
  status.setAttribute('aria-live', 'polite');
  label.append(search, status);
  (select.closest('label') || select).before(label);

  const names = new Intl.DisplayNames([language], { type: 'currency' });
  const normalized = text => String(text).normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  const options = [...select.options];
  let matches = options;
  const filter = () => {
    const value = select.value;
    const term = normalized(search.value);
    const score = option => {
      const code = normalized(option.value);
      const name = normalized(names.of(option.value));
      return code.startsWith(term) ? 0 : name.startsWith(term) ? 1 : (code.includes(term) || name.includes(term)) ? 2 : 3;
    };
    matches = term ? options.filter(option => score(option) < 3).sort((a, b) => score(a) - score(b)) : options;
    const selected = options.find(option => option.value === value);
    select.replaceChildren(...matches, ...(selected && !matches.includes(selected) ? [selected] : []));
    select.value = value;
    status.textContent = term && !matches.length ? (english ? 'No matching currency' : 'Aucune devise trouvée') : '';
  };
  search.addEventListener('input', filter);
  search.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const term = normalized(search.value);
    const match = matches.find(option => normalized(option.value) === term) || (matches.length === 1 ? matches[0] : null);
    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    select.focus();
  });
}
