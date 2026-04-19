export const CALCULATION_DOMAIN_CONTRACTS = [
  {
    domain: "Setup Normalization",
    consumes: ["rawState.meta", "rawState.setup", "rawState.years", "rawState.collectionsPolicy"],
    produces: ["normalized.meta", "normalized.setup", "normalized.years", "normalized.collectionsPolicy", "normalized.timeline"],
    mustDefine: ["input normalization", "defaulting rules", "date/month handling", "global tax posture"]
  },
  {
    domain: "Sales and Revenue",
    consumes: [
      "normalized.salesDetails.lines",
      "normalized.salesDetails.lines[*].defaultUnitsPerPeriod",
      "normalized.salesDetails.lines[*].seasonalityByMonth",
      "normalized.years.year*.assumptions",
      "normalized.years.year*.salesForecast",
      "normalized.timeline"
    ],
    produces: ["results.revenue.monthly", "results.revenue.annual", "results.revenue.quarterly"],
    mustDefine: [
      "sales line modeling",
      "monthly units formula",
      "monthly revenue formula",
      "service vs product behavior",
      "gross margin vs COGS treatment",
      "seasonality application",
      "growth application order",
      "merchant fees",
      "GST treatment on revenue"
    ]
  },
  {
    domain: "Debtors / Collections",
    consumes: ["results.revenue.monthly", "normalized.collectionsPolicy"],
    produces: ["results.collections.cashInMonthly", "results.collections.receivablesClosingMonthly"],
    mustDefine: [
      "invoice-to-cash timing model",
      "debtor days treatment",
      "collection distribution across month buckets",
      "bad debt treatment",
      "receivables opening/movement/closing formula"
    ]
  },
  {
    domain: "Costs",
    consumes: ["normalized.years.year*.costProfile", "results.revenue.monthly"],
    produces: [
      "results.costs.fixedMonthly",
      "results.costs.variableMonthly",
      "results.costs.directLaborMonthly",
      "results.costs.otherOperatingMonthly"
    ],
    mustDefine: ["fixed costs", "variable cost basis", "direct labor treatment", "other operating costs"]
  },
  {
    domain: "Marketing",
    consumes: ["normalized.years.year*.marketing"],
    produces: ["results.costs.marketingMonthly"],
    mustDefine: ["line-item spend model", "monthly allocation", "one-off vs recurring spend", "year-aware reuse"]
  },
  {
    domain: "Owner Adjustments",
    consumes: ["normalized.years.year*.ownerAdjustments", "normalized.personalCashFlow"],
    produces: [
      "results.ownerAdjustments.drawingsMonthly",
      "results.ownerAdjustments.salaryMonthly",
      "results.ownerAdjustments.distributionsMonthly"
    ],
    mustDefine: [
      "drawings treatment",
      "salary/director wage treatment",
      "distribution treatment",
      "personal-business allocation impact"
    ]
  },
  {
    domain: "Loans",
    consumes: ["normalized.loans.items", "normalized.timeline"],
    produces: ["results.financing.interestMonthly", "results.financing.principalMonthly", "results.financing.loanClosingMonthly"],
    mustDefine: ["amortization basis", "repayment frequency handling", "interest/principal split", "closing balance logic"]
  },
  {
    domain: "Assets / Depreciation",
    consumes: ["normalized.assets.items", "normalized.timeline"],
    produces: ["results.assets.depreciationMonthly", "results.assets.assetNBVMonthly"],
    mustDefine: ["depreciation method", "purchase timing impact", "annual/monthly depreciation handling", "net book value logic"]
  },
  {
    domain: "Cash Flow",
    consumes: [
      "results.collections.cashInMonthly",
      "results.costs.*",
      "results.financing.*",
      "results.ownerAdjustments.*",
      "normalized.setup.openingCash"
    ],
    produces: ["results.cashFlow.*"],
    mustDefine: ["opening balance", "cash inflows", "cash outflows", "financing flows", "closing balance"]
  },
  {
    domain: "Profit and Loss",
    consumes: ["results.revenue.*", "results.costs.*", "results.financing.*", "results.assets.*", "normalized.years.year*.assumptions"],
    produces: ["results.profitAndLoss.*"],
    mustDefine: [
      "revenue",
      "COGS",
      "gross profit",
      "operating expenses",
      "EBITDA",
      "depreciation",
      "interest",
      "net profit before tax",
      "tax",
      "net profit after tax"
    ]
  },
  {
    domain: "Balance Sheet",
    consumes: [
      "results.cashFlow.closingCashMonthly",
      "results.collections.receivablesClosingMonthly",
      "results.assets.assetNBVMonthly",
      "results.financing.loanClosingMonthly",
      "results.profitAndLoss.netProfitAfterTaxMonthly",
      "results.ownerAdjustments.drawingsMonthly",
      "results.ownerAdjustments.distributionsMonthly"
    ],
    produces: ["results.balanceSheet.*"],
    mustDefine: [
      "cash",
      "receivables",
      "non-current assets",
      "loan liabilities",
      "payables if modeled",
      "equity",
      "retained earnings logic",
      "integrity check"
    ]
  },
  {
    domain: "Break-even",
    consumes: ["results.revenue.*", "results.costs.*"],
    produces: ["results.breakeven.*"],
    mustDefine: ["service methodology", "product methodology", "contribution margin assumption", "cash vs accrual basis choice"]
  },
  {
    domain: "Quarterly Reporting",
    consumes: ["results.*.monthly"],
    produces: ["results.*.quarterly"],
    mustDefine: ["month-to-quarter rollup rules", "which metrics are rolled up", "which metrics are point-in-time"]
  }
];

export const REQUIRED_KEY_MODELING_DECISIONS = {
  receivables_timing_algorithm: {
    instruction:
      "Recommend one clear algorithm. Prefer a deterministic monthly collection profile model over brittle spreadsheet timing hacks.",
    expectedResult: "Document formula and tradeoffs."
  },
  gst_tax_treatment: {
    instruction:
      "Define one coherent approach for GST on revenue and expenses, plus high-level income tax treatment where relevant.",
    expectedResult: "Document whether outputs are gross, net, or both."
  },
  loan_amortization_method: {
    instruction: "Recommend an amortization approach with repayment frequency support and explicit formulas.",
    expectedResult: "Document formulas and assumptions."
  },
  depreciation_method: {
    instruction: "Recommend a default method suitable for this app, with support for future extension.",
    expectedResult: "Document formulas and assumptions."
  },
  balance_sheet_reconciliation: {
    instruction: "Define integrity rules that prevent hidden plugs and force equation visibility.",
    expectedResult: "Document reconciliation checks and warning/blocking thresholds."
  },
  revenue_generation_method: {
    instruction:
      "Define the exact monthly revenue generation formula for each sales stream, including how units, unit price, seasonality, growth, and GST interact.",
    expectedResult:
      "Document formula, ordering, and whether growth is YoY, monthly compounding, or explicit override."
  },
  statement_source_of_truth: {
    instruction:
      "Define the source of truth for revenue, liquidity, profitability, and financial position across the engine.",
    expectedResult: "Document which module owns each business truth and which modules consume it."
  }
};

export const EXECUTION_SEQUENCE = [
  "Setup Normalization",
  "Sales and Revenue",
  "Debtors / Collections",
  "Costs",
  "Marketing",
  "Owner Adjustments",
  "Loans",
  "Assets / Depreciation",
  "Cash Flow",
  "Profit and Loss",
  "Balance Sheet",
  "Break-even",
  "Quarterly Reporting"
];
