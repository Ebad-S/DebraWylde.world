import { round2 } from "./timeline.js";

// Statutory labor on-costs (Super + Payroll Tax). This module is intentionally
// simple and transparent:
//   - Superannuation % applies to direct labor (from costs) and director
//     salary (from owner adjustments) in the year that contains the month.
//   - Payroll tax % applies to the same base. This is a planning approximation
//     - real-world payroll tax has state-based thresholds that this app does
//     not attempt to model.
//   - Owner drawings and distributions are NOT payroll and are excluded.
export function calculateStatutoryLabor(normalizedState, costs, ownerAdjustments) {
  const { timeline, years } = normalizedState;
  const monthCount = timeline.monthCount;

  const superannuationMonthly = Array(monthCount).fill(0);
  const payrollTaxMonthly = Array(monthCount).fill(0);

  timeline.months.forEach((period, i) => {
    const yearConfig = years[period.yearKey];
    const superRate = Number(yearConfig?.assumptions?.superannuationRate || 0);
    const payrollRate = Number(yearConfig?.assumptions?.payrollTaxRate || 0);

    const directLabor = Number(costs?.directLaborMonthly?.[i] || 0);
    const directorSalary = Number(ownerAdjustments?.salaryMonthly?.[i] || 0);
    const base = directLabor + directorSalary;

    superannuationMonthly[i] = base * superRate;
    payrollTaxMonthly[i] = base * payrollRate;
  });

  return {
    superannuationMonthly: superannuationMonthly.map(round2),
    payrollTaxMonthly: payrollTaxMonthly.map(round2)
  };
}
