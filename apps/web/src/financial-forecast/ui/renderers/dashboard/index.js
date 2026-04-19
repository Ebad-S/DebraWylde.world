import { renderBarChart, renderLineChart } from "../../charts.js";
import { badge, panel, statCard } from "../shared/components.js";
import { formatMoney, formatPercent } from "../shared/format.js";

function warningTable(warnings) {
  if (!warnings.length) {
    return `<p class="ff-helper">No warnings in the current preview.</p>`;
  }
  const rows = warnings
    .slice(0, 30)
    .map(
      (warning) => `
        <tr>
          <td>${warning.severity || "-"}</td>
          <td>${warning.code || "-"}</td>
          <td>${warning.domain || "-"}</td>
          <td>${warning.message || "-"}</td>
        </tr>
      `
    )
    .join("");
  return `
    <div class="ff-table-wrap">
      <table class="ff-table">
        <thead><tr><th>Severity</th><th>Code</th><th>Domain</th><th>Detail</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function annualSummary(derived) {
  const revenue = derived?.annual?.revenueNet || {};
  const profit = derived?.annual?.netProfitAfterTax || {};
  const cash = derived?.annual?.netCash || {};
  const keys = Object.keys(revenue);
  const rows = keys
    .map(
      (yearKey) => `
        <tr>
          <th>${yearKey.toUpperCase()}</th>
          <td>${formatMoney(revenue[yearKey])}</td>
          <td>${formatMoney(profit[yearKey] || 0)}</td>
          <td>${formatMoney(cash[yearKey] || 0)}</td>
        </tr>
      `
    )
    .join("");
  return `
    <div class="ff-table-wrap">
      <table class="ff-table">
        <thead><tr><th>Year</th><th>Revenue</th><th>Net Profit</th><th>Net Cash</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderReviewStep(snapshot, stepStatusMap) {
  const strictResult = snapshot.engine.strict;
  const lenientWarnings = snapshot.engine.lenient?.warnings || [];
  const strictErrors = strictResult?.validation?.errors || [];
  const blocking = strictErrors.filter((issue) => issue.blocking);

  const statuses = Object.entries(stepStatusMap)
    .map(([stepId, status]) => {
      const label = stepId.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
      return `<li><strong>${label}</strong>: ${status.complete ? "Complete" : "Needs Attention"} (${status.blockingCount} Blockers, ${status.warningCount} Warnings)</li>`;
    })
    .join("");

  return `
    <section class="ff-panel">
      <p>Run a strict readiness check before sharing the final summary.</p>
      <div class="ff-review-summary">
        ${badge(blocking.length ? "critical" : "ok", blocking.length ? `${blocking.length} blocking issues` : "No blocking issues")}
        ${badge(lenientWarnings.length ? "warning" : "ok", `${lenientWarnings.length} warnings in preview`)}
      </div>
      <ul class="ff-review-list">${statuses}</ul>
      ${blocking.length ? panel("Blocking Issues", warningTable(blocking), "ff-panel--critical") : panel("Blocking Issues", "<p class='ff-helper'>Strict mode did not find blocking issues.</p>")}
      ${panel("Advisory Warnings", warningTable(lenientWarnings))}
    </section>
  `;
}

function buildQuarterlyRevenueFromMonthly(monthlyRevenue = []) {
  const values = [];
  const labels = [];
  for (let i = 0; i < monthlyRevenue.length; i += 3) {
    const quarterIndex = Math.floor(i / 3);
    const year = Math.floor(quarterIndex / 4) + 1;
    const quarter = (quarterIndex % 4) + 1;
    const total = Number(monthlyRevenue[i] || 0) + Number(monthlyRevenue[i + 1] || 0) + Number(monthlyRevenue[i + 2] || 0);
    values.push(total);
    labels.push(`Y${year}-Q${quarter}`);
  }
  return { values, labels };
}

function buildQuarterClosingCashFromMonthly(monthlyClosingCash = []) {
  const quarters = {};
  for (let i = 2; i < monthlyClosingCash.length; i += 3) {
    const quarterIndex = Math.floor(i / 3);
    const year = Math.floor(quarterIndex / 4) + 1;
    const quarter = (quarterIndex % 4) + 1;
    const key = `Y${year}-Q${quarter}`;
    quarters[key] = Number(monthlyClosingCash[i] || 0);
  }
  return quarters;
}

export function renderResultsStep(snapshot) {
  const result = snapshot.engine.strict?.status === "ok" ? snapshot.engine.strict : snapshot.engine.lenient;
  if (!result) {
    return `<section class="ff-panel"><p>Update any input to generate your first live preview.</p></section>`;
  }

  const derived = result.derived || {};
  const raw = result.raw || {};
  const summary = derived.summaryCards || {};
  const lowestCash = Math.min(...(raw.cashFlow?.closingCashMonthly || [0]));
  const receivablesEnd = raw.collections?.receivablesClosingMonthly?.slice(-1)[0] || 0;
  const breakEvenYear1 = raw.breakEven?.yearly?.[0] || {};
  const kpis = [
    statCard("Total Revenue", formatMoney(summary.totalRevenue || 0)),
    statCard("Total Net Profit After Tax", formatMoney(summary.totalNetProfitAfterTax || 0)),
    statCard("Average Margin", formatPercent(summary.averageMarginPct || 0)),
    statCard("Final Closing Cash", formatMoney(summary.finalClosingCash || 0)),
    statCard("Lowest Cash Point", formatMoney(lowestCash)),
    statCard("Receivables At End", formatMoney(receivablesEnd)),
    statCard("Break-Even Revenue (Y1)", formatMoney(breakEvenYear1.combinedBreakEvenRevenue || 0)),
    statCard("Warnings", String((result.warnings || []).length))
  ].join("");

  const quarterlyFromMonthly = buildQuarterlyRevenueFromMonthly(derived.charts?.revenueNetMonthly || []);
  const quarterlyClosingCash = buildQuarterClosingCashFromMonthly(raw.cashFlow?.closingCashMonthly || []);
  const quarterlyRevenueByKey = Object.fromEntries(quarterlyFromMonthly.labels.map((label, index) => [label, quarterlyFromMonthly.values[index]]));
  console.debug("[ff] quarterly revenue dataset", quarterlyRevenueByKey);
  console.debug("[ff] quarterly closing cash source", quarterlyClosingCash);

  const ownerPanel = panel(
    "Owner Adjustment Summary",
    `
      <p>Drawings: ${formatMoney((raw.ownerAdjustments?.drawingsMonthly || []).reduce((a, b) => a + b, 0))}</p>
      <p>Salary: ${formatMoney((raw.ownerAdjustments?.salaryMonthly || []).reduce((a, b) => a + b, 0))}</p>
      <p>Distributions: ${formatMoney((raw.ownerAdjustments?.distributionsMonthly || []).reduce((a, b) => a + b, 0))}</p>
    `
  );

  const financePanel = panel(
    "Financing Summary",
    `
      <p>Total drawdowns: ${formatMoney((raw.loans?.drawdownMonthly || []).reduce((a, b) => a + b, 0))}</p>
      <p>Total interest: ${formatMoney((raw.loans?.interestMonthly || []).reduce((a, b) => a + b, 0))}</p>
      <p>Closing loan balance: ${formatMoney(raw.loans?.closingLoanBalanceMonthly?.slice(-1)[0] || 0)}</p>
    `
  );

  const assetsPanel = panel(
    "Asset And Depreciation Summary",
    `
      <p>Total capex: ${formatMoney((raw.assets?.purchaseMonthly || []).reduce((a, b) => a + b, 0))}</p>
      <p>Total depreciation: ${formatMoney((raw.assets?.depreciationMonthly || []).reduce((a, b) => a + b, 0))}</p>
      <p>Closing asset value: ${formatMoney(raw.assets?.assetNBVMonthly?.slice(-1)[0] || 0)}</p>
    `
  );

  return `
    <section class="ff-panel">
      <div class="ff-subsection-head">
        <button class="btn btn--outline" data-action="print-summary">Print Summary</button>
      </div>
      <div class="ff-kpi-grid">${kpis}</div>
      <div class="ff-chart-grid">
        <div class="ff-panel">
          <h3>Revenue Trend</h3>
          <div class="ff-chart" data-chart="revenue"></div>
        </div>
        <div class="ff-panel">
          <h3>Net Profit Trend</h3>
          <div class="ff-chart" data-chart="profit"></div>
        </div>
        <div class="ff-panel">
          <h3>Closing Cash Trend</h3>
          <div class="ff-chart" data-chart="cash"></div>
        </div>
        <div class="ff-panel">
          <h3>Quarterly Revenue</h3>
          <div class="ff-chart ff-chart--bars" data-chart="quarterly-revenue"></div>
        </div>
      </div>
      ${panel("Annual Summary", annualSummary(derived))}
      ${panel("Quarterly Performance", `<div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Quarter</th><th>Revenue</th><th>Net Profit</th><th>Closing Cash</th></tr></thead><tbody>${
        Object.keys(quarterlyRevenueByKey)
          .map((quarterKey) => `
            <tr>
              <th>${quarterKey}</th>
              <td>${formatMoney(quarterlyRevenueByKey[quarterKey] ?? 0)}</td>
              <td>${formatMoney(raw.quarterly.flowRollups.netProfitAfterTax?.[quarterKey] || 0)}</td>
              <td>${formatMoney(quarterlyClosingCash[quarterKey] ?? raw.quarterly.positionSnapshots?.closingCash?.[quarterKey] ?? 0)}</td>
            </tr>`)
          .join("")
      }</tbody></table></div>`)}
      ${panel("Warnings And Issues", warningTable(result.warnings || []))}
      ${panel("Receivables Insight", `
        <p>Opening receivables: ${formatMoney(raw.collections?.receivablesOpeningMonthly?.[0] || 0)}</p>
        <p>Closing receivables: ${formatMoney(raw.collections?.receivablesClosingMonthly?.slice(-1)[0] || 0)}</p>
        <p>Total collections: ${formatMoney((raw.collections?.cashCollectedMonthly || []).reduce((a, b) => a + b, 0))}</p>
      `)}
      ${ownerPanel}
      ${financePanel}
      ${assetsPanel}
      <details class="ff-details">
        <summary>Monthly Metrics Table</summary>
        <div class="ff-table-wrap">
          <table class="ff-table">
            <thead><tr><th>Month</th><th>Revenue</th><th>Net Profit</th><th>Closing Cash</th></tr></thead>
            <tbody>
              ${(derived.charts?.revenueNetMonthly || []).map((_, index) => `
                <tr>
                  <td>M${index + 1}</td>
                  <td>${formatMoney(derived.charts.revenueNetMonthly[index] || 0)}</td>
                  <td>${formatMoney(derived.charts.netProfitAfterTaxMonthly[index] || 0)}</td>
                  <td>${formatMoney(derived.charts.closingCashMonthly[index] || 0)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>
      <script type="application/json" id="ff-quarterly-revenue-data">${JSON.stringify(quarterlyFromMonthly)}</script>
    </section>
  `;
}

export function hydrateDashboardCharts(root, snapshot) {
  const result = snapshot.engine.strict?.status === "ok" ? snapshot.engine.strict : snapshot.engine.lenient;
  if (!result || !result.derived) return;

  const labels = (result.derived.charts?.revenueNetMonthly || []).map((_, idx) => `M${idx + 1}`);
  renderLineChart(root.querySelector('[data-chart="revenue"]'), result.derived.charts?.revenueNetMonthly || [], labels, { title: "Revenue Trend", stroke: "#D8B98A" });
  renderLineChart(root.querySelector('[data-chart="profit"]'), result.derived.charts?.netProfitAfterTaxMonthly || [], labels, { title: "Net Profit Trend", stroke: "#8ED6A6" });
  renderLineChart(root.querySelector('[data-chart="cash"]'), result.derived.charts?.closingCashMonthly || [], labels, { title: "Closing Cash Trend", stroke: "#86A8FF" });

  const dataNode = root.querySelector("#ff-quarterly-revenue-data");
  if (dataNode) {
    const parsed = JSON.parse(dataNode.textContent || "{}");
    renderBarChart(root.querySelector('[data-chart="quarterly-revenue"]'), parsed.values || [], parsed.labels || []);
  }
}
