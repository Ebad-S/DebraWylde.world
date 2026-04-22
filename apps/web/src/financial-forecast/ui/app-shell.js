import {
  createEmptyAssetItem,
  createEmptyBusinessExpenseItem,
  createEmptyLoanItem,
  createEmptyMarketingLine,
  createEmptyPersonalCashFlowItem,
  createEmptySalesLine,
  createEmptySharedCostItem,
  createPersonalCashFlowRow,
  createDefaultInflowRows,
  createDefaultOutflowRows,
  createDefaultSharedCostRows,
  createNewForecastState
} from "../core/schema.js";
import { loadAutosave, clearAutosave, createAutosave } from "./autosave.js";
import { UI_COPY } from "./copy.js";
import { runLenient, runStrict } from "./engine-runner.js";
import { renderSidebar } from "./navigation.js";
import { createStateStore } from "./state-store.js";
import { STEP_DEFINITIONS, getStepByIndex, getNextStepIndex, getPreviousStepIndex } from "./step-router.js";
import { renderResultsStep, renderReviewStep, hydrateDashboardCharts } from "./renderers/dashboard/index.js";
import { renderScenarioTestingStep, hydrateScenarioTestingStep } from "./renderers/scenario-testing/index.js";
import { renderFormStep } from "./renderers/forms/index.js";
import { badge } from "./renderers/shared/components.js";
import { openPrintSummary } from "./export-summary.js";

const root = document.getElementById("forecast-app");

if (!root) {
  throw new Error("Forecast app mount node not found.");
}

const saved = loadAutosave();
const initialState = createNewForecastState();
if (initialState.salesDetails.lines.length === 0) {
  initialState.salesDetails.lines.push(createEmptySalesLine());
}

const store = createStateStore(initialState, 0);
if (saved?.canonical || saved?.data) {
  store.hydrateSavedState(saved);
}
const touchedSteps = new Set((saved?.touchedSteps || []).map((value) => Number(value)).filter((value) => Number.isFinite(value)));
const completedSteps = new Set((saved?.completedSteps || []).map((value) => Number(value)).filter((value) => Number.isFinite(value)));
const manualTaxRatePaths = new Set(saved?.manualTaxRatePaths || []);
const manualMonthlyUnitPaths = new Set(saved?.manualMonthlyUnitPaths || []);
const autosave = createAutosave(
  store,
  800,
  window.localStorage,
  () => ({
    touchedSteps: [...touchedSteps],
    completedSteps: [...completedSteps],
    manualTaxRatePaths: [...manualTaxRatePaths],
    manualMonthlyUnitPaths: [...manualMonthlyUnitPaths],
    mainScrollTop: refs.main?.scrollTop ?? 0,
    activeSubpanelScrollTop: root.querySelector(".ff-subpanel")?.scrollTop ?? 0,
    lastStableStep: store.getState().currentStep,
    lastStableScrollY: window.scrollY
  })
);

let lenientTimer = null;
let lastSnapshot = store.getState();
const refs = {};

