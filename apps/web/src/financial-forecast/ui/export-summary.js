import { formatMoney, formatPercent } from "./renderers/shared/format.js";

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildQuarterlyRevenueDataset(monthlyRevenue = []) {
  const labels = [];
  const values = [];
  for (let quarterIndex = 0; quarterIndex < 12; quarterIndex += 1) {
    const year = Math.floor(quarterIndex / 4) + 1;
    const quarter = (quarterIndex % 4) + 1;
    const baseMonth = quarterIndex * 3;
    const total = Number(monthlyRevenue[baseMonth] || 0)
      + Number(monthlyRevenue[baseMonth + 1] || 0)
      + Number(monthlyRevenue[baseMonth + 2] || 0);
    labels.push(`Y${year}-Q${quarter}`);
    values.push(total);
  }
  return { labels, values };
}

function buildQuarterEndCashMap(monthlyClosingCash = []) {
  const out = {};
  for (let quarterIndex = 0; quarterIndex < 12; quarterIndex += 1) {
    const year = Math.floor(quarterIndex / 4) + 1;
    const quarter = (quarterIndex % 4) + 1;
    const monthIndex = quarterIndex * 3 + 2;
    out[`Y${year}-Q${quarter}`] = Number(monthlyClosingCash[monthIndex] ?? 0);
  }
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
      <svg viewBox="0 0 ${width} ${height + 44}" width="${width}" height="${height + 44}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(title)}">
        <rect x="0" y="0" width="${width}" height="${height + 44}" fill="#ffffff" />
        <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#9ca3af" stroke-width="1" />
        <line x1="0" y1="0" x2="0" y2="${height}" stroke="#9ca3af" stroke-width="1" />
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
        <text x="0" y="${height + 26}" fill="#111827" font-size="12">${escapeHtml(labels[0] || "Start")}</text>
        <text x="${width - 4}" y="${height + 26}" text-anchor="end" fill="#111827" font-size="12">${escapeHtml(labels[labels.length - 1] || "End")}</text>
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
      <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(title)}">
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

