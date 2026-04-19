import { sumByYear } from "./timeline.js";

export function shapeReport(normalizedState, engineRaw, warnings) {
  const { sales, cashFlow, profitLoss, breakEven, quarterly } = engineRaw;
  const timeline = normalizedState.timeline;

  const revenueByYear = sumByYear(sales.monthly.net, timeline);
  const profitByYear = sumByYear(profitLoss.netProfitAfterTaxMonthly, timeline);
  const cashByYear = sumByYear(cashFlow.netCashMonthly, timeline);

  const totalRevenue = Object.values(revenueByYear).reduce((a, b) => a + b, 0);
  const totalProfit = Object.values(profitByYear).reduce((a, b) => a + b, 0);
  const averageMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    summaryCards: {
      totalRevenue,
      totalNetProfitAfterTax: totalProfit,
      averageMarginPct,
      finalClosingCash: cashFlow.closingCashMonthly[cashFlow.closingCashMonthly.length - 1] || 0,
      warningCount: warnings.length
    },
    annual: {
      revenueNet: revenueByYear,
      netProfitAfterTax: profitByYear,
      netCash: cashByYear
    },
    quarterly,
    charts: {
      revenueNetMonthly: sales.monthly.net,
      netProfitAfterTaxMonthly: profitLoss.netProfitAfterTaxMonthly,
      closingCashMonthly: cashFlow.closingCashMonthly
    },
    exportReady: {
      meta: {
        generatedAt: new Date().toISOString(),
        scenarioVersion: normalizedState.meta.schemaVersion
      },
      summary: {
        totalRevenue,
        totalNetProfitAfterTax: totalProfit,
        averageMarginPct
      },
      breakEven,
      warnings
    }
  };
}
