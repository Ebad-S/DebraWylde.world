import { DEFAULTS } from "../enums.js";
import { buildTimeline } from "./timeline.js";

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePct(value, fallback = 0) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return numeric / 100;
}

function buildGstPolicy(setup) {
  const isRegistered = setup.gstRegistration === "registered";
  const invoiceGstEnabled = isRegistered && Boolean(setup.chargeGstOnSales);
  const reportBasis = setup.reportBasis || "dual_view";
  const profitabilityUsesGstExclusive = reportBasis !== "cash_basis_view";
  return {
    isRegistered,
    invoiceGstEnabled,
    reportBasis,
    profitabilityUsesGstExclusive
  };
}

function toMonthlyAmount(amount, frequency) {
  const safe = Number(amount || 0);
  if (frequency === "weekly") return (safe * 52) / 12;
  if (frequency === "fortnightly") return (safe * 26) / 12;
  if (frequency === "quarterly") return safe / 3;
  if (frequency === "annual") return safe / 12;
  return safe;
}

function normalizePersonalCashFlow(personalCashFlow) {
  const items = (personalCashFlow?.items || []).map((item) => {
    const monthlyAmount = toMonthlyAmount(item.amount || 0, item.frequency || "monthly");
    const personalUsePct = Number(item.personalUsePercent || 0) / 100;
    const personalMonthlyAmount = monthlyAmount * personalUsePct;
    const businessMonthlyAmount = monthlyAmount - personalMonthlyAmount;
    return {
      ...item,
      monthlyAmount,
      personalMonthlyAmount,
      businessMonthlyAmount
    };
  });

  return {
    ...personalCashFlow,
    items
  };
}

export function normalizeState(rawState) {
  const safeInput = cloneDeep(rawState || {});
  const normalized = cloneDeep(safeInput);

  normalized.meta = normalized.meta || {};
  normalized.setup = normalized.setup || {};
  normalized.years = normalized.years || {};
  normalized.salesDetails = normalized.salesDetails || { lines: [] };
  normalized.collectionsPolicy = normalized.collectionsPolicy || {};
  normalized.personalCashFlow = normalizePersonalCashFlow(normalized.personalCashFlow || { year1Only: true, items: [] });

  normalized.setup.reportBasis = normalized.setup.reportBasis || DEFAULTS.setup.reportBasis;
  normalized.setup.openingCash = Number(normalized.setup.openingCash || 0);
  normalized.gstPolicy = buildGstPolicy(normalized.setup);

  ["year1", "year2", "year3"].forEach((yearKey, i) => {
    const year = normalized.years[yearKey] || {};
    const assumptions = year.assumptions || {};
    year.assumptions = {
      growthPct: Number(assumptions.growthPct ?? DEFAULTS.assumptions.growthPct),
      cpiPct: Number(assumptions.cpiPct ?? DEFAULTS.assumptions.cpiPct),
      taxRatePct: Number(assumptions.taxRatePct ?? DEFAULTS.assumptions.taxRatePct),
      gstRatePct: Number(assumptions.gstRatePct ?? DEFAULTS.assumptions.gstRatePct),
      growthRate: normalizePct(assumptions.growthPct ?? DEFAULTS.assumptions.growthPct),
      cpiRate: normalizePct(assumptions.cpiPct ?? DEFAULTS.assumptions.cpiPct),
      taxRate: normalizePct(assumptions.taxRatePct ?? DEFAULTS.assumptions.taxRatePct),
      gstRate: normalizePct(assumptions.gstRatePct ?? DEFAULTS.assumptions.gstRatePct)
    };

    year.salesForecast = year.salesForecast || { lineOverrides: [] };
    year.marketing = year.marketing || { lineItems: [] };
    year.costProfile = year.costProfile || cloneDeep(DEFAULTS.costProfile);
    year.ownerAdjustments = year.ownerAdjustments || cloneDeep(DEFAULTS.ownerAdjustments);
    year.yearIndex = i + 1;
    normalized.years[yearKey] = year;
  });

  normalized.salesDetails.lines = (normalized.salesDetails.lines || []).map((line) => ({
    ...line,
    unitPrice: Number(line.unitPrice || 0),
    defaultUnitsPerPeriod: Number(line.defaultUnitsPerPeriod || 0),
    seasonalityByMonth: Array.isArray(line.seasonalityByMonth) && line.seasonalityByMonth.length === 12
      ? line.seasonalityByMonth.map((x) => Number(x || 0))
      : [...DEFAULTS.salesLine.seasonalityByMonth],
    costOfGoodsSold: line.costOfGoodsSold == null ? null : Number(line.costOfGoodsSold),
    grossMarginPercent: line.grossMarginPercent == null ? null : Number(line.grossMarginPercent),
    merchantFeePercent: Number(line.merchantFeePercent || 0),
    merchantFeeRate: normalizePct(line.merchantFeePercent || 0)
  }));

  normalized.collectionsPolicy = {
    defaultDebtorDays: Number(normalized.collectionsPolicy.defaultDebtorDays ?? DEFAULTS.collectionsPolicy.defaultDebtorDays),
    badDebtPct: Number(normalized.collectionsPolicy.badDebtPct ?? DEFAULTS.collectionsPolicy.badDebtPct),
    collectionSplitByMonthBucket: Array.isArray(normalized.collectionsPolicy.collectionSplitByMonthBucket)
      ? normalized.collectionsPolicy.collectionSplitByMonthBucket.map((x) => Number(x || 0))
      : [...DEFAULTS.collectionsPolicy.collectionSplitByMonthBucket],
    receivablesBasis: normalized.collectionsPolicy.receivablesBasis || DEFAULTS.collectionsPolicy.receivablesBasis,
    openingReceivables: Number(normalized.collectionsPolicy.openingReceivables ?? DEFAULTS.collectionsPolicy.openingReceivables),
    badDebtRate: normalizePct(normalized.collectionsPolicy.badDebtPct ?? DEFAULTS.collectionsPolicy.badDebtPct)
  };

  normalized.timeline = buildTimeline(Number(normalized.meta.forecastHorizonYears || DEFAULTS.meta.forecastHorizonYears));
  return normalized;
}
