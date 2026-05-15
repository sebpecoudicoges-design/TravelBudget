export function normalizeTags(value, limit = 12) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function tagKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizedKey(value) {
  return normalizeLookupText(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function docTags(doc) {
  return Array.isArray(doc?.tags) ? doc.tags.map(String).filter(Boolean) : [];
}

export function mergeTags(existing = [], additions = [], limit = 12) {
  const out = [];
  const add = (tag) => {
    const value = String(tag || '').trim();
    const key = tagKey(value);
    if (!key) return;
    if (out.some((x) => tagKey(x) === key)) return;
    out.push(value);
  };

  normalizeTags(existing, limit).forEach(add);
  normalizeTags(additions, limit).forEach(add);
  return out.slice(0, limit);
}

export function allDocumentTags(documents = []) {
  const map = new Map();
  for (const doc of documents || []) {
    for (const tag of docTags(doc)) {
      const key = tagKey(tag);
      if (key && !map.has(key)) map.set(key, tag);
    }
  }
  return Array.from(map.values()).sort((a, b) => String(a).localeCompare(String(b), 'fr'));
}

export function normalizeLookupText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeTagMatchText(value) {
  return normalizeLookupText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanDocBaseName(doc) {
  return String(doc?.name || doc?.original_filename || '')
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTag(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (/[A-Z]{2,}/.test(raw)) return raw;
  return raw.replace(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*/gu, (word) => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

export function suggestEmployerFromPayrollName(doc) {
  const raw = cleanDocBaseName(doc);
  const lookup = normalizeLookupText(raw);
  if (!/(bulletin de paie|fiche de paie|payslip|pay slip|salaire|paie)/.test(lookup)) return '';

  let candidate = raw;
  candidate = candidate.replace(/.*?(bulletin\s+de\s+paie|fiche\s+de\s+paie|payslip|pay\s+slip|salaire|paie)/i, '');
  candidate = candidate.replace(/\b(janvier|fevrier|février|mars|avril|mai|mais|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/ig, ' ');
  candidate = candidate.replace(/\b(19|20)\d{2}\b/g, ' ');
  candidate = candidate.replace(/\b\d{1,2}\b/g, ' ');
  candidate = candidate.replace(/^[\s,.;:()'"]+|[\s,.;:()'"]+$/g, '').replace(/\s+/g, ' ').trim();

  if (candidate.length < 3) return '';
  if (candidate.split(/\s+/).length > 5) return '';
  return titleTag(candidate);
}

export function suggestExistingTagsFromName(doc, knownTags = []) {
  const name = normalizeTagMatchText(`${doc?.name || ''} ${doc?.original_filename || ''}`);
  if (!name) return [];

  return (knownTags || [])
    .filter((tag) => {
      const tagText = normalizeTagMatchText(tag);
      if (!tagText || tagText.length < 2) return false;
      return (` ${name} `).includes(` ${tagText} `);
    })
    .sort((a, b) => {
      const aw = normalizeTagMatchText(a).split(' ').length;
      const bw = normalizeTagMatchText(b).split(' ').length;
      return aw - bw || String(a).localeCompare(String(b), 'fr');
    });
}

export function suggestTagsForDocument(doc, options = {}) {
  const knownTags = options.knownTags || [];
  const name = normalizeLookupText(`${doc?.name || ''} ${doc?.original_filename || ''}`);
  const mime = String(doc?.mime_type || '').toLowerCase();
  const out = [];
  const add = (tag) => {
    const value = String(tag || '').trim();
    const key = tagKey(value);
    if (!key) return;
    if (out.some((x) => tagKey(x) === key)) return;
    if (docTags(doc).some((x) => tagKey(x) === key)) return;
    out.push(value);
  };

  for (const tag of suggestExistingTagsFromName(doc, knownTags)) add(tag);

  const rules = [
    ['Bulletin de Paie', ['bulletin de paie', 'fiche de paie', 'payslip', 'pay slip']],
    ['STC', ['solde de tout compte', 'stc']],
    ['Passeport', ['passeport', 'passport']],
    ['Visa', ['visa', 'eta', 'esta']],
    ['Banque', ['banque', 'bank', 'rib', 'iban', 'releve', 'statement', 'account']],
    ['Assurance', ['assurance', 'insurance', 'attestation']],
    ['Sante', ['sante', 'health', 'medical', 'vaccin', 'ordonnance']],
    ['Transport', ['billet', 'ticket', 'flight', 'vol', 'train', 'bus', 'boarding', 'embarquement']],
    ['Logement', ['hotel', 'booking', 'airbnb', 'reservation', 'bail', 'lease']],
    ['Identite', ['identite', 'identity', 'id-card', 'idcard', 'carte-identite']],
    ['Permis', ['permis', 'licence', 'license', 'driver']],
    ['Impots', ['impot', 'tax', 'fiscal']],
    ['Facture', ['facture', 'invoice', 'receipt', 'recu']],
    ['Contrat', ['contrat', 'contract']],
  ];

  for (const [tag, needles] of rules) {
    if (needles.some((needle) => name.includes(needle))) add(tag);
  }

  add(suggestEmployerFromPayrollName(doc));

  const hasMeaningfulSuggestion = out.length > 0;
  if (!hasMeaningfulSuggestion && (/pdf/i.test(mime) || /\.pdf$/i.test(String(doc?.original_filename || '')))) add('PDF');
  if (!hasMeaningfulSuggestion && /^image\//i.test(mime)) add('Image');

  return out.slice(0, 6);
}

export function rootFolders(folders = []) {
  return (folders || []).filter((folder) => !folder?.parent_id);
}

export function childFolders(folders = [], parentId) {
  return (folders || []).filter((folder) => String(folder?.parent_id || '') === String(parentId || ''));
}

export function folderLabel(folder, folders = []) {
  if (!folder) return 'Non classe';
  const parent = folder.parent_id ? (folders || []).find((f) => String(f.id) === String(folder.parent_id)) : null;
  return parent ? `${parent.name} / ${folder.name}` : folder.name;
}

export function isInvoiceFolder(folder, folders = []) {
  const label = typeof folder === 'string' ? folder : folderLabel(folder, folders);
  return normalizedKey(label).split(' ').includes('factures')
    || normalizedKey(label).split(' ').includes('facture');
}

export function normalizeTagsForFolder(tags = [], folder = null, folders = [], limit = 12) {
  const values = normalizeTags(tags, limit);
  if (!isInvoiceFolder(folder, folders)) return mergeTags(values, [], limit);

  const invoiceAliases = new Set(['facture', 'factures', 'invoice', 'invoices', 'recu', 'recus', 'receipt', 'receipts']);
  const filtered = values.filter((tag) => !invoiceAliases.has(normalizedKey(tag)));
  return mergeTags(filtered, ['Facture'], limit);
}

export function canCreateSubFolder(parentId, folders = []) {
  const parent = parentId ? (folders || []).find((f) => String(f.id) === String(parentId)) : null;
  if (!parentId) return { ok: true };
  if (!parent) return { ok: false, reason: 'Dossier parent introuvable.' };
  if (parent.parent_id) return { ok: false, reason: 'Un seul niveau de sous-dossier est autorise.' };
  return { ok: true, parent };
}

export function filterVisibleDocuments(documents = [], options = {}) {
  let rows = Array.isArray(documents) ? [...documents] : [];

  const folder = options.selectedFolderId;
  if (folder) rows = rows.filter((doc) => String(doc?.folder_id || '') === String(folder));

  const q = String(options.search || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter((doc) => {
      const tags = docTags(doc).join(' ');
      return `${doc?.name || ''} ${doc?.original_filename || ''} ${doc?.mime_type || ''} ${tags}`.toLowerCase().includes(q);
    });
  }

  const tag = String(options.tagFilter || '').trim();
  if (tag) {
    const wanted = tagKey(tag);
    rows = rows.filter((doc) => docTags(doc).some((value) => tagKey(value) === wanted));
  }

  if (options.onlyFavorites) rows = rows.filter((doc) => !!doc?.is_favorite);

  if (options.onlyExpiring) {
    const now = options.now ? new Date(options.now) : new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 60);

    rows = rows.filter((doc) => {
      if (!doc?.expires_at) return false;
      const dt = new Date(doc.expires_at);
      return dt >= now && dt <= limit;
    });
  }

  return rows;
}

export function selectVisibleDocumentIds(currentIds = [], visibleDocuments = []) {
  const ids = new Set((currentIds || []).map(String).filter(Boolean));
  for (const doc of visibleDocuments || []) {
    if (doc?.id) ids.add(String(doc.id));
  }
  return Array.from(ids);
}

export function normalizeCollapsedFolderIds(ids = []) {
  return Array.from(new Set((ids || []).filter((id) => id != null).map(String).filter(Boolean)));
}

export function toggleCollapsedFolderId(ids = [], id) {
  const sid = String(id || '');
  if (!sid) return normalizeCollapsedFolderIds(ids);
  const current = normalizeCollapsedFolderIds(ids);
  return current.includes(sid) ? current.filter((value) => value !== sid) : [...current, sid];
}

export function shareDurationSeconds(value) {
  const duration = String(value || '1h').trim().toLowerCase();
  if (duration === '10m') return 600;
  if (duration === '24h') return 86400;
  return 3600;
}
