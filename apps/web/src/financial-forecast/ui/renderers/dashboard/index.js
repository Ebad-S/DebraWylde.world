import { renderBarChart, renderLineChart, renderMultiLineChart } from "../../charts.js";
import { badge, panel, statCard } from "../shared/components.js";
import { formatMoney, formatPercent, formatNumber, escapeHtml } from "../shared/format.js";
import { computePersonalDecisionMetrics } from "../../../core/engine/personal-cash-flow.js";
import {
  monthlyToQuarterly,
  monthlyToYearly,
  monthlySnapshotByQuarter,
  monthlySnapshotByYear,
  quarterLabels,
  yearLabels,
  monthLabels,
  sumArray,
  safeDivide,
  buildPeriodTable
} from "../shared/aggregate.js";

function warningTable(warnings) {
  if (!warnings.length) {
    return `<p class="ff-helper">No warnings in the current preview.</p>`;
  }
  const rows = warnings
    .slice(0, 60)
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

function personalCashFlowReviewBlock(result) {
  const pcf = result?.raw?.personalCashFlow;
  if (!pcf) return "";
  const summary = pcf.summary || {};
  const closing = pcf.closingMonthly || [];
  const minClosing = Number(summary.minClosingBalance ?? 0);
  let worstIdx = -1;
  for (let i = 0; i < closing.length; i += 1) {
    if (Number(closing[i]) === minClosing) { worstIdx = i; break; }
  }
  const calendarLabels = (pcf.monthLabels && pcf.monthLabels.length === 12)
    ? pcf.monthLabels
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const worstMonth = worstIdx >= 0 ? calendarLabels[worstIdx] : "—";
  const runwayMonths = summary.runwayMonths;
  const runwayLabel = runwayMonths == null
    ? "No depletion in Year 1"
    : `${runwayMonths} month${runwayMonths === 1 ? "" : "s"} before first negative`;
  const requiredMonthly = Number(summary.requiredDrawingsMonthlyUplift || 0);
  const requiredAnnual = Number(summary.requiredDrawingsAnnualUplift || 0);
  const requiredLabel = requiredMonthly > 0
    ? `${formatMoney(requiredMonthly)}/mo (${formatMoney(requiredAnnual)}/yr) — exact`
    : "None needed — already solvent";
  const dependencyPct = Number(summary.dependencyOnBusinessDrawingsPct || 0);
  const dependencyBand = summary.dependencyBand || "none";
  const dependencyLabel = Number(summary.totalInflows || 0) <= 0
    ? "No personal inflows yet"
    : `${formatPercent(dependencyPct)} (${dependencyBand})`;

  const items = [
    ["Opening personal balance (Jan)", formatMoney(pcf.openingBalance || 0)],
    ["Closing personal balance (Dec)", formatMoney(summary.closingEndOfYear || 0)],
    ["Surplus / Deficit (Year 1)", formatMoney(summary.netChange || 0)],
    ["Worst month (min closing)", `${formatMoney(minClosing)} (${worstMonth})`],
    ["Months with negative balance", String(summary.monthsBelowZero || 0)],
    ["Runway (months)", runwayLabel],
    ["Required drawings to stay solvent", requiredLabel],
    ["Dependency on business drawings", dependencyLabel],
    ["Drawings from business (Y1)", formatMoney(summary.totalDrawingsFromBusiness || 0)],
    ["Total personal inflows (Y1)", formatMoney(summary.totalInflows || 0)],
    ["Total personal outflows (Y1)", formatMoney(summary.totalOutflows || 0)]
  ];
  const rows = items.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join("");
  return panel(
    "Personal Cash Flow (Year 1)",
    `<div class="ff-table-wrap"><table class="ff-table"><tbody>${rows}</tbody></table></div>`
  );
}

export function renderReviewStep(snapshot, stepStatusMap) {
  const strictResult = snapshot.engine.strict;
  const lenientResult = snapshot.engine.lenient;
  const lenientWarnings = lenientResult?.warnings || [];
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
      ${personalCashFlowReviewBlock(lenientResult)}
    </section>
  `;
}

function buildQuarterlyRevenueFromMonthly(monthlyRevenue = []) {
  const values = monthlyToQuarterly(monthlyRevenue);
  return { values, labels: quarterLabels() };
}

function buildQuarterClosingCashFromMonthly(monthlyClosingCash = []) {
  const snapshots = monthlySnapshotByQuarter(monthlyClosingCash);
  return Object.fromEntries(quarterLabels().map((label, i) => [label, snapshots[i]]));
}

function diffSeries(a = [], b = []) {
  const length = Math.max(a.length, b.length);
  const out = Array(length).fill(0);
  for (let i = 0; i < length; i += 1) {
    out[i] = Number(a[i] || 0) - Number(b[i] || 0);
  }
  return out;
}

function sumSeries(...series) {
  const length = Math.max(...series.map((s) => (s || []).length), 0);
  const out = Array(length).fill(0);
  for (let i = 0; i < length; i += 1) {
    for (let s = 0; s < series.length; s += 1) {
      out[i] += Number(series[s]?.[i] || 0);
    }
  }
  return out;
}

function marginPctSeries(numerator = [], denominator = []) {
  const length = Math.max(numerator.length, denominator.length);
  const out = Array(length).fill(0);
  for (let i = 0; i < length; i += 1) {
    const den = Number(denominator[i] || 0);
    out[i] = den === 0 ? 0 : (Number(numerator[i] || 0) / den) * 100;
  }
  return out;
}

function ratioByPeriod(numeratorMonthly, denominatorMonthly, periodLength) {
  const periodCount = Math.floor(36 / periodLength);
  const out = Array(periodCount).fill(0);
  for (let p = 0; p < periodCount; p += 1) {
    let num = 0;
    let den = 0;
    for (let m = p * periodLength; m < (p + 1) * periodLength; m += 1) {
      num += Number(numeratorMonthly?.[m] || 0);
      den += Number(denominatorMonthly?.[m] || 0);
    }
    out[p] = den === 0 ? 0 : (num / den) * 100;
  }
  return out;
}

function rowsForQuarters(specs) {
  return specs.map((spec) => {
    let values;
    if (spec.kind === "percent" && spec.numeratorMonthly && spec.denominatorMonthly) {
      values = ratioByPeriod(spec.numeratorMonthly, spec.denominatorMonthly, 3);
    } else {
      values = monthlyToQuarterly(spec.monthly || []);
    }
    return {
      label: spec.label,
      kind: spec.kind || "money",
      emphasis: spec.emphasis,
      values,
      totalOverride: spec.kind === "percent"
        ? (spec.yearlyTotalOverride != null ? spec.yearlyTotalOverride : undefined)
        : undefined,
      skipTotal: spec.skipTotal
    };
  });
}

function rowsForMonths(specs) {
  return specs.map((spec) => {
    let values;
    if (spec.kind === "percent" && spec.numeratorMonthly && spec.denominatorMonthly) {
      values = ratioByPeriod(spec.numeratorMonthly, spec.denominatorMonthly, 1);
    } else {
      values = (spec.monthly || []).slice(0, 36);
    }
    return {
      label: spec.label,
      kind: spec.kind || "money",
      emphasis: spec.emphasis,
      values,
      skipTotal: spec.skipTotal
    };
  });
}

function rowsForQuarterSnapshots(specs) {
  return specs.map((spec) => ({
    label: spec.label,
    kind: spec.kind || "money",
    emphasis: spec.emphasis,
    values: monthlySnapshotByQuarter(spec.monthly || []),
    skipTotal: true
  }));
}

function rowsForMonthsSnapshot(specs) {
  return specs.map((spec) => ({
    label: spec.label,
    kind: spec.kind || "money",
    emphasis: spec.emphasis,
    values: (spec.monthly || []).slice(0, 36),
    skipTotal: true
  }));
}

function statementPanel(title, specs, { description = "", firstColHeader = "Line Item", snapshot = false, includeTotal = true } = {}) {
  const quarterlyRows = snapshot ? rowsForQuarterSnapshots(specs) : rowsForQuarters(specs);
  const monthlyRows = snapshot ? rowsForMonthsSnapshot(specs) : rowsForMonths(specs);
  const qHtml = buildPeriodTable({
    rows: quarterlyRows,
    columns: quarterLabels(),
    includeTotal: snapshot ? false : includeTotal,
    firstColHeader
  });
  const mHtml = buildPeriodTable({
    rows: monthlyRows,
    columns: monthLabels(),
    includeTotal: snapshot ? false : includeTotal,
    firstColHeader
  });
  return panel(title, `
    ${description ? `<p class="ff-helper">${description}</p>` : ""}
    ${qHtml}
    <details class="ff-details"><summary>View monthly detail</summary>${mHtml}</details>
  `);
}

function yearlyPanel(title, specs, { firstColHeader = "Metric", description = "", includeTotal = true } = {}) {
  const rows = specs.map((spec) => ({
    label: spec.label,
    kind: spec.kind || "money",
    emphasis: spec.emphasis,
    values: spec.values,
    skipTotal: spec.skipTotal
  }));
  const html = buildPeriodTable({
    rows,
    columns: yearLabels(),
    includeTotal,
    firstColHeader
  });
  return panel(title, `${description ? `<p class="ff-helper">${description}</p>` : ""}${html}`);
}

function profitAndLossPanel(raw) {
  const pl = raw.profitLoss || {};
  const costs = raw.costs || {};
  const marketing = raw.marketing || {};
  const ownerAdjustments = raw.ownerAdjustments || {};

  const totalRevenue = sumArray(pl.revenueMonthly || []);
  const totalGp = sumArray(pl.grossProfitMonthly || []);
  const totalEbitda = sumArray(pl.ebitdaMonthly || []);
  const totalNpat = sumArray(pl.netProfitAfterTaxMonthly || []);

  const specs = [
    { label: "Revenue (Net)", monthly: pl.revenueMonthly, emphasis: "header" },
    { label: "Cost Of Goods Sold", monthly: (pl.cogsMonthly || []).map((v) => -Number(v || 0)) },
    { label: "Gross Profit", monthly: pl.grossProfitMonthly, emphasis: "subtotal" },
    { label: "Gross Margin %", kind: "percent", numeratorMonthly: pl.grossProfitMonthly, denominatorMonthly: pl.revenueMonthly, yearlyTotalOverride: safeDivide(totalGp, totalRevenue) * 100, emphasis: "subtotal" },
    { label: "Operating Expenses", monthly: (pl.operatingExpensesMonthly || []).map((v) => -Number(v || 0)), emphasis: "header" },
    { label: "  Fixed Costs", monthly: (costs.fixedMonthly || []).map((v) => -Number(v || 0)) },
    { label: "  Variable Costs", monthly: (costs.variableMonthly || []).map((v) => -Number(v || 0)) },
    { label: "  Direct Labor", monthly: (costs.directLaborMonthly || []).map((v) => -Number(v || 0)) },
    { label: "  Merchant Fees", monthly: (costs.merchantFeesMonthly || []).map((v) => -Number(v || 0)) },
    { label: "  Other Operating", monthly: (costs.otherOperatingMonthly || []).map((v) => -Number(v || 0)) },
    { label: "  Marketing", monthly: (marketing.monthly || []).map((v) => -Number(v || 0)) },
    { label: "  Director Salary", monthly: (ownerAdjustments.salaryMonthly || []).map((v) => -Number(v || 0)) },
    { label: "EBITDA", monthly: pl.ebitdaMonthly, emphasis: "subtotal" },
    { label: "EBITDA Margin %", kind: "percent", numeratorMonthly: pl.ebitdaMonthly, denominatorMonthly: pl.revenueMonthly, yearlyTotalOverride: safeDivide(totalEbitda, totalRevenue) * 100, emphasis: "subtotal" },
    { label: "Depreciation", monthly: (pl.depreciationMonthly || []).map((v) => -Number(v || 0)) },
    { label: "Interest", monthly: (pl.interestMonthly || []).map((v) => -Number(v || 0)) },
    { label: "Net Profit Before Tax", monthly: pl.netProfitBeforeTaxMonthly, emphasis: "subtotal" },
    { label: "Tax", monthly: (pl.taxMonthly || []).map((v) => -Number(v || 0)) },
    { label: "Net Profit After Tax", monthly: pl.netProfitAfterTaxMonthly, emphasis: "total" },
    { label: "NPAT Margin %", kind: "percent", numeratorMonthly: pl.netProfitAfterTaxMonthly, denominatorMonthly: pl.revenueMonthly, yearlyTotalOverride: safeDivide(totalNpat, totalRevenue) * 100, emphasis: "total" }
  ];

  return statementPanel("Profit & Loss Statement", specs, {
    firstColHeader: "Line Item",
    description: "Expenses shown as negatives. Ratios use revenue (net) as the denominator."
  });
}

function cashFlowStatementPanel(raw) {
  const cf = raw.cashFlow || {};

  const specs = [
    { label: "Net Operating Cash Flow", monthly: cf.netOperatingMonthly, emphasis: "subtotal" },
    { label: "Net Investing Cash Flow", monthly: cf.netInvestingMonthly, emphasis: "subtotal" },
    { label: "Net Financing Cash Flow", monthly: cf.netFinancingMonthly, emphasis: "subtotal" },
    { label: "Net Cash Movement", monthly: cf.netCashMonthly, emphasis: "total" }
  ];

  const closingCashSpec = [{ label: "Closing Cash (Snapshot)", monthly: cf.closingCashMonthly, emphasis: "header" }];

  const quarterlyHtml = buildPeriodTable({
    rows: [
      ...rowsForQuarters(specs),
      ...rowsForQuarterSnapshots(closingCashSpec)
    ],
    columns: quarterLabels(),
    includeTotal: true,
    firstColHeader: "Line Item"
  });
  const monthlyHtml = buildPeriodTable({
    rows: [
      ...rowsForMonths(specs),
      ...rowsForMonthsSnapshot(closingCashSpec)
    ],
    columns: monthLabels(),
    includeTotal: true,
    firstColHeader: "Line Item"
  });

  return panel("Cash Flow Statement", `
    <p class="ff-helper">Flows sum across each period; closing cash is a period-end snapshot.</p>
    ${quarterlyHtml}
    <details class="ff-details"><summary>View monthly detail</summary>${monthlyHtml}</details>
  `);
}

function balanceSheetPanel(raw) {
  const bs = raw.balanceSheet || {};
  const cf = raw.cashFlow || {};
  const collections = raw.collections || {};
  const assets = raw.assets || {};
  const loans = raw.loans || {};

  const snapshotSpecs = [
    { label: "Cash", monthly: cf.closingCashMonthly, emphasis: "subtotal" },
    { label: "Receivables", monthly: collections.receivablesClosingMonthly, emphasis: "subtotal" },
    { label: "Assets (Net Book Value)", monthly: assets.assetNBVMonthly, emphasis: "subtotal" },
    { label: "Total Assets", monthly: bs.assetsMonthly, emphasis: "header" },
    { label: "Loans Closing Balance", monthly: loans.closingLoanBalanceMonthly, emphasis: "subtotal" },
    { label: "Total Liabilities", monthly: bs.liabilitiesMonthly, emphasis: "header" },
    { label: "Retained Earnings", monthly: bs.retainedEarningsMonthly, emphasis: "subtotal" },
    { label: "Total Equity", monthly: bs.equityMonthly, emphasis: "header" },
    { label: "Balance Delta (Assets − L−E)", monthly: bs.balanceDeltaMonthly, emphasis: "total" }
  ];

  return statementPanel("Balance Sheet", snapshotSpecs, {
    firstColHeader: "Line Item",
    snapshot: true,
    description: "Period-end snapshots. 'Balance Delta' should be near zero; non-zero values flag reconciliation drift."
  });
}

function revenueByStreamPanel(raw, canonical) {
  const sales = raw.sales || {};
  const lines = canonical?.salesDetails?.lines || [];
  const activeLines = lines.filter((line) => line.isActive !== false);

  if (!activeLines.length) {
    return panel("Revenue By Stream", `<p class="ff-helper">No active revenue streams.</p>`);
  }

  const specs = [];
  activeLines.forEach((line) => {
    const unitSeries = sales?.monthly?.byLineUnits?.[line.id] || [];
    const netSeries = sales?.monthly?.byLineNet?.[line.id] || [];
    specs.push({ label: `${line.name || "(unnamed)"} — Units`, monthly: unitSeries, kind: "number" });
    specs.push({ label: `${line.name || "(unnamed)"} — Net Revenue`, monthly: netSeries });
  });
  specs.push({ label: "Services Total (Net)", monthly: sales.monthly?.serviceNet, emphasis: "subtotal" });
  specs.push({ label: "Products Total (Net)", monthly: sales.monthly?.productNet, emphasis: "subtotal" });
  specs.push({ label: "Revenue — All Streams (Net)", monthly: sales.monthly?.net, emphasis: "total" });

  return statementPanel("Revenue By Stream", specs, {
    firstColHeader: "Stream",
    description: "Per-stream units and net revenue. Service vs product subtotals from engine."
  });
}

function collectionsPanel(raw) {
  const c = raw.collections || {};
  const specs = [
    { label: "Invoiced (Basis)", monthly: c.invoicedBasisMonthly, emphasis: "header" },
    { label: "Cash Collected", monthly: c.cashCollectedMonthly, emphasis: "subtotal" },
    { label: "Bad Debt Written Off", monthly: c.badDebtWrittenOffMonthly },
    { label: "Receivables Opening", monthly: c.receivablesOpeningMonthly, kind: "money", emphasis: "subtotal", skipTotal: true },
    { label: "Receivables Closing", monthly: c.receivablesClosingMonthly, kind: "money", emphasis: "total", skipTotal: true }
  ];

  const quarterlyRows = specs.map((spec) => {
    if (spec.label.startsWith("Receivables")) {
      return {
        label: spec.label,
        kind: spec.kind || "money",
        emphasis: spec.emphasis,
        values: monthlySnapshotByQuarter(spec.monthly || []),
        skipTotal: true
      };
    }
    return {
      label: spec.label,
      kind: spec.kind || "money",
      emphasis: spec.emphasis,
      values: monthlyToQuarterly(spec.monthly || [])
    };
  });
  const monthlyRows = specs.map((spec) => ({
    label: spec.label,
    kind: spec.kind || "money",
    emphasis: spec.emphasis,
    values: (spec.monthly || []).slice(0, 36),
    skipTotal: spec.skipTotal || spec.label.startsWith("Receivables")
  }));

  return panel("Collections & Receivables", `
    <p class="ff-helper">Flows are summed per period; receivables balances are period-end snapshots.</p>
    ${buildPeriodTable({ rows: quarterlyRows, columns: quarterLabels(), includeTotal: true, firstColHeader: "Line Item" })}
    <details class="ff-details"><summary>View monthly detail</summary>${buildPeriodTable({ rows: monthlyRows, columns: monthLabels(), includeTotal: true, firstColHeader: "Line Item" })}</details>
  `);
}

function costsBreakdownPanel(raw) {
  const costs = raw.costs || {};
  const marketing = raw.marketing || {};
  const totalOpEx = sumSeries(
    costs.fixedMonthly,
    costs.variableMonthly,
    costs.directLaborMonthly,
    costs.merchantFeesMonthly,
    costs.otherOperatingMonthly,
    marketing.monthly
  );
  const specs = [
    { label: "Fixed Costs", monthly: costs.fixedMonthly },
    { label: "Variable Costs", monthly: costs.variableMonthly },
    { label: "Direct Labor", monthly: costs.directLaborMonthly },
    { label: "Merchant Fees", monthly: costs.merchantFeesMonthly },
    { label: "Other Operating", monthly: costs.otherOperatingMonthly },
    { label: "Marketing", monthly: marketing.monthly },
    { label: "Total Operating Expenses", monthly: totalOpEx, emphasis: "total" },
    { label: "Cost Of Goods Sold", monthly: costs.cogsMonthly, emphasis: "subtotal" }
  ];
  return statementPanel("Costs Breakdown", specs, { firstColHeader: "Cost Category" });
}

function ownerCompPanel(raw) {
  const owner = raw.ownerAdjustments || {};
  const total = sumSeries(owner.drawingsMonthly, owner.salaryMonthly, owner.distributionsMonthly);
  const specs = [
    { label: "Drawings", monthly: owner.drawingsMonthly },
    { label: "Director Salary", monthly: owner.salaryMonthly },
    { label: "Distributions", monthly: owner.distributionsMonthly },
    { label: "Total Owner Compensation", monthly: total, emphasis: "total" }
  ];
  return statementPanel("Owner Compensation", specs, { firstColHeader: "Line Item" });
}

function financingPanel(raw) {
  const loans = raw.loans || {};
  const totalPayment = sumSeries(loans.principalMonthly, loans.interestMonthly);
  const flowSpecs = [
    { label: "Drawdowns", monthly: loans.drawdownMonthly },
    { label: "Principal Repayments", monthly: loans.principalMonthly },
    { label: "Interest", monthly: loans.interestMonthly },
    { label: "Total Payment (Principal + Interest)", monthly: totalPayment, emphasis: "subtotal" }
  ];
  const snapshotSpecs = [
    { label: "Loan Closing Balance", monthly: loans.closingLoanBalanceMonthly, emphasis: "total" }
  ];

  const quarterlyRows = [
    ...rowsForQuarters(flowSpecs),
    ...rowsForQuarterSnapshots(snapshotSpecs)
  ];
  const monthlyRows = [
    ...rowsForMonths(flowSpecs),
    ...rowsForMonthsSnapshot(snapshotSpecs)
  ];

  return panel("Financing (Loans)", `
    <p class="ff-helper">Aggregate across all loans. Closing balance is a period-end snapshot.</p>
    ${buildPeriodTable({ rows: quarterlyRows, columns: quarterLabels(), includeTotal: true, firstColHeader: "Line Item" })}
    <details class="ff-details"><summary>View monthly detail</summary>${buildPeriodTable({ rows: monthlyRows, columns: monthLabels(), includeTotal: true, firstColHeader: "Line Item" })}</details>
  `);
}

function assetsPanel(raw) {
  const assets = raw.assets || {};
  const flowSpecs = [
    { label: "Asset Purchases (Capex)", monthly: assets.purchaseMonthly },
    { label: "Depreciation Expense", monthly: assets.depreciationMonthly }
  ];
  const snapshotSpecs = [
    { label: "Asset Net Book Value", monthly: assets.assetNBVMonthly, emphasis: "total" }
  ];
  const quarterlyRows = [
    ...rowsForQuarters(flowSpecs),
    ...rowsForQuarterSnapshots(snapshotSpecs)
  ];
  const monthlyRows = [
    ...rowsForMonths(flowSpecs),
    ...rowsForMonthsSnapshot(snapshotSpecs)
  ];

  return panel("Asset & Depreciation Schedule", `
    <p class="ff-helper">Aggregate across all assets. NBV is a period-end snapshot.</p>
    ${buildPeriodTable({ rows: quarterlyRows, columns: quarterLabels(), includeTotal: true, firstColHeader: "Line Item" })}
    <details class="ff-details"><summary>View monthly detail</summary>${buildPeriodTable({ rows: monthlyRows, columns: monthLabels(), includeTotal: true, firstColHeader: "Line Item" })}</details>
  `);
}

function breakEvenPanel(raw, derived) {
  const yearly = raw.breakEven?.yearly || [];
  const yearlyRevenue = derived?.annual?.revenueNet || {};

  const serviceBE = yearly.map((y) => Number(y?.serviceBreakEvenRevenue || 0));
  const productBE = yearly.map((y) => Number(y?.productBreakEvenRevenue || 0));
  const combinedBE = yearly.map((_, i) => serviceBE[i] + productBE[i]);
  const actual = ["year1", "year2", "year3"].map((k) => Number(yearlyRevenue[k] || 0));
  const headroom = actual.map((value, i) => value - combinedBE[i]);
  const headroomPct = actual.map((value, i) => (combinedBE[i] === 0 ? 0 : ((value - combinedBE[i]) / combinedBE[i]) * 100));

  return yearlyPanel("Break-Even Analysis", [
    { label: "Service Break-Even Revenue", values: serviceBE },
    { label: "Product Break-Even Revenue", values: productBE },
    { label: "Combined Break-Even Revenue", values: combinedBE, emphasis: "subtotal" },
    { label: "Actual Revenue (Net)", values: actual, emphasis: "subtotal" },
    { label: "Headroom (Actual − BE)", values: headroom, emphasis: "total" },
    { label: "Headroom %", values: headroomPct, kind: "percent", emphasis: "total", skipTotal: true }
  ], {
    firstColHeader: "Metric",
    description: "Break-even revenue needed to cover fixed costs given the current service/product contribution margin.",
    includeTotal: false
  });
}

function taxGstPanel(raw) {
  const pl = raw.profitLoss || {};
  const sales = raw.sales || {};
  const specs = [
    { label: "Tax Paid", monthly: pl.taxMonthly, emphasis: "subtotal" },
    { label: "GST Collected On Sales", monthly: sales.monthly?.gst, emphasis: "subtotal" }
  ];
  return statementPanel("Tax & GST", specs, {
    firstColHeader: "Line Item",
    description: "Tax is computed on positive NPBT at the year's tax rate. GST collected is from invoiced sales only (input GST / BAS netting is not modelled yet)."
  });
}

function personalCashFlowPanel(raw) {
  const pcf = raw.personalCashFlow;
  if (!pcf) return "";
  const summary = pcf.summary || {};
  const openingMonthly = (pcf.openingMonthly || []).slice(0, 12);
  const inflowsMonthly = (pcf.inflowsMonthly || []).slice(0, 12);
  const outflowsMonthly = (pcf.outflowsMonthly || []).slice(0, 12);
  const closingMonthly = (pcf.closingMonthly || []).slice(0, 12);
  const netMonthly = inflowsMonthly.map((v, i) => Number(v || 0) - Number(outflowsMonthly[i] || 0));

  const inflowRows = (pcf.inflowsByRow || [])
    .filter((row) => row.total !== 0 || !row.custom)
    .map((row) => ({
      label: row.label,
      kind: "money",
      values: (row.monthly || []).slice(0, 12)
    }));
  const outflowRows = (pcf.outflowsByRow || [])
    .filter((row) => row.total !== 0 || !row.custom)
    .map((row) => ({
      label: row.label,
      kind: "money",
      values: (row.monthly || []).slice(0, 12).map((v) => -Number(v || 0))
    }));
  const sharedPersonalMonthly = (pcf.sharedPersonalMonthly || []).slice(0, 12);
  const sharedRow = sharedPersonalMonthly.some((v) => v)
    ? [{
        label: "Shared Costs (Personal Portion)",
        kind: "money",
        values: sharedPersonalMonthly.map((v) => -Number(v || 0))
      }]
    : [];

  const totalsRows = [
    { label: "Opening Balance", kind: "money", emphasis: "header", values: openingMonthly, skipTotal: true },
    { label: "Total Inflows", kind: "money", emphasis: "subtotal", values: inflowsMonthly },
    { label: "Total Outflows", kind: "money", emphasis: "subtotal", values: outflowsMonthly.map((v) => -Number(v || 0)) },
    { label: "Net Cash Movement", kind: "money", emphasis: "total", values: netMonthly },
    { label: "Closing Balance", kind: "money", emphasis: "header", values: closingMonthly, skipTotal: true }
  ];

  const tableHtml = buildPeriodTable({
    rows: [
      ...inflowRows,
      ...outflowRows,
      ...sharedRow,
      ...totalsRows
    ],
    columns: monthLabels().slice(0, 12),
    includeTotal: true,
    firstColHeader: "Personal Cash Flow Line"
  });

  const minClosing = Number(summary.minClosingBalance || 0);
  const monthsNegative = Number(summary.monthsBelowZero || 0);
  const netChange = Number(summary.netChange || 0);
  const totalInflowsY1 = Number(summary.totalInflows || 0);
  const totalOutflowsY1 = Number(summary.totalOutflows || 0);
  const totalDrawings = Number(summary.totalDrawingsFromBusiness || 0);
  const nonDrawingsInflows = Math.max(totalInflowsY1 - totalDrawings, 0);

  // Identify worst month: the minimum closing balance's first occurrence.
  let worstIdx = -1;
  for (let i = 0; i < closingMonthly.length; i += 1) {
    if (Number(closingMonthly[i]) === minClosing) { worstIdx = i; break; }
  }
  // Prefer calendar month labels from the engine (Jan...Dec) for clarity.
  const calendarLabels = (pcf.monthLabels && pcf.monthLabels.length === 12)
    ? pcf.monthLabels
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const worstMonthLabel = worstIdx >= 0 ? calendarLabels[worstIdx] : "";

  const minCardClass = minClosing < 0 ? "ff-pcf-summary-card ff-pcf-summary-card--warn" : "ff-pcf-summary-card";
  const monthsNegCardClass = monthsNegative > 0 ? "ff-pcf-summary-card ff-pcf-summary-card--warn" : "ff-pcf-summary-card";
  const netChangeCardClass = netChange < 0 ? "ff-pcf-summary-card ff-pcf-summary-card--warn" : "ff-pcf-summary-card";

  const card = (label, value, cls = "ff-pcf-summary-card") => `
    <div class="${cls}">
      <div class="ff-pcf-summary-label">${label}</div>
      <div class="ff-pcf-summary-value">${value}</div>
    </div>`;

  const worstMonthCardValue = worstIdx >= 0
    ? `${formatMoney(minClosing)} <span class="ff-pcf-summary-meta">${worstMonthLabel}</span>`
    : formatMoney(minClosing);

  // --- Phase 4.2.8 decision metrics -------------------------------------
  const requiredMonthlyUplift = Number(summary.requiredDrawingsMonthlyUplift || 0);
  const requiredAnnualUplift = Number(summary.requiredDrawingsAnnualUplift || 0);
  const runwayMonths = summary.runwayMonths;
  const dependencyPct = Number(summary.dependencyOnBusinessDrawingsPct || 0);
  const dependencyBand = summary.dependencyBand || "none";
  const hasInflows = totalInflowsY1 > 0;

  const requiredCardValue = requiredMonthlyUplift > 0
    ? `${formatMoney(requiredMonthlyUplift)}<span class="ff-pcf-summary-meta">${formatMoney(requiredAnnualUplift)} / yr · exact</span>`
    : `${formatMoney(0)}<span class="ff-pcf-summary-meta">None needed — already solvent</span>`;
  const requiredCardClass = requiredMonthlyUplift > 0
    ? "ff-pcf-summary-card ff-pcf-summary-card--warn"
    : "ff-pcf-summary-card";

  const runwayCardValue = runwayMonths == null
    ? `<span class="ff-pcf-summary-value-small">No depletion in Year 1</span>`
    : `${runwayMonths}<span class="ff-pcf-summary-meta">month${runwayMonths === 1 ? "" : "s"} before first negative</span>`;
  const runwayCardClass = runwayMonths == null
    ? "ff-pcf-summary-card"
    : "ff-pcf-summary-card ff-pcf-summary-card--warn";

  const dependencyCardValue = hasInflows
    ? `${formatPercent(dependencyPct)}<span class="ff-pcf-summary-meta">${dependencyBand} dependency</span>`
    : `<span class="ff-pcf-summary-value-small">No personal inflows yet</span>`;
  const dependencyCardClass = dependencyBand === "high"
    ? "ff-pcf-summary-card ff-pcf-summary-card--warn"
    : "ff-pcf-summary-card";

  // Serialise baseline monthly arrays so the stress toggle (hydrated
  // client-side) can recompute decision metrics without mutating canonical
  // state.
  const baseForStress = {
    openingBalance: Number(pcf.openingBalance || 0),
    inflowsMonthly: (pcf.inflowsMonthly || []).slice(0, 12).map((v) => Number(v || 0)),
    outflowsMonthly: (pcf.outflowsMonthly || []).slice(0, 12).map((v) => Number(v || 0)),
    drawingsMonthly: (pcf.drawingsFromBusinessMonthly || []).slice(0, 12).map((v) => Number(v || 0)),
    calendarLabels
  };

  const summaryHtml = `
    <div class="ff-pcf-group">
      <h5 class="ff-pcf-group-title">Liquidity (Year 1)</h5>
      <div class="ff-pcf-summary">
        ${card("Opening Balance", formatMoney(pcf.openingBalance || 0))}
        ${card("Closing (Dec)", formatMoney(summary.closingEndOfYear || 0))}
        ${card("Surplus / Deficit (Year 1)", formatMoney(netChange), netChangeCardClass)}
      </div>
    </div>
    <div class="ff-pcf-group">
      <h5 class="ff-pcf-group-title">Risk (Year 1)</h5>
      <div class="ff-pcf-summary">
        ${card("Worst Month (Min Closing)", worstMonthCardValue, minCardClass)}
        ${card("Months Below Zero", String(monthsNegative), monthsNegCardClass)}
        ${card("Runway (months)", runwayCardValue, runwayCardClass)}
      </div>
    </div>
    <div class="ff-pcf-group">
      <h5 class="ff-pcf-group-title">Decision &amp; Action (Year 1)</h5>
      <div class="ff-pcf-summary">
        ${card("Required Drawings To Stay Solvent", requiredCardValue, requiredCardClass)}
        ${card("Dependency On Business Drawings", dependencyCardValue, dependencyCardClass)}
      </div>
    </div>
    <div class="ff-pcf-group">
      <h5 class="ff-pcf-group-title">Owner Extraction &amp; Inflow Mix (Year 1)</h5>
      <div class="ff-pcf-summary">
        ${card("Drawings From Business", formatMoney(totalDrawings))}
        ${card("Other Personal Inflows", formatMoney(nonDrawingsInflows))}
        ${card("Total Inflows", formatMoney(totalInflowsY1))}
        ${card("Total Outflows", formatMoney(totalOutflowsY1))}
      </div>
    </div>
  `;

  // Lightweight stress-testing control. This is NOT a scenario engine — it
  // recomputes decision metrics client-side from the baseline monthly arrays
  // using the same helper as the engine, then displays the stressed view
  // side-by-side with the base case. Canonical state is never mutated.
  const stressControlHtml = `
    <div class="ff-pcf-stress" data-region="pcf-stress">
      <div class="ff-pcf-stress-head">
        <h5 class="ff-pcf-group-title" style="margin-bottom:0;">Lightweight Stress Test</h5>
        <span class="ff-pcf-stress-helper">
          Preview how key personal-cash decisions respond to a small adverse case.
          Baseline values are unchanged.
        </span>
      </div>
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
      <div class="ff-pcf-stress-output" data-region="pcf-stress-output" hidden></div>
    </div>
    <script type="application/json" id="ff-personal-cashflow-stress-base">${JSON.stringify(baseForStress)}</script>
  `;

  const chartData = {
    labels: calendarLabels,
    series: [
      { label: "Closing Balance", values: closingMonthly, stroke: "#86A8FF" },
      { label: "Total Inflows", values: inflowsMonthly, stroke: "#8ED6A6" },
      { label: "Total Outflows", values: outflowsMonthly, stroke: "#E7B6D2" }
    ],
    markers: worstIdx >= 0
      ? [{ index: worstIdx, value: minClosing, color: "#E97B7B", label: `Worst: ${worstMonthLabel} ${formatMoney(minClosing)}` }]
      : []
  };

  const body = `
    <p class="ff-helper">
      Your <strong>personal</strong> monthly cash flow for Year 1 &mdash; this models your personal cash, not business profit.
      "Drawings from business" is the cash the business pays to you; it is linked to the business side to avoid double counting.
    </p>
    ${summaryHtml}
    ${stressControlHtml}
    <div class="ff-panel" style="margin-top:0.9rem;">
      <h4>Personal Cash Flow Trend (Year 1)</h4>
      <div class="ff-chart" data-chart="personal-cashflow-trend"></div>
      ${worstIdx >= 0 && minClosing < 0
        ? `<p class="ff-helper ff-pcf-trend-caption"><strong>Worst month:</strong> ${worstMonthLabel} (closing ${formatMoney(minClosing)}).</p>`
        : ""}
    </div>
    ${tableHtml}
    <script type="application/json" id="ff-personal-cashflow-data">${JSON.stringify(chartData)}</script>
  `;

  return panel("Personal Cash Flow (Year 1)", body);
}

function keyRatiosPanel(raw, derived) {
  const pl = raw.profitLoss || {};
  const collections = raw.collections || {};
  const loans = raw.loans || {};
  const bs = raw.balanceSheet || {};
  const cf = raw.cashFlow || {};

  const totalRevenue = sumArray(pl.revenueMonthly || []);
  const totalGp = sumArray(pl.grossProfitMonthly || []);
  const totalEbitda = sumArray(pl.ebitdaMonthly || []);
  const totalNpat = sumArray(pl.netProfitAfterTaxMonthly || []);
  const totalInterest = sumArray(pl.interestMonthly || []);
  const totalInvoiced = sumArray(collections.invoicedBasisMonthly || []);
  const totalCollected = sumArray(collections.cashCollectedMonthly || []);

  const revenueByYear = monthlyToYearly(pl.revenueMonthly || []);
  const gpByYear = monthlyToYearly(pl.grossProfitMonthly || []);
  const ebitdaByYear = monthlyToYearly(pl.ebitdaMonthly || []);
  const npatByYear = monthlyToYearly(pl.netProfitAfterTaxMonthly || []);
  const interestByYear = monthlyToYearly(pl.interestMonthly || []);

  const gmByYear = revenueByYear.map((r, i) => safeDivide(gpByYear[i], r) * 100);
  const emByYear = revenueByYear.map((r, i) => safeDivide(ebitdaByYear[i], r) * 100);
  const nmByYear = revenueByYear.map((r, i) => safeDivide(npatByYear[i], r) * 100);

  const receivablesEnd = (collections.receivablesClosingMonthly || []).slice(-1)[0] || 0;
  const dsoOverall = totalInvoiced === 0 ? 0 : (receivablesEnd / (totalInvoiced / 36)) * 30;

  const dscrByYear = interestByYear.map((i, idx) => safeDivide(ebitdaByYear[idx], i));

  const revenueGrowthY2 = safeDivide(revenueByYear[1] - revenueByYear[0], revenueByYear[0]) * 100;
  const revenueGrowthY3 = safeDivide(revenueByYear[2] - revenueByYear[1], revenueByYear[1]) * 100;

  const finalAssets = (bs.assetsMonthly || []).slice(-1)[0] || 0;
  const finalLiabilities = (bs.liabilitiesMonthly || []).slice(-1)[0] || 0;
  const finalEquity = (bs.equityMonthly || []).slice(-1)[0] || 0;
  const debtToEquity = safeDivide(finalLiabilities, finalEquity);

  const rows = [
    { label: "Gross Margin %", values: gmByYear, kind: "percent", skipTotal: true },
    { label: "EBITDA Margin %", values: emByYear, kind: "percent", skipTotal: true },
    { label: "Net Profit Margin %", values: nmByYear, kind: "percent", skipTotal: true },
    { label: "Revenue Growth Y/Y %", values: [0, revenueGrowthY2, revenueGrowthY3], kind: "percent", skipTotal: true },
    { label: "Interest Coverage (EBITDA / Interest)", values: dscrByYear.map((v) => v.toFixed(2)), kind: "number", skipTotal: true }
  ];

  const yearlyTable = buildPeriodTable({
    rows,
    columns: yearLabels(),
    includeTotal: false,
    firstColHeader: "Ratio"
  });

  const overall = `
    <div class="ff-kpi-grid">
      ${statCard("Overall Gross Margin", formatPercent(safeDivide(totalGp, totalRevenue) * 100))}
      ${statCard("Overall EBITDA Margin", formatPercent(safeDivide(totalEbitda, totalRevenue) * 100))}
      ${statCard("Overall NPAT Margin", formatPercent(safeDivide(totalNpat, totalRevenue) * 100))}
      ${statCard("Collection Efficiency", formatPercent(safeDivide(totalCollected, totalInvoiced) * 100))}
      ${statCard("DSO (approx, days)", formatNumber(dsoOverall, 1))}
      ${statCard("Debt / Equity (final)", debtToEquity.toFixed(2))}
      ${statCard("Interest Coverage (Y1)", (dscrByYear[0] || 0).toFixed(2))}
      ${statCard("Interest Coverage (Y3)", (dscrByYear[2] || 0).toFixed(2))}
    </div>
  `;

  return panel("Key Ratios", `
    <p class="ff-helper">Year-over-year efficiency, profitability, and leverage indicators.</p>
    ${overall}
    ${yearlyTable}
  `);
}

function formatCurrencyList(parts) {
  return parts.filter(Boolean).join(", ");
}

function scenarioInputsRecap(canonical) {
  if (!canonical) return panel("Scenario Inputs Recap", `<p class="ff-helper">No canonical state available.</p>`);

  const setup = canonical.setup || {};
  const meta = canonical.meta || {};
  const yearsObj = canonical.years || {};
  const salesLines = canonical.salesDetails?.lines || [];
  const assetItems = canonical.assets?.items || [];
  const loanItems = canonical.loans?.items || [];
  const pcf = canonical.personalCashFlow || {};
  const personalInflows = Array.isArray(pcf.inflows) ? pcf.inflows : [];
  const personalOutflows = Array.isArray(pcf.outflows) ? pcf.outflows : [];
  const personalSharedCosts = Array.isArray(pcf.sharedCosts) ? pcf.sharedCosts : [];
  const legacyPersonalItems = Array.isArray(pcf.items) ? pcf.items : [];
  const collectionsPolicy = canonical.collectionsPolicy || {};

  const setupGroup = `
    <div class="ff-inputs-recap__group">
      <h4>Setup</h4>
      <dl>
        <dt>Business Name</dt><dd>${escapeHtml(setup.businessName || "—")}</dd>
        <dt>Currency</dt><dd>${escapeHtml(meta.currency || "—")}</dd>
        <dt>Forecast Horizon</dt><dd>${escapeHtml(String(meta.forecastHorizonYears || "—"))} years</dd>
        <dt>Start Month</dt><dd>${escapeHtml(String(setup.startMonth || "—"))}</dd>
        <dt>Trading Structure</dt><dd>${escapeHtml(String(setup.tradingStructure || "—"))}</dd>
        <dt>GST Registration</dt><dd>${escapeHtml(String(setup.gstRegistration || "—"))}</dd>
        <dt>Charge GST on Sales</dt><dd>${setup.chargeGstOnSales ? "Yes" : "No"}</dd>
        <dt>BAS Frequency</dt><dd>${escapeHtml(String(setup.basFrequency || "—"))}</dd>
        <dt>Report Basis</dt><dd>${escapeHtml(String(setup.reportBasis || "—"))}</dd>
        <dt>Opening Cash</dt><dd>${formatMoney(setup.openingCash)}</dd>
      </dl>
    </div>
  `;

  const collectionsGroup = `
    <div class="ff-inputs-recap__group">
      <h4>Collections Policy</h4>
      <dl>
        <dt>Default Debtor Days</dt><dd>${escapeHtml(String(collectionsPolicy.defaultDebtorDays ?? "—"))}</dd>
        <dt>Bad Debt %</dt><dd>${formatPercent((collectionsPolicy.badDebtPct ?? 0))}</dd>
        <dt>Receivables Basis</dt><dd>${escapeHtml(String(collectionsPolicy.receivablesBasis || "—"))}</dd>
        <dt>Opening Receivables</dt><dd>${formatMoney(collectionsPolicy.openingReceivables)}</dd>
        <dt>Collection Split (M, M+1, M+2)</dt><dd>${(collectionsPolicy.collectionSplitByMonthBucket || []).map((v) => formatPercent(Number(v) * 100)).join(" / ")}</dd>
      </dl>
    </div>
  `;

  const yearsGroup = ["year1", "year2", "year3"]
    .map((yk, idx) => {
      const y = yearsObj[yk] || {};
      const a = y.assumptions || {};
      const cp = y.costProfile || {};
      const oa = y.ownerAdjustments || {};
      const mktg = (y.marketing?.lineItems || [])
        .map((m) => `${formatMoney(m.monthlyAmount)}/mo, M${m.startMonth}-M${m.endMonth}`)
        .join("; ");
      return `
        <div class="ff-inputs-recap__group">
          <h4>Year ${idx + 1} Plan</h4>
          <dl>
            <dt>Growth %</dt><dd>${formatPercent(a.growthPct ?? 0)}</dd>
            <dt>CPI %</dt><dd>${formatPercent(a.cpiPct ?? 0)}</dd>
            <dt>Tax Rate %</dt><dd>${formatPercent(a.taxRatePct ?? 0)}</dd>
            <dt>GST Rate %</dt><dd>${formatPercent(a.gstRatePct ?? 0)}</dd>
            <dt>Fixed Monthly Cost</dt><dd>${formatMoney(cp.fixedMonthlyCost)}</dd>
            <dt>Variable %</dt><dd>${formatPercent(cp.variableCostPctOfRevenue ?? 0)}</dd>
            <dt>Direct Labor %</dt><dd>${formatPercent(cp.directLaborPctOfRevenue ?? 0)}</dd>
            <dt>Other Operating</dt><dd>${formatMoney(cp.otherOperatingExpenseMonthly)}</dd>
            <dt>Owner Model</dt><dd>${escapeHtml(String(oa.modelType || "—"))}</dd>
            <dt>Drawings Monthly</dt><dd>${formatMoney(oa.ownerDrawingsMonthly)}</dd>
            <dt>Director Salary Monthly</dt><dd>${formatMoney(oa.directorSalaryMonthly)}</dd>
            <dt>Distributions Monthly</dt><dd>${formatMoney(oa.distributionsMonthly)}</dd>
            <dt>Marketing</dt><dd>${escapeHtml(mktg || "—")}</dd>
          </dl>
        </div>
      `;
    })
    .join("");

  const salesLinesTable = salesLines.length
    ? `<div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Line</th><th>Type</th><th>Unit Price</th><th>Default Units/mo</th><th>COGS</th><th>Merchant Fee</th><th>GST?</th><th>Active?</th><th>Seasonality (Jan-Dec)</th></tr></thead><tbody>${
      salesLines.map((line) => `
        <tr>
          <th>${escapeHtml(line.name || "—")}</th>
          <td>${escapeHtml(line.type || "—")}</td>
          <td>${formatMoney(line.unitPrice)}</td>
          <td>${formatNumber(line.defaultUnitsPerPeriod, 1)}</td>
          <td>${line.costOfGoodsSold != null ? formatMoney(line.costOfGoodsSold) : (line.grossMarginPercent != null ? `${formatPercent(line.grossMarginPercent)} GM` : "—")}</td>
          <td>${formatPercent(line.merchantFeePercent ?? 0)}</td>
          <td>${line.gstApplies ? "Yes" : "No"}</td>
          <td>${line.isActive === false ? "No" : "Yes"}</td>
          <td>${(line.seasonalityByMonth || []).map((v) => formatNumber(v, 2)).join(", ")}</td>
        </tr>
      `).join("")
    }</tbody></table></div>`
    : `<p class="ff-helper">No revenue streams.</p>`;

  const assetsTable = assetItems.length
    ? `<div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Asset</th><th>Category</th><th>Purchase</th><th>Purchase Month</th><th>Useful Life (Y)</th><th>Depreciation</th><th>Residual</th></tr></thead><tbody>${
      assetItems.map((a) => `
        <tr>
          <th>${escapeHtml(a.name || "—")}</th>
          <td>${escapeHtml(a.category || "—")}</td>
          <td>${formatMoney(a.purchaseAmount)}</td>
          <td>M${escapeHtml(String(a.purchaseMonthIndex ?? "—"))}</td>
          <td>${escapeHtml(String(a.usefulLifeYears ?? "—"))}</td>
          <td>${escapeHtml(a.depreciationMethod || "—")}</td>
          <td>${formatMoney(a.residualValue)}</td>
        </tr>
      `).join("")
    }</tbody></table></div>`
    : `<p class="ff-helper">No assets.</p>`;

  const loansTable = loanItems.length
    ? `<div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Loan</th><th>Principal</th><th>Rate</th><th>Term (Y)</th><th>Frequency</th><th>Drawdown Month</th><th>Repayment Start</th></tr></thead><tbody>${
      loanItems.map((l) => `
        <tr>
          <th>${escapeHtml(l.name || "—")}</th>
          <td>${formatMoney(l.principal)}</td>
          <td>${formatPercent(l.annualInterestRate ?? 0)}</td>
          <td>${escapeHtml(String(l.termYears ?? "—"))}</td>
          <td>${escapeHtml(l.repaymentFrequency || "—")}</td>
          <td>M${escapeHtml(String(l.drawdownMonthIndex ?? "—"))}</td>
          <td>M${escapeHtml(String(l.repaymentStartMonthIndex ?? "—"))}</td>
        </tr>
      `).join("")
    }</tbody></table></div>`
    : `<p class="ff-helper">No loans.</p>`;

  const rowTotal = (row) => (row.monthly || []).reduce((sum, v) => sum + Number(v || 0), 0);
  const monthlyRowHtml = (rows) => rows.length
    ? `<div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Row</th><th>Y1 Total</th><th>Monthly (Jan-Dec)</th></tr></thead><tbody>${
      rows.map((r) => `
        <tr>
          <th>${escapeHtml(r.label || r.id || "—")}</th>
          <td>${formatMoney(rowTotal(r))}</td>
          <td>${(r.monthly || []).map((v) => formatNumber(Number(v || 0), 0)).join(", ")}</td>
        </tr>
      `).join("")
    }</tbody></table></div>`
    : `<p class="ff-helper">No rows.</p>`;

  const sharedCostsTableHtml = personalSharedCosts.length
    ? `<div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Item</th><th>Amount</th><th>Frequency</th><th>Personal Use %</th></tr></thead><tbody>${
      personalSharedCosts.map((s) => `
        <tr>
          <th>${escapeHtml(s.name || "—")}</th>
          <td>${formatMoney(s.amount)}</td>
          <td>${escapeHtml(s.frequency || "—")}</td>
          <td>${formatPercent(s.personalUsePercent ?? 0)}</td>
        </tr>
      `).join("")
    }</tbody></table></div>`
    : `<p class="ff-helper">No shared costs.</p>`;

  const legacyItemsHtml = legacyPersonalItems.length
    ? `<details class="ff-details"><summary>Legacy Items (${legacyPersonalItems.length}) — migrated</summary><div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Item</th><th>Amount</th><th>Frequency</th><th>Personal Use %</th></tr></thead><tbody>${
      legacyPersonalItems.map((p) => `
        <tr>
          <th>${escapeHtml(p.name || "—")}</th>
          <td>${formatMoney(p.amount)}</td>
          <td>${escapeHtml(p.frequency || "—")}</td>
          <td>${formatPercent(p.personalUsePercent ?? 0)}</td>
        </tr>
      `).join("")
    }</tbody></table></div></details>`
    : "";

  const pcfHeadingSuffix = `${pcf.year1Only ? " — Year 1 Only" : ""} · Opening Bal: ${formatMoney(pcf.openingBalance ?? 0)}`;

  const body = `
    <div class="ff-inputs-recap">
      ${setupGroup}
      ${collectionsGroup}
      ${yearsGroup}
      <div class="ff-inputs-recap__group"><h4>Revenue Streams (${salesLines.length})</h4>${salesLinesTable}</div>
      <div class="ff-inputs-recap__group"><h4>Assets (${assetItems.length})</h4>${assetsTable}</div>
      <div class="ff-inputs-recap__group"><h4>Loans (${loanItems.length})</h4>${loansTable}</div>
      <div class="ff-inputs-recap__group">
        <h4>Personal Cash Flow${pcfHeadingSuffix}</h4>
        <h5 class="ff-inputs-recap__subhead">Personal Inflows (${personalInflows.length})</h5>
        ${monthlyRowHtml(personalInflows)}
        <h5 class="ff-inputs-recap__subhead">Personal Outflows (${personalOutflows.length})</h5>
        ${monthlyRowHtml(personalOutflows)}
        <h5 class="ff-inputs-recap__subhead">Shared Business/Personal Costs (${personalSharedCosts.length})</h5>
        ${sharedCostsTableHtml}
        ${legacyItemsHtml}
      </div>
    </div>
  `;

  return panel("Scenario Inputs Recap", `
    <details class="ff-details" open>
      <summary>Expand / collapse all assumptions driving this forecast</summary>
      ${body}
    </details>
  `);
}

export function renderResultsStep(snapshot) {
  const result = snapshot.engine.strict?.status === "ok" ? snapshot.engine.strict : snapshot.engine.lenient;
  if (!result) {
    return `<section class="ff-panel"><p>Update any input to generate your first live preview.</p></section>`;
  }

  const derived = result.derived || {};
  const raw = result.raw || {};
  const canonical = snapshot.canonical || {};
  const summary = derived.summaryCards || {};
  const lowestCash = Math.min(...(raw.cashFlow?.closingCashMonthly || [0]));
  const receivablesEnd = raw.collections?.receivablesClosingMonthly?.slice(-1)[0] || 0;
  const breakEvenYear1 = raw.breakEven?.yearly?.[0] || {};
  const combinedBreakEvenY1 = Number(breakEvenYear1.serviceBreakEvenRevenue || 0) + Number(breakEvenYear1.productBreakEvenRevenue || 0);

  const kpis = [
    statCard("Total Revenue", formatMoney(summary.totalRevenue || 0)),
    statCard("Total Net Profit After Tax", formatMoney(summary.totalNetProfitAfterTax || 0)),
    statCard("Average Margin", formatPercent(summary.averageMarginPct || 0)),
    statCard("Final Closing Cash", formatMoney(summary.finalClosingCash || 0)),
    statCard("Lowest Cash Point", formatMoney(lowestCash)),
    statCard("Receivables At End", formatMoney(receivablesEnd)),
    statCard("Break-Even Revenue (Y1)", formatMoney(combinedBreakEvenY1)),
    statCard("Warnings", String((result.warnings || []).length))
  ].join("");

  const quarterlyFromMonthly = buildQuarterlyRevenueFromMonthly(derived.charts?.revenueNetMonthly || []);
  const quarterlyClosingCash = buildQuarterClosingCashFromMonthly(raw.cashFlow?.closingCashMonthly || []);
  const quarterlyRevenueByKey = Object.fromEntries(quarterlyFromMonthly.labels.map((label, index) => [label, quarterlyFromMonthly.values[index]]));
  console.debug("[ff] quarterly revenue dataset", quarterlyRevenueByKey);
  console.debug("[ff] quarterly closing cash source", quarterlyClosingCash);

  const pl = raw.profitLoss || {};
  const cf = raw.cashFlow || {};
  const bs = raw.balanceSheet || {};

  const marginChartData = {
    revenueMonthly: pl.revenueMonthly || [],
    gpMonthly: pl.grossProfitMonthly || [],
    ebitdaMonthly: pl.ebitdaMonthly || [],
    npatMonthly: pl.netProfitAfterTaxMonthly || []
  };
  const marginSeries = {
    labels: monthLabels(),
    series: [
      { label: "Gross Margin %", values: marginPctSeries(marginChartData.gpMonthly, marginChartData.revenueMonthly), stroke: "#D8B98A" },
      { label: "EBITDA Margin %", values: marginPctSeries(marginChartData.ebitdaMonthly, marginChartData.revenueMonthly), stroke: "#8ED6A6" },
      { label: "NPAT Margin %", values: marginPctSeries(marginChartData.npatMonthly, marginChartData.revenueMonthly), stroke: "#86A8FF" }
    ]
  };

  const cashFlowComponents = {
    labels: monthLabels(),
    series: [
      { label: "Net Operating", values: cf.netOperatingMonthly || [], stroke: "#8ED6A6" },
      { label: "Net Investing", values: cf.netInvestingMonthly || [], stroke: "#E7B6D2" },
      { label: "Net Financing", values: cf.netFinancingMonthly || [], stroke: "#86A8FF" }
    ]
  };

  const balanceSheetSeries = {
    labels: monthLabels(),
    series: [
      { label: "Total Assets", values: bs.assetsMonthly || [], stroke: "#D8B98A" },
      { label: "Total Liabilities", values: bs.liabilitiesMonthly || [], stroke: "#E7B6D2" },
      { label: "Total Equity", values: bs.equityMonthly || [], stroke: "#8ED6A6" }
    ]
  };

  const streamSeries = (canonical?.salesDetails?.lines || [])
    .filter((line) => line.isActive !== false)
    .slice(0, 6)
    .map((line) => ({
      label: line.name || "(unnamed)",
      values: raw.sales?.monthly?.byLineNet?.[line.id] || []
    }));
  const streamSeriesData = {
    labels: monthLabels(),
    series: streamSeries
  };

  return `
    <section class="ff-panel">
      <div class="ff-subsection-head ff-subsection-head--actions">
        <div class="ff-actions-inline">
          <button class="btn btn--outline" data-action="print-summary">Print Summary</button>
          <button class="btn btn--outline" data-action="save-json-file">Save JSON Data</button>
        </div>
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
        <div class="ff-panel">
          <h3>Revenue By Stream</h3>
          <div class="ff-chart" data-chart="revenue-by-stream"></div>
        </div>
        <div class="ff-panel">
          <h3>Margin Trend (%)</h3>
          <div class="ff-chart" data-chart="margin-trend"></div>
        </div>
        <div class="ff-panel">
          <h3>Cash Flow Components</h3>
          <div class="ff-chart" data-chart="cashflow-components"></div>
        </div>
        <div class="ff-panel">
          <h3>Balance Sheet Components</h3>
          <div class="ff-chart" data-chart="balance-sheet-components"></div>
        </div>
      </div>

      ${panel("Annual Summary", annualSummary(derived))}
      ${panel("Quarterly Performance", `<div class="ff-table-wrap"><table class="ff-table"><thead><tr><th>Quarter</th><th>Revenue</th><th>Net Profit</th><th>Closing Cash</th></tr></thead><tbody>${
        Object.keys(quarterlyRevenueByKey)
          .map((quarterKey) => `
            <tr>
              <th>${quarterKey}</th>
              <td>${formatMoney(quarterlyRevenueByKey[quarterKey] ?? 0)}</td>
              <td>${formatMoney(raw.quarterly?.flowRollups?.netProfitAfterTax?.[quarterKey] || 0)}</td>
              <td>${formatMoney(quarterlyClosingCash[quarterKey] ?? raw.quarterly?.positionSnapshots?.closingCash?.[quarterKey] ?? 0)}</td>
            </tr>`)
          .join("")
      }</tbody></table></div>`)}

      ${profitAndLossPanel(raw)}
      ${cashFlowStatementPanel(raw)}
      ${balanceSheetPanel(raw)}
      ${revenueByStreamPanel(raw, canonical)}
      ${collectionsPanel(raw)}
      ${costsBreakdownPanel(raw)}
      ${ownerCompPanel(raw)}
      ${financingPanel(raw)}
      ${assetsPanel(raw)}
      ${breakEvenPanel(raw, derived)}
      ${taxGstPanel(raw)}
      ${keyRatiosPanel(raw, derived)}
      ${personalCashFlowPanel(raw)}

      ${panel("Warnings And Issues", warningTable(result.warnings || []))}

      ${scenarioInputsRecap(canonical)}

      <script type="application/json" id="ff-quarterly-revenue-data">${JSON.stringify(quarterlyFromMonthly)}</script>
      <script type="application/json" id="ff-margin-trend-data">${JSON.stringify(marginSeries)}</script>
      <script type="application/json" id="ff-cashflow-components-data">${JSON.stringify(cashFlowComponents)}</script>
      <script type="application/json" id="ff-balance-sheet-components-data">${JSON.stringify(balanceSheetSeries)}</script>
      <script type="application/json" id="ff-revenue-by-stream-data">${JSON.stringify(streamSeriesData)}</script>
    </section>
  `;
}

function parseJsonNode(root, selector) {
  const node = root.querySelector(selector);
  if (!node) return null;
  try {
    return JSON.parse(node.textContent || "{}");
  } catch (error) {
    console.debug("[ff] parse chart data failed", selector, error);
    return null;
  }
}

export function hydrateDashboardCharts(root, snapshot) {
  const result = snapshot.engine.strict?.status === "ok" ? snapshot.engine.strict : snapshot.engine.lenient;
  if (!result || !result.derived) return;

  const labels = (result.derived.charts?.revenueNetMonthly || []).map((_, idx) => `M${idx + 1}`);
  renderLineChart(root.querySelector('[data-chart="revenue"]'), result.derived.charts?.revenueNetMonthly || [], labels, { title: "Revenue Trend", stroke: "#D8B98A" });
  renderLineChart(root.querySelector('[data-chart="profit"]'), result.derived.charts?.netProfitAfterTaxMonthly || [], labels, { title: "Net Profit Trend", stroke: "#8ED6A6" });
  renderLineChart(root.querySelector('[data-chart="cash"]'), result.derived.charts?.closingCashMonthly || [], labels, { title: "Closing Cash Trend", stroke: "#86A8FF" });

  const quarterly = parseJsonNode(root, "#ff-quarterly-revenue-data");
  if (quarterly) {
    renderBarChart(root.querySelector('[data-chart="quarterly-revenue"]'), quarterly.values || [], quarterly.labels || []);
  }

  const margin = parseJsonNode(root, "#ff-margin-trend-data");
  if (margin) {
    renderMultiLineChart(root.querySelector('[data-chart="margin-trend"]'), margin.series || [], margin.labels || [], { title: "Margin Trend" });
  }

  const cfComponents = parseJsonNode(root, "#ff-cashflow-components-data");
  if (cfComponents) {
    renderMultiLineChart(root.querySelector('[data-chart="cashflow-components"]'), cfComponents.series || [], cfComponents.labels || [], { title: "Cash Flow Components" });
  }

  const bsComponents = parseJsonNode(root, "#ff-balance-sheet-components-data");
  if (bsComponents) {
    renderMultiLineChart(root.querySelector('[data-chart="balance-sheet-components"]'), bsComponents.series || [], bsComponents.labels || [], { title: "Balance Sheet Components" });
  }

  const streams = parseJsonNode(root, "#ff-revenue-by-stream-data");
  if (streams) {
    renderMultiLineChart(root.querySelector('[data-chart="revenue-by-stream"]'), streams.series || [], streams.labels || [], { title: "Revenue By Stream" });
  }

  const pcfData = parseJsonNode(root, "#ff-personal-cashflow-data");
  if (pcfData) {
    renderMultiLineChart(root.querySelector('[data-chart="personal-cashflow-trend"]'), pcfData.series || [], pcfData.labels || [], { title: "Personal Cash Flow (Year 1)", markers: pcfData.markers || [] });
  }

  hydratePersonalCashFlowStress(root);
}

function formatRunway(months) {
  if (months == null) return "No depletion in Year 1";
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

function hydratePersonalCashFlowStress(root) {
  const stressRegion = root.querySelector('[data-region="pcf-stress"]');
  const baseNode = root.querySelector("#ff-personal-cashflow-stress-base");
  if (!stressRegion || !baseNode) return;
  let base;
  try {
    base = JSON.parse(baseNode.textContent || "{}");
  } catch (error) {
    console.debug("[ff] stress base parse failed", error);
    return;
  }
  const calendarLabels = Array.isArray(base.calendarLabels) ? base.calendarLabels : [];
  const outputNode = stressRegion.querySelector('[data-region="pcf-stress-output"]');
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
