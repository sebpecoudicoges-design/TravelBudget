/* =========================
   UI Error Helpers (V6.5)
   - safeCall(): protect critical renders so one broken block doesn't break the page
   - renderErrorBox(): visible section-level error card with copy logs
   ========================= */
(function () {
  function _slug(s) {
    return String(s || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function renderErrorBox(section, err, containerId) {
    try {
      const sec = String(section || "Section");
      const id = "tb-errorbox-" + _slug(sec);
      const existing = document.getElementById(id);
      if (existing) existing.remove();

      const box = document.createElement("div");
      box.id = id;
      box.className = "card";
      box.style.border = "1px solid #ff6b6b";
      box.style.background = "rgba(255, 107, 107, 0.08)";
      box.style.padding = "12px";
      box.style.marginTop = "10px";

      const plain = (window.__errorBus && window.__errorBus.toPlain) ? window.__errorBus.toPlain(err) : { message: String(err) };

      box.innerHTML = `
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:700; margin-bottom:6px;">Erreur de rendu — ${sec}</div>
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px; white-space:pre-wrap;">${escapeHTML(plain.message || "Erreur inconnue")}</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" id="${id}-copy">Copier logs</button>
            <button class="btn" id="${id}-close">Fermer</button>
          </div>
        </div>
      `;

      const target = containerId ? document.getElementById(containerId) : null;
      const parent = target || document.body;
      parent.appendChild(box);

      const btnCopy = document.getElementById(id + "-copy");
      if (btnCopy) {
        btnCopy.onclick = async () => {
          const report = {
            section: sec,
            error: plain,
            doctor: window.__doctorReport || null,
            errors: (window.__errorBus && window.__errorBus.get) ? window.__errorBus.get() : [],
            ts: new Date().toISOString(),
            url: location.href,
          };
          const ok = window.__errorBus && window.__errorBus.copyToClipboard
            ? await window.__errorBus.copyToClipboard(JSON.stringify(report, null, 2))
            : false;
          btnCopy.textContent = ok ? "Copié ✅" : "Copie impossible";
          setTimeout(() => (btnCopy.textContent = "Copier logs"), 1200);
        };
      }

      const btnClose = document.getElementById(id + "-close");
      if (btnClose) btnClose.onclick = () => box.remove();
    } catch (e) {
      console.warn("[renderErrorBox] failed", e);
    }
  }

  function safeCall(section, fn, opts) {
    try {
      const out = fn();
      if (out && typeof out.then === "function") {
        return out.catch((err) => {
          console.error("[safeCall/async]", section, err);
          if (window.__errorBus && window.__errorBus.push) {
            window.__errorBus.push({ type: "render_async", section: String(section), error: window.__errorBus.toPlain(err) });
          }
          renderErrorBox(section, err, opts && opts.containerId);
          throw err;
        });
      }
      return out;
    } catch (err) {
      console.error("[safeCall]", section, err);
      if (window.__errorBus && window.__errorBus.push) {
        window.__errorBus.push({ type: "render", section: String(section), error: window.__errorBus.toPlain(err) });
      }
      renderErrorBox(section, err, opts && opts.containerId);
      return null;
    }
  }

  window.renderErrorBox = renderErrorBox;
  window.safeCall = safeCall;
})();
