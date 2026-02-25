/* =========================
   TB Doctor (V6.5)
   - Runtime diagnostics for schema, RLS and frontend wiring
   - Exposes window.__doctorReport
   - Debug panel available when ?debug=1
   ========================= */
(function () {
  const DEFAULT_TABLE_CHECKS = [
    // [tableKey, columnsToProbe]
    ["settings", ["user_id"]],
    ["periods", ["id","user_id","start_date","end_date"]],
    ["wallets", ["id","user_id","period_id","currency"]],
    ["transactions", ["id","user_id","wallet_id","amount","currency","type","date_start"]],
    ["budget_segments", ["id","user_id","period_id","start_date","end_date"]],
    ["categories", ["id","user_id","name"]],
    ["trip_groups", ["id","user_id"]],
    ["trip_participants", ["trip_id","user_id"]],
  ];

  function classify(err) {
    const status = err?.status || err?.statusCode;
    const code = err?.code;
    if (status === 404) return "missing_table_or_route";
    if (status === 403) return "rls_forbidden";
    if (status === 401) return "unauthenticated";
    if (status === 406) return "not_acceptable";
    if (status === 400 && String(err?.message || "").toLowerCase().includes("column")) return "missing_column";
    if (code === "42P01") return "missing_table_or_route";
    if (code === "42703") return "missing_column";
    return "unknown";
  }

  async function probeTable(tableKey, cols) {
    const table = TB_CONST?.TABLES?.[tableKey] || tableKey;
    const sel = (cols && cols.length) ? cols.join(",") : "*";
    try {
      const { data, error } = await sb.from(table).select(sel).limit(1);
      if (error) throw error;
      return { ok: true, table, select: sel, sample: Array.isArray(data) ? data[0] : data };
    } catch (e) {
      return {
        ok: false,
        table,
        select: sel,
        error: __errorBus?.toPlain ? __errorBus.toPlain(e) : { message: String(e) },
        class: classify(e),
      };
    }
  }

  async function runDoctor() {
    const startedAt = new Date().toISOString();

    const report = {
      startedAt,
      url: location.href,
      user: sbUser ? { id: sbUser.id, email: sbUser.email } : null,
      checks: [],
      notes: [],
    };

    // Basic wiring checks
    const requiredFns = ["renderAll","renderSettings","refreshFromServer","recomputeAllocations","fxConvert"];
    requiredFns.forEach((fn) => {
      report.checks.push({
        type: "fn",
        name: fn,
        ok: (typeof window[fn] === "function"),
      });
    });

    // Schema / RLS checks
    if (!window.sb) {
      report.notes.push("Supabase client (sb) not found on window.");
    } else {
      for (const [tableKey, cols] of DEFAULT_TABLE_CHECKS) {
        // eslint-disable-next-line no-await-in-loop
        const r = await probeTable(tableKey, cols);
        report.checks.push({ type: "table", key: tableKey, ...r });
      }
    }

    // Capture
    window.__doctorReport = report;
    return report;
  }

  function shouldShowDebugPanel() {
    try {
      const qs = new URLSearchParams(location.search || "");
      return qs.get("debug") === "1" || localStorage.getItem(TB_CONST?.LS_KEYS?.debug || "travelbudget_debug_v1") === "1";
    } catch (_) {
      return false;
    }
  }

  function renderDebugPanel() {
    if (!shouldShowDebugPanel()) return;
    const root = document.createElement("div");
    root.id = "tb-debug-panel";
    root.style.position = "fixed";
    root.style.right = "12px";
    root.style.bottom = "12px";
    root.style.zIndex = "99999";
    root.style.width = "360px";
    root.style.maxHeight = "60vh";
    root.style.overflow = "auto";
    root.style.padding = "12px";
    root.style.borderRadius = "16px";
    root.style.background = "rgba(0,0,0,0.78)";
    root.style.color = "white";
    root.style.fontSize = "12px";
    root.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

    root.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div style="font-weight:700;">Doctor</div>
        <div style="display:flex; gap:8px;">
          <button id="tb-debug-run" style="padding:6px 10px; border-radius:10px; border:0; cursor:pointer;">Run</button>
          <button id="tb-debug-copy" style="padding:6px 10px; border-radius:10px; border:0; cursor:pointer;">Copy</button>
          <button id="tb-debug-close" style="padding:6px 10px; border-radius:10px; border:0; cursor:pointer;">×</button>
        </div>
      </div>
      <div id="tb-debug-body" style="margin-top:10px; white-space:pre-wrap;"></div>
    `;
    document.body.appendChild(root);

    const body = root.querySelector("#tb-debug-body");

    function refreshView(report) {
      if (!body) return;
      body.textContent = JSON.stringify(report || window.__doctorReport || {}, null, 2);
    }

    root.querySelector("#tb-debug-close").onclick = () => root.remove();
    root.querySelector("#tb-debug-run").onclick = async () => {
      body.textContent = "Running…";
      const r = await runDoctor();
      refreshView(r);
    };
    root.querySelector("#tb-debug-copy").onclick = async () => {
      const payload = JSON.stringify({ doctor: window.__doctorReport || null, errors: __errorBus?.get ? __errorBus.get() : [] }, null, 2);
      const ok = __errorBus?.copyToClipboard ? await __errorBus.copyToClipboard(payload) : false;
      root.querySelector("#tb-debug-copy").textContent = ok ? "Copied ✅" : "Copy failed";
      setTimeout(() => (root.querySelector("#tb-debug-copy").textContent = "Copy"), 1200);
    };

    // auto-run once
    runDoctor().then(refreshView).catch((e) => {
      body.textContent = "Doctor failed: " + (e?.message || e);
    });
  }

  window.TB_DOCTOR = runDoctor;

  // render panel after DOM is ready-ish
  setTimeout(renderDebugPanel, 400);
})();