function ensureStructures(canonical) {
  ["year1", "year2", "year3"].forEach((yearKey) => {
    const year = canonical.years[yearKey];
    if (!year.marketing || typeof year.marketing !== "object") year.marketing = {};
    if (!Array.isArray(year.marketing.lineItems)) year.marketing.lineItems = [];
    // Back-compat: older scenarios stored a single marketing line without
    // id/label/isActive. Upgrade them in place rather than silently migrating
    // to a guessed category.
    year.marketing.lineItems = year.marketing.lineItems.map((m) => ({
      id: m.id || `mktg_${Math.random().toString(36).slice(2, 10)}`,
      label: m.label || "",
      monthlyAmount: Number(m.monthlyAmount || 0),
      startMonth: Number(m.startMonth || 1),
      endMonth: Number(m.endMonth || 12),
      isActive: m.isActive === false ? false : true
    }));
    if (!year.businessExpenses || typeof year.businessExpenses !== "object") {
      year.businessExpenses = { lineItems: [] };
    }
    if (!Array.isArray(year.businessExpenses.lineItems)) year.businessExpenses.lineItems = [];
    if (!year.assumptions || typeof year.assumptions !== "object") year.assumptions = {};
    if (year.assumptions.superannuationPct == null) year.assumptions.superannuationPct = 0;
    if (year.assumptions.payrollTaxPct == null) year.assumptions.payrollTaxPct = 0;
  });
  if (!canonical.collectionsPolicy.collectionSplitByMonthBucket) {
    canonical.collectionsPolicy.collectionSplitByMonthBucket = [0.7, 0.2, 0.1];
  }
  // Migrate legacy personalCashFlow.items -> sharedCosts, and ensure default inflow/outflow rows exist.
  if (!canonical.personalCashFlow || typeof canonical.personalCashFlow !== "object") {
    canonical.personalCashFlow = {};
  }
  const pcf = canonical.personalCashFlow;
  if (pcf.openingBalance == null) pcf.openingBalance = 0;
  if (pcf.year1Only == null) pcf.year1Only = true;
  const refreshCanonicalLabels = (rows, defaults) => {
    const byId = new Map(defaults.map((d) => [d.id, d]));
    rows.forEach((r) => {
      const canonical = byId.get(r.id);
      if (canonical) {
        r.label = canonical.label;
        r.custom = false;
      }
    });
  };
  if (!Array.isArray(pcf.inflows) || pcf.inflows.length === 0) {
    pcf.inflows = createDefaultInflowRows();
  } else {
    const seen = new Set(pcf.inflows.map((r) => r.id));
    createDefaultInflowRows().forEach((def) => {
      if (!seen.has(def.id)) pcf.inflows.push(def);
    });
    refreshCanonicalLabels(pcf.inflows, createDefaultInflowRows());
  }
  if (!Array.isArray(pcf.outflows) || pcf.outflows.length === 0) {
    pcf.outflows = createDefaultOutflowRows();
  } else {
    const seen = new Set(pcf.outflows.map((r) => r.id));
    createDefaultOutflowRows().forEach((def) => {
      if (!seen.has(def.id)) pcf.outflows.push(def);
    });
    refreshCanonicalLabels(pcf.outflows, createDefaultOutflowRows());
  }
  if (!Array.isArray(pcf.sharedCosts)) pcf.sharedCosts = [];
  // Legacy `items` migration: map each item to a custom shared cost if not already present.
  if (Array.isArray(pcf.items) && pcf.items.length > 0 && pcf.sharedCosts.length === 0) {
    pcf.sharedCosts = pcf.items.map((it) => ({
      id: it.id || `shared_${Math.random().toString(36).slice(2, 10)}`,
      name: it.name || "",
      amount: Number(it.amount || 0),
      frequency: it.frequency || "monthly",
      personalUsePercent: Number(it.personalUsePercent ?? 100),
      custom: true
    }));
    delete pcf.items;
  }
  if (pcf.sharedCosts.length === 0) {
    pcf.sharedCosts = createDefaultSharedCostRows();
  }
}

function preserveScroll(run) {
  const prevX = window.scrollX;
  const prevY = window.scrollY;
  run();
  window.scrollTo(prevX, prevY);
}

function stepFromFieldPath(fieldPath = "") {
  if (fieldPath.startsWith("setup.") || fieldPath.startsWith("meta.")) return "setup";
  if (fieldPath.startsWith("salesDetails.")) return "sales-details";
  if (fieldPath.startsWith("collectionsPolicy.")) return "collections";
  if (fieldPath.startsWith("years.year1.")) return "year-1";
  if (fieldPath.startsWith("years.year2.")) return "year-2";
  if (fieldPath.startsWith("years.year3.")) return "year-3";
  if (fieldPath.startsWith("assets.") || fieldPath.startsWith("loans.")) return "assets-loans";
  if (fieldPath.startsWith("personalCashFlow.")) return "personal-cash-flow";
  return "review";
}

function stepIndexFromFieldPath(fieldPath = "") {
  const stepId = stepFromFieldPath(fieldPath);
  return Math.max(0, STEP_DEFINITIONS.findIndex((step) => step.id === stepId));
}

