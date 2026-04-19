import { round2 } from "./timeline.js";

export function calculateBalanceSheet(normalizedState, collections, assets, loans, cashFlow, profitLoss, ownerAdjustments) {
  const monthCount = normalizedState.timeline.monthCount;
  const assetsMonthly = Array(monthCount).fill(0);
  const liabilitiesMonthly = Array(monthCount).fill(0);
  const equityMonthly = Array(monthCount).fill(0);
  const balanceDeltaMonthly = Array(monthCount).fill(0);
  const isBalancedMonthly = Array(monthCount).fill(false);
  const retainedEarningsMonthly = Array(monthCount).fill(0);

  const openingEquity = Number(normalizedState.setup.openingCash || 0);
  let retainedEarnings = 0;

  for (let i = 0; i < monthCount; i += 1) {
    retainedEarnings += Number(profitLoss.netProfitAfterTaxMonthly[i] || 0);
    retainedEarnings -= Number(ownerAdjustments.drawingsMonthly[i] || 0);
    retainedEarnings -= Number(ownerAdjustments.distributionsMonthly[i] || 0);
    retainedEarningsMonthly[i] = retainedEarnings;

    const assetsValue =
      Number(cashFlow.closingCashMonthly[i] || 0) +
      Number(collections.receivablesClosingMonthly[i] || 0) +
      Number(assets.assetNBVMonthly[i] || 0);
    const liabilitiesValue = Number(loans.closingLoanBalanceMonthly[i] || 0);
    const equityValue = openingEquity + retainedEarnings;
    const delta = assetsValue - (liabilitiesValue + equityValue);

    assetsMonthly[i] = assetsValue;
    liabilitiesMonthly[i] = liabilitiesValue;
    equityMonthly[i] = equityValue;
    balanceDeltaMonthly[i] = delta;
    isBalancedMonthly[i] = Math.abs(delta) <= 0.5;
  }

  return {
    assetsMonthly: assetsMonthly.map(round2),
    liabilitiesMonthly: liabilitiesMonthly.map(round2),
    equityMonthly: equityMonthly.map(round2),
    retainedEarningsMonthly: retainedEarningsMonthly.map(round2),
    balanceDeltaMonthly: balanceDeltaMonthly.map(round2),
    isBalancedMonthly
  };
}
