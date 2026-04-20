import { formatMoney, formatPercent, formatNumber, escapeHtml } from "./renderers/shared/format.js";
import {
  monthlyToQuarterly,
  monthlyToYearly,
  monthlySnapshotByQuarter,
  monthlySnapshotByYear,
  quarterLabels,
  yearLabels,
  monthLabels,
  monthLabelsForYear,
  sliceYearFromMonthly,
  sumArray,
  safeDivide
} from "./renderers/shared/aggregate.js";

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
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

function formatCell(value, kind) {
  if (kind === "percent") return formatPercent(value);
  if (kind === "number") return Number(value || 0).toLocaleString("en-AU");
  return formatMoney(value);
}

/**
 * Build a period table in PRINT styling (not dashboard styling).
 * rows: [{ label, values, kind, emphasis, skipTotal, totalOverride }]
 * columns: string[]
 */
function buildPrintPeriodTable({ rows = [], columns = [], includeTotal = false, firstColHeader = "Line Item" } = {}) {
  const totalHeader = includeTotal ? "<th>Total</th>" : "";
  const head = `<thead><tr><th>${escapeHtml(firstColHeader)}</th>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}${totalHeader}</tr></thead>`;
  const body = rows
    .map((row) => {
      const kind = row.kind || "money";
      const emphasisClass = row.emphasis ? ` class="print-row-${row.emphasis}"` : "";
      const cells = columns.map((_, idx) => `<td>${formatCell(row.values?.[idx] ?? 0, kind)}</td>`).join("");
      let totalCell = "";
      if (includeTotal) {
        if (row.totalOverride != null) {
          totalCell = `<td>${formatCell(row.totalOverride, kind)}</td>`;
        } else if (kind === "percent" || row.skipTotal) {
          totalCell = "<td>&mdash;</td>";
        } else {
          totalCell = `<td>${formatCell(sumArray(row.values || []), kind)}</td>`;
        }
      }
      return `<tr${emphasisClass}><th scope="row">${escapeHtml(row.label)}</th>${cells}${totalCell}</tr>`;
    })
    .join("");
  return `<table class="print-table print-table--period">${head}<tbody>${body}</tbody></table>`;
}

/**
 * Build 3 stacked month tables (one per year) from full-horizon monthly rows.
 * rowSpecs have shape { label, monthly, kind, emphasis, skipTotal } OR
 * { label, valuesFullMonthly, kind, emphasis, skipTotal }.
 * When snapshot=true, the row is treated as a period-end snapshot (no totals).
 */
