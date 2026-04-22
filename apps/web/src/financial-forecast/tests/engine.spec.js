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

// Phase 4.3.2: the three demo datasets (conservative/base/aggressive) were
// moved out of the public bundle into tests/fixtures/ so they are explicitly
// test-only artifacts and are NOT served from the live app. These helpers
// still unwrap the `.data` envelope because the datasets were originally
// saved in the full canonical save format.
async function loadPublicDataset(name) {
  const raw = await readFile(path.join(fixturesDir, name), "utf8");
  const parsed = JSON.parse(raw);
  return parsed?.data || parsed;
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
  // Phase 4.3.3: PCF projects across all three years, so for this test to
  // keep LOW_BUFFER silent we also need the Y2/Y3 year plans to carry
  // drawings that match the Y1 PCF drawings row. The 4.3.1 behaviour (Y1
  // only) is preserved as the Year 1 summary; the warning check below is
  // scoped to Year 1 because that is the original test intent.
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
  ["year1", "year2", "year3"].forEach((yk) => {
    input.years[yk].ownerAdjustments = input.years[yk].ownerAdjustments || {};
    input.years[yk].ownerAdjustments.modelType = "sole_trader_drawings";
    input.years[yk].ownerAdjustments.ownerDrawingsMonthly = 1100;
  });
  const output = runForecastEngine(input);
  const year1Warnings = output.warnings.filter((w) => !w.year || w.year === "year1" || w.year === "all");
  const year1Codes = year1Warnings.map((w) => w.code);
  assert.ok(!year1Codes.includes("PERSONAL_CASHFLOW_LOW_BUFFER"),
    `LOW_BUFFER should stay silent on Year 1 with a healthy buffer, got: ${year1Codes.join(",")}`);
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

// --- Phase 4.3.0 Business Expenses + Statutory Labor ---------------------

test("Phase 4.3.0: minimal scenario without businessExpenses/super/payroll runs and zero-defaults cleanly", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const output = runForecastEngine(input);

  assert.equal(output.status, "ok");
  const costs = output.raw.costs;
  assert.ok(Array.isArray(costs.namedOperatingMonthly));
  assert.equal(costs.namedOperatingMonthly.length, 36);
  costs.namedOperatingMonthly.forEach((v) => approx(v, 0));

  const stat = output.raw.statutoryLabor;
  assert.ok(stat);
  assert.equal(stat.superannuationMonthly.length, 36);
  assert.equal(stat.payrollTaxMonthly.length, 36);
  stat.superannuationMonthly.forEach((v) => approx(v, 0));
  stat.payrollTaxMonthly.forEach((v) => approx(v, 0));
});

test("Phase 4.3.0: active named business expense rolls into P&L operating expenses and cash outflows", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const baseline = runForecastEngine(JSON.parse(JSON.stringify(input)));
  const baselineOpEx = baseline.raw.profitLoss.operatingExpensesMonthly[0];
  const baselineNetOperating = baseline.raw.cashFlow.netOperatingMonthly[0];

  input.years.year1.businessExpenses = {
    lineItems: [
      {
        id: "rent",
        category: "rent_lease",
        label: "Studio Rent",
        monthlyAmount: 1000,
        startMonth: 1,
        endMonth: 12,
        isActive: true,
        notes: ""
      }
    ]
  };
  const output = runForecastEngine(input);

  approx(output.raw.costs.namedOperatingMonthly[0], 1000);
  approx(output.raw.profitLoss.operatingExpensesMonthly[0] - baselineOpEx, 1000);

  // Net operating cash drops by the 1000 extra outflow, offset by lower tax
  // paid on the (now smaller) taxable profit. With a 25% tax rate and a still-
  // positive NPBT, the net cash drop is 1000 * (1 - 0.25) = 750.
  const taxRate = 0.25;
  approx(baselineNetOperating - output.raw.cashFlow.netOperatingMonthly[0], 1000 * (1 - taxRate), 1);

  const breakdown = output.raw.costs.namedOperatingByCategoryMonthly[0];
  assert.ok(breakdown);
  approx(breakdown.rent_lease, 1000);
});

test("Phase 4.3.0: business expense respects startMonth/endMonth window", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.years.year1.businessExpenses = {
    lineItems: [
      {
        id: "insurance",
        category: "insurance",
        label: "Insurance",
        monthlyAmount: 600,
        startMonth: 4,
        endMonth: 9,
        isActive: true
      }
    ]
  };
  const output = runForecastEngine(input);
  const named = output.raw.costs.namedOperatingMonthly;
  // Months 1-3 (indices 0,1,2) outside window -> 0.
  approx(named[0], 0);
  approx(named[2], 0);
  // Month 4 (index 3) through Month 9 (index 8) inside window -> 600.
  approx(named[3], 600);
  approx(named[8], 600);
  // Month 10 (index 9) onwards outside window -> 0.
  approx(named[9], 0);
  approx(named[11], 0);
});

