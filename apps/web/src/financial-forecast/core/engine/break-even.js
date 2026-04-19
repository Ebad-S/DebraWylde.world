import { round2, sumByYear } from "./timeline.js";

function computeBreakEvenRevenue(revenue, variableCosts, fixedCosts) {
  if (revenue <= 0) return null;
  const contribution = revenue - variableCosts;
  const ratio = contribution / revenue;
  if (ratio <= 0) return null;
  return fixedCosts / ratio;
}

export function calculateBreakEven(normalizedState, sales, costs, marketing) {
  const revenueByYear = sumByYear(sales.monthly.net, normalizedState.timeline);
  const serviceRevenueByYear = sumByYear(sales.monthly.serviceNet, normalizedState.timeline);
  const productRevenueByYear = sumByYear(sales.monthly.productNet, normalizedState.timeline);

  const variableByYear = sumByYear(costs.variableMonthly, normalizedState.timeline);
  const fixedByYear = sumByYear(
    costs.fixedMonthly.map((v, i) => Number(v || 0) + Number(costs.otherOperatingMonthly[i] || 0) + Number(marketing.monthly[i] || 0)),
    normalizedState.timeline
  );

  const yearly = ["year1", "year2", "year3"].map((yearKey) => {
    const revenue = Number(revenueByYear[yearKey] || 0);
    const variable = Number(variableByYear[yearKey] || 0);
    const fixed = Number(fixedByYear[yearKey] || 0);
    const serviceRevenue = Number(serviceRevenueByYear[yearKey] || 0);
    const productRevenue = Number(productRevenueByYear[yearKey] || 0);

    const serviceShare = revenue > 0 ? serviceRevenue / revenue : 0;
    const productShare = revenue > 0 ? productRevenue / revenue : 0;
    const serviceVariable = variable * serviceShare;
    const productVariable = variable * productShare;

    return {
      yearKey,
      serviceBreakEvenRevenue: computeBreakEvenRevenue(serviceRevenue, serviceVariable, fixed),
      productBreakEvenRevenue: computeBreakEvenRevenue(productRevenue, productVariable, fixed)
    };
  });

  return {
    yearly: yearly.map((row) => ({
      ...row,
      serviceBreakEvenRevenue: row.serviceBreakEvenRevenue == null ? null : round2(row.serviceBreakEvenRevenue),
      productBreakEvenRevenue: row.productBreakEvenRevenue == null ? null : round2(row.productBreakEvenRevenue)
    }))
  };
}
