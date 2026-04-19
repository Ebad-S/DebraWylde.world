const RULE_SEVERITY = {
  ERROR: "error",
  WARNING: "warning"
};

function buildIssue({ code, severity, domain, fieldPath, message, blocking }) {
  return { code, severity, domain, fieldPath, message, blocking };
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function getYears(state) {
  return ["year1", "year2", "year3"].map((key) => ({ key, value: state?.years?.[key] || {} }));
}

export const VALIDATION_RULE_METADATA = {
  setup: ["businessName required", "openingCash numeric", "reportBasis required"],
  sales: [
    "line requires name/type/unitPrice",
    "defaultUnitsPerPeriod must be non-negative",
    "seasonalityByMonth must have 12 non-negative factors",
    "must define COGS or gross margin basis"
  ],
  collections: ["collection split sums to 1", "receivables basis present", "debtor days non-negative"],
  yearCostProfile: ["fixed cost non-negative", "variable percentages in range", "direct labor in range"],
  ownerAdjustments: ["modelType required", "owner adjustment amounts non-negative"],
  loans: ["term required when principal > 0", "interest rate range valid"],
  assets: ["useful life greater than zero", "residual does not exceed purchase amount"]
};

export function validateSetup(state) {
  const issues = [];
  const setup = state?.setup || {};

  if (!setup.businessName || !String(setup.businessName).trim()) {
    issues.push(buildIssue({
      code: "SETUP_MISSING_BUSINESS_NAME",
      severity: RULE_SEVERITY.ERROR,
      domain: "setup",
      fieldPath: "setup.businessName",
      message: "Business name is required.",
      blocking: true
    }));
  }

  if (!isNumber(setup.openingCash)) {
    issues.push(buildIssue({
      code: "SETUP_INVALID_OPENING_CASH",
      severity: RULE_SEVERITY.ERROR,
      domain: "setup",
      fieldPath: "setup.openingCash",
      message: "Opening cash must be numeric.",
      blocking: true
    }));
  }

  if (!setup.reportBasis) {
    issues.push(buildIssue({
      code: "SETUP_MISSING_REPORT_BASIS",
      severity: RULE_SEVERITY.ERROR,
      domain: "setup",
      fieldPath: "setup.reportBasis",
      message: "Report basis is required.",
      blocking: true
    }));
  }

  return issues;
}

export function validateSales(state) {
  const issues = [];
  const lines = state?.salesDetails?.lines || [];

  lines.forEach((line, index) => {
    if (!line.name || !line.type || !isNumber(line.unitPrice) || line.unitPrice < 0) {
      issues.push(buildIssue({
        code: "SALES_INVALID_LINE",
        severity: RULE_SEVERITY.ERROR,
        domain: "sales",
        fieldPath: `salesDetails.lines[${index}]`,
        message: "Sales line requires valid name, type, and non-negative unit price.",
        blocking: true
      }));
    }

    if (!isNumber(line.defaultUnitsPerPeriod) || line.defaultUnitsPerPeriod < 0) {
      issues.push(buildIssue({
        code: "SALES_INVALID_DEFAULT_UNITS",
        severity: RULE_SEVERITY.ERROR,
        domain: "sales",
        fieldPath: `salesDetails.lines[${index}].defaultUnitsPerPeriod`,
        message: "Default units per period must be a non-negative number.",
        blocking: true
      }));
    }

    const seasonality = line.seasonalityByMonth;
    const isSeasonalityValid =
      Array.isArray(seasonality) &&
      seasonality.length === 12 &&
      seasonality.every((value) => isNumber(value) && value >= 0);
    if (!isSeasonalityValid) {
      issues.push(buildIssue({
        code: "SALES_INVALID_SEASONALITY",
        severity: RULE_SEVERITY.ERROR,
        domain: "sales",
        fieldPath: `salesDetails.lines[${index}].seasonalityByMonth`,
        message: "Seasonality must be an array of 12 non-negative numeric monthly factors.",
        blocking: true
      }));
    }

    const hasCogs = isNumber(line.costOfGoodsSold);
    const hasMargin = isNumber(line.grossMarginPercent);
    if (!hasCogs && !hasMargin) {
      issues.push(buildIssue({
        code: "SALES_MISSING_MARGIN_OR_COGS",
        severity: RULE_SEVERITY.ERROR,
        domain: "sales",
        fieldPath: `salesDetails.lines[${index}]`,
        message: "Sales line must define COGS or gross margin basis.",
        blocking: true
      }));
    }

    if (isNumber(line.grossMarginPercent) && line.grossMarginPercent < 20) {
      issues.push(buildIssue({
        code: "SALES_LOW_MARGIN",
        severity: RULE_SEVERITY.WARNING,
        domain: "sales",
        fieldPath: `salesDetails.lines[${index}].grossMarginPercent`,
        message: "Gross margin is low for this sales line.",
        blocking: false
      }));
    }
  });

  return issues;
}

export function validateCollectionsPolicy(state) {
  const issues = [];
  const policy = state?.collectionsPolicy || {};
  const split = policy.collectionSplitByMonthBucket || [];
  const splitTotal = split.reduce((sum, value) => sum + Number(value || 0), 0);

  if (!isNumber(policy.defaultDebtorDays) || policy.defaultDebtorDays < 0) {
    issues.push(buildIssue({
      code: "COLLECTIONS_INVALID_DEBTOR_DAYS",
      severity: RULE_SEVERITY.ERROR,
      domain: "collections",
      fieldPath: "collectionsPolicy.defaultDebtorDays",
      message: "Default debtor days must be non-negative.",
      blocking: true
    }));
  }

  if (!isNumber(policy.badDebtPct) || policy.badDebtPct < 0 || policy.badDebtPct > 100) {
    issues.push(buildIssue({
      code: "COLLECTIONS_INVALID_BAD_DEBT_PCT",
      severity: RULE_SEVERITY.ERROR,
      domain: "collections",
      fieldPath: "collectionsPolicy.badDebtPct",
      message: "Bad debt percent must be between 0 and 100.",
      blocking: true
    }));
  }

  if (!Array.isArray(split) || split.length === 0 || Math.abs(splitTotal - 1) > 0.001) {
    issues.push(buildIssue({
      code: "COLLECTIONS_SPLIT_NOT_ONE",
      severity: RULE_SEVERITY.ERROR,
      domain: "collections",
      fieldPath: "collectionsPolicy.collectionSplitByMonthBucket",
      message: "Collection split must sum to 1.0 (+/- 0.001).",
      blocking: true
    }));
  }

  if (!policy.receivablesBasis) {
    issues.push(buildIssue({
      code: "COLLECTIONS_MISSING_RECEIVABLES_BASIS",
      severity: RULE_SEVERITY.ERROR,
      domain: "collections",
      fieldPath: "collectionsPolicy.receivablesBasis",
      message: "Receivables basis must be defined.",
      blocking: true
    }));
  }

  if (isNumber(policy.defaultDebtorDays) && policy.defaultDebtorDays > 60) {
    issues.push(buildIssue({
      code: "COLLECTIONS_LONG_DEBTOR_DAYS",
      severity: RULE_SEVERITY.WARNING,
      domain: "collections",
      fieldPath: "collectionsPolicy.defaultDebtorDays",
      message: "Debtor days are unusually long.",
      blocking: false
    }));
  }

  return issues;
}

export function validateYearStructures(state) {
  const issues = [];

  getYears(state).forEach(({ key, value }) => {
    const costProfile = value?.costProfile || {};
    const ownerAdjustments = value?.ownerAdjustments || {};

    if (!isNumber(costProfile.fixedMonthlyCost) || costProfile.fixedMonthlyCost < 0) {
      issues.push(buildIssue({
        code: "COSTPROFILE_INVALID_FIXED_COST",
        severity: RULE_SEVERITY.ERROR,
        domain: "costs",
        fieldPath: `years.${key}.costProfile.fixedMonthlyCost`,
        message: "Fixed monthly cost must be a non-negative number.",
        blocking: true
      }));
    }

    if (!isNumber(costProfile.variableCostPctOfRevenue) || costProfile.variableCostPctOfRevenue < 0 || costProfile.variableCostPctOfRevenue > 100) {
      issues.push(buildIssue({
        code: "COSTPROFILE_INVALID_VARIABLE_PCT",
        severity: RULE_SEVERITY.ERROR,
        domain: "costs",
        fieldPath: `years.${key}.costProfile.variableCostPctOfRevenue`,
        message: "Variable cost percent must be between 0 and 100.",
        blocking: true
      }));
    }

    if (!isNumber(costProfile.directLaborPctOfRevenue) || costProfile.directLaborPctOfRevenue < 0 || costProfile.directLaborPctOfRevenue > 100) {
      issues.push(buildIssue({
        code: "COSTPROFILE_INVALID_DIRECT_LABOR_PCT",
        severity: RULE_SEVERITY.ERROR,
        domain: "costs",
        fieldPath: `years.${key}.costProfile.directLaborPctOfRevenue`,
        message: "Direct labor percent must be between 0 and 100.",
        blocking: true
      }));
    }

    if (!ownerAdjustments.modelType) {
      issues.push(buildIssue({
        code: "OWNERADJ_MISSING_MODEL_TYPE",
        severity: RULE_SEVERITY.ERROR,
        domain: "ownerAdjustments",
        fieldPath: `years.${key}.ownerAdjustments.modelType`,
        message: "Owner adjustment model type is required.",
        blocking: true
      }));
    }

    ["ownerDrawingsMonthly", "directorSalaryMonthly", "distributionsMonthly"].forEach((field) => {
      if (!isNumber(ownerAdjustments[field]) || ownerAdjustments[field] < 0) {
        issues.push(buildIssue({
          code: "OWNERADJ_INVALID_AMOUNT",
          severity: RULE_SEVERITY.ERROR,
          domain: "ownerAdjustments",
          fieldPath: `years.${key}.ownerAdjustments.${field}`,
          message: "Owner adjustment amount must be a non-negative number.",
          blocking: true
        }));
      }
    });
  });

  return issues;
}

export function validateLoans(state) {
  const issues = [];
  const loans = state?.loans?.items || [];

  loans.forEach((loan, index) => {
    if (Number(loan.principal || 0) > 0 && (!isNumber(loan.termYears) || loan.termYears <= 0)) {
      issues.push(buildIssue({
        code: "LOAN_MISSING_TERM",
        severity: RULE_SEVERITY.ERROR,
        domain: "loans",
        fieldPath: `loans.items[${index}].termYears`,
        message: "Loan term must be greater than zero when principal is entered.",
        blocking: true
      }));
    }
  });

  return issues;
}

export function validateAssets(state) {
  const issues = [];
  const assets = state?.assets?.items || [];

  assets.forEach((asset, index) => {
    if (!isNumber(asset.usefulLifeYears) || asset.usefulLifeYears <= 0) {
      issues.push(buildIssue({
        code: "ASSET_INVALID_USEFUL_LIFE",
        severity: RULE_SEVERITY.ERROR,
        domain: "assets",
        fieldPath: `assets.items[${index}].usefulLifeYears`,
        message: "Asset useful life must be greater than zero.",
        blocking: true
      }));
    }
  });

  return issues;
}

export function validateState(state) {
  const issues = [
    ...validateSetup(state),
    ...validateSales(state),
    ...validateCollectionsPolicy(state),
    ...validateYearStructures(state),
    ...validateLoans(state),
    ...validateAssets(state)
  ];

  return {
    errors: issues.filter((issue) => issue.severity === RULE_SEVERITY.ERROR),
    warnings: issues.filter((issue) => issue.severity === RULE_SEVERITY.WARNING),
    all: issues
  };
}