test("Phase 4.3.0: inactive business expenses are excluded", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.years.year1.businessExpenses = {
    lineItems: [
      { id: "a", category: "utilities", label: "Power", monthlyAmount: 500, startMonth: 1, endMonth: 12, isActive: true },
      { id: "b", category: "software_saas", label: "Experimental SaaS", monthlyAmount: 999, startMonth: 1, endMonth: 12, isActive: false }
    ]
  };
  const output = runForecastEngine(input);
  approx(output.raw.costs.namedOperatingMonthly[0], 500);
});

test("Phase 4.3.0: superannuation and payroll tax apply to direct labor and director salary", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.years.year1.assumptions.superannuationPct = 11;
  input.years.year1.assumptions.payrollTaxPct = 5;
  input.years.year1.ownerAdjustments = {
    modelType: "company_salary_and_distributions",
    ownerDrawingsMonthly: 0,
    directorSalaryMonthly: 4000,
    distributionsMonthly: 0,
    notes: ""
  };
  const output = runForecastEngine(input);

  const directLabor = output.raw.costs.directLaborMonthly[0];
  const directorSalary = output.raw.ownerAdjustments.salaryMonthly[0];
  assert.ok(directorSalary > 0, "expected director salary to flow under company model");
  const base = directLabor + directorSalary;

  approx(output.raw.statutoryLabor.superannuationMonthly[0], base * 0.11, 0.02);
  approx(output.raw.statutoryLabor.payrollTaxMonthly[0], base * 0.05, 0.02);

  // Drawings/distributions must NOT contribute to the statutory base.
  const input2 = await loadFixture("minimal-valid-state.json");
  input2.years.year1.assumptions.superannuationPct = 11;
  input2.years.year1.assumptions.payrollTaxPct = 5;
  input2.years.year1.ownerAdjustments = {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 9999,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0,
    notes: ""
  };
  const output2 = runForecastEngine(input2);
  const baseOnly = output2.raw.costs.directLaborMonthly[0];
  approx(output2.raw.statutoryLabor.superannuationMonthly[0], baseOnly * 0.11, 0.02);
});

test("Phase 4.3.0: super + payroll tax flow into P&L OpEx and cash outflow identically", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const baseline = runForecastEngine(JSON.parse(JSON.stringify(input)));
  input.years.year1.assumptions.superannuationPct = 10;
  input.years.year1.assumptions.payrollTaxPct = 5;
  input.years.year1.ownerAdjustments = {
    modelType: "company_salary_and_distributions",
    ownerDrawingsMonthly: 0,
    directorSalaryMonthly: 2000,
    distributionsMonthly: 0,
    notes: ""
  };
  const output = runForecastEngine(input);

  const sup = output.raw.statutoryLabor.superannuationMonthly[0];
  const pay = output.raw.statutoryLabor.payrollTaxMonthly[0];
  const uplift = sup + pay;
  assert.ok(uplift > 0);

  const opExDelta = output.raw.profitLoss.operatingExpensesMonthly[0]
    - baseline.raw.profitLoss.operatingExpensesMonthly[0];
  // OpEx delta = new director salary (2000) + statutory labor uplift.
  approx(opExDelta, 2000 + uplift, 0.5);

  // Net operating cash drops by (2000 + uplift) minus the tax saved on the
  // now-smaller profit (rate 25%). Distribution payout is zero, so no extra
  // financing leakage enters the operating line.
  const taxRate = 0.25;
  const cashDelta = baseline.raw.cashFlow.netOperatingMonthly[0]
    - output.raw.cashFlow.netOperatingMonthly[0];
  approx(cashDelta, (2000 + uplift) * (1 - taxRate), 2);
});

test("Phase 4.3.0: named business expenses + statutory labor contribute to break-even fixed costs", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  const baseline = runForecastEngine(JSON.parse(JSON.stringify(input)));
  const baselineBE = baseline.raw.breakEven.yearly.find((y) => y.yearKey === "year1") || {};
  const baselineService = Number(baselineBE.serviceBreakEvenRevenue || 0);

  input.years.year1.businessExpenses = {
    lineItems: [
      { id: "rent", category: "rent_lease", label: "Rent", monthlyAmount: 2000, startMonth: 1, endMonth: 12, isActive: true }
    ]
  };
  input.years.year1.assumptions.superannuationPct = 12;
  input.years.year1.ownerAdjustments = {
    modelType: "company_owner_salary",
    ownerDrawingsMonthly: 0,
    directorSalaryMonthly: 3000,
    distributionsMonthly: 0,
    notes: ""
  };
  const output = runForecastEngine(input);
  const updated = output.raw.breakEven.yearly.find((y) => y.yearKey === "year1") || {};
  const updatedService = Number(updated.serviceBreakEvenRevenue || 0);

  // Adding more fixed costs must raise the service break-even revenue required.
  assert.ok(updatedService > baselineService,
    `expected break-even revenue to increase, got baseline=${baselineService} updated=${updatedService}`);
});

