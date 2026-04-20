import { round2 } from "./timeline.js";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function zeroMonths() {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

function sumArray(arr) {
  return (arr || []).reduce((a, b) => a + Number(b || 0), 0);
}

function sumRowsMonthly(rows) {
  const total = zeroMonths();
  (rows || []).forEach((row) => {
    for (let i = 0; i < 12; i += 1) {
      total[i] += Number(row.monthly?.[i] || 0);
    }
  });
  return total;
}

/**
 * Build the monthly closing-balance series given:
 *  - opening balance
 *  - total inflows per month
 *  - total outflows per month
 * Returns { openingMonthly, closingMonthly }.
 */
function rollForward(openingBalance, inflowsMonthly, outflowsMonthly) {
  const openingMonthly = zeroMonths();
  const closingMonthly = zeroMonths();
  let rolling = Number(openingBalance || 0);
  for (let i = 0; i < 12; i += 1) {
    openingMonthly[i] = rolling;
    rolling = rolling + Number(inflowsMonthly[i] || 0) - Number(outflowsMonthly[i] || 0);
    closingMonthly[i] = rolling;
  }
  return { openingMonthly, closingMonthly };
}

/**
 * Exact minimum constant monthly uplift `u` added to inflows such that
 * closing[i] >= 0 for every month i in Year 1.
 *
 * Given baseline closing[i] = opening + sum_{k<=i}(inflows[k]-outflows[k]),
 * adding `u` each month yields newClosing[i] = closing[i] + (i+1)*u.
 * For newClosing[i] >= 0 we need u >= -closing[i] / (i+1). The tightest
 * constraint across all months is max_i( -closing[i] / (i+1) ). Clamped to 0.
 *
 * This is EXACT (not an approximation) for Year 1, given the standard
 * personal cash flow roll-forward.
 */
function computeRequiredMonthlyUplift(closingMonthly) {
  let uplift = 0;
  for (let i = 0; i < 12; i += 1) {
    const c = Number(closingMonthly[i] || 0);
    if (c < 0) {
      const need = -c / (i + 1);
      if (need > uplift) uplift = need;
    }
  }
  return uplift;
}

/**
 * Runway (months) = how many full months the closing balance stays >= 0
 * before the first negative-closing month. Returns `null` if never negative.
 * If closing[0] < 0 already, runway = 0 (ran out immediately).
 */
function computeRunwayMonths(closingMonthly) {
  for (let i = 0; i < 12; i += 1) {
    if (Number(closingMonthly[i] || 0) < 0) return i;
  }
  return null;
}

function classifyDependency(pct) {
  if (!Number.isFinite(pct) || pct <= 0) return "none";
  if (pct < 33) return "low";
  if (pct < 66) return "moderate";
  return "high";
}

/**
 * Derive decision-layer metrics from the monthly series. Exported so the UI
 * stress mode can reuse the exact same math on a temporarily stressed series
 * (without mutating canonical state).
 */
export function computePersonalDecisionMetrics({
  openingBalance = 0,
  inflowsMonthly = [],
  outflowsMonthly = [],
  drawingsMonthly = []
} = {}) {
  const { openingMonthly, closingMonthly } = rollForward(
    openingBalance,
    inflowsMonthly,
    outflowsMonthly
  );

  const totalInflows = sumArray(inflowsMonthly);
  const totalOutflows = sumArray(outflowsMonthly);
  const totalDrawingsFromBusiness = sumArray(drawingsMonthly);
  const minClosingBalance = closingMonthly.reduce(
    (min, v) => (v < min ? v : min),
    Number.POSITIVE_INFINITY
  );
  const minClosing = Number.isFinite(minClosingBalance) ? minClosingBalance : 0;
  const monthsBelowZero = closingMonthly.filter((v) => v < 0).length;

  const requiredDrawingsMonthlyUplift = computeRequiredMonthlyUplift(closingMonthly);
  const requiredDrawingsAnnualUplift = requiredDrawingsMonthlyUplift * 12;
  const runwayMonths = computeRunwayMonths(closingMonthly);

  const averageMonthlyOutflows = totalOutflows / 12;
  const dependencyPct = totalInflows > 0
    ? (totalDrawingsFromBusiness / totalInflows) * 100
    : 0;
  const dependencyBand = classifyDependency(dependencyPct);

  return {
    openingMonthly,
    closingMonthly,
    inflowsMonthly: inflowsMonthly.slice(),
    outflowsMonthly: outflowsMonthly.slice(),
    totals: {
      totalInflows,
      totalOutflows,
      totalDrawingsFromBusiness,
      netChange: totalInflows - totalOutflows,
      closingEndOfYear: closingMonthly[11] || 0
    },
    risk: {
      minClosingBalance: minClosing,
      monthsBelowZero
    },
    decision: {
      requiredDrawingsMonthlyUplift,
      requiredDrawingsAnnualUplift,
      runwayMonths,
      dependencyOnBusinessDrawingsPct: dependencyPct,
      dependencyBand,
      averageMonthlyOutflows
    }
  };
}

export function calculatePersonalCashFlow(normalizedState) {
  const pcf = normalizedState.personalCashFlow || {};
  const openingBalance = Number(pcf.openingBalance || 0);

  const inflowsMonthlyTotal = sumRowsMonthly(pcf.inflows);
  const outflowsMonthlyTotal = sumRowsMonthly(pcf.outflows);

  // Shared costs contribute their personal portion as outflows each month in Y1.
  const sharedPersonalMonthly = zeroMonths();
  (pcf.sharedCosts || []).forEach((item) => {
    for (let i = 0; i < 12; i += 1) {
      sharedPersonalMonthly[i] += Number(item.personalMonthlyAmount || 0);
    }
  });

  const totalOutflowsMonthly = zeroMonths();
  for (let i = 0; i < 12; i += 1) {
    totalOutflowsMonthly[i] = outflowsMonthlyTotal[i] + sharedPersonalMonthly[i];
  }

  const drawingsRow = (pcf.inflows || []).find((r) => r.id === "drawings-from-business");
  const drawingsMonthly = drawingsRow
    ? drawingsRow.monthly.map((v) => Number(v || 0))
    : zeroMonths();

  const metrics = computePersonalDecisionMetrics({
    openingBalance,
    inflowsMonthly: inflowsMonthlyTotal,
    outflowsMonthly: totalOutflowsMonthly,
    drawingsMonthly
  });

  return {
    monthLabels: MONTH_LABELS.slice(),
    openingBalance: round2(openingBalance),
    openingMonthly: metrics.openingMonthly.map(round2),
    inflowsMonthly: inflowsMonthlyTotal.map(round2),
    outflowsBaseMonthly: outflowsMonthlyTotal.map(round2),
    sharedPersonalMonthly: sharedPersonalMonthly.map(round2),
    outflowsMonthly: totalOutflowsMonthly.map(round2),
    closingMonthly: metrics.closingMonthly.map(round2),
    drawingsFromBusinessMonthly: drawingsMonthly.map(round2),
    summary: {
      minClosingBalance: round2(metrics.risk.minClosingBalance),
      monthsBelowZero: metrics.risk.monthsBelowZero,
      totalInflows: round2(metrics.totals.totalInflows),
      totalOutflows: round2(metrics.totals.totalOutflows),
      totalDrawingsFromBusiness: round2(metrics.totals.totalDrawingsFromBusiness),
      netChange: round2(metrics.totals.netChange),
      closingEndOfYear: round2(metrics.totals.closingEndOfYear),
      // --- Phase 4.2.8 decision metrics -------------------------------
      // `requiredDrawingsMonthlyUplift` is the EXACT minimum constant monthly
      // uplift needed to keep Year-1 closing >= 0 given current inflows and
      // outflows. Zero if the plan is already solvent.
      requiredDrawingsMonthlyUplift: round2(metrics.decision.requiredDrawingsMonthlyUplift),
      requiredDrawingsAnnualUplift: round2(metrics.decision.requiredDrawingsAnnualUplift),
      requiredDrawingsIsExact: true,
      // `runwayMonths`: months of positive liquidity before first negative
      // closing. `null` means no depletion occurs in Year 1.
      runwayMonths: metrics.decision.runwayMonths,
      // `dependencyOnBusinessDrawingsPct` = drawings-from-business / total
      // personal inflows (%). 0 when there are no inflows at all.
      dependencyOnBusinessDrawingsPct: round2(metrics.decision.dependencyOnBusinessDrawingsPct),
      dependencyBand: metrics.decision.dependencyBand,
      averageMonthlyOutflows: round2(metrics.decision.averageMonthlyOutflows)
    },
    inflowsByRow: (pcf.inflows || []).map((row) => ({
      id: row.id,
      label: row.label,
      custom: Boolean(row.custom),
      monthly: row.monthly.map((v) => round2(Number(v || 0))),
      total: round2(sumArray(row.monthly))
    })),
    outflowsByRow: (pcf.outflows || []).map((row) => ({
      id: row.id,
      label: row.label,
      custom: Boolean(row.custom),
      monthly: row.monthly.map((v) => round2(Number(v || 0))),
      total: round2(sumArray(row.monthly))
    })),
    sharedCostsRows: (pcf.sharedCosts || []).map((item) => ({
      id: item.id,
      name: item.name,
      amount: Number(item.amount || 0),
      frequency: item.frequency,
      personalUsePercent: Number(item.personalUsePercent || 0),
      monthlyAmount: round2(Number(item.monthlyAmount || 0)),
      personalMonthlyAmount: round2(Number(item.personalMonthlyAmount || 0)),
      businessMonthlyAmount: round2(Number(item.businessMonthlyAmount || 0)),
      custom: Boolean(item.custom)
    }))
  };
}
