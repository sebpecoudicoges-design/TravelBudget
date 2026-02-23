// TB_DOCTOR (dev helper)
// Run in console: TB_DOCTOR()
window.TB_DOCTOR = function TB_DOCTOR() {
  // Requirements can be "one of" several function names.
  const requiredFnGroups = [
    ["renderAll"],
    ["renderSettings"],
    ["refreshFromServer"],
    ["recomputeAllocations"],
    ["fxConvert"],
    // segments helpers (name changed across versions)
    ["getSegmentForDate", "getBudgetSegmentForDate", "getBudgetSegmentForISODate"],
    // settings panels
    ["renderBudgetSegmentsUI"],
    ["renderCategoriesUI", "renderCategoriesSettingsUI"],
  ];

  const missingFnGroups = requiredFnGroups
    .filter((alts) => !alts.some((n) => typeof window[n] === "function"))
    .map((alts) => alts.join(" | "));

  // DOM checks: hard requirements only for panels we own.
  const requiredDom = ["seg-list", "cat-list"];
  const missingDom = requiredDom.filter((id) => !document.getElementById(id));

  // Soft nav check: look for tabs by text if IDs differ.
  const navLabels = ["Dashboard", "Transactions", "Settings", "Trip", "Membres"];
  const navFound = navLabels.map((lab) => {
    const el = Array.from(document.querySelectorAll("button, a")).find((x) =>
      (x.textContent || "").trim().toLowerCase() === lab.toLowerCase()
    );
    return Boolean(el);
  });
  const missingNavLabels = navLabels.filter((_, i) => !navFound[i]);

  const report = {
    ok: missingFnGroups.length === 0 && missingDom.length === 0,
    missingFns: missingFnGroups,
    missingDom,
    missingNavLabels, // informational only
    at: new Date().toISOString(),
  };

  console.log("[TB_DOCTOR]", report);
  if (!report.ok) {
    try {
      alert(
        "TB_DOCTOR: éléments manquants.\n\n" +
          (missingFnGroups.length ? "Fonctions: " + missingFnGroups.join(", ") + "\n" : "") +
          (missingDom.length ? "DOM: " + missingDom.join(", ") + "\n" : "")
      );
    } catch (_) {}
  }
  return report;
};
