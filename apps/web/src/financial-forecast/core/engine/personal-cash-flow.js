import { round2 } from "./timeline.js";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const YEAR_KEYS = ["year1", "year2", "year3"];

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
 * closing[i] >= 0 for every month i in a 12-month horizon.
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

function modelIncludesDrawings(modelType) {
  return modelType === "sole_trader_drawings" || modelType === "hybrid";
}

function buildSummaryFromMetrics(metrics) {
  return {
    minClosingBalance: round2(metrics.risk.minClosingBalance),
    monthsBelowZero: metrics.risk.monthsBelowZero,
    totalInflows: round2(metrics.totals.totalInflows),
    totalOutflows: round2(metrics.totals.totalOutflows),
    totalDrawingsFromBusiness: round2(metrics.totals.totalDrawingsFromBusiness),
    netChange: round2(metrics.totals.netChange),
    closingEndOfYear: round2(metrics.totals.closingEndOfYear),
    requiredDrawingsMonthlyUplift: round2(metrics.decision.requiredDrawingsMonthlyUplift),
    requiredDrawingsAnnualUplift: round2(metrics.decision.requiredDrawingsAnnualUplift),
    requiredDrawingsIsExact: true,
    runwayMonths: metrics.decision.runwayMonths,
    dependencyOnBusinessDrawingsPct: round2(metrics.decision.dependencyOnBusinessDrawingsPct),
    dependencyBand: metrics.decision.dependencyBand,
    averageMonthlyOutflows: round2(metrics.decision.averageMonthlyOutflows)
  };
}

/**
 * Build a per-year PCF slice. Year 1 is authoritative from the canonical PCF
 * inputs. Years 2 and 3 project the Year 1 personal lifestyle pattern forward
 * unchanged, except that the "drawings from business" inflow row is replaced
 * by the year-plan `ownerAdjustments.ownerDrawingsMonthly` for that year (or
 * zero if that year's owner model does not include drawings). This keeps
 * Personal Cash Flow coherent with the business-side owner-compensation
 * engine without requiring separate per-year PCF inputs.
 *
 * No CPI uplift is applied to personal inflows/outflows in Y2/Y3. This is a
 * documented simplification: the rows are treated as a lifestyle baseline
 * rather than an inflation-projected forecast.
 */
function buildYearSlice({
  yearIndex,
  openingBalance,
  y1NonDrawingInflowsMonthly,
  y1OutflowsMonthly,
  y1SharedPersonalMonthly,
  drawingsMonthlyForYear
}) {
  const inflowsMonthly = zeroMonths();
  const outflowsMonthly = zeroMonths();
  for (let i = 0; i < 12; i += 1) {
    inflowsMonthly[i] = y1NonDrawingInflowsMonthly[i] + drawingsMonthlyForYear[i];
    outflowsMonthly[i] = y1OutflowsMonthly[i];
  }

  const metrics = computePersonalDecisionMetrics({
    openingBalance,
    inflowsMonthly,
    outflowsMonthly,
    drawingsMonthly: drawingsMonthlyForYear
  });

  return {
    yearIndex,
    openingBalance: round2(openingBalance),
    openingMonthly: metrics.openingMonthly.map(round2),
    inflowsMonthly: inflowsMonthly.map(round2),
    outflowsMonthly: outflowsMonthly.map(round2),
    sharedPersonalMonthly: y1SharedPersonalMonthly.map(round2),
    closingMonthly: metrics.closingMonthly.map(round2),
    drawingsFromBusinessMonthly: drawingsMonthlyForYear.map(round2),
    summary: buildSummaryFromMetrics(metrics)
  };
}

