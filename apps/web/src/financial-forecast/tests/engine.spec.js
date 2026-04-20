import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runForecastEngine } from "../core/engine/index.js";
import { computePersonalDecisionMetrics } from "../core/engine/personal-cash-flow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

async function loadFixture(name) {
  const raw = await readFile(path.join(fixturesDir, name), "utf8");
  return JSON.parse(raw);
}

function approx(actual, expected, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} ~= ${expected}`);
}

test("minimal valid scenario returns deterministic structure", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const outA = runForecastEngine(input);
  const outB = runForecastEngine(input);

  assert.equal(outA.timeline.monthCount, 36);
  assert.equal(outA.raw.sales.monthly.net.length, 36);
  assert.equal(outA.raw.cashFlow.closingCashMonthly.length, 36);
  assert.deepEqual(outA.raw.sales.monthly.net, outB.raw.sales.monthly.net);
  assert.deepEqual(outA.raw.profitLoss.netProfitAfterTaxMonthly, outB.raw.profitLoss.netProfitAfterTaxMonthly);
});

test("service-led scenario produces service revenue and quarterly outputs", async () => {
  const input = await loadFixture("service-business-state.json");
  const output = runForecastEngine(input);
  const serviceRevenue = output.raw.sales.monthly.serviceNet.reduce((a, b) => a + b, 0);

  assert.ok(serviceRevenue > 0);
  assert.equal(Object.keys(output.raw.quarterly.flowRollups.revenueNet).length, 12);
  assert.ok(output.derived.summaryCards.totalRevenue > 0);
});

test("product-led scenario produces product break-even metrics", async () => {
  const input = await loadFixture("product-business-state.json");
  const output = runForecastEngine(input);
  const year1 = output.raw.breakEven.yearly.find((x) => x.yearKey === "year1");

  assert.ok(year1);
  assert.ok(year1.productBreakEvenRevenue === null || year1.productBreakEvenRevenue >= 0);
});

test("sole trader drawings follow Personal Cash Flow drawings row in Year 1", async () => {
  const input = await loadFixture("owner-drawings-state.json");
  // Replace legacy items representation with the new PCF model so this test
  // exercises the Phase 4.2.6 "drawings-from-business wins in Y1" contract.
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      {
        id: "drawings-from-business",
        name: "Drawings from business",
        monthly: [1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800]
      }
    ],
    outflows: [],
    sharedCosts: []
  };
  const output = runForecastEngine(input);

  const drawingsY1 = output.raw.ownerAdjustments.drawingsMonthly.slice(0, 12);
  drawingsY1.forEach((v) => approx(v, 1800));
  // Year 2 should fall back to the year-plan figure (1300/month).
  approx(output.raw.ownerAdjustments.drawingsMonthly[12], 1300);
  assert.equal(output.raw.ownerAdjustments.salaryMonthly[0], 0);
});

test("company salary/distributions route correctly", async () => {
  const input = await loadFixture("company-salary-distributions-state.json");
  const output = runForecastEngine(input);

  assert.equal(output.raw.ownerAdjustments.drawingsMonthly[0], 0);
  assert.ok(output.raw.ownerAdjustments.salaryMonthly[0] > 0);
  assert.ok(output.raw.ownerAdjustments.distributionsMonthly[0] > 0);
});

test("negative closing cash warning is emitted", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.years.year1.costProfile.fixedMonthlyCost = 50000;
  const output = runForecastEngine(input);
  const hasWarning = output.warnings.some((w) => w.code === "CASHFLOW_NEGATIVE_CLOSING");
  assert.equal(hasWarning, true);
});

test("long debtor days warning is emitted", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.collectionsPolicy.defaultDebtorDays = 75;
  const output = runForecastEngine(input);
  const hasWarning = output.warnings.some((w) => w.code === "COLLECTIONS_LONG_DEBTOR_DAYS");
  assert.equal(hasWarning, true);
});

test("low gross margin warning is emitted", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.salesDetails.lines[0].grossMarginPercent = 5;
  const output = runForecastEngine(input);
  const hasWarning = output.warnings.some((w) => w.code === "SALES_LOW_MARGIN");
  assert.equal(hasWarning, true);
});

test("collections split validation catches invalid split", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.collectionsPolicy.collectionSplitByMonthBucket = [0.8, 0.3];
  const output = runForecastEngine(input);
  const hasError = output.validation.errors.some((e) => e.code === "COLLECTIONS_SPLIT_NOT_ONE");
  assert.equal(hasError, true);
});

test("cash and receivables reconciliation produce expected shape", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const output = runForecastEngine(input);

  assert.equal(output.raw.reconciliation.cashRollForward.length, 36);
  assert.equal(output.raw.reconciliation.receivablesRollForward.length, 36);
  assert.equal(output.raw.reconciliation.balanceEquation.length, 36);
});

test("balance equation reconciliation tracks pass/fail", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const output = runForecastEngine(input);
  const first = output.raw.reconciliation.balanceEquation[0];

  assert.equal(typeof first.pass, "boolean");
  approx(first.assets, output.raw.balanceSheet.assetsMonthly[0], 0.01);
});

test("balance equation reconciles for minimal scenario (A = L + E)", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const output = runForecastEngine(input);
  const maxAbs = output.raw.reconciliation.balanceEquation.reduce(
    (a, r) => Math.max(a, Math.abs(r.delta)),
    0
  );
  assert.ok(maxAbs <= 0.5, `expected max balance delta <= 0.5, got ${maxAbs}`);
  assert.equal(output.raw.reconciliation.summary.allBalancePass, true);
});

test("balance equation reconciles with GST gross basis + bad debt + opening receivables", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.collectionsPolicy.receivablesBasis = "gross";
  input.collectionsPolicy.badDebtPct = 2;
  input.collectionsPolicy.openingReceivables = 2500;
  const output = runForecastEngine(input);
  const maxAbs = output.raw.reconciliation.balanceEquation.reduce(
    (a, r) => Math.max(a, Math.abs(r.delta)),
    0
  );
  assert.ok(maxAbs <= 0.5, `expected max balance delta <= 0.5, got ${maxAbs}`);
  assert.equal(output.raw.reconciliation.summary.allBalancePass, true);
  const hasWarning = output.warnings.some((w) => w.code === "RECON_BALANCE_EQUATION_FAIL");
  assert.equal(hasWarning, false);
});

test("bad debt flows into P&L as an operating expense", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.collectionsPolicy.badDebtPct = 5;
  const output = runForecastEngine(input);
  const bd = output.raw.profitLoss.badDebtMonthly;
  const coll = output.raw.collections.badDebtWrittenOffMonthly;
  assert.ok(Array.isArray(bd) && bd.length === 36);
  assert.ok(bd.some((v) => v > 0), "expected at least one month with bad debt");
  approx(bd.reduce((a, b) => a + b, 0), coll.reduce((a, b) => a + b, 0), 0.5);
});

test("tax and interest are paid as operating cash outflows", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const output = runForecastEngine(input);
  const totalTax = output.raw.profitLoss.taxMonthly.reduce((a, b) => a + b, 0);
  const totalInterest = output.raw.loans.interestMonthly.reduce((a, b) => a + b, 0);
  const totalTaxPaid = (output.raw.cashFlow.taxPaidMonthly || []).reduce((a, b) => a + b, 0);
  const totalInterestPaid = (output.raw.cashFlow.interestPaidMonthly || []).reduce((a, b) => a + b, 0);
  approx(totalTaxPaid, totalTax, 0.5);
  approx(totalInterestPaid, totalInterest, 0.5);
});

test("GST payable accrues as a liability when receivables basis is gross", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.collectionsPolicy.receivablesBasis = "gross";
  const output = runForecastEngine(input);
  const gstPay = output.raw.balanceSheet.gstPayableMonthly;
  assert.ok(Array.isArray(gstPay) && gstPay.length === 36);
  const totalGst = output.raw.sales.monthly.gst.reduce((a, b) => a + b, 0);
  approx(gstPay[gstPay.length - 1], totalGst, 0.5);
});

test("multi-line COGS uses true line units and line revenue", async () => {
  const input = await loadFixture("multi-line-cogs-state.json");
  const output = runForecastEngine(input);

  approx(output.raw.sales.monthly.byLineUnits.line_a[0], 10);
  approx(output.raw.sales.monthly.byLineUnits.line_b[0], 1);
  approx(output.raw.costs.cogsMonthly[0], 800);
  approx(output.raw.costs.variableMonthly[0], 0);
});

test("GST handling separates invoicing GST from profitability basis", async () => {
  const dualBasisInput = await loadFixture("gst-behavior-state.json");
  const dualBasisOutput = runForecastEngine(dualBasisInput);
  approx(dualBasisOutput.raw.sales.monthly.gross[0], 110);
  approx(dualBasisOutput.raw.sales.monthly.net[0], 100);
  approx(dualBasisOutput.raw.sales.monthly.gst[0], 10);

  const cashBasisInput = await loadFixture("gst-behavior-state.json");
  cashBasisInput.setup.reportBasis = "cash_basis_view";
  const cashBasisOutput = runForecastEngine(cashBasisInput);
  approx(cashBasisOutput.raw.sales.monthly.gross[0], 110);
  approx(cashBasisOutput.raw.sales.monthly.net[0], 110);
  approx(cashBasisOutput.raw.sales.monthly.gst[0], 10);
});

test("loan amortization monthly values are numerically correct", async () => {
  const input = await loadFixture("loan-amortization-state.json");
  const output = runForecastEngine(input);

  approx(output.raw.loans.drawdownMonthly[0], 1200);
  approx(output.raw.loans.interestMonthly[0], 12);
  approx(output.raw.loans.principalMonthly[0], 94.62, 0.02);
  approx(output.raw.loans.paymentMonthly[0], 106.62, 0.02);
  approx(output.raw.loans.closingLoanBalanceMonthly[0], 1105.38, 0.02);
});

test("retained earnings roll-forward subtracts distributions", async () => {
  const input = await loadFixture("retained-earnings-state.json");
  const output = runForecastEngine(input);

  const month1Profit = output.raw.profitLoss.netProfitAfterTaxMonthly[0];
  const month1Distributions = output.raw.ownerAdjustments.distributionsMonthly[0];
  const month1Retained = output.raw.balanceSheet.retainedEarningsMonthly[0];
  approx(month1Retained, month1Profit - month1Distributions);
});

test("strict mode aborts on blocking validation errors", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.collectionsPolicy.collectionSplitByMonthBucket = [0.9, 0.5];
  const output = runForecastEngine(input, { mode: "strict" });

  assert.equal(output.status, "validation_failed");
  assert.equal(output.raw, null);
  assert.equal(output.derived, null);
  assert.ok(output.validation.errors.some((issue) => issue.blocking));
});

// --- Phase 4.2.7 Personal Cash Flow correctness tests --------------------

test("PCF roll-forward: closing[t-1] = opening[t] and summary matches monthly", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 5000,
    inflows: [
      {
        id: "drawings-from-business",
        label: "Drawings from business",
        monthly: [1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800]
      },
      {
        id: "part-time",
        label: "Part-time / casual work",
        monthly: [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500]
      }
    ],
    outflows: [
      {
        id: "groceries",
        label: "Groceries",
        monthly: [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200]
      }
    ],
    sharedCosts: [
      { id: "rent", name: "Household Rent", amount: 2000, frequency: "monthly", personalUsePercent: 80 }
    ]
  };
  const output = runForecastEngine(input);
  const pcf = output.raw.personalCashFlow;

  for (let i = 1; i < 12; i += 1) {
    approx(pcf.openingMonthly[i], pcf.closingMonthly[i - 1]);
  }
  approx(pcf.openingMonthly[0], 5000);

  const sumInflowsMonthly = pcf.inflowsMonthly.reduce((a, b) => a + b, 0);
  const sumOutflowsMonthly = pcf.outflowsMonthly.reduce((a, b) => a + b, 0);
  approx(pcf.summary.totalInflows, sumInflowsMonthly);
  approx(pcf.summary.totalOutflows, sumOutflowsMonthly);
  approx(pcf.summary.netChange, sumInflowsMonthly - sumOutflowsMonthly);
  approx(pcf.summary.closingEndOfYear, pcf.closingMonthly[11]);
  approx(pcf.closingMonthly[11], 5000 + sumInflowsMonthly - sumOutflowsMonthly);
  approx(pcf.summary.minClosingBalance, Math.min(...pcf.closingMonthly));
});

test("PCF shared costs do not double-count on the business side", async () => {
  const input = await loadFixture("owner-drawings-state.json");
  const baseline = runForecastEngine({ ...JSON.parse(JSON.stringify(input)) });
  const baselineOperatingExpenses = baseline.raw.profitLoss.operatingExpensesMonthly.reduce((a, b) => a + b, 0);

  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [],
    outflows: [],
    sharedCosts: [
      { id: "rent", name: "Household Rent", amount: 3000, frequency: "monthly", personalUsePercent: 100 },
      { id: "internet", name: "Internet", amount: 100, frequency: "monthly", personalUsePercent: 50 }
    ]
  };
  const withShared = runForecastEngine(input);

  const withSharedOperatingExpenses = withShared.raw.profitLoss.operatingExpensesMonthly.reduce((a, b) => a + b, 0);
  approx(withSharedOperatingExpenses, baselineOperatingExpenses);

  const pcf = withShared.raw.personalCashFlow;
  const expectedPersonalMonthly = 3000 * 1.0 + 100 * 0.5;
  approx(pcf.sharedPersonalMonthly[0], expectedPersonalMonthly);
  approx(pcf.outflowsMonthly[0], expectedPersonalMonthly);
});

test("PCF drawings linkage reduces business cash + equity by the same amount", async () => {
  const input = await loadFixture("owner-drawings-state.json");
  const monthly = [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500];
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [{ id: "drawings-from-business", label: "Drawings from business", monthly }],
    outflows: [],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const engineDrawingsY1 = output.raw.ownerAdjustments.drawingsMonthly.slice(0, 12);
  engineDrawingsY1.forEach((v, i) => approx(v, monthly[i]));

  const pcfDrawings = output.raw.personalCashFlow.drawingsFromBusinessMonthly;
  for (let i = 0; i < 12; i += 1) {
    approx(pcfDrawings[i], engineDrawingsY1[i]);
  }

  const cashRolls = output.raw.reconciliation.cashRollForward.slice(0, 12);
  cashRolls.forEach((row) => assert.ok(Math.abs(row.delta) < 0.01));
  const balanceRolls = output.raw.reconciliation.balanceEquation.slice(0, 12);
  balanceRolls.forEach((row) => assert.ok(Math.abs(row.delta) < 0.01));
});

test("PCF LOW_BUFFER warning does not fire on an all-zero scenario", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = { year1Only: true, openingBalance: 0, inflows: [], outflows: [], sharedCosts: [] };
  const output = runForecastEngine(input);
  const codes = output.warnings.map((w) => w.code);
  assert.ok(!codes.includes("PERSONAL_CASHFLOW_LOW_BUFFER"), "LOW_BUFFER should not fire when PCF is blank");
  assert.ok(!codes.includes("PERSONAL_CASHFLOW_NEGATIVE_CLOSING"), "NEGATIVE_CLOSING should not fire when PCF is blank");
});

// --- Phase 4.2.8 Personal Decision Intelligence tests --------------------

test("PCF required drawings uplift is zero when plan is already solvent", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 10000,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(2000) }
    ],
    outflows: [
      { id: "groceries", label: "Groceries", monthly: Array(12).fill(1000) }
    ],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const s = output.raw.personalCashFlow.summary;
  approx(s.requiredDrawingsMonthlyUplift, 0);
  approx(s.requiredDrawingsAnnualUplift, 0);
  assert.equal(s.requiredDrawingsIsExact, true);
  assert.equal(s.runwayMonths, null);
  assert.ok(s.minClosingBalance >= 0);
});

test("PCF required drawings uplift is exact when plan dips negative", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  // Opening 0, inflows 0, outflows 1000/month -> closing[i] = -(i+1)*1000.
  // Required uplift satisfies closing[i] + (i+1)*u >= 0, so u = 1000.
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [],
    outflows: [
      { id: "groceries", label: "Groceries", monthly: Array(12).fill(1000) }
    ],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const s = output.raw.personalCashFlow.summary;
  approx(s.requiredDrawingsMonthlyUplift, 1000);
  approx(s.requiredDrawingsAnnualUplift, 12000);
  // Applying the uplift should make closing non-negative in every month.
  const lift = s.requiredDrawingsMonthlyUplift;
  const closing = output.raw.personalCashFlow.closingMonthly;
  closing.forEach((c, i) => {
    assert.ok(c + (i + 1) * lift >= -0.01, `month ${i}: ${c} + ${(i + 1) * lift} must be >= 0`);
  });
});

test("PCF dependency ratio is 0% and runway is null when there are no inflows", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 5000,
    inflows: [],
    outflows: [],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const s = output.raw.personalCashFlow.summary;
  approx(s.dependencyOnBusinessDrawingsPct, 0);
  assert.equal(s.dependencyBand, "none");
  assert.equal(s.runwayMonths, null);
});

test("PCF dependency ratio reflects drawings share of total inflows", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(3000) },
      { id: "part-time", label: "Part-time / casual work", monthly: Array(12).fill(1000) }
    ],
    outflows: [],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const s = output.raw.personalCashFlow.summary;
  approx(s.dependencyOnBusinessDrawingsPct, 75, 0.05);
  assert.equal(s.dependencyBand, "high");
});

test("PCF runway equals the first negative-closing month index", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  // Opening 1500, burn 1000/month -> closings: 500, -500, -1500, ...
  // First negative is month index 1 -> runway = 1 full month of positive closing.
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 1500,
    inflows: [],
    outflows: [
      { id: "groceries", label: "Groceries", monthly: Array(12).fill(1000) }
    ],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const s = output.raw.personalCashFlow.summary;
  assert.equal(s.runwayMonths, 1);
  approx(s.minClosingBalance, -10500);
});

test("PCF burn-aware LOW_BUFFER warning fires when buffer is under ~0.5 months of outflows", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  // Drawings 1100/month, outflows 1000/month -> net closing grows by 100/mo
  // from opening 200. Min closing ≈ 300 at month 1, well below 500
  // (= 0.5 * avg monthly outflows of 1000).
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 200,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(1100) }
    ],
    outflows: [
      { id: "groceries", label: "Groceries", monthly: Array(12).fill(1000) }
    ],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const codes = output.warnings.map((w) => w.code);
  assert.ok(codes.includes("PERSONAL_CASHFLOW_LOW_BUFFER"),
    `expected LOW_BUFFER with burn-aware threshold, got: ${codes.join(",")}`);
});

test("PCF burn-aware LOW_BUFFER stays silent when minimum buffer exceeds half a month of outflows", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  // Opening 5000 (well above 0.5 * 1000 = 500), no outflows leaving balance
  // near zero at any point.
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 5000,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(1100) }
    ],
    outflows: [
      { id: "groceries", label: "Groceries", monthly: Array(12).fill(1000) }
    ],
    sharedCosts: []
  };
  const output = runForecastEngine(input);
  const codes = output.warnings.map((w) => w.code);
  assert.ok(!codes.includes("PERSONAL_CASHFLOW_LOW_BUFFER"),
    `LOW_BUFFER should stay silent with a healthy buffer, got: ${codes.join(",")}`);
});

test("Stress helper recomputes decision metrics without mutating canonical state", () => {
  const base = {
    openingBalance: 0,
    inflowsMonthly: Array(12).fill(2000),
    outflowsMonthly: Array(12).fill(1800),
    drawingsMonthly: Array(12).fill(2000)
  };
  const baseMetrics = computePersonalDecisionMetrics(base);
  approx(baseMetrics.risk.minClosingBalance, 200);
  assert.equal(baseMetrics.decision.runwayMonths, null);

  // Reduce drawings by 50% and bump outflows by 20%:
  //   inflows -> 1000/mo, outflows -> 2160/mo, net = -1160/mo.
  const stressed = computePersonalDecisionMetrics({
    openingBalance: 0,
    inflowsMonthly: Array(12).fill(1000),
    outflowsMonthly: Array(12).fill(2160),
    drawingsMonthly: Array(12).fill(1000)
  });
  approx(stressed.closingMonthly[0], -1160);
  assert.equal(stressed.decision.runwayMonths, 0);
  approx(stressed.decision.requiredDrawingsMonthlyUplift, 1160);

  // Base case must still be untouched.
  assert.deepEqual(base.inflowsMonthly, Array(12).fill(2000));
  assert.deepEqual(base.outflowsMonthly, Array(12).fill(1800));
});

test("Invariant: business cash reduction from drawings equals personal drawings in Year 1", async () => {
  const input = await loadFixture("owner-drawings-state.json");
  const monthly = [1500, 1600, 1700, 1800, 1500, 1600, 1700, 1800, 1500, 1600, 1700, 1800];
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [{ id: "drawings-from-business", label: "Drawings from business", monthly }],
    outflows: [],
    sharedCosts: []
  };
  const output = runForecastEngine(input);

  // Business-side drawings in Year 1 must exactly equal what the personal
  // layer shows as drawings inflow for Year 1.
  const businessDrawingsY1 = output.raw.ownerAdjustments.drawingsMonthly
    .slice(0, 12)
    .reduce((a, b) => a + b, 0);
  const personalDrawingsY1 = output.raw.personalCashFlow.drawingsFromBusinessMonthly
    .reduce((a, b) => a + b, 0);
  const inputDrawingsY1 = monthly.reduce((a, b) => a + b, 0);

  approx(businessDrawingsY1, inputDrawingsY1, 0.01);
  approx(personalDrawingsY1, inputDrawingsY1, 0.01);
  approx(businessDrawingsY1, personalDrawingsY1, 0.01);

  // Balance equation and cash roll-forward must still reconcile.
  const balanceRolls = output.raw.reconciliation.balanceEquation.slice(0, 12);
  balanceRolls.forEach((row) => assert.ok(Math.abs(row.delta) < 0.01));
  const cashRolls = output.raw.reconciliation.cashRollForward.slice(0, 12);
  cashRolls.forEach((row) => assert.ok(Math.abs(row.delta) < 0.01));
});
