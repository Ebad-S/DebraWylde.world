import {
  DEFAULTS,
  DEFAULT_PERSONAL_CASHFLOW_INFLOWS,
  DEFAULT_PERSONAL_CASHFLOW_OUTFLOWS,
  DEFAULT_PERSONAL_CASHFLOW_SHARED_COSTS
} from "./enums.js";

export const CANONICAL_STATE_TEMPLATE = {
  meta: {
    appVersion: "0.1.0",
    schemaVersion: DEFAULTS.meta.schemaVersion,
    createdAt: "",
    updatedAt: "",
    forecastHorizonYears: DEFAULTS.meta.forecastHorizonYears,
    currency: DEFAULTS.meta.currency
  },
  setup: {
    businessName: "",
    startMonth: DEFAULTS.setup.startMonth,
    tradingStructure: DEFAULTS.setup.tradingStructure,
    gstRegistration: DEFAULTS.setup.gstRegistration,
    chargeGstOnSales: DEFAULTS.setup.chargeGstOnSales,
    basFrequency: DEFAULTS.setup.basFrequency,
    openingCash: DEFAULTS.setup.openingCash,
    reportBasis: DEFAULTS.setup.reportBasis
  },
  years: {
    year1: createEmptyYearConfig(1),
    year2: createEmptyYearConfig(2),
    year3: createEmptyYearConfig(3)
  },
  salesDetails: {
    lines: []
  },
  collectionsPolicy: createEmptyCollectionsPolicy(),
  assets: {
    items: []
  },
  loans: {
    items: []
  },
  personalCashFlow: createEmptyPersonalCashFlow(),
  derived: {
    monthly: {},
    annual: {},
    quarterly: {},
    summaryCards: {},
    charts: {}
  },
  warnings: []
};

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function createEmptyYearConfig(yearIndex) {
  return {
    yearIndex,
    assumptions: {
      growthPct: DEFAULTS.assumptions.growthPct,
      cpiPct: DEFAULTS.assumptions.cpiPct,
      taxRatePct: DEFAULTS.assumptions.taxRatePct,
      gstRatePct: DEFAULTS.assumptions.gstRatePct,
      superannuationPct: DEFAULTS.assumptions.superannuationPct,
      payrollTaxPct: DEFAULTS.assumptions.payrollTaxPct
    },
    costProfile: createEmptyCostProfile(),
    ownerAdjustments: createEmptyOwnerAdjustments(),
    marketing: {
      lineItems: []
    },
    businessExpenses: {
      lineItems: []
    },
    salesForecast: {
      lineOverrides: []
    }
  };
}

export function createEmptyCostProfile() {
  return {
    fixedMonthlyCost: DEFAULTS.costProfile.fixedMonthlyCost,
    variableCostPctOfRevenue: DEFAULTS.costProfile.variableCostPctOfRevenue,
    directLaborPctOfRevenue: DEFAULTS.costProfile.directLaborPctOfRevenue,
    otherOperatingExpenseMonthly: DEFAULTS.costProfile.otherOperatingExpenseMonthly
  };
}

export function createEmptyOwnerAdjustments() {
  return {
    modelType: DEFAULTS.ownerAdjustments.modelType,
    ownerDrawingsMonthly: DEFAULTS.ownerAdjustments.ownerDrawingsMonthly,
    directorSalaryMonthly: DEFAULTS.ownerAdjustments.directorSalaryMonthly,
    distributionsMonthly: DEFAULTS.ownerAdjustments.distributionsMonthly,
    notes: DEFAULTS.ownerAdjustments.notes
  };
}

export function createEmptyCollectionsPolicy() {
  return {
    defaultDebtorDays: DEFAULTS.collectionsPolicy.defaultDebtorDays,
    badDebtPct: DEFAULTS.collectionsPolicy.badDebtPct,
    collectionSplitByMonthBucket: [...DEFAULTS.collectionsPolicy.collectionSplitByMonthBucket],
    receivablesBasis: DEFAULTS.collectionsPolicy.receivablesBasis,
    openingReceivables: DEFAULTS.collectionsPolicy.openingReceivables
  };
}