function stepMeetsCompletionThreshold(stepId, snapshot) {
  if (stepId === "intro") return Boolean(snapshot.data.setup.businessName?.trim());
  if (stepId === "setup") return snapshot.data.setup.openingCash >= 0 && Boolean(snapshot.data.setup.reportBasis);
  if (stepId === "sales-details") {
    return snapshot.data.salesDetails.lines.some((line) => line.name && Number(line.unitPrice) > 0);
  }
  if (stepId === "collections") {
    return (snapshot.data.collectionsPolicy.collectionSplitByMonthBucket || []).length > 0;
  }
  if (stepId === "year-1") return snapshot.data.years.year1.assumptions.taxRatePct >= 0;
  if (stepId === "year-2") return snapshot.data.years.year2.assumptions.taxRatePct >= 0;
  if (stepId === "year-3") return snapshot.data.years.year3.assumptions.taxRatePct >= 0;
  if (stepId === "assets-loans") return true;
  if (stepId === "personal") return true;
  if (stepId === "personal-cash-flow") return true;
  if (stepId === "review") return true;
  if (stepId === "results") return true;
  if (stepId === "scenario-testing") return true;
  return false;
}

function updateCompletionForStep(stepIndex) {
  const snapshot = store.getState();
  const stepId = STEP_DEFINITIONS[stepIndex]?.id;
  if (!stepId) return;
  const isCompleted = stepMeetsCompletionThreshold(stepId, snapshot);
  if (isCompleted) {
    completedSteps.add(stepIndex);
  } else {
    completedSteps.delete(stepIndex);
  }
}

function applyDerivedRevenueFields(path, snapshot) {
  const priceMatch = path.match(/^salesDetails\.lines\.(\d+)\.unitPrice$/);
  const cogsMatch = path.match(/^salesDetails\.lines\.(\d+)\.costOfGoodsSold$/);
  const defaultUnitsMatch = path.match(/^salesDetails\.lines\.(\d+)\.defaultUnitsPerPeriod$/);
  const monthlyUnitsMatch = path.match(/^salesDetails\.lines\.(\d+)\.uiMonthlyUnitsByMonth\.(\d+)$/);
  const affectedLine = priceMatch?.[1] ?? cogsMatch?.[1] ?? defaultUnitsMatch?.[1] ?? monthlyUnitsMatch?.[1];
  if (affectedLine == null) return;
  const lineIndex = Number(affectedLine);

  store.mutateCanonical((canonical) => {
    const line = canonical.salesDetails.lines[lineIndex];
    if (!line) return;
    const unitPrice = Number(line.unitPrice || 0);
    const cogsValue = line.costOfGoodsSold;
    const hasCogs = cogsValue != null && cogsValue !== "";
    const cogs = Number(cogsValue || 0);
    if (unitPrice > 0 && hasCogs) {
      line.grossMarginPercent = Number((((unitPrice - cogs) / unitPrice) * 100).toFixed(2));
    } else {
      line.grossMarginPercent = "";
    }

    if (defaultUnitsMatch) {
      const defaultUnits = Number(line.defaultUnitsPerPeriod || 0);
      line.uiMonthlyUnitsByMonth = Array.from({ length: 12 }, (_, monthIndex) => {
        const keyPath = `salesDetails.lines.${lineIndex}.uiMonthlyUnitsByMonth.${monthIndex}`;
        const existing = line.uiMonthlyUnitsByMonth?.[monthIndex];
        if (manualMonthlyUnitPaths.has(keyPath) && existing != null) return existing;
        return defaultUnits;
      });
      line.seasonalityByMonth = line.uiMonthlyUnitsByMonth.map((units) =>
        defaultUnits > 0 ? Number(units || 0) / defaultUnits : 0
      );
      console.debug("[ff] prefill monthly units from default", { lineIndex, defaultUnits });
    }

    if (monthlyUnitsMatch) {
      const monthIndex = Number(monthlyUnitsMatch[2]);
      const defaultUnits = Number(line.defaultUnitsPerPeriod || 0);
      const units = Number(line.uiMonthlyUnitsByMonth?.[monthIndex] || 0);
      if (!Array.isArray(line.seasonalityByMonth) || line.seasonalityByMonth.length !== 12) {
        line.seasonalityByMonth = Array(12).fill(1);
      }
      line.seasonalityByMonth[monthIndex] = defaultUnits > 0 ? units / defaultUnits : 0;
    }
  });

  const refreshed = store.getState();
  const margin = refreshed.data.salesDetails.lines[lineIndex]?.grossMarginPercent ?? "";
  const marginInput = root.querySelector(`[data-path="salesDetails.lines.${lineIndex}.grossMarginPercent"]`);
  if (marginInput) {
    marginInput.value = margin === "" ? "" : Number(margin).toFixed(2);
  }
  if (defaultUnitsMatch) {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthPath = `salesDetails.lines.${lineIndex}.uiMonthlyUnitsByMonth.${monthIndex}`;
      const monthInput = root.querySelector(`[data-path="${monthPath}"]`);
      if (monthInput && !manualMonthlyUnitPaths.has(monthPath)) {
        monthInput.value = Number(refreshed.data.salesDetails.lines[lineIndex]?.uiMonthlyUnitsByMonth?.[monthIndex] || 0);
      }
    }
  }
  if (priceMatch || cogsMatch) {
    console.debug("[ff] gross margin recalculated", { lineIndex, margin });
  }
}

