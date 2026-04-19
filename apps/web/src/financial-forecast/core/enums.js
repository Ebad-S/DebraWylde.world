export const ENUMS = {
  START_MONTH: [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec"
  ],
  TRADING_STRUCTURE: ["sole_trader", "partnership", "company", "trust", "other"],
  GST_REGISTRATION: ["registered", "not_registered"],
  BAS_FREQUENCY: ["monthly", "quarterly", "annual"],
  REVENUE_TYPE: ["service", "product", "other"],
  PAYMENT_METHOD: ["bank_transfer", "card", "cash", "other"],
  REPAYMENT_FREQUENCY: ["monthly"],
  ASSET_CATEGORY: ["equipment", "vehicles", "furniture", "it_hardware", "intangible", "other"],
  DEPRECIATION_METHOD: ["straight_line"],
  WARNING_SEVERITY: ["info", "warning", "critical"],
  REPORT_MODE: ["cash_basis_view", "accrual_basis_view", "dual_view"],
  OWNER_ADJUSTMENT_MODEL_TYPE: ["sole_trader_drawings", "company_salary_and_distributions", "hybrid"],
  PROVENANCE_TYPE: ["input", "derived", "assumption", "override", "system"],
  RECEIVABLES_BASIS: ["gross", "net"],
  PERSONAL_CASH_FLOW_FREQUENCY: ["weekly", "fortnightly", "monthly", "quarterly", "annual"]
};

export const DEFAULTS = {
  meta: {
    schemaVersion: "2.0.0",
    forecastHorizonYears: 3,
    currency: "AUD"
  },
  setup: {
    startMonth: "jan",
    tradingStructure: "sole_trader",
    gstRegistration: "registered",
    chargeGstOnSales: true,
    basFrequency: "quarterly",
    openingCash: 0,
    reportBasis: "dual_view"
  },
  assumptions: {
    growthPct: 0,
    cpiPct: 0,
    taxRatePct: 25,
    gstRatePct: 10
  },
  costProfile: {
    fixedMonthlyCost: 0,
    variableCostPctOfRevenue: 0,
    directLaborPctOfRevenue: 0,
    otherOperatingExpenseMonthly: 0
  },
  ownerAdjustments: {
    modelType: "sole_trader_drawings",
    ownerDrawingsMonthly: 0,
    directorSalaryMonthly: 0,
    distributionsMonthly: 0,
    notes: ""
  },
  collectionsPolicy: {
    defaultDebtorDays: 30,
    badDebtPct: 0,
    collectionSplitByMonthBucket: [0.7, 0.2, 0.1],
    receivablesBasis: "gross",
    openingReceivables: 0
  },
  salesLine: {
    type: "service",
    unitPrice: 0,
    defaultUnitsPerPeriod: 0,
    seasonalityByMonth: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    costOfGoodsSold: null,
    grossMarginPercent: null,
    paymentMethod: "bank_transfer",
    merchantFeePercent: 0,
    collectionProfile: "default",
    gstApplies: true,
    isActive: true
  },
  assetItem: {
    category: "equipment",
    purchaseAmount: 0,
    purchaseMonthIndex: 1,
    usefulLifeYears: 5,
    depreciationMethod: "straight_line",
    residualValue: 0
  },
  loanItem: {
    principal: 0,
    annualInterestRate: 0,
    termYears: 1,
    repaymentFrequency: "monthly",
    drawdownMonthIndex: 1,
    repaymentStartMonthIndex: 1
  },
  personalCashFlowItem: {
    amount: 0,
    frequency: "monthly",
    personalUsePercent: 100
  },
  reportMode: "dual_view"
};

export const SELECT_OPTIONS = {
  startMonth: ENUMS.START_MONTH.map((value) => ({ value, label: value.toUpperCase() })),
  tradingStructure: ENUMS.TRADING_STRUCTURE.map((value) => ({ value, label: value.replaceAll("_", " ") })),
  gstRegistration: ENUMS.GST_REGISTRATION.map((value) => ({ value, label: value.replaceAll("_", " ") })),
  basFrequency: ENUMS.BAS_FREQUENCY.map((value) => ({ value, label: value })),
  revenueType: ENUMS.REVENUE_TYPE.map((value) => ({ value, label: value })),
  paymentMethod: ENUMS.PAYMENT_METHOD.map((value) => ({ value, label: value.replaceAll("_", " ") })),
  repaymentFrequency: ENUMS.REPAYMENT_FREQUENCY.map((value) => ({ value, label: value })),
  assetCategory: ENUMS.ASSET_CATEGORY.map((value) => ({ value, label: value.replaceAll("_", " ") })),
  depreciationMethod: ENUMS.DEPRECIATION_METHOD.map((value) => ({ value, label: value.replaceAll("_", " ") })),
  reportMode: ENUMS.REPORT_MODE.map((value) => ({ value, label: value.replaceAll("_", " ") })),
  ownerAdjustmentModelType: ENUMS.OWNER_ADJUSTMENT_MODEL_TYPE.map((value) => ({ value, label: value.replaceAll("_", " ") })),
  receivablesBasis: ENUMS.RECEIVABLES_BASIS.map((value) => ({ value, label: value })),
  personalCashFlowFrequency: ENUMS.PERSONAL_CASH_FLOW_FREQUENCY.map((value) => ({ value, label: value }))
};
