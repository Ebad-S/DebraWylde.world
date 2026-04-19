import { round2 } from "./timeline.js";

export function runReconciliation(normalizedState, collections, cashFlow, balanceSheet, loans, assets, ownerAdjustments) {
  const monthCount = normalizedState.timeline.monthCount;
  const cashRollForward = [];
  const receivablesRollForward = [];
  const balanceEquation = [];

  let cashOpen = Number(normalizedState.setup.openingCash || 0);

  for (let i = 0; i < monthCount; i += 1) {
    const cashExpectedClose = cashOpen + Number(cashFlow.netCashMonthly[i] || 0);
    const cashActualClose = Number(cashFlow.closingCashMonthly[i] || 0);
    const cashDelta = cashActualClose - cashExpectedClose;
    cashRollForward.push({
      monthIndex: i + 1,
      expectedClose: round2(cashExpectedClose),
      actualClose: round2(cashActualClose),
      delta: round2(cashDelta),
      pass: Math.abs(cashDelta) <= 0.5
    });
    cashOpen = cashActualClose;

    const receivablesExpectedClose =
      Number(collections.receivablesOpeningMonthly[i] || 0) +
      Number(collections.invoicedBasisMonthly[i] || 0) -
      Number(collections.cashCollectedMonthly[i] || 0) -
      Number(collections.badDebtWrittenOffMonthly[i] || 0);
    const receivablesActualClose = Number(collections.receivablesClosingMonthly[i] || 0);
    const receivablesDelta = receivablesActualClose - receivablesExpectedClose;
    receivablesRollForward.push({
      monthIndex: i + 1,
      expectedClose: round2(receivablesExpectedClose),
      actualClose: round2(receivablesActualClose),
      delta: round2(receivablesDelta),
      pass: Math.abs(receivablesDelta) <= 0.5
    });

    const assetsVal = Number(balanceSheet.assetsMonthly[i] || 0);
    const liabilitiesVal = Number(balanceSheet.liabilitiesMonthly[i] || 0);
    const equityVal = Number(balanceSheet.equityMonthly[i] || 0);
    const delta = assetsVal - (liabilitiesVal + equityVal);
    balanceEquation.push({
      monthIndex: i + 1,
      assets: round2(assetsVal),
      liabilitiesPlusEquity: round2(liabilitiesVal + equityVal),
      delta: round2(delta),
      pass: Math.abs(delta) <= 0.5
    });
  }

  return {
    cashRollForward,
    receivablesRollForward,
    balanceEquation,
    summary: {
      allCashPass: cashRollForward.every((r) => r.pass),
      allReceivablesPass: receivablesRollForward.every((r) => r.pass),
      allBalancePass: balanceEquation.every((r) => r.pass)
    },
    inputsUsed: {
      receivablesBasis: normalizedState.collectionsPolicy.receivablesBasis,
      openingCash: normalizedState.setup.openingCash,
      openingReceivables: normalizedState.collectionsPolicy.openingReceivables,
      loanSeriesLength: loans.closingLoanBalanceMonthly.length,
      assetSeriesLength: assets.assetNBVMonthly.length,
      ownerSeriesLength: ownerAdjustments.drawingsMonthly.length
    }
  };
}