function applyTaxPrefill(snapshot) {
  const trading = snapshot.data.setup.tradingStructure;
  const mapped = trading === "company" ? 25 : trading === "sole_trader" ? 10 : null;
  if (mapped == null) return;
  store.mutateCanonical((canonical) => {
    ["year1", "year2", "year3"].forEach((yearKey) => {
      const path = `years.${yearKey}.assumptions.taxRatePct`;
      const current = canonical.years[yearKey].assumptions.taxRatePct;
      if (!manualTaxRatePaths.has(path) || current == null || current === "") {
        canonical.years[yearKey].assumptions.taxRatePct = mapped;
      }
    });
  });
  console.debug("[ff] tax prefill fired", { tradingStructure: trading, mappedTaxRate: mapped });
  ["year1", "year2", "year3"].forEach((yearKey) => {
    const path = `years.${yearKey}.assumptions.taxRatePct`;
    const input = root.querySelector(`[data-path="${path}"]`);
    if (input && !manualTaxRatePaths.has(path)) {
      input.value = String(mapped);
    }
  });
}

function evaluateStepStatus(snapshot) {
  const map = Object.fromEntries(STEP_DEFINITIONS.map((step) => [step.id, { warningCount: 0, blockingCount: 0, complete: false }]));
  const validation = snapshot.meta.engine.lenient?.validation;
  const warnings = snapshot.meta.engine.lenient?.warnings || [];

  if (validation) {
    validation.errors.forEach((issue) => {
      const step = stepFromFieldPath(issue.fieldPath);
      map[step].blockingCount += issue.blocking ? 1 : 0;
    });
  }
  warnings.forEach((warning) => {
    const step = stepFromFieldPath(warning.fieldPath);
    map[step].warningCount += 1;
  });

  STEP_DEFINITIONS.forEach((step) => {
    map[step.id].complete = stepMeetsCompletionThreshold(step.id, snapshot);
  });
  map.review.complete = !map.review.blockingCount;
  map.results.complete = !map.review.blockingCount;

  STEP_DEFINITIONS.forEach((step, index) => {
    const isVisited = snapshot.visitedSteps.includes(index);
    const hasTouched = touchedSteps.has(index);
    const leftStep = snapshot.currentStep !== index;
    const isPersistedComplete = completedSteps.has(index);
    if (!isVisited || !hasTouched || !leftStep || !isPersistedComplete) {
      map[step.id].complete = false;
    }
    if (isPersistedComplete && !stepMeetsCompletionThreshold(step.id, snapshot)) {
      completedSteps.delete(index);
      map[step.id].complete = false;
    }
  });
  return map;
}

