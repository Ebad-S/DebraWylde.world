import { formatMoney, formatPercent, escapeHtml } from "./format.js";

export const MONTH_COUNT = 36;
export const QUARTER_COUNT = 12;
export const YEAR_COUNT = 3;

export function quarterLabels() {
  const labels = [];
  for (let q = 0; q < QUARTER_COUNT; q += 1) {
    labels.push(`Y${Math.floor(q / 4) + 1}-Q${(q % 4) + 1}`);
  }
  return labels;
}

export function yearLabels() {
  return ["Year 1", "Year 2", "Year 3"];
}

export function monthLabels() {
  const labels = [];
  for (let i = 0; i < MONTH_COUNT; i += 1) labels.push(`M${i + 1}`);
  return labels;
}

export function monthLabelsForYear(yearIndex) {
  const start = yearIndex * 12;
  const labels = [];
  for (let i = 0; i < 12; i += 1) labels.push(`M${start + i + 1}`);
  return labels;
}

export function sliceYearFromMonthly(monthly, yearIndex) {
  const start = yearIndex * 12;
  return (monthly || []).slice(start, start + 12);
}

export function monthlyToQuarterly(monthly = []) {
  const out = Array(QUARTER_COUNT).fill(0);
  for (let i = 0; i < MONTH_COUNT; i += 1) {
    const q = Math.floor(i / 3);
    if (q >= QUARTER_COUNT) break;
    out[q] += Number(monthly[i] || 0);
  }
  return out;
}

export function monthlyToYearly(monthly = []) {
  const out = Array(YEAR_COUNT).fill(0);
  for (let i = 0; i < MONTH_COUNT; i += 1) {
    const y = Math.floor(i / 12);
    if (y >= YEAR_COUNT) break;
    out[y] += Number(monthly[i] || 0);
  }
  return out;
}

export function monthlySnapshotByQuarter(monthly = []) {
  const out = Array(QUARTER_COUNT).fill(0);
  for (let q = 0; q < QUARTER_COUNT; q += 1) {
    const idx = q * 3 + 2;
    out[q] = Number(monthly[idx] ?? 0);
  }
  return out;
}

export function monthlySnapshotByYear(monthly = []) {
  const out = Array(YEAR_COUNT).fill(0);
  for (let y = 0; y < YEAR_COUNT; y += 1) {
    const idx = y * 12 + 11;
    out[y] = Number(monthly[idx] ?? 0);
  }
  return out;
}

export function sumArray(values = []) {
  return values.reduce((acc, value) => acc + Number(value || 0), 0);
}

export function safeDivide(a, b) {
  const denom = Number(b || 0);
  if (denom === 0) return 0;
  return Number(a || 0) / denom;
}

function formatCellValue(value, kind) {
  if (kind === "percent") return formatPercent(value);
  if (kind === "number") return Number(value || 0).toLocaleString("en-AU");
  return formatMoney(value);
}

/**
 * rows: Array<{ label: string, values: number[], kind?: "money"|"percent"|"number", emphasis?: "total"|"subtotal"|"header" }>
 * columns: Array<string>  (header labels)
 * includeTotal: add a "Total" column summing each row (not for snapshot rows / percent rows unless overridden per row)
 */
export function buildPeriodTable({ rows = [], columns = [], includeTotal = false, firstColHeader = "Metric" } = {}) {
  const totalHeader = includeTotal ? "<th>Total</th>" : "";
  const head = `<thead><tr><th>${escapeHtml(firstColHeader)}</th>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}${totalHeader}</tr></thead>`;
  const body = rows
    .map((row) => {
      const kind = row.kind || "money";
      const className = row.emphasis ? ` class="ff-row-${row.emphasis}"` : "";
      const cells = columns
        .map((_, colIndex) => `<td>${formatCellValue(row.values?.[colIndex] ?? 0, kind)}</td>`)
        .join("");
      let totalCell = "";
      if (includeTotal) {
        if (row.totalOverride != null) {
          totalCell = `<td>${formatCellValue(row.totalOverride, kind)}</td>`;
        } else if (kind === "percent" || row.skipTotal) {
          totalCell = "<td>&mdash;</td>";
        } else {
          totalCell = `<td>${formatCellValue(sumArray(row.values || []), kind)}</td>`;
        }
      }
      return `<tr${className}><th scope="row">${escapeHtml(row.label)}</th>${cells}${totalCell}</tr>`;
    })
    .join("");
  return `<div class="ff-table-wrap"><table class="ff-table ff-table--period">${head}<tbody>${body}</tbody></table></div>`;
}

export function buildMonthlyTable({ rows = [], includeTotal = false, firstColHeader = "Metric" } = {}) {
  return buildPeriodTable({ rows, columns: monthLabels(), includeTotal, firstColHeader });
}

export function buildQuarterlyTable({ rows = [], includeTotal = false, firstColHeader = "Metric" } = {}) {
  return buildPeriodTable({ rows, columns: quarterLabels(), includeTotal, firstColHeader });
}

export function buildYearlyTable({ rows = [], includeTotal = false, firstColHeader = "Metric" } = {}) {
  return buildPeriodTable({ rows, columns: yearLabels(), includeTotal, firstColHeader });
}
