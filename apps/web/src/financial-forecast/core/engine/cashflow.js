import { round2 } from "./timeline.js";

export function calculateCashFlow(normalizedState, collections, costs, marketing, ownerAdjustments, loans, assets) {
  const monthCount = normalizedState.timeline.monthCount;

  const netOperatingMonthly = Array(monthCount).fill(0);
  const netFinancingMonthly = Array(monthCount).fill(0);
  const netInvestingMonthly = Array(monthCount).fill(0);
  const netCashMonthly = Array(monthCount).fill(0);
  const closingCashMonthly = Array(monthCount).fill(0);

  let rollingCash = Number(normalizedState.setup.openingCash || 0);

  for (let i = 0; i < monthCount; i += 1) {
    const operatingOut =
      Number(costs.cogsMonthly[i] || 0) +
      Number(costs.variableMonthly[i] || 0) +
      Number(costs.directLaborMonthly[i] || 0) +
      Number(costs.merchantFeesMonthly[i] || 0) +
      Number(costs.otherOperatingMonthly[i] || 0) +
      Number(costs.fixedMonthly[i] || 0) +
      Number(marketing.monthly[i] || 0) +
      Number(ownerAdjustments.salaryMonthly[i] || 0);

    const netOperating = Number(collections.cashCollectedMonthly[i] || 0) - operatingOut;
    const netFinancing =
      Number(loans.drawdownMonthly[i] || 0) -
      Number(loans.principalMonthly[i] || 0) -
      Number(ownerAdjustments.drawingsMonthly[i] || 0) -
      Number(ownerAdjustments.distributionsMonthly[i] || 0);
    const netInvesting = -Number(assets.purchaseMonthly[i] || 0);

    const netCash = netOperating + netFinancing + netInvesting;
    rollingCash += netCash;

    netOperatingMonthly[i] = netOperating;
    netFinancingMonthly[i] = netFinancing;
    netInvestingMonthly[i] = netInvesting;
    netCashMonthly[i] = netCash;
    closingCashMonthly[i] = rollingCash;
  }

  return {
    netOperatingMonthly: netOperatingMonthly.map(round2),
    netFinancingMonthly: netFinancingMonthly.map(round2),
    netInvestingMonthly: netInvestingMonthly.map(round2),
    netCashMonthly: netCashMonthly.map(round2),
    closingCashMonthly: closingCashMonthly.map(round2)
  };
}
