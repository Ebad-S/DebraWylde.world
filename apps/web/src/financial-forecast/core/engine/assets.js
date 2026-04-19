import { round2 } from "./timeline.js";

export function calculateAssets(normalizedState) {
  const { timeline, assets } = normalizedState;
  const monthCount = timeline.monthCount;

  const purchaseMonthly = Array(monthCount).fill(0);
  const depreciationMonthly = Array(monthCount).fill(0);
  const assetNBVMonthly = Array(monthCount).fill(0);

  const assetStates = (assets.items || []).map((asset) => {
    const purchaseValue = Number(asset.purchaseAmount || 0);
    const residual = Number(asset.residualValue || 0);
    const usefulLifeMonths = Math.max(1, Math.round(Number(asset.usefulLifeYears || 1) * 12));
    const depreciableBase = Math.max(0, purchaseValue - residual);
    return {
      asset,
      purchaseValue,
      residual,
      usefulLifeMonths,
      monthlyDepreciation: depreciableBase / usefulLifeMonths
    };
  });

  timeline.months.forEach((period, index) => {
    let purchased = 0;
    let depreciation = 0;
    let nbv = 0;

    assetStates.forEach((state) => {
      const purchaseMonth = Number(state.asset.purchaseMonthIndex || 1);
      if (period.globalMonthIndex === purchaseMonth) {
        purchased += state.purchaseValue;
      }

      const monthsSincePurchase = period.globalMonthIndex - purchaseMonth;
      if (monthsSincePurchase >= 0 && monthsSincePurchase < state.usefulLifeMonths) {
        depreciation += state.monthlyDepreciation;
      }

      if (period.globalMonthIndex >= purchaseMonth) {
        const appliedMonths = Math.min(Math.max(monthsSincePurchase + 1, 0), state.usefulLifeMonths);
        const cumulativeDep = appliedMonths * state.monthlyDepreciation;
        const currentNbv = Math.max(state.residual, state.purchaseValue - cumulativeDep);
        nbv += currentNbv;
      }
    });

    purchaseMonthly[index] = purchased;
    depreciationMonthly[index] = depreciation;
    assetNBVMonthly[index] = nbv;
  });

  return {
    purchaseMonthly: purchaseMonthly.map(round2),
    depreciationMonthly: depreciationMonthly.map(round2),
    assetNBVMonthly: assetNBVMonthly.map(round2)
  };
}
