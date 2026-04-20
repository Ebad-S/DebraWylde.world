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

export const DEFAULT_PERSONAL_CASHFLOW_INFLOWS = [
  { id: "drawings-from-business", label: "Drawings from business (from business to you)" },
  { id: "part-time-casual-work", label: "Part-time / casual work" },
  { id: "spouse-partner-wages", label: "Spouse / partner wages" },
  { id: "govt-payments", label: "Govt payments (e.g. Family Tax Benefit, Carers)" },
  { id: "other-income", label: "Other income (hobby, investments)" }
];

export const DEFAULT_PERSONAL_CASHFLOW_OUTFLOWS = [
  { id: "groceries", label: "Groceries" },
  { id: "entertainment-recreation", label: "Entertainment / recreation" },
  { id: "clothing-footwear", label: "Clothing / footwear" },
  { id: "home-insurance", label: "Home insurance" },
  { id: "health-other-insurance", label: "Health / other insurance" },
  { id: "council-rates", label: "Council rates" },
  { id: "medical-expenses", label: "Medical expenses" },
  { id: "fuel-personal-use", label: "Fuel for personal use" },
  { id: "transport-fares", label: "Transport - fares, taxi / uber" },
  { id: "childcare", label: "Childcare" },
  { id: "school-fees-education", label: "School fees & education costs" },
  { id: "pets", label: "Pets" },
  { id: "gym-membership", label: "Gym membership" },
  { id: "holidays", label: "Holidays" },
  { id: "gifts", label: "Gifts" },
  { id: "books-magazines-newspapers", label: "Books, magazines, newspapers" },
  { id: "personal-care", label: "Personal care - hair / beauty" },
  { id: "subscriptions-netflix", label: "Subscriptions (e.g. Netflix)" },
  { id: "miscellaneous", label: "Miscellaneous" },
  { id: "bank-charges", label: "Bank charges" },
  { id: "vehicle-loan", label: "Vehicle loan" },
  { id: "personal-loan-repayments", label: "Personal loan repayments" },
  { id: "personal-credit-card-repayments", label: "Personal credit card repayments" }
];

export const DEFAULT_PERSONAL_CASHFLOW_SHARED_COSTS = [
  { name: "Household Rent" },
  { name: "Telephone" },
  { name: "Internet" },
  { name: "Mobile" },
  { name: "Motor vehicle - Repairs and Maintenance" },
  { name: "Motor vehicle - Registration" },
  { name: "Motor vehicle - Insurance" },
  { name: "Motor vehicle - Lease or loan interest" },
  { name: "Utilities - Gas" },
  { name: "Utilities - Electricity" },
  { name: "Utilities - Water" }
];

export const DEFAULTS = {
  meta: {
    schemaVersion: "2.1.0",
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
