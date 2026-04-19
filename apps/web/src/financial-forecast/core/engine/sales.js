import { round2, sumByQuarter, sumByYear } from "./timeline.js";

function getLineOverrideUnits(normalizedState, yearKey, salesLineId, monthIndex) {
  const overrides = normalizedState?.years?.[yearKey]?.salesForecast?.lineOverrides || [];
  const match = overrides.find((override) => override.salesLineId === salesLineId && Number(override.monthIndex) === monthIndex);
  return match ? Number(match.unitsOverride) : null;
}

export function calculateSales(normalizedState) {
  const { timeline, salesDetails, years, gstPolicy } = normalizedState;
  const monthCount = timeline.monthCount;

  const monthly = {
    units: Array(monthCount).fill(0),
    gross: Array(monthCount).fill(0),
    net: Array(monthCount).fill(0),
    gst: Array(monthCount).fill(0),
    serviceNet: Array(monthCount).fill(0),
    productNet: Array(monthCount).fill(0),
    byLineUnits: {},
    byLineGross: {},
    byLineNet: {},
    byLineGst: {}
  };

  salesDetails.lines.forEach((line) => {
    monthly.byLineUnits[line.id] = Array(monthCount).fill(0);
    monthly.byLineGross[line.id] = Array(monthCount).fill(0);
    monthly.byLineNet[line.id] = Array(monthCount).fill(0);
    monthly.byLineGst[line.id] = Array(monthCount).fill(0);

    timeline.months.forEach((period, index) => {
      if (!line.isActive) return;
      const yearAssumptions = years[period.yearKey].assumptions;
      const growthFactor = Math.pow(1 + Number(yearAssumptions.growthRate || 0), period.yearIndex - 1);
      const seasonalityFactor = Number(line.seasonalityByMonth[period.monthIndex - 1] || 0);

      const overrideUnits = getLineOverrideUnits(normalizedState, period.yearKey, line.id, period.monthIndex);
      const monthlyUnits = overrideUnits != null
        ? overrideUnits
        : Number(line.defaultUnitsPerPeriod || 0) * seasonalityFactor * growthFactor;

      const monthlyRevenueGross = monthlyUnits * Number(line.unitPrice || 0);
      const gstRate = Number(yearAssumptions.gstRate || 0);
      const invoiceGstApplies = gstPolicy.invoiceGstEnabled && line.gstApplies && gstRate > 0;
      const monthlyRevenueNetExclusive = invoiceGstApplies
        ? monthlyRevenueGross / (1 + gstRate)
        : monthlyRevenueGross;
      const monthlyRevenueGst = invoiceGstApplies
        ? monthlyRevenueGross - monthlyRevenueNetExclusive
        : 0;
      const monthlyRevenueNet = gstPolicy.profitabilityUsesGstExclusive
        ? monthlyRevenueNetExclusive
        : monthlyRevenueGross;

      monthly.units[index] += monthlyUnits;
      monthly.gross[index] += monthlyRevenueGross;
      monthly.net[index] += monthlyRevenueNet;
      monthly.gst[index] += monthlyRevenueGst;

      monthly.byLineUnits[line.id][index] = monthlyUnits;
      monthly.byLineGross[line.id][index] = monthlyRevenueGross;
      monthly.byLineNet[line.id][index] = monthlyRevenueNet;
      monthly.byLineGst[line.id][index] = monthlyRevenueGst;

      if (line.type === "service") monthly.serviceNet[index] += monthlyRevenueNet;
      if (line.type === "product") monthly.productNet[index] += monthlyRevenueNet;
    });
  });

  return {
    monthly: {
      units: monthly.units.map(round2),
      gross: monthly.gross.map(round2),
      net: monthly.net.map(round2),
      gst: monthly.gst.map(round2),
      serviceNet: monthly.serviceNet.map(round2),
      productNet: monthly.productNet.map(round2),
      byLineUnits: Object.fromEntries(Object.entries(monthly.byLineUnits).map(([id, values]) => [id, values.map(round2)])),
      byLineGross: Object.fromEntries(Object.entries(monthly.byLineGross).map(([id, values]) => [id, values.map(round2)])),
      byLineNet: Object.fromEntries(Object.entries(monthly.byLineNet).map(([id, values]) => [id, values.map(round2)])),
      byLineGst: Object.fromEntries(Object.entries(monthly.byLineGst).map(([id, values]) => [id, values.map(round2)]))
    },
    annual: {
      gross: Object.fromEntries(Object.entries(sumByYear(monthly.gross, timeline)).map(([k, v]) => [k, round2(v)])),
      net: Object.fromEntries(Object.entries(sumByYear(monthly.net, timeline)).map(([k, v]) => [k, round2(v)])),
      gst: Object.fromEntries(Object.entries(sumByYear(monthly.gst, timeline)).map(([k, v]) => [k, round2(v)]))
    },
    quarterly: {
      gross: Object.fromEntries(Object.entries(sumByQuarter(monthly.gross, timeline)).map(([k, v]) => [k, round2(v)])),
      net: Object.fromEntries(Object.entries(sumByQuarter(monthly.net, timeline)).map(([k, v]) => [k, round2(v)]))
    }
  };
}