function buildMetricsTable(charts = {}) {
  const revenue = charts.revenueNetMonthly || [];
  const profit = charts.netProfitAfterTaxMonthly || [];
  const cash = charts.closingCashMonthly || [];
  if (!revenue.length) {
    return "<p>No monthly metrics available in current preview.</p>";
  }
  const rows = revenue
    .map((_, index) => `
      <tr>
        <th>M${index + 1}</th>
        <td>${formatMoney(revenue[index] || 0)}</td>
        <td>${formatMoney(profit[index] || 0)}</td>
        <td>${formatMoney(cash[index] || 0)}</td>
      </tr>
    `)
    .join("");
  return `
    <table class="print-table">
      <thead><tr><th>Month</th><th>Revenue</th><th>Net Profit</th><th>Closing Cash</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function simpleSummaryBlock(title, items) {
  const rows = items.map((item) => `<p>${escapeHtml(item.label)}: ${item.value}</p>`).join("");
  return `
    <section class="print-subsection">
      <h3>${escapeHtml(title)}</h3>
      ${rows}
    </section>
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

  const monthlyLabels = (charts.revenueNetMonthly || []).map((_, index) => `M${index + 1}`);
  const quarterlyData = buildQuarterlyRevenueDataset(charts.revenueNetMonthly || []);
  const quarterEndCash = buildQuarterEndCashMap(raw.cashFlow?.closingCashMonthly || []);
  const quarterlyProfitMap = raw.quarterly?.flowRollups?.netProfitAfterTax || {};

  console.debug("[ff] quarterly revenue dataset before print", Object.fromEntries(quarterlyData.labels.map((label, index) => [label, quarterlyData.values[index]])));
  console.debug("[ff] quarterly closing cash source before print", quarterEndCash);

  const chartSnapshots = [
    renderLineChartSvg("Revenue Trend", monthlyLabels, charts.revenueNetMonthly || [], "#0f766e"),
    renderLineChartSvg("Net Profit Trend", monthlyLabels, charts.netProfitAfterTaxMonthly || [], "#7c2d12"),
    renderLineChartSvg("Closing Cash Trend", monthlyLabels, charts.closingCashMonthly || [], "#1d4ed8"),
    renderBarChartSvg("Quarterly Revenue", quarterlyData.labels, quarterlyData.values)
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
          <article class="print-card"><h3>Break-Even Revenue (Y1)</h3><p>${formatMoney(raw.breakEven?.yearly?.[0]?.combinedBreakEvenRevenue || 0)}</p></article>
          <article class="print-card"><h3>Warnings</h3><p>${escapeHtml(String((result.warnings || []).length))}</p></article>
        </div>
      `
    },
    {
      id: "key_charts",
      title: "Key Charts",
      html: chartsMarkup
    },
    {
      id: "key_tables",
      title: "Key Tables",
      html: `
        <section class="print-subsection">
          <h3>Annual Summary Table</h3>
          ${buildAnnualSummaryTable(annual)}
        </section>
        <section class="print-subsection">
          <h3>Quarterly Performance Table</h3>
          ${buildQuarterlyPerformanceTable(quarterlyData.labels, quarterlyData.values, quarterlyProfitMap, quarterEndCash)}
        </section>
      `
    },
    {
      id: "warnings_and_issues",
      title: "Warnings And Issues",
      html: buildWarningsTable(result.warnings || [])
    },
    {
      id: "receivables_insight",
      title: "Receivables Insight",
      html: simpleSummaryBlock("Receivables Insight", [
        { label: "Opening receivables", value: formatMoney(raw.collections?.receivablesOpeningMonthly?.[0] || 0) },
        { label: "Closing receivables", value: formatMoney(raw.collections?.receivablesClosingMonthly?.slice(-1)[0] || 0) },
        { label: "Total collections", value: formatMoney((raw.collections?.cashCollectedMonthly || []).reduce((a, b) => a + b, 0)) }
      ])
    },
    {
      id: "owner_adjustment_summary",
      title: "Owner Adjustment Summary",
      html: simpleSummaryBlock("Owner Adjustment Summary", [
        { label: "Drawings", value: formatMoney((raw.ownerAdjustments?.drawingsMonthly || []).reduce((a, b) => a + b, 0)) },
        { label: "Salary", value: formatMoney((raw.ownerAdjustments?.salaryMonthly || []).reduce((a, b) => a + b, 0)) },
        { label: "Distributions", value: formatMoney((raw.ownerAdjustments?.distributionsMonthly || []).reduce((a, b) => a + b, 0)) }
      ])
    },
    {
      id: "financing_summary",
      title: "Financing Summary",
      html: simpleSummaryBlock("Financing Summary", [
        { label: "Total drawdowns", value: formatMoney((raw.loans?.drawdownMonthly || []).reduce((a, b) => a + b, 0)) },
        { label: "Total interest", value: formatMoney((raw.loans?.interestMonthly || []).reduce((a, b) => a + b, 0)) },
        { label: "Closing loan balance", value: formatMoney(raw.loans?.closingLoanBalanceMonthly?.slice(-1)[0] || 0) }
      ])
    },
    {
      id: "asset_depreciation_summary",
      title: "Asset And Depreciation Summary",
      html: simpleSummaryBlock("Asset And Depreciation Summary", [
        { label: "Total capex", value: formatMoney((raw.assets?.purchaseMonthly || []).reduce((a, b) => a + b, 0)) },
        { label: "Total depreciation", value: formatMoney((raw.assets?.depreciationMonthly || []).reduce((a, b) => a + b, 0)) },
        { label: "Closing asset value", value: formatMoney(raw.assets?.assetNBVMonthly?.slice(-1)[0] || 0) }
      ])
    },
    {
      id: "monthly_metrics_table",
      title: "Monthly Metrics Table",
      html: buildMetricsTable(charts)
    }
  ];

  const removed = [];
  const filteredSections = sections.filter((section) => {
    const content = section.html.replace(/\s+/g, "");
    const hasMeaningfulContent = content.length > 0;
    if (!hasMeaningfulContent) {
      removed.push(section.id);
    }
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
  sectionNodes.forEach((sectionNode) => {
    const id = sectionNode.getAttribute("data-print-section") || "unknown";
    const meaningfulText = (sectionNode.textContent || "").replace(/\s+/g, "").length;
    const chartCount = sectionNode.querySelectorAll(".print-chart").length;
    const tableRowCount = sectionNode.querySelectorAll("tbody tr").length;
    if (meaningfulText === 0 || (chartCount === 0 && tableRowCount === 0 && id !== "header" && id !== "kpi_cards" && !sectionNode.querySelector(".print-chart-fallback"))) {
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
  window.setTimeout(cleanup, 1500);
}
