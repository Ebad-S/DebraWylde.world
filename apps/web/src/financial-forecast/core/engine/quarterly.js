import { round2 } from "./timeline.js";

function rollupByQuarter(values, timeline) {
  const out = {};
  timeline.months.forEach((period, idx) => {
    out[period.quarterKey] = Number(out[period.quarterKey] || 0) + Number(values[idx] || 0);
  });
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, round2(v)]));
}

function snapshotByQuarter(values, timeline) {
  const out = {};
  timeline.months.forEach((period, idx) => {
    if (period.monthIndex % 3 === 0) {
      out[period.quarterKey] = round2(values[idx] || 0);
    }
  });
  return out;
}

export function calculateQuarterly(normalizedState, sales, cashFlow, profitLoss, balanceSheet, collections) {
  const { timeline } = normalizedState;
  return {
    flowRollups: {
      revenueNet: rollupByQuarter(sales.monthly.net, timeline),
      netCash: rollupByQuarter(cashFlow.netCashMonthly, timeline),
      netProfitAfterTax: rollupByQuarter(profitLoss.netProfitAfterTaxMonthly, timeline)
    },
    positionSnapshots: {
      closingCash: snapshotByQuarter(cashFlow.closingCashMonthly, timeline),
      receivablesClosing: snapshotByQuarter(collections.receivablesClosingMonthly, timeline),
      liabilities: snapshotByQuarter(balanceSheet.liabilitiesMonthly, timeline),
      equity: snapshotByQuarter(balanceSheet.equityMonthly, timeline)
    }
  };
}