function renderShell() {
  root.innerHTML = `
    <div class="ff-layout">
      <div data-region="sidebar"></div>
      <div class="ff-main">
        <div class="ff-top">
          <div>
            <h1>${UI_COPY.appTitle}</h1>
            <p>${UI_COPY.appSubtitle}</p>
          </div>
          <div class="ff-top__meta" data-region="top-meta"></div>
          <div class="ff-actions-inline ff-top-actions">
            <button class="btn btn--outline" data-action="run-strict">${UI_COPY.actions.runStrict}</button>
            <button class="btn btn--outline" data-action="reset-session">${UI_COPY.actions.reset}</button>
          </div>
        </div>
        <section class="ff-step-view">
          <header class="ff-step-header">
            <h2 data-region="step-title"></h2>
            <div class="ff-actions-inline">
              <button class="btn btn--outline" data-action="prev-step">Previous</button>
              <button class="btn btn--outline" data-action="next-step">Next</button>
            </div>
          </header>
          <div data-region="step-content"></div>
          <div data-region="review-actions"></div>
        </section>
      </div>
    </div>
  `;
  refs.sidebar = root.querySelector('[data-region="sidebar"]');
  refs.main = root.querySelector(".ff-main");
  refs.topMeta = root.querySelector('[data-region="top-meta"]');
  refs.stepTitle = root.querySelector('[data-region="step-title"]');
  refs.stepContent = root.querySelector('[data-region="step-content"]');
  refs.reviewActions = root.querySelector('[data-region="review-actions"]');
}

function renderMeta(snapshot) {
  const modeBadge = snapshot.meta.engine.running
    ? badge("info", "Updating Preview...")
    : badge("ok", UI_COPY.lenientModeLabel);
  refs.topMeta.innerHTML = `${modeBadge}`;
}

function renderSidebarRegion(snapshot, stepStatusMap) {
  refs.sidebar.innerHTML = renderSidebar(snapshot.currentStep, stepStatusMap, snapshot.data.setup.businessName?.trim());
}

function renderStepContent(snapshot, stepStatusMap, preserve = true) {
  const currentStep = getStepByIndex(snapshot.currentStep);
  const renderFn = () => {
    refs.stepTitle.textContent = currentStep.title;
    refs.reviewActions.innerHTML = "";
    if (currentStep.id === "review") {
      refs.stepContent.innerHTML = renderReviewStep(
        {
          engine: snapshot.meta.engine,
          canonical: snapshot.data
        },
        stepStatusMap
      );
      refs.reviewActions.innerHTML = `<div class="ff-bottom-actions"><button class="btn btn--primary" data-action="run-strict">${UI_COPY.actions.runStrict}</button></div>`;
    } else if (currentStep.id === "results") {
      refs.stepContent.innerHTML = renderResultsStep({
        engine: snapshot.meta.engine,
        canonical: snapshot.data
      });
      hydrateDashboardCharts(root, { engine: snapshot.meta.engine, canonical: snapshot.data });
    } else if (currentStep.id === "scenario-testing") {
      refs.stepContent.innerHTML = renderScenarioTestingStep({
        engine: snapshot.meta.engine,
        canonical: snapshot.data
      });
      hydrateScenarioTestingStep(root);
    } else {
      refs.stepContent.innerHTML = renderFormStep(currentStep.id, snapshot.data);
    }
  };
  if (preserve) {
    preserveScroll(renderFn);
  } else {
    renderFn();
  }
}

function refreshLayout({ rerenderStep = false, preserve = true } = {}) {
  const snapshot = store.getState();
  const stepStatusMap = evaluateStepStatus(snapshot);
  renderMeta(snapshot);
  renderSidebarRegion(snapshot, stepStatusMap);

  if (rerenderStep || snapshot.currentStep !== lastSnapshot.currentStep) {
    renderStepContent(snapshot, stepStatusMap, preserve);
  }
  lastSnapshot = snapshot;
}

function parseInputValue(target) {
  const type = target.dataset.type || target.type;
  if (type === "boolean" || target.type === "checkbox") return Boolean(target.checked);
  if (target.type === "number") return target.value === "" ? "" : Number(target.value);
  return target.value;
}

function runLenientDebounced() {
  if (lenientTimer) window.clearTimeout(lenientTimer);
  lenientTimer = window.setTimeout(() => {
    store.setEngineRunning(true);
    refreshLayout();
    const next = store.getState();
    const result = runLenient(next.data);
    store.setEngineResult("lenient", result);
    store.setEngineRunning(false);
    refreshLayout();
  }, 250);
}

function runStrictNow() {
  const snapshot = store.getState();
  const result = runStrict(snapshot.data);
  store.setEngineResult("strict", result);
  refreshLayout({ rerenderStep: true });
}

