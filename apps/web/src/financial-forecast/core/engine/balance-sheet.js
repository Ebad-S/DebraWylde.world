import { round2 } from "./timeline.js";

export function calculateBalanceSheet(normalizedState, collections, assets, loans, cashFlow, profitLoss, ownerAdjustments, sales) {
  const monthCount = normalizedState.timeline.monthCount;
  const assetsMonthly = Array(monthCount).fill(0);
  const liabilitiesMonthly = Array(monthCount).fill(0);
  const equityMonthly = Array(monthCount).fill(0);
  const gstPayableMonthly = Array(monthCount).fill(0);
  const balanceDeltaMonthly = Array(monthCount).fill(0);
  const isBalancedMonthly = Array(monthCount).fill(false);
  const retainedEarningsMonthly = Array(monthCount).fill(0);

  const openingCash = Number(normalizedState.setup.openingCash || 0);
  const openingReceivables = Number(normalizedState.collectionsPolicy?.openingReceivables || 0);
  const openingAssetNBV = Number(assets?.assetNBVMonthly?.[0] || 0) > 0 && Number(assets?.purchaseMonthly?.[0] || 0) === 0
    ? Number(assets.assetNBVMonthly[0] || 0)
    : 0;
  const openingLoanBalance = Number(loans?.closingLoanBalanceMonthly?.[0] || 0) > 0 && Number(loans?.drawdownMonthly?.[0] || 0) === 0
    ? Number(loans.closingLoanBalanceMonthly[0] || 0)
    : 0;

  // Accounting identity at t=0 must hold trivially. Equity is whatever balances
  // the opening assets minus opening liabilities; GST payable starts at 0.
  const openingEquity = openingCash + openingReceivables + openingAssetNBV - openingLoanBalance;
  const gstAccrualEnabled = normalizedState.collectionsPolicy?.receivablesBasis === "gross";
  let retainedEarnings = 0;
  let gstPayable = 0;

  for (let i = 0; i < monthCount; i += 1) {
    retainedEarnings += Number(profitLoss.netProfitAfterTaxMonthly[i] || 0);
    retainedEarnings -= Number(ownerAdjustments.drawingsMonthly[i] || 0);
    retainedEarnings -= Number(ownerAdjustments.distributionsMonthly[i] || 0);
    retainedEarningsMonthly[i] = retainedEarnings;

    if (gstAccrualEnabled) {
      // Accrue GST collected on invoiced sales (BAS remittance not modelled).
      gstPayable += Number(sales?.monthly?.gst?.[i] || 0);
    }
    gstPayableMonthly[i] = gstPayable;

    const assetsValue =
      Number(cashFlow.closingCashMonthly[i] || 0) +
      Number(collections.receivablesClosingMonthly[i] || 0) +
      Number(assets.assetNBVMonthly[i] || 0);
    const liabilitiesValue =
      Number(loans.closingLoanBalanceMonthly[i] || 0) +
      gstPayable;
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
    gstPayableMonthly: gstPayableMonthly.map(round2),
    retainedEarningsMonthly: retainedEarningsMonthly.map(round2),
    balanceDeltaMonthly: balanceDeltaMonthly.map(round2),
    isBalancedMonthly,
    openingEquity: round2(openingEquity)
  };
}
