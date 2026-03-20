// 21_dashboard_drag.js — Wallet reorder only (no dashboard layout changes)
// Goal: allow reordering wallets inside #wallets-container, and persist order locally.
// This script intentionally does NOT move dashboard cards/columns.

(function () {
  function key() {
    try {
      return (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.wallet_order)
        ? TB_CONST.LS_KEYS.wallet_order
        : "travelbudget_wallet_order_v2";
    } catch (_) {
      return "travelbudget_wallet_order_v2";
    }
  }

  function getContainer() {
    return document.getElementById("wallets-container");
  }

  function getWalletEls(container) {
    if (!container) return [];
    // Prefer elements annotated by 12_dashboard_render (data-wallet-id), fallback to .wallet cards.
    const byData = [...container.querySelectorAll("[data-wallet-id]")];
    if (byData.length) return byData;
    const byDataset = [...container.querySelectorAll("[data-walletid]")];
    if (byDataset.length) return byDataset;
    return [...container.querySelectorAll(".wallet")];
  }

  function getElKey(el) {
    return el?.getAttribute?.("data-wallet-id")
      || el?.getAttribute?.("data-walletid")
      || el?.getAttribute?.("data-id")
      || el?.id
      || null;
  }

  function saveOrder(container) {
    const els = getWalletEls(container);
    const order = els
      .map(el => getElKey(el))
      .filter(Boolean);
    try { localStorage.setItem(key(), JSON.stringify(order)); } catch {}
  }

  function restoreOrder(container) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key()) || "null"); } catch {}
    if (!Array.isArray(saved) || saved.length === 0) return;

    const els = getWalletEls(container);
    // Build map by id-like
    const map = new Map();
    for (const el of els) {
      const k = getElKey(el);
      if (k) map.set(k, el);
    }

    for (const k of saved) {
      const el = map.get(k);
      if (el) container.appendChild(el);
    }
  }

  function getAfterElement(container, y) {
    const els = getWalletEls(container).filter(el => !el.classList.contains("dragging"));
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

    for (const child of els) {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset, element: child };
      }
    }
    return closest.element;
  }

  function enable(container) {
    const els = getWalletEls(container);
    if (els.length < 2) return;

    // Make draggable & add handlers
    for (const el of els) {
      el.draggable = true;

      el.addEventListener("dragstart", (e) => {
        const t = e.target;
        // Avoid dragging when interacting with buttons/inputs
        if (t && (t.closest("button") || t.closest("input") || t.closest("select") || t.closest("textarea") || t.closest("a"))) {
          e.preventDefault();
          return;
        }
        el.classList.add("dragging");
      });

      el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        saveOrder(container);
      });
    }

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = container.querySelector(".dragging");
      if (!dragging) return;
      const after = getAfterElement(container, e.clientY);
      if (after == null) container.appendChild(dragging);
      else container.insertBefore(dragging, after);
    });
  }

  // =========================
  // Public helpers expected by dashboard renderer
  // =========================
  window.sortWalletsBySavedOrder = function sortWalletsBySavedOrder(wallets) {
    const arr = Array.isArray(wallets) ? wallets.slice() : [];
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key()) || "null"); } catch {}
    if (!Array.isArray(saved) || !saved.length) return arr;

    const pos = new Map();
    saved.forEach((id, i) => { if (id) pos.set(String(id), i); });
    arr.sort((a, b) => {
      const pa = pos.has(String(a?.id)) ? pos.get(String(a?.id)) : 1e9;
      const pb = pos.has(String(b?.id)) ? pos.get(String(b?.id)) : 1e9;
      return pa - pb;
    });
    return arr;
  };

  window.enableWalletsReorderDrag = function enableWalletsReorderDrag(containerEl) {
    try {
      if (!containerEl) return;
      // Ensure DOM order matches saved order first.
      restoreOrder(containerEl);
      enable(containerEl);
    } catch (_) {}
  };

  // We run on load and also after each refresh/render if available.
  function boot() {
    const c = getContainer();
    if (!c) return;
    // Prefer the explicit list container if present
    const list = c.querySelector("#wallets-list") || c;
    restoreOrder(list);
    enable(list);
  }

  window.addEventListener("load", boot);

  // Optional hook if app calls refresh/render frequently:
  // If your code dispatches a custom event after rendering wallets, we listen.
  window.addEventListener("wallets:rendered", boot);

  // Also hook into tbBus if present (the app uses tb:render:done as a broad render marker).
  try {
    if (window.tbBus && typeof tbBus.on === "function") {
      tbBus.on("render:done", () => { try { boot(); } catch (_) {} });
      tbBus.on("wallets:rendered", () => { try { boot(); } catch (_) {} });
      tbBus.on("data:updated", () => { try { boot(); } catch (_) {} });
    }
  } catch (_) {}
})();
