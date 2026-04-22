import { panel, statCard } from "../shared/components.js";
import { formatMoney, formatPercent, escapeHtml } from "../shared/format.js";
import { computePersonalDecisionMetrics } from "../../../core/engine/personal-cash-flow.js";

const CALENDAR_FALLBACK = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatRunway(months) {
  if (months == null) return "No depletion";
  return `${months} month${months === 1 ? "" : "s"}`;
}

function formatRequired(monthly) {
  if (monthly <= 0) return "None needed";
  return `${formatMoney(monthly)}/mo`;
}

function formatMinClosing(min, worstIdx, calendarLabels) {
  const label = worstIdx >= 0 && calendarLabels[worstIdx] ? ` (${calendarLabels[worstIdx]})` : "";
  return `${formatMoney(min)}${label}`;
}

function renderStressOutput(base, stressed, reducePct, increasePct) {
  const baseMin = Number(base.risk.minClosingBalance || 0);
  const baseMinIdx = base.closingMonthly.findIndex((v) => Number(v) === baseMin);
  const stressMin = Number(stressed.risk.minClosingBalance || 0);
  const stressMinIdx = stressed.closingMonthly.findIndex((v) => Number(v) === stressMin);

  const row = (label, baseVal, stressVal, delta) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${baseVal}</td>
      <td>${stressVal}</td>
      <td class="ff-pcf-stress-delta">${delta || ""}</td>
    </tr>
  `;

  const baseRequiredMonthly = Number(base.decision.requiredDrawingsMonthlyUplift || 0);
  const stressRequiredMonthly = Number(stressed.decision.requiredDrawingsMonthlyUplift || 0);
  const requiredDelta = stressRequiredMonthly - baseRequiredMonthly;

  return `
    <h5 class="ff-pcf-group-title">Stressed Decision View</h5>
    <p class="ff-helper">
      Applying: drawings &minus;${reducePct}% and outflows +${increasePct}%. Canonical
      data is unchanged; base column reflects the saved scenario.
    </p>
    <div class="ff-table-wrap">
      <table class="ff-table ff-pcf-stress-table">
        <thead>
          <tr><th>Metric</th><th>Base Case</th><th>Stressed</th><th>Change</th></tr>
        </thead>
        <tbody>
          ${row(
            "Worst Month (Min Closing)",
            formatMinClosing(baseMin, baseMinIdx, base.calendarLabels),
            formatMinClosing(stressMin, stressMinIdx, base.calendarLabels),
            formatMoney(stressMin - baseMin)
          )}
          ${row(
            "Runway (months)",
            formatRunway(base.decision.runwayMonths),
            formatRunway(stressed.decision.runwayMonths),
            ""
          )}
          ${row(
            "Months Below Zero",
            String(base.risk.monthsBelowZero || 0),
            String(stressed.risk.monthsBelowZero || 0),
            ""
          )}
          ${row(
            "Required Drawings To Stay Solvent",
            formatRequired(baseRequiredMonthly),
            formatRequired(stressRequiredMonthly),
            requiredDelta === 0 ? "" : `${requiredDelta > 0 ? "+" : ""}${formatMoney(requiredDelta)}/mo`
          )}
        </tbody>
      </table>
    </div>
  `;
}

function insufficientStatePanel(reason) {
  return `
    <section class="ff-panel">
      <h2>Scenario Testing</h2>
      <p class="ff-helper">${escapeHtml(reason)}</p>
      <p class="ff-helper">
        Complete the earlier steps (especially <em>Personal Cash Flow</em>) and return here to
        pressure-test your plan without changing any saved inputs.
      </p>
    </section>
  `;
}

export function renderScenarioTestingStep(snapshot) {
  const result = snapshot.engine?.strict?.status === "ok" ? snapshot.engine.strict : snapshot.engine?.lenient;
  if (!result) {
    return insufficientStatePanel("No preview results are available yet. Review your inputs to generate a live preview first.");
  }

  const raw = result.raw || {};
  const derived = result.derived || {};
  const pcf = raw.personalCashFlow;
  const summary = derived.summaryCards || {};
  const lowestCash = Math.min(...(raw.cashFlow?.closingCashMonthly || [0]));

  const baselineKpis = [
    statCard("Total Revenue", formatMoney(summary.totalRevenue || 0)),
    statCard("Total Net Profit After Tax", formatMoney(summary.totalNetProfitAfterTax || 0)),
    statCard("Final Closing Cash", formatMoney(summary.finalClosingCash || 0)),
    statCard("Lowest Cash Point", formatMoney(lowestCash)),
    statCard("Warnings", String((result.warnings || []).length))
  ].join("");

  // --- Phase 4.3.3: 3-year PCF baseline summary --------------------------
  // Show a compact per-year snapshot so the scenario-testing baseline is
  // consistent with the 3-year Personal Cash Flow view on the Results
  // Dashboard. The stress test below remains Year-1-focused by design; the
  // exact "required drawings uplift" solver is a Year 1 closed-form.
  const pcfPerYear = raw.personalCashFlow?.perYear || {};
  const perYearSnapshotRow = (label, yk) => {
    const s = pcfPerYear[yk]?.summary || {};
    return `
      <tr>
        <th>${label}</th>
        <td>${formatMoney(pcfPerYear[yk]?.openingBalance || 0)}</td>
        <td>${formatMoney(s.closingEndOfYear || 0)}</td>
        <td>${formatMoney(s.minClosingBalance || 0)}</td>
        <td>${String(s.monthsBelowZero || 0)}</td>
      </tr>
    `;
  };
  const perYearTable = raw.personalCashFlow ? `
    <div class="ff-table-wrap">
      <table class="ff-table">
        <thead>
          <tr>
            <th>Personal Cash Flow</th>
            <th>Opening</th>
            <th>Closing (Dec)</th>
            <th>Worst Month</th>
            <th>Months Below Zero</th>
          </tr>
        </thead>
        <tbody>
          ${perYearSnapshotRow("Year 1", "year1")}
          ${perYearSnapshotRow("Year 2", "year2")}
          ${perYearSnapshotRow("Year 3", "year3")}
        </tbody>
      </table>
    </div>
  ` : "";

  const baselinePanel = panel(
    "Baseline Scenario Summary",
    `
      <p class="ff-helper">These are the headline numbers from your current inputs. Use the Personal Cash Flow stress test below to see how sensitive your plan is to everyday downside pressure. The stress test is Year-1 focused because the exact "required drawings" solver is a closed-form Y1 calculation; use the 3-year table to eyeball Y2 / Y3 resilience.</p>
      <div class="ff-kpi-grid">${baselineKpis}</div>
      ${perYearTable}
    `
  );

  if (!pcf) {
    return `
      <section class="ff-panel">
        <h2>Scenario Testing</h2>
        <p class="ff-helper">
          Use this step to pressure-test your plan. Your canonical inputs remain unchanged.
        </p>
      </section>
      ${baselinePanel}
      ${panel("Personal Cash Flow Stress Test", `<p class="ff-helper">Personal Cash Flow data is not available yet. Complete Step 10 (Personal Cash Flow) to unlock this test.</p>`)}
    `;
  }

  const calendarLabels = (pcf.monthLabels && pcf.monthLabels.length === 12) ? pcf.monthLabels : CALENDAR_FALLBACK;
  const closingMonthly = (pcf.closingMonthly || []).slice(0, 12);
  const inflowsMonthly = (pcf.inflowsMonthly || []).slice(0, 12).map((v) => Number(v || 0));
  const outflowsMonthly = (pcf.outflowsMonthly || []).slice(0, 12).map((v) => Number(v || 0));
  const drawingsMonthly = (pcf.drawingsFromBusinessMonthly || []).slice(0, 12).map((v) => Number(v || 0));
  const hasPcfActivity = inflowsMonthly.some((v) => v !== 0) || outflowsMonthly.some((v) => v !== 0);

  const minClosing = Number(pcf.summary?.minClosingBalance ?? 0);
  const monthsBelowZero = Number(pcf.summary?.monthsBelowZero ?? 0);
  const runwayMonths = pcf.summary?.runwayMonths;
  const requiredMonthly = Number(pcf.summary?.requiredDrawingsMonthlyUplift ?? 0);
  const dependencyPct = Number(pcf.summary?.dependencyOnBusinessDrawingsPct ?? 0);

  const pcfKpiHtml = `
    <div class="ff-kpi-grid">
      ${statCard("Worst Month (Min Closing)", formatMoney(minClosing))}
      ${statCard("Months Below Zero", String(monthsBelowZero))}
      ${statCard("Runway (months)", runwayMonths == null ? "No depletion" : String(runwayMonths))}
      ${statCard("Required Drawings Uplift", requiredMonthly > 0 ? `${formatMoney(requiredMonthly)}/mo` : "None needed")}
      ${statCard("Dependency On Drawings", formatPercent(dependencyPct))}
    </div>
  `;

  const baseForStress = {
    openingBalance: Number(pcf.openingBalance || 0),
    inflowsMonthly,
    outflowsMonthly,
    drawingsMonthly,
    closingMonthly,
    calendarLabels
  };

  const emptyHint = !hasPcfActivity
    ? `<p class="ff-helper ff-inline-note">Personal Cash Flow currently has no inflows or outflows, so the stress test has nothing to flex. Enter real numbers in Step 10 to make this useful.</p>`
    : "";

  const stressControlHtml = `
    <div class="ff-pcf-stress" data-region="scenario-pcf-stress">
      <div class="ff-pcf-stress-head">
        <h5 class="ff-pcf-group-title" style="margin-bottom:0;">Personal Cash Flow Stress Test</h5>
        <span class="ff-pcf-stress-helper">
          Preview how key personal-cash decisions respond to a small adverse case.
          Baseline values are unchanged; canonical state is never mutated.
        </span>
      </div>
      ${emptyHint}
      <div class="ff-pcf-stress-controls">
        <label class="ff-pcf-stress-field">
          <span>Reduce drawings from business</span>
          <input type="number" min="0" max="100" step="5" value="0" data-stress-input="reduceDrawingsPct" />
          <span class="ff-pcf-stress-suffix">%</span>
        </label>
        <label class="ff-pcf-stress-field">
          <span>Increase personal outflows</span>
          <input type="number" min="0" max="100" step="5" value="0" data-stress-input="increaseOutflowsPct" />
          <span class="ff-pcf-stress-suffix">%</span>
        </label>
        <button type="button" class="btn btn--outline btn--sm" data-stress-action="reset">Reset</button>
      </div>
      <div class="ff-pcf-stress-output" data-region="scenario-pcf-stress-output" hidden></div>
    </div>
    <script type="application/json" id="ff-scenario-testing-stress-base">${JSON.stringify(baseForStress)}</script>
  `;

  return `
    <section class="ff-panel">
      <h2>Scenario Testing</h2>
      <p class="ff-helper">
        Pressure-test your plan against downside cases without changing any saved inputs.
        This step is diagnostic; the numbers on the Results Dashboard and in the printed summary
        remain the authoritative scenario.
      </p>
    </section>
    ${baselinePanel}
    ${panel("Personal Cash Flow Baseline (Year 1)", `
      <p class="ff-helper">Year 1 personal liquidity metrics from your current inputs. The Results Dashboard shows the same plan across all 3 years; this panel stays Year-1 focused because the "required drawings" metric is an exact Y1 solver.</p>
      ${pcfKpiHtml}
    `)}
    ${panel("Personal Cash Flow Stress Test (Year 1)", stressControlHtml)}
  `;
}

export function hydrateScenarioTestingStep(root) {
  const stressRegion = root.querySelector('[data-region="scenario-pcf-stress"]');
  const baseNode = root.querySelector("#ff-scenario-testing-stress-base");
  if (!stressRegion || !baseNode) return;
  let base;
  try {
    base = JSON.parse(baseNode.textContent || "{}");
  } catch (error) {
    console.debug("[ff] scenario-testing stress base parse failed", error);
    return;
  }
  const calendarLabels = Array.isArray(base.calendarLabels) ? base.calendarLabels : CALENDAR_FALLBACK;
  const outputNode = stressRegion.querySelector('[data-region="scenario-pcf-stress-output"]');
  const reduceInput = stressRegion.querySelector('[data-stress-input="reduceDrawingsPct"]');
  const increaseInput = stressRegion.querySelector('[data-stress-input="increaseOutflowsPct"]');
  const resetBtn = stressRegion.querySelector('[data-stress-action="reset"]');

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const rebuildStressed = () => {
    const reducePct = clamp(Number(reduceInput?.value || 0), 0, 100);
    const increasePct = clamp(Number(increaseInput?.value || 0), 0, 100);
    if (reducePct === 0 && increasePct === 0) {
      if (outputNode) {
        outputNode.hidden = true;
        outputNode.innerHTML = "";
      }
      return;
    }

    const drawings = Array.isArray(base.drawingsMonthly) ? base.drawingsMonthly : [];
    const inflows = Array.isArray(base.inflowsMonthly) ? base.inflowsMonthly : [];
    const outflows = Array.isArray(base.outflowsMonthly) ? base.outflowsMonthly : [];
    const stressedDrawings = drawings.map((v) => Number(v || 0) * (1 - reducePct / 100));
    const stressedInflows = inflows.map((v, i) => {
      const other = Number(v || 0) - Number(drawings[i] || 0);
      return other + stressedDrawings[i];
    });
    const stressedOutflows = outflows.map((v) => Number(v || 0) * (1 + increasePct / 100));

    const baseMetrics = computePersonalDecisionMetrics({
      openingBalance: base.openingBalance || 0,
      inflowsMonthly: inflows,
      outflowsMonthly: outflows,
      drawingsMonthly: drawings
    });
    baseMetrics.calendarLabels = calendarLabels;

    const stressedMetrics = computePersonalDecisionMetrics({
      openingBalance: base.openingBalance || 0,
      inflowsMonthly: stressedInflows,
      outflowsMonthly: stressedOutflows,
      drawingsMonthly: stressedDrawings
    });
    stressedMetrics.calendarLabels = calendarLabels;

    if (outputNode) {
      outputNode.hidden = false;
      outputNode.innerHTML = renderStressOutput(baseMetrics, stressedMetrics, reducePct, increasePct);
    }
  };

  reduceInput?.addEventListener("input", rebuildStressed);
  increaseInput?.addEventListener("input", rebuildStressed);
  resetBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    if (reduceInput) reduceInput.value = "0";
    if (increaseInput) increaseInput.value = "0";
    rebuildStressed();
  });
}