function buildMonthlyByYearTables(rowSpecs, { snapshot = false, firstColHeader = "Line Item", includeTotal = true } = {}) {
  const tables = [];
  for (let yearIndex = 0; yearIndex < 3; yearIndex += 1) {
    const rows = rowSpecs.map((spec) => {
      let values;
      if (!snapshot && spec.kind === "percent" && spec.numeratorMonthly && spec.denominatorMonthly) {
        const fullRatios = ratioByPeriod(spec.numeratorMonthly, spec.denominatorMonthly, 1);
        values = fullRatios.slice(yearIndex * 12, yearIndex * 12 + 12);
      } else {
        const fullMonthly = spec.monthly || [];
        values = sliceYearFromMonthly(fullMonthly, yearIndex);
      }
      return {
        label: spec.label,
        values,
        kind: spec.kind || "money",
        emphasis: spec.emphasis,
        skipTotal: snapshot || spec.skipTotal
      };
    });
    const title = `Year ${yearIndex + 1} Monthly (M${yearIndex * 12 + 1}–M${yearIndex * 12 + 12})`;
    tables.push(`<h4 class="print-sub-heading">${escapeHtml(title)}</h4>${buildPrintPeriodTable({
      rows,
      columns: monthLabelsForYear(yearIndex),
      includeTotal: snapshot ? false : includeTotal,
      firstColHeader
    })}`);
  }
  return tables.join("");
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

function valuesForPeriod(spec, { snapshot, periodLength }) {
  if (snapshot) {
    if (periodLength === 12) return monthlySnapshotByYear(spec.monthly || []);
    if (periodLength === 3) return monthlySnapshotByQuarter(spec.monthly || []);
    return (spec.monthly || []).slice(0, 36);
  }
  if (spec.kind === "percent" && spec.numeratorMonthly && spec.denominatorMonthly) {
    return ratioByPeriod(spec.numeratorMonthly, spec.denominatorMonthly, periodLength);
  }
  if (periodLength === 12) return monthlyToYearly(spec.monthly || []);
  if (periodLength === 3) return monthlyToQuarterly(spec.monthly || []);
  return (spec.monthly || []).slice(0, 36);
}

function statementPrintSection(title, specs, { snapshot = false, firstColHeader = "Line Item", includeTotal = true, description = "" } = {}) {
  const quarterlyRows = specs.map((spec) => ({
    label: spec.label,
    kind: spec.kind || "money",
    emphasis: spec.emphasis,
    values: valuesForPeriod(spec, { snapshot, periodLength: 3 }),
    skipTotal: snapshot || spec.skipTotal,
    totalOverride: spec.yearlyTotalOverride
  }));
  const yearlyRows = specs.map((spec) => ({
    label: spec.label,
    kind: spec.kind || "money",
    emphasis: spec.emphasis,
    values: valuesForPeriod(spec, { snapshot, periodLength: 12 }),
    skipTotal: snapshot || spec.skipTotal,
    totalOverride: spec.yearlyTotalOverride
  }));
  return `
    <section class="print-subsection">
      <h3>${escapeHtml(title)}</h3>
      ${description ? `<p class="print-helper">${escapeHtml(description)}</p>` : ""}
      <h4 class="print-sub-heading">Yearly Summary</h4>
      ${buildPrintPeriodTable({ rows: yearlyRows, columns: yearLabels(), includeTotal: snapshot ? false : includeTotal, firstColHeader })}
      <h4 class="print-sub-heading">Quarterly Summary</h4>
      ${buildPrintPeriodTable({ rows: quarterlyRows, columns: quarterLabels(), includeTotal: snapshot ? false : includeTotal, firstColHeader })}
      ${buildMonthlyByYearTables(specs, { snapshot, firstColHeader, includeTotal })}
    </section>
  `;
}

function buildQuarterlyRevenueDataset(monthlyRevenue = []) {
  return { labels: quarterLabels(), values: monthlyToQuarterly(monthlyRevenue) };
}

function buildQuarterEndCashMap(monthlyClosingCash = []) {
  const snapshots = monthlySnapshotByQuarter(monthlyClosingCash);
  const out = {};
  quarterLabels().forEach((label, i) => { out[label] = snapshots[i]; });
  return out;
}

function linePath(values, width, height, min, max) {
  const span = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderLineChartSvg(title, labels, values, color = "#1f2937") {
  const numeric = values.map((value) => Number(value));
  if (!numeric.length || numeric.some((value) => Number.isNaN(value))) {
    console.debug("[ff] chart snapshot failure", { title, reason: "invalid-line-series" });
    return {
      ok: false,
      title,
      html: `<div class="print-chart-fallback">Chart unavailable for ${escapeHtml(title)} (invalid or empty series).</div>`
    };
  }
  const width = 860;
  const height = 250;
  const min = Math.min(...numeric, 0);
  const max = Math.max(...numeric, 0);
  const path = linePath(numeric, width, height, min, max);
  console.debug("[ff] chart snapshot success", { title, points: numeric.length });
  return {
    ok: true,
    title,
    html: `
    <figure class="print-chart" data-print-chart="${escapeHtml(title)}">
      <figcaption>${escapeHtml(title)}</figcaption>
      <svg viewBox="0 0 ${width} ${height + 44}" width="${width}" height="${height + 44}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(title)}" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="${width}" height="${height + 44}" fill="#ffffff" />
        <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#9ca3af" stroke-width="1" />
        <line x1="0" y1="0" x2="0" y2="${height}" stroke="#9ca3af" stroke-width="1" />
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
        <text x="0" y="${height + 26}" fill="#111827" font-size="12">${escapeHtml(labels[0] || "Start")}</text>
        <text x="${width - 4}" y="${height + 26}" text-anchor="end" fill="#111827" font-size="12">${escapeHtml(labels[labels.length - 1] || "End")}</text>
        <text x="0" y="12" fill="#111827" font-size="11">${Math.round(max).toLocaleString()}</text>
        <text x="0" y="${height}" fill="#111827" font-size="11">${Math.round(min).toLocaleString()}</text>
      </svg>
    </figure>
  `
  };
}

function renderMultiLineChartSvg(title, labels, seriesList) {
  const series = (seriesList || []).filter((s) => Array.isArray(s?.values) && s.values.length);
  if (!series.length) {
    return {
      ok: false,
      title,
      html: `<div class="print-chart-fallback">Chart unavailable for ${escapeHtml(title)} (no series).</div>`
    };
  }
  const width = 860;
  const height = 260;
  const flat = series.flatMap((s) => s.values.map((v) => Number(v || 0)));
  const min = Math.min(...flat, 0);
  const max = Math.max(...flat, 0);

  const colors = ["#0f766e", "#7c2d12", "#1d4ed8", "#92400e", "#4c1d95", "#065f46"];
  const paths = series
    .map((s, idx) => {
      const color = s.color || colors[idx % colors.length];
      const path = linePath(s.values.map((v) => Number(v || 0)), width, height, min, max);
      return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" />`;
    })
    .join("");
  const legend = series
    .map((s, idx) => {
      const color = s.color || colors[idx % colors.length];
      return `<g transform="translate(${12 + idx * 160}, ${height + 18})"><rect width="14" height="4" fill="${color}" /><text x="22" y="6" fill="#111827" font-size="11">${escapeHtml((s.label || "").slice(0, 22))}</text></g>`;
    })
    .join("");

  return {
    ok: true,
    title,
    html: `
    <figure class="print-chart" data-print-chart="${escapeHtml(title)}">
      <figcaption>${escapeHtml(title)}</figcaption>
      <svg viewBox="0 0 ${width} ${height + 44}" width="${width}" height="${height + 44}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(title)}" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="${width}" height="${height + 44}" fill="#ffffff" />
        <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#9ca3af" stroke-width="1" />
        <line x1="0" y1="0" x2="0" y2="${height}" stroke="#9ca3af" stroke-width="1" />
        ${paths}
        <text x="0" y="12" fill="#111827" font-size="11">${Math.round(max).toLocaleString()}</text>
        <text x="0" y="${height}" fill="#111827" font-size="11">${Math.round(min).toLocaleString()}</text>
        ${legend}
        <text x="0" y="${height + 36}" fill="#111827" font-size="10">${escapeHtml(labels[0] || "Start")}</text>
        <text x="${width - 4}" y="${height + 36}" text-anchor="end" fill="#111827" font-size="10">${escapeHtml(labels[labels.length - 1] || "End")}</text>
      </svg>
    </figure>
  `
  };
}

function renderBarChartSvg(title, labels, values) {
  const numeric = values.map((value) => Number(value));
  if (!numeric.length || numeric.some((value) => Number.isNaN(value)) || numeric.every((value) => value === 0)) {
    console.debug("[ff] chart snapshot failure", { title, reason: "invalid-bar-series" });
    return {
      ok: false,
      title,
      html: `<div class="print-chart-fallback">Chart unavailable for ${escapeHtml(title)} (no plottable quarterly values).</div>`
    };
  }
  const width = 860;
  const height = 280;
  const barWidth = width / Math.max(1, numeric.length);
  const max = Math.max(...numeric, 1);
  const bars = numeric
    .map((value, index) => {
      const ratio = Math.max(0, value) / max;
      const barHeight = ratio * (height - 26);
      const x = index * barWidth + 6;
      const y = height - barHeight - 18;
      const label = labels[index] || `Q${index + 1}`;
      return `
        <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(3, barWidth - 12).toFixed(2)}" height="${barHeight.toFixed(2)}" fill="#374151"></rect>
        <text x="${(x + (barWidth - 12) / 2).toFixed(2)}" y="${height - 4}" text-anchor="middle" fill="#111827" font-size="10">${escapeHtml(label)}</text>
      `;
    })
    .join("");
  console.debug("[ff] chart snapshot success", { title, bars: numeric.length });
  return {
    ok: true,
    title,
    html: `
    <figure class="print-chart" data-print-chart="${escapeHtml(title)}">
      <figcaption>${escapeHtml(title)}</figcaption>
      <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(title)}" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
        <line x1="0" y1="${height - 18}" x2="${width}" y2="${height - 18}" stroke="#9ca3af" stroke-width="1" />
        ${bars}
      </svg>
    </figure>
  `
  };
}

function buildAnnualSummaryTable(annual = {}) {
  const keys = Object.keys(annual.revenueNet || {});
  if (!keys.length) return "";
  const rows = keys
    .map((yearKey) => `
      <tr>
        <th>${escapeHtml(yearKey.toUpperCase())}</th>
        <td>${formatMoney(annual.revenueNet?.[yearKey] || 0)}</td>
        <td>${formatMoney(annual.netProfitAfterTax?.[yearKey] || 0)}</td>
        <td>${formatMoney(annual.netCash?.[yearKey] || 0)}</td>
      </tr>
    `)
    .join("");
  return `
    <table class="print-table">
      <thead><tr><th>Year</th><th>Revenue</th><th>Net Profit</th><th>Net Cash</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildQuarterlyPerformanceTable(labels, quarterlyRevenueValues, quarterlyProfitMap = {}, quarterEndCashMap = {}) {
  const rows = labels
    .map((label, index) => `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${formatMoney(quarterlyRevenueValues[index] || 0)}</td>
        <td>${formatMoney(quarterlyProfitMap[label] || 0)}</td>
        <td>${formatMoney(quarterEndCashMap[label] || 0)}</td>
      </tr>
    `)
    .join("");
  return `
    <table class="print-table">
      <thead><tr><th>Quarter</th><th>Revenue</th><th>Net Profit</th><th>Closing Cash</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildWarningsTable(warnings = []) {
  if (!warnings.length) {
    return "<p>No warnings in current preview.</p>";
  }
  const rows = warnings
    .map((warning) => `
      <tr>
        <td>${escapeHtml(warning.severity || "-")}</td>
        <td>${escapeHtml(warning.code || "-")}</td>
        <td>${escapeHtml(warning.domain || "-")}</td>
        <td>${escapeHtml(warning.message || "-")}</td>
      </tr>
    `)
    .join("");
  return `
    <table class="print-table">
      <thead><tr><th>Severity</th><th>Code</th><th>Domain</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildProfitAndLossSection(raw) {
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

  return statementPrintSection("Profit & Loss Statement", specs, {
    firstColHeader: "Line Item",
    description: "Expenses shown as negatives. Percent rows use revenue (net) as denominator."
  });
}

function buildCashFlowSection(raw) {
  const cf = raw.cashFlow || {};
  const flowSpecs = [
    { label: "Net Operating Cash Flow", monthly: cf.netOperatingMonthly, emphasis: "subtotal" },
    { label: "Net Investing Cash Flow", monthly: cf.netInvestingMonthly, emphasis: "subtotal" },
    { label: "Net Financing Cash Flow", monthly: cf.netFinancingMonthly, emphasis: "subtotal" },
    { label: "Net Cash Movement", monthly: cf.netCashMonthly, emphasis: "total" }
  ];
  const flowSection = statementPrintSection("Cash Flow Statement (Flows)", flowSpecs, {
    description: "Flows summed within each period."
  });
  const snapshotSection = statementPrintSection("Cash Flow Statement (Closing Cash)", [
    { label: "Closing Cash", monthly: cf.closingCashMonthly, emphasis: "total" }
  ], { snapshot: true, description: "Period-end cash balance (snapshot)." });
  return flowSection + snapshotSection;
}

function buildBalanceSheetSection(raw) {
  const bs = raw.balanceSheet || {};
  const cf = raw.cashFlow || {};
  const collections = raw.collections || {};
  const assets = raw.assets || {};
  const loans = raw.loans || {};

  const specs = [
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
  return statementPrintSection("Balance Sheet", specs, {
    snapshot: true,
    description: "Period-end snapshots. Balance Delta near zero indicates the books reconcile."
  });
}

function buildRevenueByStreamSection(raw, canonical) {
  const sales = raw.sales || {};
  const lines = canonical?.salesDetails?.lines || [];
  const active = lines.filter((line) => line.isActive !== false);
  if (!active.length) return "";

  const specs = [];
  active.forEach((line) => {
    const unitSeries = sales.monthly?.byLineUnits?.[line.id] || [];
    const netSeries = sales.monthly?.byLineNet?.[line.id] || [];
    specs.push({ label: `${line.name || "(unnamed)"} — Units`, monthly: unitSeries, kind: "number" });
    specs.push({ label: `${line.name || "(unnamed)"} — Net Revenue`, monthly: netSeries });
  });
  specs.push({ label: "Services Total (Net)", monthly: sales.monthly?.serviceNet, emphasis: "subtotal" });
  specs.push({ label: "Products Total (Net)", monthly: sales.monthly?.productNet, emphasis: "subtotal" });
  specs.push({ label: "Revenue — All Streams (Net)", monthly: sales.monthly?.net, emphasis: "total" });

  return statementPrintSection("Revenue By Stream", specs, {
    firstColHeader: "Stream",
    description: "Per-stream units and net revenue."
  });
}

function buildCollectionsSection(raw) {
  const c = raw.collections || {};
  const flowSpecs = [
    { label: "Invoiced (Basis)", monthly: c.invoicedBasisMonthly, emphasis: "header" },
    { label: "Cash Collected", monthly: c.cashCollectedMonthly, emphasis: "subtotal" },
    { label: "Bad Debt Written Off", monthly: c.badDebtWrittenOffMonthly }
  ];
  const snapshotSpecs = [
    { label: "Receivables Opening", monthly: c.receivablesOpeningMonthly, emphasis: "subtotal" },
    { label: "Receivables Closing", monthly: c.receivablesClosingMonthly, emphasis: "total" }
  ];
  return statementPrintSection("Collections (Flows)", flowSpecs, { description: "Invoiced and collected flows per period." })
    + statementPrintSection("Receivables (Snapshot)", snapshotSpecs, { snapshot: true, description: "Period-end receivables balances." });
}

function buildCostsBreakdownSection(raw) {
  const costs = raw.costs || {};
  const marketing = raw.marketing || {};
  const totalOpEx = sumSeries(
    costs.fixedMonthly, costs.variableMonthly, costs.directLaborMonthly,
    costs.merchantFeesMonthly, costs.otherOperatingMonthly, marketing.monthly
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
  return statementPrintSection("Costs Breakdown", specs, { firstColHeader: "Cost Category" });
}

function buildOwnerCompSection(raw) {
  const owner = raw.ownerAdjustments || {};
  const total = sumSeries(owner.drawingsMonthly, owner.salaryMonthly, owner.distributionsMonthly);
  const specs = [
    { label: "Drawings", monthly: owner.drawingsMonthly },
    { label: "Director Salary", monthly: owner.salaryMonthly },
    { label: "Distributions", monthly: owner.distributionsMonthly },
    { label: "Total Owner Compensation", monthly: total, emphasis: "total" }
  ];
  return statementPrintSection("Owner Compensation", specs);
}

function buildFinancingSection(raw) {
  const loans = raw.loans || {};
  const totalPayment = sumSeries(loans.principalMonthly, loans.interestMonthly);
  const flowSpecs = [
    { label: "Drawdowns", monthly: loans.drawdownMonthly },
    { label: "Principal Repayments", monthly: loans.principalMonthly },
    { label: "Interest", monthly: loans.interestMonthly },
    { label: "Total Payment (Principal + Interest)", monthly: totalPayment, emphasis: "subtotal" }
  ];
  const snapshotSpecs = [{ label: "Loan Closing Balance", monthly: loans.closingLoanBalanceMonthly, emphasis: "total" }];
  return statementPrintSection("Financing (Flows)", flowSpecs, { description: "Aggregated across all loans." })
    + statementPrintSection("Financing (Closing Balance)", snapshotSpecs, { snapshot: true, description: "Period-end loan balances." });
}

function buildAssetsSection(raw) {
  const assets = raw.assets || {};
  const flowSpecs = [
    { label: "Asset Purchases (Capex)", monthly: assets.purchaseMonthly },
    { label: "Depreciation Expense", monthly: assets.depreciationMonthly }
  ];
  const snapshotSpecs = [{ label: "Asset Net Book Value", monthly: assets.assetNBVMonthly, emphasis: "total" }];
  return statementPrintSection("Asset & Depreciation (Flows)", flowSpecs, { description: "Aggregated across all assets." })
    + statementPrintSection("Asset & Depreciation (Closing NBV)", snapshotSpecs, { snapshot: true, description: "Period-end net book value." });
}

function buildBreakEvenSection(raw, derived) {
  const yearly = raw.breakEven?.yearly || [];
  const yearlyRevenue = derived?.annual?.revenueNet || {};

  const serviceBE = yearly.map((y) => Number(y?.serviceBreakEvenRevenue || 0));
  const productBE = yearly.map((y) => Number(y?.productBreakEvenRevenue || 0));
  const combinedBE = yearly.map((_, i) => serviceBE[i] + productBE[i]);
  const actual = ["year1", "year2", "year3"].map((k) => Number(yearlyRevenue[k] || 0));
  const headroom = actual.map((value, i) => value - combinedBE[i]);
  const headroomPct = actual.map((value, i) => (combinedBE[i] === 0 ? 0 : ((value - combinedBE[i]) / combinedBE[i]) * 100));

  const rows = [
    { label: "Service Break-Even Revenue", values: serviceBE },
    { label: "Product Break-Even Revenue", values: productBE },
    { label: "Combined Break-Even Revenue", values: combinedBE, emphasis: "subtotal" },
    { label: "Actual Revenue (Net)", values: actual, emphasis: "subtotal" },
    { label: "Headroom (Actual − BE)", values: headroom, emphasis: "total" },
    { label: "Headroom %", values: headroomPct, kind: "percent", emphasis: "total", skipTotal: true }
  ];

  return `
    <section class="print-subsection">
      <h3>Break-Even Analysis</h3>
      <p class="print-helper">Break-even revenue required to cover fixed costs given current service/product contribution margins.</p>
      ${buildPrintPeriodTable({ rows, columns: yearLabels(), includeTotal: false, firstColHeader: "Metric" })}
    </section>
  `;
}

function buildTaxGstSection(raw) {
  const pl = raw.profitLoss || {};
  const sales = raw.sales || {};
  const specs = [
    { label: "Tax Paid", monthly: pl.taxMonthly, emphasis: "subtotal" },
    { label: "GST Collected On Sales", monthly: sales.monthly?.gst, emphasis: "subtotal" }
  ];
  return statementPrintSection("Tax & GST", specs, {
    description: "Tax computed on positive NPBT at the year's tax rate. GST collected from invoiced sales only (BAS netting not modelled yet)."
  });
}

function buildKeyRatiosSection(raw) {
  const pl = raw.profitLoss || {};
  const collections = raw.collections || {};
  const bs = raw.balanceSheet || {};

  const totalRevenue = sumArray(pl.revenueMonthly || []);
  const totalGp = sumArray(pl.grossProfitMonthly || []);
  const totalEbitda = sumArray(pl.ebitdaMonthly || []);
  const totalNpat = sumArray(pl.netProfitAfterTaxMonthly || []);
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

  const finalLiabilities = (bs.liabilitiesMonthly || []).slice(-1)[0] || 0;
  const finalEquity = (bs.equityMonthly || []).slice(-1)[0] || 0;
  const debtToEquity = safeDivide(finalLiabilities, finalEquity);

  const rows = [
    { label: "Gross Margin %", values: gmByYear, kind: "percent", skipTotal: true },
    { label: "EBITDA Margin %", values: emByYear, kind: "percent", skipTotal: true },
    { label: "Net Profit Margin %", values: nmByYear, kind: "percent", skipTotal: true },
    { label: "Revenue Growth Y/Y %", values: [0, revenueGrowthY2, revenueGrowthY3], kind: "percent", skipTotal: true },
    { label: "Interest Coverage (EBITDA / Interest)", values: dscrByYear.map((v) => Number(v.toFixed(2))), kind: "number", skipTotal: true }
  ];

  const overallTable = `
    <table class="print-table">
      <thead><tr><th>Ratio</th><th>Value</th></tr></thead>
      <tbody>
        <tr><th>Overall Gross Margin</th><td>${formatPercent(safeDivide(totalGp, totalRevenue) * 100)}</td></tr>
        <tr><th>Overall EBITDA Margin</th><td>${formatPercent(safeDivide(totalEbitda, totalRevenue) * 100)}</td></tr>
        <tr><th>Overall NPAT Margin</th><td>${formatPercent(safeDivide(totalNpat, totalRevenue) * 100)}</td></tr>
        <tr><th>Collection Efficiency</th><td>${formatPercent(safeDivide(totalCollected, totalInvoiced) * 100)}</td></tr>
        <tr><th>DSO (approximate, days)</th><td>${formatNumber(dsoOverall, 1)}</td></tr>
        <tr><th>Debt / Equity (final)</th><td>${debtToEquity.toFixed(2)}</td></tr>
        <tr><th>Interest Coverage (Y1)</th><td>${(dscrByYear[0] || 0).toFixed(2)}</td></tr>
        <tr><th>Interest Coverage (Y3)</th><td>${(dscrByYear[2] || 0).toFixed(2)}</td></tr>
      </tbody>
    </table>
  `;

  return `
    <section class="print-subsection">
      <h3>Key Ratios — Yearly</h3>
      ${buildPrintPeriodTable({ rows, columns: yearLabels(), includeTotal: false, firstColHeader: "Ratio" })}
      <h3>Key Ratios — Overall</h3>
      ${overallTable}
    </section>
  `;
}

function buildPersonalCashFlowSection(raw) {
  const pcf = raw.personalCashFlow;
  if (!pcf) return "";
  const summary = pcf.summary || {};
  const calendarLabels = (pcf.monthLabels && pcf.monthLabels.length === 12)
    ? pcf.monthLabels
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthCols = calendarLabels;
  const closing = pcf.closingMonthly || [];
  const minClosing = Number(summary.minClosingBalance ?? 0);
  let worstIdx = -1;
  for (let i = 0; i < closing.length; i += 1) {
    if (Number(closing[i]) === minClosing) { worstIdx = i; break; }
  }
  const worstMonth = worstIdx >= 0 ? monthCols[worstIdx] : "—";
  const totalInflowsY1 = Number(summary.totalInflows || 0);
  const totalDrawings = Number(summary.totalDrawingsFromBusiness || 0);
  const nonDrawingsInflows = Math.max(totalInflowsY1 - totalDrawings, 0);

  // --- Phase 4.2.8 decision metrics for the print output ---------------
  const requiredMonthly = Number(summary.requiredDrawingsMonthlyUplift || 0);
  const requiredAnnual = Number(summary.requiredDrawingsAnnualUplift || 0);
  const requiredIsExact = summary.requiredDrawingsIsExact !== false;
  const runwayMonths = summary.runwayMonths;
  const dependencyPct = Number(summary.dependencyOnBusinessDrawingsPct || 0);
  const dependencyBand = summary.dependencyBand || "none";
  const avgMonthlyOutflows = Number(summary.averageMonthlyOutflows || 0);

  const requiredLine = requiredMonthly > 0
    ? `${formatMoney(requiredMonthly)} / mo (${formatMoney(requiredAnnual)} / yr)${requiredIsExact ? " — exact minimum" : " — approximate"}`
    : "None needed — Year 1 is already solvent";
  const runwayLine = runwayMonths == null
    ? "No depletion in Year 1"
    : `${runwayMonths} month${runwayMonths === 1 ? "" : "s"} before first negative`;
  const dependencyLine = totalInflowsY1 > 0
    ? `${formatPercent(dependencyPct)} (${dependencyBand} dependency on business)`
    : "No personal inflows yet";

  const lowBufferThreshold = avgMonthlyOutflows * 0.5;
  const bufferInterpretation = avgMonthlyOutflows > 0
    ? `Low-buffer warning threshold: ${formatMoney(lowBufferThreshold)} (≈ half a month of average personal outflows, ${formatMoney(avgMonthlyOutflows)}/mo).`
    : "Low-buffer warning is not meaningful until personal outflows are modelled.";

  const summaryTable = `
    <table class="print-table print-table--kv print-table--pcf-summary">
      <tbody>
        <tr class="print-table__group"><th colspan="2">Liquidity (Year 1)</th></tr>
        <tr><th>Opening Balance (Jan)</th><td>${formatMoney(pcf.openingBalance || 0)}</td></tr>
        <tr><th>Closing Balance (Dec)</th><td>${formatMoney(summary.closingEndOfYear || 0)}</td></tr>
        <tr><th>Surplus / Deficit (Year 1)</th><td>${formatMoney(summary.netChange || 0)}</td></tr>
        <tr class="print-table__group"><th colspan="2">Risk (Year 1)</th></tr>
        <tr><th>Worst Month (Min Closing)</th><td>${formatMoney(minClosing)} (${worstMonth})</td></tr>
        <tr><th>Months With Negative Balance</th><td>${Number(summary.monthsBelowZero || 0)}</td></tr>
        <tr><th>Runway (months)</th><td>${escapeHtml(runwayLine)}</td></tr>
        <tr class="print-table__group"><th colspan="2">Decision &amp; Action (Year 1)</th></tr>
        <tr><th>Required Drawings To Stay Solvent</th><td>${escapeHtml(requiredLine)}</td></tr>
        <tr><th>Dependency On Business Drawings</th><td>${escapeHtml(dependencyLine)}</td></tr>
        <tr><th>Low-Buffer Threshold (interpretation)</th><td>${escapeHtml(bufferInterpretation)}</td></tr>
        <tr class="print-table__group"><th colspan="2">Owner Extraction &amp; Inflow Mix (Year 1)</th></tr>
        <tr><th>Drawings From Business</th><td>${formatMoney(totalDrawings)}</td></tr>
        <tr><th>Other Personal Inflows</th><td>${formatMoney(nonDrawingsInflows)}</td></tr>
        <tr><th>Total Inflows</th><td>${formatMoney(totalInflowsY1)}</td></tr>
        <tr><th>Total Outflows</th><td>${formatMoney(summary.totalOutflows || 0)}</td></tr>
      </tbody>
    </table>
  `;

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
    { label: "Opening Balance", kind: "money", emphasis: "header", values: (pcf.openingMonthly || []).slice(0, 12), skipTotal: true },
    { label: "Total Inflows", kind: "money", emphasis: "subtotal", values: (pcf.inflowsMonthly || []).slice(0, 12) },
    { label: "Total Outflows", kind: "money", emphasis: "subtotal", values: (pcf.outflowsMonthly || []).slice(0, 12).map((v) => -Number(v || 0)) },
    { label: "Net Cash Movement", kind: "money", emphasis: "total", values: ((pcf.inflowsMonthly || []).slice(0, 12)).map((v, i) => Number(v || 0) - Number((pcf.outflowsMonthly || [])[i] || 0)) },
    { label: "Closing Balance", kind: "money", emphasis: "header", values: (pcf.closingMonthly || []).slice(0, 12), skipTotal: true }
  ];

  const table = buildPrintPeriodTable({
    rows: [...inflowRows, ...outflowRows, ...sharedRow, ...totalsRows],
    columns: monthCols,
    includeTotal: true,
    firstColHeader: "Personal Cash Flow Line"
  });

  const sharedCostsDetail = (pcf.sharedCostsRows || []).length
    ? `<h4 class="print-sub-heading">Shared Cost Items</h4>
       <table class="print-table">
         <thead><tr><th>Name</th><th>Amount</th><th>Frequency</th><th>Personal Use %</th><th>Personal $/mo</th><th>Business $/mo</th></tr></thead>
         <tbody>${
           (pcf.sharedCostsRows || []).map((row) => `
             <tr>
               <th>${escapeHtml(row.name || "—")}</th>
               <td>${formatMoney(row.amount || 0)}</td>
               <td>${escapeHtml(row.frequency || "—")}</td>
               <td>${formatPercent(row.personalUsePercent || 0)}</td>
               <td>${formatMoney(row.personalMonthlyAmount || 0)}</td>
               <td>${formatMoney(row.businessMonthlyAmount || 0)}</td>
             </tr>
           `).join("")
         }</tbody>
       </table>`
    : "";

  return `
    <section class="print-subsection">
      <h3>Personal Cash Flow (Year 1)</h3>
      <p class="print-helper">
        Owner's personal liquidity model for Year 1. This models the owner's personal
        cash, not business profit. "Drawings from business" is linked to business
        drawings to avoid double counting.
      </p>
      <h4 class="print-sub-heading">Decision Summary</h4>
      ${summaryTable}
      <h4 class="print-sub-heading">Monthly Detail</h4>
      ${table}
      ${sharedCostsDetail}
    </section>
  `;
}

function buildScenarioInputsRecap(canonical) {
  if (!canonical) return "<p class='print-helper'>No canonical state available.</p>";

  const setup = canonical.setup || {};
  const meta = canonical.meta || {};
  const yearsObj = canonical.years || {};
  const salesLines = canonical.salesDetails?.lines || [];
  const assetItems = canonical.assets?.items || [];
  const loanItems = canonical.loans?.items || [];
  const personalCashFlow = canonical.personalCashFlow || {};
  const personalInflows = Array.isArray(personalCashFlow.inflows) ? personalCashFlow.inflows : [];
  const personalOutflows = Array.isArray(personalCashFlow.outflows) ? personalCashFlow.outflows : [];
  const personalSharedCosts = Array.isArray(personalCashFlow.sharedCosts) ? personalCashFlow.sharedCosts : [];
  const legacyPersonalItems = Array.isArray(personalCashFlow.items) ? personalCashFlow.items : [];
  const collectionsPolicy = canonical.collectionsPolicy || {};

  const dl = (items) => `<table class="print-table print-table--kv"><tbody>${items.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;

  const setupBlock = dl([
    ["Business Name", escapeHtml(setup.businessName || "—")],
    ["Currency", escapeHtml(meta.currency || "—")],
    ["Forecast Horizon (years)", escapeHtml(String(meta.forecastHorizonYears || "—"))],
    ["Start Month", escapeHtml(String(setup.startMonth || "—"))],
    ["Trading Structure", escapeHtml(String(setup.tradingStructure || "—"))],
    ["GST Registration", escapeHtml(String(setup.gstRegistration || "—"))],
    ["Charge GST On Sales", setup.chargeGstOnSales ? "Yes" : "No"],
    ["BAS Frequency", escapeHtml(String(setup.basFrequency || "—"))],
    ["Report Basis", escapeHtml(String(setup.reportBasis || "—"))],
    ["Opening Cash", formatMoney(setup.openingCash)]
  ]);

  const collectionsBlock = dl([
    ["Default Debtor Days", escapeHtml(String(collectionsPolicy.defaultDebtorDays ?? "—"))],
    ["Bad Debt %", formatPercent(collectionsPolicy.badDebtPct ?? 0)],
    ["Receivables Basis", escapeHtml(String(collectionsPolicy.receivablesBasis || "—"))],
    ["Opening Receivables", formatMoney(collectionsPolicy.openingReceivables)],
    ["Collection Split (M, M+1, M+2)", (collectionsPolicy.collectionSplitByMonthBucket || []).map((v) => formatPercent(Number(v) * 100)).join(" / ")]
  ]);

  const yearBlocks = ["year1", "year2", "year3"]
    .map((yk, idx) => {
      const y = yearsObj[yk] || {};
      const a = y.assumptions || {};
      const cp = y.costProfile || {};
      const oa = y.ownerAdjustments || {};
      const mktg = (y.marketing?.lineItems || [])
        .map((m) => `${formatMoney(m.monthlyAmount)}/mo, M${m.startMonth}-M${m.endMonth}`)
        .join("; ");
      return `<h4 class="print-sub-heading">Year ${idx + 1} Plan</h4>${dl([
        ["Growth %", formatPercent(a.growthPct ?? 0)],
        ["CPI %", formatPercent(a.cpiPct ?? 0)],
        ["Tax Rate %", formatPercent(a.taxRatePct ?? 0)],
        ["GST Rate %", formatPercent(a.gstRatePct ?? 0)],
        ["Fixed Monthly Cost", formatMoney(cp.fixedMonthlyCost)],
        ["Variable %", formatPercent(cp.variableCostPctOfRevenue ?? 0)],
        ["Direct Labor %", formatPercent(cp.directLaborPctOfRevenue ?? 0)],
        ["Other Operating", formatMoney(cp.otherOperatingExpenseMonthly)],
        ["Owner Model", escapeHtml(String(oa.modelType || "—"))],
        ["Drawings Monthly", formatMoney(oa.ownerDrawingsMonthly)],
        ["Director Salary Monthly", formatMoney(oa.directorSalaryMonthly)],
        ["Distributions Monthly", formatMoney(oa.distributionsMonthly)],
        ["Marketing", escapeHtml(mktg || "—")]
      ])}`;
    })
    .join("");

  const salesTable = salesLines.length
    ? `<table class="print-table"><thead><tr><th>Line</th><th>Type</th><th>Unit Price</th><th>Default Units/mo</th><th>COGS</th><th>Merchant Fee</th><th>GST?</th><th>Active?</th><th>Seasonality (Jan-Dec)</th></tr></thead><tbody>${
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
    }</tbody></table>`
    : "<p class='print-helper'>No revenue streams.</p>";

  const assetsTable = assetItems.length
    ? `<table class="print-table"><thead><tr><th>Asset</th><th>Category</th><th>Purchase</th><th>Purchase Month</th><th>Useful Life (Y)</th><th>Depreciation</th><th>Residual</th></tr></thead><tbody>${
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
    }</tbody></table>`
    : "<p class='print-helper'>No assets.</p>";

  const loansTable = loanItems.length
    ? `<table class="print-table"><thead><tr><th>Loan</th><th>Principal</th><th>Rate</th><th>Term (Y)</th><th>Frequency</th><th>Drawdown Month</th><th>Repayment Start</th></tr></thead><tbody>${
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
    }</tbody></table>`
    : "<p class='print-helper'>No loans.</p>";

  const renderRowTable = (rows, emptyMsg) => rows.length
    ? `<table class="print-table"><thead><tr><th>Row</th><th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th><th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th><th>Total</th></tr></thead><tbody>${
        rows.map((row) => {
          const cells = (row.monthly || []).slice(0, 12).map((v) => `<td>${formatMoney(v || 0)}</td>`).join("");
          const total = (row.monthly || []).reduce((a, b) => a + Number(b || 0), 0);
          return `<tr><th>${escapeHtml(row.label || "—")}</th>${cells}<td>${formatMoney(total)}</td></tr>`;
        }).join("")
      }</tbody></table>`
    : `<p class='print-helper'>${emptyMsg}</p>`;

  const inflowsBlock = renderRowTable(personalInflows, "No personal inflows.");
  const outflowsBlock = renderRowTable(personalOutflows, "No personal outflows.");
  const sharedCostsBlock = personalSharedCosts.length
    ? `<table class="print-table"><thead><tr><th>Name</th><th>Amount</th><th>Frequency</th><th>Personal Use %</th></tr></thead><tbody>${
      personalSharedCosts.map((c) => `
        <tr>
          <th>${escapeHtml(c.name || "—")}</th>
          <td>${formatMoney(c.amount ?? 0)}</td>
          <td>${escapeHtml(c.frequency || "—")}</td>
          <td>${formatPercent(c.personalUsePercent ?? 0)}</td>
        </tr>
      `).join("")
    }</tbody></table>`
    : "<p class='print-helper'>No shared costs.</p>";

  const legacyPersonalBlock = legacyPersonalItems.length
    ? `<p class='print-helper'><em>Legacy "items" entries (should migrate to shared costs):</em></p>
       <table class="print-table"><thead><tr><th>Item</th><th>Amount</th><th>Frequency</th><th>Personal Use %</th></tr></thead><tbody>${
      legacyPersonalItems.map((p) => `
        <tr>
          <th>${escapeHtml(p.name || "—")}</th>
          <td>${formatMoney(p.amount)}</td>
          <td>${escapeHtml(p.frequency || "—")}</td>
          <td>${formatPercent(p.personalUsePercent ?? 0)}</td>
        </tr>
      `).join("")
    }</tbody></table>`
    : "";

  return `
    <h4 class="print-sub-heading">Setup</h4>${setupBlock}
    <h4 class="print-sub-heading">Collections Policy</h4>${collectionsBlock}
    ${yearBlocks}
    <h4 class="print-sub-heading">Revenue Streams (${salesLines.length})</h4>${salesTable}
    <h4 class="print-sub-heading">Assets (${assetItems.length})</h4>${assetsTable}
    <h4 class="print-sub-heading">Loans (${loanItems.length})</h4>${loansTable}
    <h4 class="print-sub-heading">Personal Cash Flow — Opening Balance: ${formatMoney(personalCashFlow.openingBalance ?? 0)}${personalCashFlow.year1Only ? " · Year 1 Only" : ""}</h4>
    <h4 class="print-sub-heading">Personal Inflows (${personalInflows.length})</h4>${inflowsBlock}
    <h4 class="print-sub-heading">Personal Outflows (${personalOutflows.length})</h4>${outflowsBlock}
    <h4 class="print-sub-heading">Shared Costs (${personalSharedCosts.length})</h4>${sharedCostsBlock}
    ${legacyPersonalBlock}
  `;
}

export async function openPrintSummary(snapshot) {
  const result = snapshot.engine.strict?.status === "ok" ? snapshot.engine.strict : snapshot.engine.lenient;
  if (!result) return;

  const company = snapshot.canonical.setup.businessName || "Your Company";
  const summary = result.derived?.summaryCards || {};
  const annual = result.derived?.annual || {};
  const raw = result.raw || {};
  const charts = result.derived?.charts || {};
  const canonical = snapshot.canonical || {};

  const monthlyLbls = monthLabels();
  const quarterlyData = buildQuarterlyRevenueDataset(charts.revenueNetMonthly || []);
  const quarterEndCash = buildQuarterEndCashMap(raw.cashFlow?.closingCashMonthly || []);
  const quarterlyProfitMap = raw.quarterly?.flowRollups?.netProfitAfterTax || {};

  const breakEvenYear1 = raw.breakEven?.yearly?.[0] || {};
  const combinedBreakEvenY1 = Number(breakEvenYear1.serviceBreakEvenRevenue || 0) + Number(breakEvenYear1.productBreakEvenRevenue || 0);

  console.debug("[ff] quarterly revenue dataset before print", Object.fromEntries(quarterlyData.labels.map((label, index) => [label, quarterlyData.values[index]])));
  console.debug("[ff] quarterly closing cash source before print", quarterEndCash);

  const marginSeries = [
    { label: "Gross Margin %", values: marginPctSeries(raw.profitLoss?.grossProfitMonthly || [], raw.profitLoss?.revenueMonthly || []) },
    { label: "EBITDA Margin %", values: marginPctSeries(raw.profitLoss?.ebitdaMonthly || [], raw.profitLoss?.revenueMonthly || []) },
    { label: "NPAT Margin %", values: marginPctSeries(raw.profitLoss?.netProfitAfterTaxMonthly || [], raw.profitLoss?.revenueMonthly || []) }
  ];

  const cfComponents = [
    { label: "Net Operating", values: raw.cashFlow?.netOperatingMonthly || [] },
    { label: "Net Investing", values: raw.cashFlow?.netInvestingMonthly || [] },
    { label: "Net Financing", values: raw.cashFlow?.netFinancingMonthly || [] }
  ];

  const bsComponents = [
    { label: "Total Assets", values: raw.balanceSheet?.assetsMonthly || [] },
    { label: "Total Liabilities", values: raw.balanceSheet?.liabilitiesMonthly || [] },
    { label: "Total Equity", values: raw.balanceSheet?.equityMonthly || [] }
  ];

  const streamSeries = (canonical?.salesDetails?.lines || [])
    .filter((line) => line.isActive !== false)
    .slice(0, 6)
    .map((line) => ({
      label: line.name || "(unnamed)",
      values: raw.sales?.monthly?.byLineNet?.[line.id] || []
    }));

  const chartSnapshots = [
    renderLineChartSvg("Revenue Trend", monthlyLbls, charts.revenueNetMonthly || [], "#0f766e"),
    renderLineChartSvg("Net Profit Trend", monthlyLbls, charts.netProfitAfterTaxMonthly || [], "#7c2d12"),
    renderLineChartSvg("Closing Cash Trend", monthlyLbls, charts.closingCashMonthly || [], "#1d4ed8"),
    renderBarChartSvg("Quarterly Revenue", quarterlyData.labels, quarterlyData.values),
    renderMultiLineChartSvg("Margin Trend", monthlyLbls, marginSeries),
    renderMultiLineChartSvg("Cash Flow Components", monthlyLbls, cfComponents),
    renderMultiLineChartSvg("Balance Sheet Components", monthlyLbls, bsComponents),
    renderMultiLineChartSvg("Revenue By Stream", monthlyLbls, streamSeries)
  ];
  const chartsMarkup = chartSnapshots.map((entry) => entry.html).join("");

  const sections = [
    {
      id: "header",
      title: "Report Header",
      html: `
        <h1>${escapeHtml(company)}</h1>
        <p class="subtitle">Financial Forecast Summary</p>
        <p class="timestamp">Generated: ${escapeHtml(new Date().toLocaleString())}</p>
      `
    },
    {
      id: "kpi_cards",
      title: "KPI Cards",
      html: `
        <div class="print-kpi-grid">
          <article class="print-card"><h3>Total Revenue</h3><p>${formatMoney(summary.totalRevenue || 0)}</p></article>
          <article class="print-card"><h3>Total Net Profit After Tax</h3><p>${formatMoney(summary.totalNetProfitAfterTax || 0)}</p></article>
          <article class="print-card"><h3>Average Margin</h3><p>${formatPercent(summary.averageMarginPct || 0)}</p></article>
          <article class="print-card"><h3>Final Closing Cash</h3><p>${formatMoney(summary.finalClosingCash || 0)}</p></article>
          <article class="print-card"><h3>Lowest Cash Point</h3><p>${formatMoney(Math.min(...(raw.cashFlow?.closingCashMonthly || [0])))}</p></article>
          <article class="print-card"><h3>Receivables At End</h3><p>${formatMoney(raw.collections?.receivablesClosingMonthly?.[35] || 0)}</p></article>
          <article class="print-card"><h3>Break-Even Revenue (Y1)</h3><p>${formatMoney(combinedBreakEvenY1)}</p></article>
          <article class="print-card"><h3>Warnings</h3><p>${escapeHtml(String((result.warnings || []).length))}</p></article>
        </div>
      `
    },
    { id: "key_charts", title: "Key Charts", html: chartsMarkup },
    {
      id: "key_tables",
      title: "Key Summary Tables",
      html: `
        <section class="print-subsection">
          <h3>Annual Summary</h3>
          ${buildAnnualSummaryTable(annual)}
        </section>
        <section class="print-subsection">
          <h3>Quarterly Performance</h3>
          ${buildQuarterlyPerformanceTable(quarterlyData.labels, quarterlyData.values, quarterlyProfitMap, quarterEndCash)}
        </section>
      `
    },
    { id: "profit_loss", title: "Profit & Loss Statement", html: buildProfitAndLossSection(raw) },
    { id: "cash_flow", title: "Cash Flow Statement", html: buildCashFlowSection(raw) },
    { id: "balance_sheet", title: "Balance Sheet", html: buildBalanceSheetSection(raw) },
    { id: "revenue_by_stream", title: "Revenue By Stream", html: buildRevenueByStreamSection(raw, canonical) },
    { id: "collections", title: "Collections & Receivables", html: buildCollectionsSection(raw) },
    { id: "costs", title: "Costs Breakdown", html: buildCostsBreakdownSection(raw) },
    { id: "owner_comp", title: "Owner Compensation", html: buildOwnerCompSection(raw) },
    { id: "financing", title: "Financing", html: buildFinancingSection(raw) },
    { id: "assets", title: "Asset & Depreciation", html: buildAssetsSection(raw) },
    { id: "break_even", title: "Break-Even Analysis", html: buildBreakEvenSection(raw, result.derived) },
    { id: "tax_gst", title: "Tax & GST", html: buildTaxGstSection(raw) },
    { id: "key_ratios", title: "Key Ratios", html: buildKeyRatiosSection(raw) },
    { id: "personal_cash_flow", title: "Personal Cash Flow (Year 1)", html: buildPersonalCashFlowSection(raw) },
    { id: "warnings_and_issues", title: "Warnings And Issues", html: buildWarningsTable(result.warnings || []) },
    { id: "scenario_inputs", title: "Scenario Inputs Recap", html: buildScenarioInputsRecap(canonical) }
  ];

  const removed = [];
  const filteredSections = sections.filter((section) => {
    const content = section.html.replace(/\s+/g, "");
    const hasMeaningfulContent = content.length > 0;
    if (!hasMeaningfulContent) removed.push(section.id);
    return hasMeaningfulContent;
  });

  console.debug("[ff] print DOM section list before print", filteredSections.map((section) => section.id));
  console.debug("[ff] sections removed as empty", removed);
  console.debug("[ff] snapshot status list", chartSnapshots.map((item) => ({ title: item.title, ok: item.ok })));

  const existing = document.getElementById("ff-print-layout");
  if (existing) existing.remove();

  const container = document.createElement("section");
  container.id = "ff-print-layout";
  container.innerHTML = `
    <main class="ff-print-root">
      ${filteredSections
        .map((section) => `
          <section class="ff-print-section" data-print-section="${escapeHtml(section.id)}">
            <h2>${escapeHtml(section.title)}</h2>
            ${section.html}
          </section>
        `)
        .join("")}
    </main>
  `;
  document.body.appendChild(container);

  await nextFrame();

  const sectionNodes = Array.from(container.querySelectorAll("[data-print-section]"));
  const removedAfterMeasure = [];
  const keepByDefault = new Set([
    "header", "kpi_cards", "key_charts", "key_tables",
    "profit_loss", "cash_flow", "balance_sheet", "revenue_by_stream",
    "collections", "costs", "owner_comp", "financing", "assets",
    "break_even", "tax_gst", "key_ratios", "personal_cash_flow", "warnings_and_issues",
    "scenario_inputs"
  ]);
  sectionNodes.forEach((sectionNode) => {
    const id = sectionNode.getAttribute("data-print-section") || "unknown";
    const meaningfulText = (sectionNode.textContent || "").replace(/\s+/g, "").length;
    if (meaningfulText === 0 && !keepByDefault.has(id)) {
      removedAfterMeasure.push(id);
      sectionNode.remove();
    }
  });

  const measuredHeights = Array.from(container.querySelectorAll("[data-print-section]")).map((sectionNode) => ({
    id: sectionNode.getAttribute("data-print-section"),
    height: Math.round(sectionNode.getBoundingClientRect().height)
  }));
  console.debug("[ff] print section heights", measuredHeights);
  console.debug("[ff] sections removed after measure", removedAfterMeasure);
  console.debug("[ff] final printable page-flow node count", container.querySelectorAll(".ff-print-section, .print-chart, .print-table").length);
  console.debug("[ff] final print root metrics", {
    scrollHeight: container.scrollHeight,
    clientHeight: container.clientHeight
  });

  const cleanup = () => {
    const node = document.getElementById("ff-print-layout");
    if (node) node.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup, { once: true });

  await nextFrame();
  await nextFrame();
  window.print();
  window.setTimeout(cleanup, 2500);
}