function setImportStatus(message, tone = "info") {
  const status = root.querySelector('[data-region="import-json-status"]');
  if (!status) return;
  status.textContent = message;
  status.style.color = tone === "error" ? "#ff9e7b" : tone === "ok" ? "#a5d99f" : "";
}

function isLikelyForecastCanonical(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.meta || typeof payload.meta !== "object") return false;
  if (!payload.setup || typeof payload.setup !== "object") return false;
  if (!payload.years || typeof payload.years !== "object") return false;
  return true;
}

function hydrateFromParsedJson(parsed, sourceLabel) {
  const payload = parsed?.data && isLikelyForecastCanonical(parsed.data)
    ? parsed
    : isLikelyForecastCanonical(parsed?.canonical)
      ? { data: parsed.canonical, savedAt: parsed.savedAt, currentStep: parsed.currentStep, visitedSteps: parsed.visitedSteps }
      : isLikelyForecastCanonical(parsed)
        ? { data: parsed }
        : null;
  if (!payload) {
    setImportStatus(`${sourceLabel} does not look like a forecast scenario.`, "error");
    return false;
  }
  store.hydrateSavedState(payload);
  store.mutateCanonical((canonical) => ensureStructures(canonical));
  const fresh = runLenient(store.getState().data);
  store.setEngineResult("lenient", fresh);
  touchedSteps.clear();
  completedSteps.clear();
  STEP_DEFINITIONS.forEach((_, index) => updateCompletionForStep(index));
  autosave.flushSave();
  refreshLayout({ rerenderStep: true, preserve: false });
  setImportStatus(`Imported "${sourceLabel}". Ready to continue.`, "ok");
  return true;
}

function importJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => setImportStatus("Could not read the selected file.", "error");
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const parsed = JSON.parse(text);
      hydrateFromParsedJson(parsed, file.name);
    } catch (err) {
      console.warn("[ff] json import failed", err);
      setImportStatus("That file is not valid JSON.", "error");
    }
  };
  reader.readAsText(file);
}