test("Phase 4.3.0: business expense normalization clamps invalid months into range", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.years.year1.businessExpenses = {
    lineItems: [
      { id: "x", category: "utilities", label: "Bad Months", monthlyAmount: 200, startMonth: 0, endMonth: 99, isActive: true }
    ]
  };
  const output = runForecastEngine(input);
  approx(output.raw.costs.namedOperatingMonthly[0], 200);
  approx(output.raw.costs.namedOperatingMonthly[11], 200);
});

test("Phase 4.3.0: superannuation/payroll pct out of range produces blocking validation issue", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.years.year1.assumptions.superannuationPct = 150;
  const output = runForecastEngine(input);
  const hasError = output.validation.errors.some((e) => e.code === "STATUTORY_LABOR_INVALID_PCT");
  assert.equal(hasError, true);
});

test("Phase 4.3.0: multi marketing rows aggregate into monthly spend, respect windows, and skip inactive", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.years.year1.marketing = {
    lineItems: [
      { id: "m1", label: "Google Ads", monthlyAmount: 500, startMonth: 1, endMonth: 12, isActive: true },
      { id: "m2", label: "Facebook Ads", monthlyAmount: 300, startMonth: 3, endMonth: 6, isActive: true },
      { id: "m3", label: "Billboard (paused)", monthlyAmount: 1000, startMonth: 1, endMonth: 12, isActive: false }
    ]
  };
  const output = runForecastEngine(input);
  const m = output.raw.marketing.monthly;
  approx(m[0], 500);
  approx(m[1], 500);
  // Month 3 (index 2) through Month 6 (index 5): 500 + 300.
  approx(m[2], 800);
  approx(m[5], 800);
  // Month 7 (index 6) onwards: 500 only.
  approx(m[6], 500);
  approx(m[11], 500);
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

// ---------------------------------------------------------------------------
// Phase 4.3.1 guardrail tests: schema-aligned public datasets.
// These tests load the three downloadable testing scenarios from
// apps/web/public/datasets and assert that the critical 4.3.0 inputs
// (named business expenses, statutory labor, owner compensation, personal
// cash flow) flow through the engine into non-zero outputs without
// regressions.
// ---------------------------------------------------------------------------

test("Phase 4.3.1: conservative dataset exercises sole-trader drawings + named expenses", async () => {
  const input = await loadPublicDataset("conservative.forecast.json");
  const out = runForecastEngine(input);

  assert.equal(out.status, "ok");
  assert.equal(out.timeline.monthCount, 36);

  const namedExp3y = out.raw.costs.namedOperatingMonthly.reduce((a, b) => a + b, 0);
  assert.ok(namedExp3y > 0, "named business expenses must aggregate above zero");

  const drawY1 = out.raw.ownerAdjustments.drawingsMonthly
    .slice(0, 12)
    .reduce((a, b) => a + b, 0);
  assert.ok(drawY1 > 0, "Y1 drawings must flow from owner compensation");

  // Sole trader: no director salary / distributions.
  const salY1 = out.raw.ownerAdjustments.salaryMonthly.slice(0, 12).reduce((a, b) => a + b, 0);
  const distY1 = out.raw.ownerAdjustments.distributionsMonthly.slice(0, 12).reduce((a, b) => a + b, 0);
  assert.equal(salY1, 0);
  assert.equal(distY1, 0);

  // PCF must produce a defined closing balance series for Y1.
  assert.equal(out.raw.personalCashFlow.closingMonthly.length, 12);
});

test("Phase 4.3.1: base dataset exercises company salary + distributions + statutory super", async () => {
  const input = await loadPublicDataset("base.forecast.json");
  const out = runForecastEngine(input);

  assert.equal(out.status, "ok");

  const salY1 = out.raw.ownerAdjustments.salaryMonthly.slice(0, 12).reduce((a, b) => a + b, 0);
  const distY1 = out.raw.ownerAdjustments.distributionsMonthly.slice(0, 12).reduce((a, b) => a + b, 0);
  const drawY1 = out.raw.ownerAdjustments.drawingsMonthly.slice(0, 12).reduce((a, b) => a + b, 0);
  assert.ok(salY1 > 0, "director salary must flow in company model");
  assert.ok(distY1 > 0, "distributions must flow in company model");
  assert.equal(drawY1, 0, "company model must NOT produce drawings");

  const namedExp3y = out.raw.costs.namedOperatingMonthly.reduce((a, b) => a + b, 0);
  assert.ok(namedExp3y > 0, "named business expenses must aggregate above zero");

  const super3y = out.raw.statutoryLabor.superannuationMonthly.reduce((a, b) => a + b, 0);
  assert.ok(super3y > 0, "superannuation must flow from statutory labor");
});

test("Phase 4.3.1: aggressive dataset exercises full statutory labor stack", async () => {
  const input = await loadPublicDataset("aggressive.forecast.json");
  const out = runForecastEngine(input);

  assert.equal(out.status, "ok");

  const namedExp3y = out.raw.costs.namedOperatingMonthly.reduce((a, b) => a + b, 0);
  assert.ok(namedExp3y > 0);

  const super3y = out.raw.statutoryLabor.superannuationMonthly.reduce((a, b) => a + b, 0);
  const payroll3y = out.raw.statutoryLabor.payrollTaxMonthly.reduce((a, b) => a + b, 0);
  assert.ok(super3y > 0, "superannuation must flow in aggressive dataset");
  assert.ok(payroll3y > 0, "payroll tax must flow in aggressive dataset");

  const salY1 = out.raw.ownerAdjustments.salaryMonthly.slice(0, 12).reduce((a, b) => a + b, 0);
  const distY1 = out.raw.ownerAdjustments.distributionsMonthly.slice(0, 12).reduce((a, b) => a + b, 0);
  assert.ok(salY1 > 0);
  assert.ok(distY1 > 0);
});

test("Phase 4.3.1: all three datasets reconcile balance equation + cash roll-forward", async () => {
  // Tolerance is widened vs. fixture tests because public datasets span 36
  // months of heavy aggregation; a +/- 1c rounding drift is acceptable.
  const TOLERANCE = 1;
  for (const name of ["conservative.forecast.json", "base.forecast.json", "aggressive.forecast.json"]) {
    const input = await loadPublicDataset(name);
    const out = runForecastEngine(input);
    out.raw.reconciliation.balanceEquation.forEach((row) =>
      assert.ok(Math.abs(row.delta) < TOLERANCE, `${name} balance delta too large: ${row.delta}`)
    );
    out.raw.reconciliation.cashRollForward.forEach((row) =>
      assert.ok(Math.abs(row.delta) < TOLERANCE, `${name} cash roll delta too large: ${row.delta}`)
    );
  }
});

test("Phase 4.3.1: backward compat - legacy dataset without 4.3.0 fields still runs and zero-defaults", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  delete input.years.year1.businessExpenses;
  delete input.years.year2.businessExpenses;
  delete input.years.year3.businessExpenses;
  delete input.years.year1.assumptions.superannuationPct;
  delete input.years.year1.assumptions.payrollTaxPct;

  const out = runForecastEngine(input);
  assert.equal(out.status, "ok");

  const namedExp = out.raw.costs.namedOperatingMonthly.reduce((a, b) => a + b, 0);
  assert.equal(namedExp, 0, "legacy datasets must produce zero named expenses");

  const super3y = out.raw.statutoryLabor.superannuationMonthly.reduce((a, b) => a + b, 0);
  const payroll3y = out.raw.statutoryLabor.payrollTaxMonthly.reduce((a, b) => a + b, 0);
  assert.equal(super3y, 0);
  assert.equal(payroll3y, 0);
});

