import { round2 } from "./timeline.js";

export function calculateMarketing(normalizedState) {
  const { timeline, years } = normalizedState;
  const monthly = Array(timeline.monthCount).fill(0);

  timeline.months.forEach((period, index) => {
    const lineItems = years[period.yearKey]?.marketing?.lineItems || [];
    let total = 0;
    lineItems.forEach((item) => {
      if (item.isActive === false) return;
      const start = Number(item.startMonth || 1);
      const end = Number(item.endMonth || 12);
      const amount = Number(item.monthlyAmount || 0);
      const isInRange = period.monthIndex >= start && period.monthIndex <= end;
      if (isInRange) total += amount;
    });
    monthly[index] = total;
  });

  return {
    monthly: monthly.map(round2)
  };
}