function saveCanonicalJsonFile() {
  const snapshot = store.getState();
  const canonical = snapshot.data;
  const payload = {
    data: canonical,
    savedAt: new Date().toISOString(),
    currentStep: snapshot.currentStep,
    visitedSteps: snapshot.visitedSteps,
    schemaVersion: canonical?.meta?.schemaVersion || "2.1.0"
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (canonical?.setup?.businessName || "forecast")
    .toString()
    .trim()
    .replace(/[^a-z0-9-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "forecast";
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${safeName}_${stamp}.forecast.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

root.addEventListener("input", (event) => {
  const target = event.target;
  const path = target?.dataset?.path;
  if (!path) return;
  touchedSteps.add(stepIndexFromFieldPath(path));
  if (target.dataset.taxRate === "1") {
    manualTaxRatePaths.add(path);
  }
  if (target.dataset.monthlyUnits === "1") {
    manualMonthlyUnitPaths.add(path);
  }
  store.updateField(path, parseInputValue(target));
  applyDerivedRevenueFields(path, store.getState());
  if (path === "setup.tradingStructure") {
    applyTaxPrefill(store.getState());
  }
  runLenientDebounced();
  refreshLayout();
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (target?.dataset?.region === "import-json-input") {
    const file = target.files && target.files[0];
    if (file) {
      setImportStatus(`Reading "${file.name}"...`);
      importJsonFile(file);
    }
    target.value = "";
    return;
  }
  const path = target?.dataset?.path;
  if (!path) return;
  store.updateField(path, parseInputValue(target));
  if (path === "setup.tradingStructure") {
    applyTaxPrefill(store.getState());
  }
  refreshLayout();
});

root.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!target?.dataset?.path) return;
  console.debug("[ff] blur save request", { currentStep: store.getState().currentStep });
  autosave.scheduleSave();
});

root.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const action = trigger.dataset.action;

  if (action === "go-step") {
    touchedSteps.add(store.getState().currentStep);
    updateCompletionForStep(store.getState().currentStep);
    console.debug("[ff] navigation helper fired", { action: "go-step", from: store.getState().currentStep, to: Number(trigger.dataset.stepIndex) });
    store.setStep(trigger.dataset.stepIndex);
    autosave.flushSave();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "next-step") {
    const current = store.getState().currentStep;
    touchedSteps.add(current);
    updateCompletionForStep(current);
    console.debug("[ff] navigation helper fired", { action: "next-step", from: current, to: getNextStepIndex(current) });
    store.setStep(getNextStepIndex(current));
    autosave.flushSave();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "prev-step") {
    const current = store.getState().currentStep;
    touchedSteps.add(current);
    updateCompletionForStep(current);
    console.debug("[ff] navigation helper fired", { action: "prev-step", from: current, to: getPreviousStepIndex(current) });
    store.setStep(getPreviousStepIndex(current));
    autosave.flushSave();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }

  if (action === "add-sales-line") {
    touchedSteps.add(store.getState().currentStep);
    store.mutateCanonical((canonical) => canonical.salesDetails.lines.push(createEmptySalesLine()));
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-sales-line") {
    touchedSteps.add(store.getState().currentStep);
    const index = Number(trigger.dataset.index);
    store.mutateCanonical((canonical) => {
      canonical.salesDetails.lines.splice(index, 1);
      if (canonical.salesDetails.lines.length === 0) {
        canonical.salesDetails.lines.push(createEmptySalesLine());
      }
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "add-asset") {
    touchedSteps.add(store.getState().currentStep);
    store.mutateCanonical((canonical) => canonical.assets.items.push(createEmptyAssetItem()));
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-asset") {
    touchedSteps.add(store.getState().currentStep);
    const index = Number(trigger.dataset.index);
    store.mutateCanonical((canonical) => canonical.assets.items.splice(index, 1));
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "add-business-expense") {
    touchedSteps.add(store.getState().currentStep);
    const yearKey = trigger.dataset.yearKey;
    if (!yearKey) return;
    store.mutateCanonical((canonical) => {
      const year = canonical.years[yearKey];
      if (!year.businessExpenses) year.businessExpenses = { lineItems: [] };
      if (!Array.isArray(year.businessExpenses.lineItems)) year.businessExpenses.lineItems = [];
      year.businessExpenses.lineItems.push(createEmptyBusinessExpenseItem());
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-business-expense") {
    touchedSteps.add(store.getState().currentStep);
    const yearKey = trigger.dataset.yearKey;
    const index = Number(trigger.dataset.index);
    if (!yearKey || !Number.isFinite(index)) return;
    store.mutateCanonical((canonical) => {
      const list = canonical.years[yearKey]?.businessExpenses?.lineItems;
      if (Array.isArray(list)) list.splice(index, 1);
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "add-marketing-line") {
    touchedSteps.add(store.getState().currentStep);
    const yearKey = trigger.dataset.yearKey;
    if (!yearKey) return;
    store.mutateCanonical((canonical) => {
      const year = canonical.years[yearKey];
      if (!year.marketing) year.marketing = { lineItems: [] };
      if (!Array.isArray(year.marketing.lineItems)) year.marketing.lineItems = [];
      year.marketing.lineItems.push(createEmptyMarketingLine());
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-marketing-line") {
    touchedSteps.add(store.getState().currentStep);
    const yearKey = trigger.dataset.yearKey;
    const index = Number(trigger.dataset.index);
    if (!yearKey || !Number.isFinite(index)) return;
    store.mutateCanonical((canonical) => {
      const list = canonical.years[yearKey]?.marketing?.lineItems;
      if (Array.isArray(list)) list.splice(index, 1);
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "add-loan") {
    touchedSteps.add(store.getState().currentStep);
    store.mutateCanonical((canonical) => canonical.loans.items.push(createEmptyLoanItem()));
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-loan") {
    touchedSteps.add(store.getState().currentStep);
    const index = Number(trigger.dataset.index);
    store.mutateCanonical((canonical) => canonical.loans.items.splice(index, 1));
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "add-personal-item") {
    touchedSteps.add(store.getState().currentStep);
    store.mutateCanonical((canonical) => {
      if (!Array.isArray(canonical.personalCashFlow.items)) canonical.personalCashFlow.items = [];
      canonical.personalCashFlow.items.push(createEmptyPersonalCashFlowItem());
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-personal-item") {
    touchedSteps.add(store.getState().currentStep);
    const index = Number(trigger.dataset.index);
    store.mutateCanonical((canonical) => {
      if (Array.isArray(canonical.personalCashFlow.items)) canonical.personalCashFlow.items.splice(index, 1);
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "add-pcf-inflow" || action === "add-pcf-outflow") {
    touchedSteps.add(store.getState().currentStep);
    const listKey = action === "add-pcf-inflow" ? "inflows" : "outflows";
    store.mutateCanonical((canonical) => {
      if (!Array.isArray(canonical.personalCashFlow[listKey])) canonical.personalCashFlow[listKey] = [];
      canonical.personalCashFlow[listKey].push(createPersonalCashFlowRow({ label: "", custom: true }));
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-pcf-inflow" || action === "remove-pcf-outflow") {
    touchedSteps.add(store.getState().currentStep);
    const listKey = action === "remove-pcf-inflow" ? "inflows" : "outflows";
    const rowId = trigger.dataset.rowId;
    store.mutateCanonical((canonical) => {
      const list = canonical.personalCashFlow[listKey];
      if (!Array.isArray(list)) return;
      const idx = list.findIndex((row) => row.id === rowId && row.custom);
      if (idx >= 0) list.splice(idx, 1);
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "add-pcf-shared-cost") {
    touchedSteps.add(store.getState().currentStep);
    store.mutateCanonical((canonical) => {
      if (!Array.isArray(canonical.personalCashFlow.sharedCosts)) canonical.personalCashFlow.sharedCosts = [];
      canonical.personalCashFlow.sharedCosts.push(createEmptySharedCostItem({ custom: true }));
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "remove-pcf-shared-cost") {
    touchedSteps.add(store.getState().currentStep);
    const rowId = trigger.dataset.rowId;
    store.mutateCanonical((canonical) => {
      const list = canonical.personalCashFlow.sharedCosts;
      if (!Array.isArray(list)) return;
      const idx = list.findIndex((row) => row.id === rowId && row.custom);
      if (idx >= 0) list.splice(idx, 1);
    });
    runLenientDebounced();
    refreshLayout({ rerenderStep: true, preserve: true });
    return;
  }
  if (action === "run-strict") {
    runStrictNow();
    return;
  }
  if (action === "print-summary") {
    openPrintSummary({
      engine: store.getState().meta.engine,
      canonical: store.getState().data
    });
    return;
  }
  if (action === "import-json-file") {
    const fileInput = root.querySelector('[data-region="import-json-input"]');
    if (fileInput) fileInput.click();
    return;
  }
  if (action === "save-json-file") {
    saveCanonicalJsonFile();
    return;
  }
  if (action === "reset-session") {
    clearAutosave();
    window.location.reload();
  }
});

store.mutateCanonical((canonical) => ensureStructures(canonical));
applyTaxPrefill(store.getState());
STEP_DEFINITIONS.forEach((_, index) => updateCompletionForStep(index));
const firstResult = runLenient(store.getState().data);
store.setEngineResult("lenient", firstResult);
renderShell();
refreshLayout({ rerenderStep: true, preserve: false });

if (saved?.scrollX != null || saved?.scrollY != null) {
  window.setTimeout(() => {
    window.scrollTo(Number(saved.scrollX || 0), Number(saved.scrollY || 0));
    if (refs.main && saved.mainScrollTop != null) {
      refs.main.scrollTop = Number(saved.mainScrollTop || 0);
    }
    const subpanel = root.querySelector(".ff-subpanel");
    if (subpanel && saved.activeSubpanelScrollTop != null) {
      subpanel.scrollTop = Number(saved.activeSubpanelScrollTop || 0);
    }
  }, 0);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    console.debug("[ff] visibility hidden", { currentStep: store.getState().currentStep, scrollY: window.scrollY });
  } else {
    console.debug("[ff] visibility visible restore", { currentStep: store.getState().currentStep, scrollY: window.scrollY });
  }
});

window.addEventListener("focus", () => {
  console.debug("[ff] focus return", { currentStep: store.getState().currentStep, scrollY: window.scrollY });
});