test("Phase 4.3.1: backward compat - legacy personalCashFlow.items migrates to sharedCosts", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    items: [
      { id: "legacy_rent", name: "Home rent", amount: 2000, frequency: "monthly", personalUsePercent: 100 },
      { id: "legacy_phone", name: "Phone", amount: 120, frequency: "monthly", personalUsePercent: 50 }
    ]
  };
  const out = runForecastEngine(input);
  assert.equal(out.status, "ok");

  const pcf = out.raw.personalCashFlow;
  assert.ok(Array.isArray(pcf.sharedCostsRows));
  assert.equal(pcf.sharedCostsRows.length, 2);
  const rent = pcf.sharedCostsRows.find((r) => r.name === "Home rent");
  assert.ok(rent, "migrated rent row must exist");
  approx(rent.personalMonthlyAmount, 2000);
});

test("Phase 4.3.1: round-trip save/load - canonical state survives JSON serialize + re-run", async () => {
  const input = await loadPublicDataset("base.forecast.json");
  const out1 = runForecastEngine(input);

  // Simulate the save/load path: serialize canonical via JSON and re-run.
  const roundTripped = JSON.parse(JSON.stringify(input));
  const out2 = runForecastEngine(roundTripped);

  assert.deepEqual(out1.raw.sales.monthly.net, out2.raw.sales.monthly.net);
  assert.deepEqual(
    out1.raw.profitLoss.netProfitAfterTaxMonthly,
    out2.raw.profitLoss.netProfitAfterTaxMonthly
  );
  assert.deepEqual(
    out1.raw.ownerAdjustments.drawingsMonthly,
    out2.raw.ownerAdjustments.drawingsMonthly
  );
  assert.deepEqual(
    out1.raw.costs.namedOperatingMonthly,
    out2.raw.costs.namedOperatingMonthly
  );
});

