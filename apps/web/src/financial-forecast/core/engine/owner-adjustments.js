import { round2 } from "./timeline.js";

// For Year 1 and models where the owner extracts cash as "drawings",
// the Personal Cash Flow step's "Drawings from business" monthly row is
// authoritative and overrides the year-plan single monthly value whenever
// it has been populated. When the PCF row sums to zero (the default state
// for imported legacy datasets where the user has not yet filled in the
// Personal Cash Flow step), we fall back to the year-plan
// `ownerDrawingsMonthly` so Y1 drawings are never silently zeroed out just
// because the PCF row is empty. For Y2/Y3 the year-plan figure continues
// to apply. The previous engine behaviour of also adding the shared-costs
// "personal portion" to drawings has been removed to prevent double
// counting; shared costs now flow exclusively through the Personal Cash
// Flow outflow model.
export function calculateOwnerAdjustments(normalizedState) {
  const { timeline, years, personalCashFlow } = normalizedState;
  const monthCount = timeline.monthCount;

  const drawingsMonthly = Array(monthCount).fill(0);
  const salaryMonthly = Array(monthCount).fill(0);
  const distributionsMonthly = Array(monthCount).fill(0);

  const drawingsRow = (personalCashFlow?.inflows || []).find((r) => r.id === "drawings-from-business");
  const personalDrawingsMonthlyY1 = drawingsRow
    ? drawingsRow.monthly.map((v) => Number(v || 0))
    : null;
  const personalDrawingsPopulated = personalDrawingsMonthlyY1
    ? personalDrawingsMonthlyY1.some((v) => Number(v || 0) !== 0)
    : false;

  timeline.months.forEach((period, index) => {
    const owner = years[period.yearKey].ownerAdjustments;
    const model = owner.modelType;
    const ownerExtractsAsDrawings = model === "sole_trader_drawings" || model === "hybrid";
    const ownerExtractsAsSalaryDist = model === "company_salary_and_distributions" || model === "hybrid";

    if (ownerExtractsAsDrawings) {
      if (period.yearIndex === 1 && personalDrawingsPopulated) {
        drawingsMonthly[index] = personalDrawingsMonthlyY1[period.monthIndex - 1] || 0;
      } else {
        drawingsMonthly[index] = Number(owner.ownerDrawingsMonthly || 0);
      }
    }
    if (ownerExtractsAsSalaryDist) {
      salaryMonthly[index] = Number(owner.directorSalaryMonthly || 0);
      distributionsMonthly[index] = Number(owner.distributionsMonthly || 0);
    }
  });

  return {
    drawingsMonthly: drawingsMonthly.map(round2),
    salaryMonthly: salaryMonthly.map(round2),
    distributionsMonthly: distributionsMonthly.map(round2)
  };
}
