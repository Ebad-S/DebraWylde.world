import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runForecastEngine } from "../core/engine/index.js";

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

test("sole trader drawings include personal cash flow normalization", async () => {
  const input = await loadFixture("owner-drawings-state.json");
  const output = runForecastEngine(input);

  const drawingMonth1 = output.raw.ownerAdjustments.drawingsMonthly[0];
  assert.ok(drawingMonth1 > 1300);
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