test("Phase 4.3.1: Y1-drawings-from-PCF override only applies when PCF row is populated", async () => {
  const input = await loadFixture("owner-drawings-state.json");

  // Ensure sole_trader_drawings with an explicit year-plan drawings figure.
  input.years.year1.ownerAdjustments = {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 2500,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0,
    notes: ""
  };
  // PCF row exists (canonical behaviour) but is entirely zero - user has NOT
  // filled in the Personal Cash Flow step. The engine must fall back to the
  // year-plan figure rather than silently zeroing out Y1 drawings.
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      {
        id: "drawings-from-business",
        label: "Drawings from business",
        monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    ],
    outflows: [],
    sharedCosts: []
  };

  const out = runForecastEngine(input);
  const drawY1 = out.raw.ownerAdjustments.drawingsMonthly.slice(0, 12);
  drawY1.forEach((v) => approx(v, 2500));
});

// --- Phase 4.3.2 regression tests ---------------------------------------

test("Phase 4.3.2: step-router exposes a Scenario Testing step as the final step", async () => {
  const mod = await import("../ui/step-router.js");
  assert.ok(Array.isArray(mod.STEP_DEFINITIONS));
  assert.equal(mod.STEP_DEFINITIONS.length, 13, "expected exactly 13 steps in the flow");
  const last = mod.STEP_DEFINITIONS[mod.STEP_DEFINITIONS.length - 1];
  assert.equal(last.id, "scenario-testing");
  assert.equal(last.title, "Scenario Testing");
  const results = mod.STEP_DEFINITIONS.find((s) => s.id === "results");
  const scenario = mod.STEP_DEFINITIONS.find((s) => s.id === "scenario-testing");
  const resultsIdx = mod.STEP_DEFINITIONS.indexOf(results);
  const scenarioIdx = mod.STEP_DEFINITIONS.indexOf(scenario);
  assert.ok(resultsIdx >= 0 && scenarioIdx > resultsIdx, "Scenario Testing must come after Results Dashboard");
});

test("Phase 4.3.2: Scenario Testing renderer returns HTML with stress-test controls when PCF is present", async () => {
  const { renderScenarioTestingStep } = await import("../ui/renderers/scenario-testing/index.js");
  const input = await loadPublicDataset("base.forecast.json");
  const engineOut = runForecastEngine(input);
  const html = renderScenarioTestingStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null }
  });
  assert.ok(typeof html === "string" && html.length > 0);
  assert.match(html, /Scenario Testing/);
  assert.match(html, /Personal Cash Flow Stress Test/);
  assert.match(html, /reduceDrawingsPct/);
  assert.match(html, /increaseOutflowsPct/);
  assert.match(html, /id="ff-scenario-testing-stress-base"/);
});

test("Phase 4.3.2: Scenario Testing renderer renders a graceful empty state when engine has no result", async () => {
  const { renderScenarioTestingStep } = await import("../ui/renderers/scenario-testing/index.js");
  const html = renderScenarioTestingStep({
    canonical: {},
    engine: { lenient: null, strict: null }
  });
  assert.match(html, /No preview results are available/);
  assert.doesNotMatch(html, /id="ff-scenario-testing-stress-base"/);
});

test("Phase 4.3.2: Results Dashboard no longer embeds the stress-test controls", async () => {
  const { renderResultsStep } = await import("../ui/renderers/dashboard/index.js");
  const input = await loadPublicDataset("base.forecast.json");
  const engineOut = runForecastEngine(input);
  const html = renderResultsStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null }
  });
  assert.ok(typeof html === "string" && html.length > 0);
  assert.doesNotMatch(html, /id="ff-personal-cashflow-stress-base"/);
  assert.doesNotMatch(html, /data-region="pcf-stress"/);
  assert.doesNotMatch(html, /Lightweight Stress Test/);
  // The Personal Cash Flow summary block must still be present on the dashboard.
  // Phase 4.3.3: the block is now the 3-year view rather than Y1-only.
  assert.match(html, /Personal Cash Flow \(3-Year View\)/);
});

