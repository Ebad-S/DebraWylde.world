import { getMonthOffsetIndex, round2 } from "./timeline.js";

export function calculateCollections(normalizedState, salesResult) {
  const { timeline, collectionsPolicy } = normalizedState;
  const { monthly: salesMonthly } = salesResult;
  const monthCount = timeline.monthCount;

  const basisSeries = collectionsPolicy.receivablesBasis === "gross" ? salesMonthly.gross : salesMonthly.net;
  const cashCollectedMonthly = Array(monthCount).fill(0);
  const receivablesOpeningMonthly = Array(monthCount).fill(0);
  const badDebtWrittenOffMonthly = Array(monthCount).fill(0);
  const receivablesClosingMonthly = Array(monthCount).fill(0);

  const split = collectionsPolicy.collectionSplitByMonthBucket || [];
  let rollingOpen = Number(collectionsPolicy.openingReceivables || 0);

  timeline.months.forEach((period) => {
    const i = period.globalMonthIndex - 1;
    receivablesOpeningMonthly[i] = rollingOpen;

    let collected = 0;
    split.forEach((ratio, offset) => {
      const invoiceIndex = getMonthOffsetIndex(period.globalMonthIndex, -offset, monthCount);
      if (invoiceIndex == null) return;
      collected += Number(basisSeries[invoiceIndex] || 0) * Number(ratio || 0);
    });
    cashCollectedMonthly[i] = collected;

    const badDebt = Number(basisSeries[i] || 0) * Number(collectionsPolicy.badDebtRate || 0);
    badDebtWrittenOffMonthly[i] = badDebt;

    const closing = rollingOpen + Number(basisSeries[i] || 0) - collected - badDebt;
    receivablesClosingMonthly[i] = closing;
    rollingOpen = closing;
  });

  return {
    basis: collectionsPolicy.receivablesBasis,
    invoicedBasisMonthly: basisSeries.map(round2),
    cashCollectedMonthly: cashCollectedMonthly.map(round2),
    receivablesOpeningMonthly: receivablesOpeningMonthly.map(round2),
    badDebtWrittenOffMonthly: badDebtWrittenOffMonthly.map(round2),
    receivablesClosingMonthly: receivablesClosingMonthly.map(round2)
  };
}
