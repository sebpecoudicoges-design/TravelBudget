(function () {
  "use strict";

  function fallbackEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  const defaultRelationOptions = [
    ["receipt", "Reçu"],
    ["invoice", "Facture"],
    ["proof", "Justificatif"],
    ["warranty", "Garantie"],
    ["other", "Autre"]
  ];

  function relationOptionsHTML(options, escapeHTML) {
    return options.map(([value, label]) => `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`).join("");
  }

  function renderTripExpenseDocumentsContent({
    links = [],
    availableDocs = [],
    documentName = (doc) => doc?.name || doc?.title || doc?.filename || "Document",
    relationLabel = (type) => type || "Document",
    relationOptions = defaultRelationOptions,
    escapeHTML = fallbackEscape
  }) {
    const safeLinks = Array.isArray(links) ? links : [];
    const safeDocs = Array.isArray(availableDocs) ? availableDocs : [];
    const optionsHTML = relationOptionsHTML(relationOptions, escapeHTML);
    const linkedHTML = safeLinks.length
      ? safeLinks.map((link) => {
        const doc = link?.document;
        if (!doc) return '<div class="card trip-doc-linked-card"><div class="muted">Document supprimé</div></div>';
        return `
          <div class="card trip-doc-linked-card">
            <div class="trip-doc-linked-row">
              <div>
                <strong>${escapeHTML(documentName(doc))}</strong>
                <div class="muted trip-doc-meta">${escapeHTML(relationLabel(link?.relation_type))}</div>
              </div>
              <div class="trip-doc-linked-actions">
                <button class="btn" data-open-trip-doc="${escapeHTML(doc.id)}">Ouvrir</button>
                <button class="btn danger" data-unlink-trip-doc="${escapeHTML(link?.id)}">Délier</button>
              </div>
            </div>
          </div>`;
      }).join("")
      : '<div class="muted">Aucun document lié.</div>';

    return `<div class="tb-trip-documents-content">${linkedHTML}
      <div class="trip-doc-link-panel">
        <h3>Ajouter ou lier un document</h3>
        <div class="trip-doc-link-grid">
          <div>
            <label class="muted trip-doc-label">Document existant</label>
            <input id="trip-doc-search" class="input trip-doc-search" type="search" placeholder="Rechercher un document…" />
            <select id="trip-doc-select" class="input trip-doc-select">
              ${safeDocs.map((doc) => `<option value="${escapeHTML(doc.id)}">${escapeHTML(documentName(doc))}</option>`).join("")}
            </select>
          </div>
          <div class="trip-doc-link-actions">
            <select id="trip-doc-relation" class="input">${optionsHTML}</select>
            <button class="btn primary" type="button" data-trip-doc-link-selected>Lier</button>
          </div>
        </div>
        <div class="trip-doc-upload-row">
          <select id="trip-doc-upload-relation" class="input">${optionsHTML}</select>
          <button class="btn" type="button" data-trip-doc-upload-btn>+ Ajouter un document</button>
          <input id="trip-doc-upload-input" type="file" accept="application/pdf,image/*" hidden />
          <span class="muted trip-doc-note">PDF ou image. Le fichier sera ajouté au coffre Documents puis lié à cette dépense.</span>
        </div>
      </div>
    </div>`;
  }

  window.UI = window.UI || {};
  window.UI.tripDocumentView = {
    renderTripExpenseDocumentsContent
  };
})();
