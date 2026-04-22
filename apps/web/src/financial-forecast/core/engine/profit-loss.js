import { round2 } from "./timeline.js";

export function calculateProfitAndLoss(normalizedState, sales, costs, marketing, ownerAdjustments, loans, assets, collections, statutoryLabor) {
  const monthCount = normalizedState.timeline.monthCount;
  const revenueMonthly = Array(monthCount).fill(0);
  const cogsMonthly = Array(monthCount).fill(0);
  const grossProfitMonthly = Array(monthCount).fill(0);
  const operatingExpensesMonthly = Array(monthCount).fill(0);
  const badDebtMonthly = Array(monthCount).fill(0);
  const ebitdaMonthly = Array(monthCount).fill(0);
  const depreciationMonthly = Array(monthCount).fill(0);
  const interestMonthly = Array(monthCount).fill(0);
  const netProfitBeforeTaxMonthly = Array(monthCount).fill(0);
  const taxMonthly = Array(monthCount).fill(0);
  const netProfitAfterTaxMonthly = Array(monthCount).fill(0);

  normalizedState.timeline.months.forEach((period, i) => {
    const revenue = Number(sales.monthly.net[i] || 0);
    const cogs = Number(costs.cogsMonthly[i] || 0);
    const grossProfit = revenue - cogs;

    const badDebt = Number(collections?.badDebtWrittenOffMonthly?.[i] || 0);
    const namedOperating = Number(costs.namedOperatingMonthly?.[i] || 0);
    const superannuation = Number(statutoryLabor?.superannuationMonthly?.[i] || 0);
    const payrollTax = Number(statutoryLabor?.payrollTaxMonthly?.[i] || 0);
    const operatingExpenses =
      Number(costs.variableMonthly[i] || 0) +
      Number(costs.fixedMonthly[i] || 0) +
      Number(costs.otherOperatingMonthly[i] || 0) +
      Number(costs.directLaborMonthly[i] || 0) +
      Number(costs.merchantFeesMonthly[i] || 0) +
      namedOperating +
      Number(marketing.monthly[i] || 0) +
      Number(ownerAdjustments.salaryMonthly[i] || 0) +
      superannuation +
      payrollTax +
      badDebt;

    const ebitda = grossProfit - operatingExpenses;
    const depreciation = Number(assets.depreciationMonthly[i] || 0);
    const interest = Number(loans.interestMonthly[i] || 0);
    const netProfitBeforeTax = ebitda - depreciation - interest;
    const taxRate = Number(normalizedState.years[period.yearKey].assumptions.taxRate || 0);
    const tax = Math.max(netProfitBeforeTax, 0) * taxRate;
    const netProfitAfterTax = netProfitBeforeTax - tax;

    revenueMonthly[i] = revenue;
    cogsMonthly[i] = cogs;
    grossProfitMonthly[i] = grossProfit;
    operatingExpensesMonthly[i] = operatingExpenses;
    badDebtMonthly[i] = badDebt;
    ebitdaMonthly[i] = ebitda;
    depreciationMonthly[i] = depreciation;
    interestMonthly[i] = interest;
    netProfitBeforeTaxMonthly[i] = netProfitBeforeTax;
    taxMonthly[i] = tax;
    netProfitAfterTaxMonthly[i] = netProfitAfterTax;
  });

  return {
    revenueMonthly: revenueMonthly.map(round2),
    cogsMonthly: cogsMonthly.map(round2),
    grossProfitMonthly: grossProfitMonthly.map(round2),
    operatingExpensesMonthly: operatingExpensesMonthly.map(round2),
    badDebtMonthly: badDebtMonthly.map(round2),
    ebitdaMonthly: ebitdaMonthly.map(round2),
    depreciationMonthly: depreciationMonthly.map(round2),
    interestMonthly: interestMonthly.map(round2),
    netProfitBeforeTaxMonthly: netProfitBeforeTaxMonthly.map(round2),
    taxMonthly: taxMonthly.map(round2),
    netProfitAfterTaxMonthly: netProfitAfterTaxMonthly.map(round2)
  };
}
