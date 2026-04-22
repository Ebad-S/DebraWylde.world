import { round2 } from "./timeline.js";

function deriveLineCogsForMonth(line, units, revenueNet) {
  if (line.costOfGoodsSold != null) {
    return Number(line.costOfGoodsSold) * Number(units || 0);
  }
  if (line.grossMarginPercent != null) {
    const marginRate = Number(line.grossMarginPercent) / 100;
    return Number(revenueNet) * (1 - marginRate);
  }
  return 0;
}

// Business-expense line items are monthly-flat within their start/end month
// window (inclusive). Rows with isActive=false contribute zero. We return both
// the aggregated per-month total and the per-category total to support
// dashboard / print breakdowns without leaking category semantics into
// downstream modules.
function aggregateNamedExpenses(yearConfig, period) {
  const lineItems = yearConfig?.businessExpenses?.lineItems || [];
  let total = 0;
  const byCategory = {};
  lineItems.forEach((item) => {
    if (item.isActive === false) return;
    const start = Number(item.startMonth || 1);
    const end = Number(item.endMonth || 12);
    const amount = Number(item.monthlyAmount || 0);
    if (!(period.monthIndex >= start && period.monthIndex <= end)) return;
    if (!Number.isFinite(amount) || amount === 0) return;
    total += amount;
    const key = item.category || "miscellaneous";
    byCategory[key] = (byCategory[key] || 0) + amount;
  });
  return { total, byCategory };
}

export function calculateCosts(normalizedState, salesResult) {
  const { timeline, years, salesDetails } = normalizedState;
  const monthCount = timeline.monthCount;

  const fixedMonthly = Array(monthCount).fill(0);
  const variableMonthly = Array(monthCount).fill(0);
  const directLaborMonthly = Array(monthCount).fill(0);
  const merchantFeesMonthly = Array(monthCount).fill(0);
  const otherOperatingMonthly = Array(monthCount).fill(0);
  const namedOperatingMonthly = Array(monthCount).fill(0);
  const namedOperatingByCategoryMonthly = Array(monthCount).fill(null).map(() => ({}));
  const superannuationOnDirectLaborMonthly = Array(monthCount).fill(0);
  const payrollTaxOnDirectLaborMonthly = Array(monthCount).fill(0);
  const cogsMonthly = Array(monthCount).fill(0);

  timeline.months.forEach((period, index) => {
    const yearConfig = years[period.yearKey];
    const costProfile = yearConfig.costProfile;
    const revenueNet = Number(salesResult.monthly.net[index] || 0);
    fixedMonthly[index] = Number(costProfile.fixedMonthlyCost || 0);
    variableMonthly[index] = revenueNet * (Number(costProfile.variableCostPctOfRevenue || 0) / 100);
    directLaborMonthly[index] = revenueNet * (Number(costProfile.directLaborPctOfRevenue || 0) / 100);
    otherOperatingMonthly[index] = Number(costProfile.otherOperatingExpenseMonthly || 0);

    const named = aggregateNamedExpenses(yearConfig, period);
    namedOperatingMonthly[index] = named.total;
    namedOperatingByCategoryMonthly[index] = named.byCategory;

    // Super and payroll tax on direct labor. The matching super/payroll on
    // director salary is computed after ownerAdjustments runs, in
    // statutory-labor.js.
    const superRate = Number(yearConfig.assumptions.superannuationRate || 0);
    const payrollTaxRate = Number(yearConfig.assumptions.payrollTaxRate || 0);
    superannuationOnDirectLaborMonthly[index] = directLaborMonthly[index] * superRate;
    payrollTaxOnDirectLaborMonthly[index] = directLaborMonthly[index] * payrollTaxRate;

    let merchant = 0;
    let explicitLineCogs = 0;
    salesDetails.lines.forEach((line) => {
      if (!line.isActive) return;
      const lineRevenueNet = Number(salesResult.monthly.byLineNet[line.id]?.[index] || 0);
      const lineRevenueGross = line.gstApplies ? lineRevenueNet * (1 + yearConfig.assumptions.gstRate) : lineRevenueNet;
      merchant += lineRevenueGross * Number(line.merchantFeeRate || 0);

      const lineUnits = Number(salesResult.monthly.byLineUnits[line.id]?.[index] || 0);
      explicitLineCogs += deriveLineCogsForMonth(line, lineUnits, lineRevenueNet);
    });

    merchantFeesMonthly[index] = merchant;
    cogsMonthly[index] = explicitLineCogs;
  });

  return {
    fixedMonthly: fixedMonthly.map(round2),
    variableMonthly: variableMonthly.map(round2),
    directLaborMonthly: directLaborMonthly.map(round2),
    merchantFeesMonthly: merchantFeesMonthly.map(round2),
    otherOperatingMonthly: otherOperatingMonthly.map(round2),
    namedOperatingMonthly: namedOperatingMonthly.map(round2),
    namedOperatingByCategoryMonthly,
    superannuationOnDirectLaborMonthly: superannuationOnDirectLaborMonthly.map(round2),
    payrollTaxOnDirectLaborMonthly: payrollTaxOnDirectLaborMonthly.map(round2),
    cogsMonthly: cogsMonthly.map(round2)
  };
}
