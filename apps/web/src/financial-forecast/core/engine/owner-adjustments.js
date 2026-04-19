import { round2 } from "./timeline.js";

export function calculateOwnerAdjustments(normalizedState) {
  const { timeline, years, personalCashFlow } = normalizedState;
  const monthCount = timeline.monthCount;

  const drawingsMonthly = Array(monthCount).fill(0);
  const salaryMonthly = Array(monthCount).fill(0);
  const distributionsMonthly = Array(monthCount).fill(0);

  const personalMonthlyDrawings = (personalCashFlow?.items || []).reduce(
    (sum, item) => sum + Number(item.personalMonthlyAmount || 0),
    0
  );

  timeline.months.forEach((period, index) => {
    const owner = years[period.yearKey].ownerAdjustments;
    const model = owner.modelType;

    if (model === "sole_trader_drawings" || model === "hybrid") {
      drawingsMonthly[index] = Number(owner.ownerDrawingsMonthly || 0) + (period.yearIndex === 1 ? personalMonthlyDrawings : 0);
    }
    if (model === "company_salary_and_distributions" || model === "hybrid") {
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