test("Phase 4.3.2: Results Dashboard surfaces a Data Completeness banner", async () => {
  const { renderResultsStep } = await import("../ui/renderers/dashboard/index.js");
  const input = await loadPublicDataset("base.forecast.json");
  const engineOut = runForecastEngine(input);
  const html = renderResultsStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null }
  });
  assert.match(html, /ff-data-completeness/);
  assert.match(html, /Data Completeness/);
});

test("Phase 4.3.2: Results Dashboard empty-input hints fire for a blank fixture", async () => {
  const { renderResultsStep } = await import("../ui/renderers/dashboard/index.js");
  const input = await loadFixture("minimal-valid-state.json");
  const engineOut = runForecastEngine(input);
  const html = renderResultsStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null }
  });
  // Minimal fixture doesn't populate owner comp, named expenses, or statutory labor,
  // so the banner should call those out explicitly.
  assert.match(html, /Data Completeness/);
  assert.match(html, /Owner Compensation/);
});

test("Phase 4.3.2: Results Dashboard completeness banner is OK for a fully-populated dataset", async () => {
  const { renderResultsStep } = await import("../ui/renderers/dashboard/index.js");
  const input = await loadPublicDataset("base.forecast.json");
  const engineOut = runForecastEngine(input);
  const html = renderResultsStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null }
  });
  assert.match(html, /ff-data-completeness--ok/);
});

test("Phase 4.3.2: Warning messages carry actionable guidance (plain-language refinement)", async () => {
  const input = await loadPublicDataset("base.forecast.json");
  const out = runForecastEngine(input);
  const warnings = out.warnings || [];
  // The refined messages mention either a likely cause, a fix, or a step to review.
  warnings.forEach((w) => {
    if (w.code === "CASHFLOW_NEGATIVE_CLOSING") {
      assert.match(w.message, /drawings|opening cash|collections/i, "CASHFLOW_NEGATIVE_CLOSING should hint at likely causes");
    }
    if (w.code === "PERSONAL_CASHFLOW_NEGATIVE_CLOSING") {
      assert.match(w.message, /Personal Cash Flow|drawings|outflows|opening/i, "PCF negative warning should hint at fixes");
    }
    if (w.code === "SALES_LOW_MARGIN") {
      assert.match(w.message, /Cost Of Goods Sold|Direct Labor|Revenue Streams|Year Plans/i, "Low margin warning should point to inputs to review");
    }
  });
});


// -------------------------------------------------------------------------
// Phase 4.3.3 regression tests: 3-year Personal Cash Flow + owner-comp
// vs PCF contradiction guardrails + aligned copy.
// -------------------------------------------------------------------------

test("Phase 4.3.3: engine produces a perYear PCF slice for all 3 years", async () => {
  const input = await loadPublicDataset("base.forecast.json");
  const out = runForecastEngine(input);
  const pcf = out.raw.personalCashFlow;
  assert.ok(pcf.perYear, "expected perYear on personal cash flow output");
  ["year1", "year2", "year3"].forEach((yk) => {
    const slice = pcf.perYear[yk];
    assert.ok(slice, `expected perYear.${yk}`);
    assert.equal((slice.inflowsMonthly || []).length, 12, `${yk} inflows should have 12 months`);
    assert.equal((slice.outflowsMonthly || []).length, 12, `${yk} outflows should have 12 months`);
    assert.equal((slice.closingMonthly || []).length, 12, `${yk} closing should have 12 months`);
    assert.ok(slice.summary, `${yk} should have a summary`);
    assert.ok("minClosingBalance" in slice.summary);
    assert.ok("closingEndOfYear" in slice.summary);
  });
  assert.ok(pcf.monthly36, "expected monthly36 series");
  assert.equal((pcf.monthly36.closing || []).length, 36, "monthly36.closing should have 36 months");
});

test("Phase 4.3.3: Year 2 opens at Year 1 closing; Year 3 opens at Year 2 closing", async () => {
  const input = await loadPublicDataset("base.forecast.json");
  const out = runForecastEngine(input);
  const pcf = out.raw.personalCashFlow;
  const y1 = pcf.perYear.year1.summary.closingEndOfYear;
  const y2open = pcf.perYear.year2.openingBalance;
  const y2 = pcf.perYear.year2.summary.closingEndOfYear;
  const y3open = pcf.perYear.year3.openingBalance;
  assert.ok(Math.abs(y1 - y2open) < 0.01, `Year 2 opening (${y2open}) should equal Year 1 closing (${y1})`);
  assert.ok(Math.abs(y2 - y3open) < 0.01, `Year 3 opening (${y3open}) should equal Year 2 closing (${y2})`);
});