export function createEmptySalesLine() {
  return {
    id: buildId("sales"),
    name: "",
    type: DEFAULTS.salesLine.type,
    unitPrice: DEFAULTS.salesLine.unitPrice,
    defaultUnitsPerPeriod: DEFAULTS.salesLine.defaultUnitsPerPeriod,
    seasonalityByMonth: [...DEFAULTS.salesLine.seasonalityByMonth],
    costOfGoodsSold: DEFAULTS.salesLine.costOfGoodsSold,
    grossMarginPercent: DEFAULTS.salesLine.grossMarginPercent,
    paymentMethod: DEFAULTS.salesLine.paymentMethod,
    merchantFeePercent: DEFAULTS.salesLine.merchantFeePercent,
    collectionProfile: DEFAULTS.salesLine.collectionProfile,
    gstApplies: DEFAULTS.salesLine.gstApplies,
    isActive: DEFAULTS.salesLine.isActive
  };
}

export function createEmptyAssetItem() {
  return {
    id: buildId("asset"),
    name: "",
    category: DEFAULTS.assetItem.category,
    purchaseAmount: DEFAULTS.assetItem.purchaseAmount,
    purchaseMonthIndex: DEFAULTS.assetItem.purchaseMonthIndex,
    usefulLifeYears: DEFAULTS.assetItem.usefulLifeYears,
    depreciationMethod: DEFAULTS.assetItem.depreciationMethod,
    residualValue: DEFAULTS.assetItem.residualValue
  };
}

export function createEmptyBusinessExpenseItem({ category, label } = {}) {
  const defaults = DEFAULTS.businessExpenseLine;
  return {
    id: buildId("bexp"),
    category: category || defaults.category,
    label: label || "",
    monthlyAmount: defaults.monthlyAmount,
    startMonth: defaults.startMonth,
    endMonth: defaults.endMonth,
    isActive: defaults.isActive,
    notes: defaults.notes
  };
}

export function createEmptyMarketingLine() {
  const defaults = DEFAULTS.marketingLine;
  return {
    id: buildId("mktg"),
    label: defaults.label,
    monthlyAmount: defaults.monthlyAmount,
    startMonth: defaults.startMonth,
    endMonth: defaults.endMonth,
    isActive: defaults.isActive
  };
}

export function createEmptyLoanItem() {
  return {
    id: buildId("loan"),
    name: "",
    principal: DEFAULTS.loanItem.principal,
    annualInterestRate: DEFAULTS.loanItem.annualInterestRate,
    termYears: DEFAULTS.loanItem.termYears,
    repaymentFrequency: DEFAULTS.loanItem.repaymentFrequency,
    drawdownMonthIndex: DEFAULTS.loanItem.drawdownMonthIndex,
    repaymentStartMonthIndex: DEFAULTS.loanItem.repaymentStartMonthIndex
  };
}

export function createEmptyPersonalCashFlowItem() {
  return {
    id: buildId("pcf"),
    name: "",
    amount: DEFAULTS.personalCashFlowItem.amount,
    frequency: DEFAULTS.personalCashFlowItem.frequency,
    personalUsePercent: DEFAULTS.personalCashFlowItem.personalUsePercent,
    businessUsePercentDerived: 0
  };
}

function zeroMonths() {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

export function createPersonalCashFlowRow({ id, label, custom = false } = {}) {
  return {
    id: id || buildId("pcf-row"),
    label: label || "",
    monthly: zeroMonths(),
    custom: Boolean(custom)
  };
}

export function createEmptySharedCostItem({ name = "", custom = true } = {}) {
  return {
    id: buildId("shared"),
    name,
    amount: 0,
    frequency: "monthly",
    personalUsePercent: 100,
    custom: Boolean(custom)
  };
}

export function createDefaultInflowRows() {
  return DEFAULT_PERSONAL_CASHFLOW_INFLOWS.map((row) =>
    createPersonalCashFlowRow({ id: row.id, label: row.label, custom: false })
  );
}

export function createDefaultOutflowRows() {
  return DEFAULT_PERSONAL_CASHFLOW_OUTFLOWS.map((row) =>
    createPersonalCashFlowRow({ id: row.id, label: row.label, custom: false })
  );
}

export function createDefaultSharedCostRows() {
  return DEFAULT_PERSONAL_CASHFLOW_SHARED_COSTS.map((row) =>
    createEmptySharedCostItem({ name: row.name, custom: false })
  );
}

export function createEmptyPersonalCashFlow() {
  return {
    year1Only: true,
    openingBalance: 0,
    inflows: createDefaultInflowRows(),
    outflows: createDefaultOutflowRows(),
    sharedCosts: createDefaultSharedCostRows()
  };
}

export function createNewForecastState() {
  const nowIso = new Date().toISOString();
  return {
    ...cloneDeep(CANONICAL_STATE_TEMPLATE),
    meta: {
      ...cloneDeep(CANONICAL_STATE_TEMPLATE.meta),
      createdAt: nowIso,
      updatedAt: nowIso
    }
  };
}
