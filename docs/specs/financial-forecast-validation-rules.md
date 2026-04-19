# Financial Forecast Validation Rules

## 1. Validation Philosophy

Validation is domain-first and deterministic:
- Prevent invalid financial states from entering the engine.
- Allow non-blocking warnings for risky but plausible inputs.
- Keep all rule outcomes machine-readable and explainable to users.

## 2. Blocking Errors vs Warnings

- **Blocking error:** calculation cannot proceed safely.
- **Warning:** calculation can proceed, but result quality/risk is flagged.

Rule output shape:

```json
{
  "code": "string",
  "severity": "error|warning",
  "domain": "string",
  "fieldPath": "string",
  "message": "string",
  "blocking": true
}
```

## 3. Setup Rules (`setup.*`)

Blocking:
- `setup.businessName` required.
- `setup.openingCash` must be numeric.
- `setup.reportBasis` required.

Warnings:
- `setup.openingCash` below configured minimum threshold.

## 4. Sales Rules

Blocking:
- Sales line must have `name`, `type`, and `unitPrice >= 0`.
- `salesDetails.lines[*].defaultUnitsPerPeriod >= 0`.
- `salesDetails.lines[*].seasonalityByMonth` must contain 12 non-negative monthly factors.
- Sales line must define either COGS basis or gross-margin basis (with precedence rule if both supplied).
- `gstApplies` required boolean.

Warnings:
- Unit price of zero on active sales line.
- Gross margin below threshold.
- Merchant fee unusually high.

## 5. Collections Rules (`collectionsPolicy.*`)

Blocking:
- `collectionsPolicy.defaultDebtorDays >= 0`.
- `collectionsPolicy.collectionSplitByMonthBucket` required and sums to `1.0 +/- tolerance`.
- `collectionsPolicy.badDebtPct` must be within `0..100`.
- `collectionsPolicy.receivablesBasis` required.

Warnings:
- `collectionsPolicy.defaultDebtorDays` above advisory threshold.
- `collectionsPolicy.badDebtPct` above advisory threshold.

## 6. Cost and Marketing Rules (`years.year*.costProfile`, `years.year*.marketing`)

Blocking:
- `years.year*.costProfile.fixedMonthlyCost` non-negative.
- `years.year*.costProfile.variableCostPctOfRevenue` in `0..100`.
- `years.year*.costProfile.directLaborPctOfRevenue` in `0..100`.
- `years.year*.costProfile.otherOperatingExpenseMonthly` non-negative.
- `years.year*.marketing.lineItems[*].startMonth <= endMonth`.

Warnings:
- Sustained marketing spend above revenue for configured duration.
- Fixed costs exceed configured revenue coverage thresholds.

## 6.1 Owner Adjustment Rules (`years.year*.ownerAdjustments`)

Blocking:
- `years.year*.ownerAdjustments.modelType` required.
- `ownerDrawingsMonthly`, `directorSalaryMonthly`, and `distributionsMonthly` must be non-negative.

Warnings:
- Company structure with high drawings and zero salary/director wage.
- Sole trader structure with high salary and no drawings (review flag).

## 7. Loan Rules

Blocking:
- If `loans.items[*].principal > 0`, term and interest rate must be present.
- `loans.items[*].termYears > 0`.
- `loans.items[*].annualInterestRate` in `0..100`.
- `loans.items[*].drawdownMonthIndex` and `repaymentStartMonthIndex` must be valid timeline periods.

Warnings:
- Loan repayment ratio exceeds affordability threshold.
- Very high effective annual rate.

## 8. Asset Rules

Blocking:
- `assets.items[*].purchaseAmount >= 0`.
- `assets.items[*].usefulLifeYears > 0`.
- `assets.items[*].depreciationMethod` must be supported enum.
- `assets.items[*].residualValue <= assets.items[*].purchaseAmount`.

Warnings:
- Useful life outside normal range by category.

## 9. Tax/GST Rules

Blocking:
- `years.year*.assumptions.gstRatePct` and `years.year*.assumptions.taxRatePct` in `0..100`.
- If GST mode is registered, GST rate must be present.
- GST-applicable lines must emit net/gst/gross components.

Warnings:
- Mixed GST applicability patterns that likely reflect input mistakes.
- Tax disabled with positive profits across all periods (review flag).

## 10. Statement Integrity Rules

Blocking:
- Balance sheet equation failure above configured hard threshold.
- Cash roll-forward mismatch above tolerance.

Warnings:
- Balance equation mismatch within warning tolerance.
- Receivables roll-forward mismatch within warning tolerance.
- Negative closing cash.

## 11. Summary/Export Readiness Rules

Blocking:
- Any unresolved blocking errors in dependent domains.
- Missing summary outputs required by reporting contract.

Warnings:
- Critical warnings present at export time.

## Rule Configuration Defaults

```json
{
  "tolerance": {
    "collectionSplit": 0.001,
    "reconciliationAmount": 0.5
  },
  "thresholds": {
    "highMerchantFeePct": 5.0,
    "longDebtorDays": 60,
    "lowGrossMarginPct": 20
  }
}
```

## Error and Warning Catalog (Starter)

- `SETUP_MISSING_BUSINESS_NAME` (error)
- `SETUP_INVALID_CURRENCY` (error)
- `SALES_MISSING_MARGIN_OR_COGS` (error)
- `SALES_LOW_MARGIN` (warning)
- `COLLECTIONS_SPLIT_NOT_ONE` (error)
- `COLLECTIONS_LONG_DEBTOR_DAYS` (warning)
- `COSTPROFILE_INVALID_FIXED_COST` (error)
- `COSTPROFILE_INVALID_VARIABLE_PCT` (error)
- `OWNERADJ_MISSING_MODEL_TYPE` (error)
- `OWNERADJ_INVALID_AMOUNT` (error)
- `LOAN_MISSING_TERM` (error)
- `ASSET_INVALID_USEFUL_LIFE` (error)
- `TAX_INVALID_RATE` (error)
- `CASHFLOW_NEGATIVE_CLOSING` (warning)
- `BALANCE_NOT_BALANCED` (error/warning by tolerance)