test("Phase 4.3.3: Y2/Y3 drawings-from-business follow year-plan ownerDrawingsMonthly when model includes drawings", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(2000) }
    ],
    outflows: [],
    sharedCosts: []
  };
  ["year1", "year2", "year3"].forEach((yk, idx) => {
    input.years[yk].ownerAdjustments = input.years[yk].ownerAdjustments || {};
    input.years[yk].ownerAdjustments.modelType = "sole_trader_drawings";
    // Y1: 1500, Y2: 2500, Y3: 3500 in the year plan.
    input.years[yk].ownerAdjustments.ownerDrawingsMonthly = 1500 + idx * 1000;
  });
  const out = runForecastEngine(input);
  const perYear = out.raw.personalCashFlow.perYear;
  // Y1 is authoritative from canonical PCF (2000/mo), Y2 from year plan
  // (2500/mo), Y3 from year plan (3500/mo).
  const y1Drawings = perYear.year1.drawingsFromBusinessMonthly;
  const y2Drawings = perYear.year2.drawingsFromBusinessMonthly;
  const y3Drawings = perYear.year3.drawingsFromBusinessMonthly;
  assert.ok(y1Drawings.every((v) => v === 2000), `Y1 drawings should be 2000, got ${y1Drawings.join(",")}`);
  assert.ok(y2Drawings.every((v) => v === 2500), `Y2 drawings should be 2500, got ${y2Drawings.join(",")}`);
  assert.ok(y3Drawings.every((v) => v === 3500), `Y3 drawings should be 3500, got ${y3Drawings.join(",")}`);
});

test("Phase 4.3.3: Y2/Y3 drawings-from-business are zero when model excludes drawings", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(0) }
    ],
    outflows: [],
    sharedCosts: []
  };
  ["year1", "year2", "year3"].forEach((yk) => {
    input.years[yk].ownerAdjustments = input.years[yk].ownerAdjustments || {};
    input.years[yk].ownerAdjustments.modelType = "company_salary_and_distributions";
    input.years[yk].ownerAdjustments.ownerDrawingsMonthly = 0;
    input.years[yk].ownerAdjustments.directorSalaryMonthly = 4000;
    input.years[yk].ownerAdjustments.distributionsMonthly = 0;
  });
  const out = runForecastEngine(input);
  const perYear = out.raw.personalCashFlow.perYear;
  [perYear.year1, perYear.year2, perYear.year3].forEach((slice, idx) => {
    const drawings = slice.drawingsFromBusinessMonthly;
    assert.ok(drawings.every((v) => v === 0), `Year ${idx + 1} drawings should be 0 under company-salary model, got ${drawings.join(",")}`);
  });
});

test("Phase 4.3.3 guardrail: OWNER_PCF_DRAWINGS_MODEL_CONFLICT fires when model excludes drawings but drawings exist", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(2000) }
    ],
    outflows: [],
    sharedCosts: []
  };
  // Y1 model excludes drawings but the PCF drawings row has $24k for the year.
  input.years.year1.ownerAdjustments = {
    modelType: "company_salary_and_distributions",
    ownerDrawingsMonthly: 0,
    directorSalaryMonthly: 4000,
    distributionsMonthly: 0
  };
  // Y2 model excludes drawings but the Year 2 Plan still lists drawings > 0.
  input.years.year2.ownerAdjustments = {
    modelType: "company_salary_and_distributions",
    ownerDrawingsMonthly: 1500,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0
  };
  input.years.year3.ownerAdjustments = {
    modelType: "company_salary_and_distributions",
    ownerDrawingsMonthly: 0,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0
  };
  const out = runForecastEngine(input);
  const codes = out.warnings.map((w) => w.code);
  const conflicts = out.warnings.filter((w) => w.code === "OWNER_PCF_DRAWINGS_MODEL_CONFLICT");
  assert.ok(conflicts.length >= 2, `expected >=2 conflicts (Y1 PCF + Y2 plan), got ${codes.join(",")}`);
  const y1Conflict = conflicts.find((w) => w.year === "year1");
  const y2Conflict = conflicts.find((w) => w.year === "year2");
  assert.ok(y1Conflict, "expected Y1 conflict from PCF drawings row under company model");
  assert.ok(y2Conflict, "expected Y2 conflict from year plan drawings under company model");
  assert.match(y1Conflict.message, /Personal Cash Flow|drawings/i);
  assert.match(y2Conflict.message, /Year Plan|drawings/i);
});

test("Phase 4.3.3 guardrail: OWNER_PCF_DRAWINGS_Y1_MISMATCH fires when PCF and Year 1 Plan disagree materially", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(3000) }
    ],
    outflows: [],
    sharedCosts: []
  };
  // Y1 plan says $1000/mo ($12k/yr), PCF row says $36k/yr. Large mismatch.
  input.years.year1.ownerAdjustments = {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 1000,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0
  };
  const out = runForecastEngine(input);
  const mismatch = out.warnings.find((w) => w.code === "OWNER_PCF_DRAWINGS_Y1_MISMATCH");
  assert.ok(mismatch, "expected OWNER_PCF_DRAWINGS_Y1_MISMATCH warning");
  assert.match(mismatch.message, /Personal Cash Flow|Year 1 Plan/i);
});