export function calculatePersonalCashFlow(normalizedState) {
  const pcf = normalizedState.personalCashFlow || {};
  const openingBalance = Number(pcf.openingBalance || 0);

  const inflowsMonthlyTotal = sumRowsMonthly(pcf.inflows);
  const outflowsMonthlyTotal = sumRowsMonthly(pcf.outflows);

  // Shared costs contribute their personal portion as outflows each month.
  // The same shared-cost profile applies across Year 1, Year 2, and Year 3.
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
  const personalDrawingsY1 = drawingsRow
    ? drawingsRow.monthly.map((v) => Number(v || 0))
    : zeroMonths();
  const personalDrawingsPopulatedY1 = personalDrawingsY1.some((v) => v !== 0);

  // Non-drawing inflows for Year 1: the total inflows minus the "drawings
  // from business" row. For Y2/Y3 we reuse this "lifestyle" inflows pattern
  // and splice in the year-specific drawings figure.
  const y1NonDrawingInflowsMonthly = zeroMonths();
  for (let i = 0; i < 12; i += 1) {
    y1NonDrawingInflowsMonthly[i] = inflowsMonthlyTotal[i] - personalDrawingsY1[i];
  }

  // --- Year 1: authoritative from canonical PCF inputs --------------------
  // Mirrors the pre-4.3.3 behaviour exactly so existing Y1 output is stable.
  const y1Metrics = computePersonalDecisionMetrics({
    openingBalance,
    inflowsMonthly: inflowsMonthlyTotal,
    outflowsMonthly: totalOutflowsMonthly,
    drawingsMonthly: personalDrawingsY1
  });

  const year1Slice = {
    yearIndex: 1,
    openingBalance: round2(openingBalance),
    openingMonthly: y1Metrics.openingMonthly.map(round2),
    inflowsMonthly: inflowsMonthlyTotal.map(round2),
    outflowsMonthly: totalOutflowsMonthly.map(round2),
    sharedPersonalMonthly: sharedPersonalMonthly.map(round2),
    closingMonthly: y1Metrics.closingMonthly.map(round2),
    drawingsFromBusinessMonthly: personalDrawingsY1.map(round2),
    summary: buildSummaryFromMetrics(y1Metrics)
  };

  // --- Years 2 and 3: project forward -------------------------------------
  const years = normalizedState.years || {};

  const drawingsForYear = (yearKey) => {
    const owner = (years[yearKey] || {}).ownerAdjustments || {};
    if (!modelIncludesDrawings(owner.modelType)) return zeroMonths();
    const monthly = Number(owner.ownerDrawingsMonthly || 0);
    const out = zeroMonths();
    for (let i = 0; i < 12; i += 1) out[i] = monthly;
    return out;
  };

  const y2Slice = buildYearSlice({
    yearIndex: 2,
    openingBalance: year1Slice.summary.closingEndOfYear,
    y1NonDrawingInflowsMonthly,
    y1OutflowsMonthly: totalOutflowsMonthly,
    y1SharedPersonalMonthly: sharedPersonalMonthly,
    drawingsMonthlyForYear: drawingsForYear("year2")
  });
  const y3Slice = buildYearSlice({
    yearIndex: 3,
    openingBalance: y2Slice.summary.closingEndOfYear,
    y1NonDrawingInflowsMonthly,
    y1OutflowsMonthly: totalOutflowsMonthly,
    y1SharedPersonalMonthly: sharedPersonalMonthly,
    drawingsMonthlyForYear: drawingsForYear("year3")
  });

  const perYear = { year1: year1Slice, year2: y2Slice, year3: y3Slice };

  const monthly36 = {
    opening: [...year1Slice.openingMonthly, ...y2Slice.openingMonthly, ...y3Slice.openingMonthly],
    inflows: [...year1Slice.inflowsMonthly, ...y2Slice.inflowsMonthly, ...y3Slice.inflowsMonthly],
    outflows: [...year1Slice.outflowsMonthly, ...y2Slice.outflowsMonthly, ...y3Slice.outflowsMonthly],
    closing: [...year1Slice.closingMonthly, ...y2Slice.closingMonthly, ...y3Slice.closingMonthly],
    drawingsFromBusiness: [
      ...year1Slice.drawingsFromBusinessMonthly,
      ...y2Slice.drawingsFromBusinessMonthly,
      ...y3Slice.drawingsFromBusinessMonthly
    ]
  };

  return {
    monthLabels: MONTH_LABELS.slice(),
    openingBalance: round2(openingBalance),
    // --- Backwards-compatible Year 1 top-level fields ---------------------
    // Pre-4.3.3 callers read these shapes directly. They are preserved so
    // existing dashboard / review / scenario-testing code paths keep working
    // while new code can prefer the `perYear` structure below.
    openingMonthly: year1Slice.openingMonthly,
    inflowsMonthly: year1Slice.inflowsMonthly,
    outflowsBaseMonthly: outflowsMonthlyTotal.map(round2),
    sharedPersonalMonthly: year1Slice.sharedPersonalMonthly,
    outflowsMonthly: year1Slice.outflowsMonthly,
    closingMonthly: year1Slice.closingMonthly,
    drawingsFromBusinessMonthly: year1Slice.drawingsFromBusinessMonthly,
    summary: year1Slice.summary,
    // --- Phase 4.3.3: 3-year view -----------------------------------------
    perYear,
    monthly36,
    // Diagnostic / guardrail context (consumed by warnings.js and the UI):
    drawingsLink: {
      personalDrawingsPopulatedY1,
      personalDrawingsTotalY1: round2(sumArray(personalDrawingsY1)),
      yearPlanDrawingsMonthly: YEAR_KEYS.reduce((acc, yk) => {
        const owner = (years[yk] || {}).ownerAdjustments || {};
        acc[yk] = {
          modelType: owner.modelType || "sole_trader_drawings",
          ownerDrawingsMonthly: round2(Number(owner.ownerDrawingsMonthly || 0))
        };
        return acc;
      }, {})
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
