// 21_dashboard_drag.js — Wallet reorder only (no dashboard layout changes)
// Goal: allow reordering wallets inside #wallets-container, and persist order locally.
// This script intentionally does NOT move dashboard cards/columns.

(function () {
  const KEY = "walletOrder_v2";

  function getContainer() {
    return document.getElementById("wallets-container");
  }

  function getWalletEls(container) {
    // Prefer elements annotated by 12_dashboard_render (data-wallet-id), fallback to .wallet cards.
    const byData = [...container.querySelectorAll("[data-wallet-id]")];
    if (byData.length) return byData;
    return [...container.querySelectorAll(".wallet")];
  }

  function saveOrder(container) {
    const els = getWalletEls(container);
    const order = els
      .map(el => el.getAttribute("data-wallet-id") || el.getAttribute("data-id") || el.id || null)
      .filter(Boolean);
    try { localStorage.setItem(KEY, JSON.stringify(order)); } catch {}
  }

  function restoreOrder(container) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
    if (!Array.isArray(saved) || saved.length === 0) return;

    const els = getWalletEls(container);
    // Build map by id-like
    const map = new Map();
    for (const el of els) {
      const k = el.getAttribute("data-wallet-id") || el.getAttribute("data-id") || el.id;
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

  // We run on load and also after each refresh/render if available.
  function boot() {
    const c = getContainer();
    if (!c) return;
    restoreOrder(c);
    enable(c);
  }

  window.addEventListener("load", boot);

  // Optional hook if app calls refresh/render frequently:
  // If your code dispatches a custom event after rendering wallets, we listen.
  window.addEventListener("wallets:rendered", boot);
})();