test("Phase 4.3.3 guardrail: OWNER_PCF_DRAWINGS_Y1_MISMATCH does NOT fire when PCF and Y1 Plan agree (within tolerance)", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  // PCF drawings total = $24,000/yr; year plan = $2000/mo = $24,000/yr.
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(2000) }
    ],
    outflows: [],
    sharedCosts: []
  };
  input.years.year1.ownerAdjustments = {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 2000,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0
  };
  const out = runForecastEngine(input);
  const codes = out.warnings.map((w) => w.code);
  assert.ok(!codes.includes("OWNER_PCF_DRAWINGS_Y1_MISMATCH"),
    `MISMATCH should stay silent when PCF and year plan agree, got: ${codes.join(",")}`);
});

test("Phase 4.3.3: PCF negative-closing warning names the specific year", async () => {
  const input = await loadFixture("minimal-valid-state.json");
  // Y1 has huge drawings + low outflows to stay solvent; Y2 has zero drawings
  // (but outflows from Y1 pattern) to force Y2 into negative territory.
  input.personalCashFlow = {
    year1Only: true,
    openingBalance: 0,
    inflows: [
      { id: "drawings-from-business", label: "Drawings from business", monthly: Array(12).fill(3000) }
    ],
    outflows: [
      { id: "groceries", label: "Groceries", monthly: Array(12).fill(2500) }
    ],
    sharedCosts: []
  };
  input.years.year1.ownerAdjustments = {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 3000,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0
  };
  input.years.year2.ownerAdjustments = {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 0,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0
  };
  input.years.year3.ownerAdjustments = {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 3000,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0
  };
  const out = runForecastEngine(input);
  const pcfNeg = out.warnings.filter((w) => w.code === "PERSONAL_CASHFLOW_NEGATIVE_CLOSING");
  assert.ok(pcfNeg.length >= 1, "expected at least one PCF negative warning");
  const y2Warning = pcfNeg.find((w) => w.year === "year2");
  assert.ok(y2Warning, "expected a PERSONAL_CASHFLOW_NEGATIVE_CLOSING warning scoped to year2");
  assert.match(y2Warning.message, /Year 2/i, "Y2 warning should explicitly name Year 2");
});

test("Phase 4.3.3: Results Dashboard renders the 3-year PCF view", async () => {
  const { renderResultsStep } = await import("../ui/renderers/dashboard/index.js");
  const input = await loadPublicDataset("base.forecast.json");
  const engineOut = runForecastEngine(input);
  const html = renderResultsStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null }
  });
  assert.match(html, /Personal Cash Flow \(3-Year View\)/, "dashboard should surface the 3-year PCF panel");
  assert.match(html, /3-Year Summary/, "dashboard should include a 3-year summary block");
  assert.match(html, /<summary>[\s\S]*?Year 1/);
  assert.match(html, /<summary>[\s\S]*?Year 2/);
  assert.match(html, /<summary>[\s\S]*?Year 3/);
});

test("Phase 4.3.3: Review-step PCF block is 3-year consistent", async () => {
  const { renderReviewStep } = await import("../ui/renderers/dashboard/index.js");
  const input = await loadPublicDataset("base.forecast.json");
  const engineOut = runForecastEngine(input);
  const stepStatusMap = {
    intro: { complete: true, blockingCount: 0, warningCount: 0 },
    setup: { complete: true, blockingCount: 0, warningCount: 0 },
    review: { complete: true, blockingCount: 0, warningCount: 0 }
  };
  const html = renderReviewStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null }
  }, stepStatusMap);
  assert.match(html, /Personal Cash Flow \(3-Year View\)/);
  assert.match(html, /Year 1[\s\S]*Year 2[\s\S]*Year 3/);
  assert.match(html, /Year 1 decision metrics/i);
});

test("Phase 4.3.3: Scenario Testing baseline includes a 3-year PCF snapshot", async () => {
  const { renderScenarioTestingStep } = await import("../ui/renderers/scenario-testing/index.js");
  const input = await loadPublicDataset("base.forecast.json");
  const engineOut = runForecastEngine(input);
  const html = renderScenarioTestingStep({
    canonical: input,
    engine: { lenient: engineOut, strict: null },
    data: input
  });
  assert.match(html, /Baseline Scenario Summary/);
  assert.match(html, /Year 1[\s\S]*Year 2[\s\S]*Year 3/);
});
