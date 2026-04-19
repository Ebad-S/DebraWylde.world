# Financial Forecast Calculation Contract

## 1. Executive Summary

This contract defines deterministic, implementation-grade calculation behavior for the financial forecast engine. It replaces spreadsheet coupling with explicit domain modules, clear input/output contracts, and reconciliation checks.

## 2. Normalization Stage

Before any calculations:
- Apply defaults for missing optional fields.
- Validate required fields and ranges.
- Normalize all percentages to decimal form internally (`pct / 100`).
- Build canonical timeline (`Y1-M1` through `Y3-M12`).
- Resolve per-year assumptions and per-line overrides.
- Tag every normalized value with provenance (`input`, `default`, `override`, `assumption`).

Output:
- `NormalizedModel` object consumed by all downstream modules.

## 3. Setup and Global Assumptions

Inputs:
- `setup.*` metadata (`startMonth`, `tradingStructure`, GST posture, `openingCash`, `reportBasis`).
- `years.year*.assumptions.*` (`growthPct`, `cpiPct`, `gstRatePct`, `taxRatePct`).
- `collectionsPolicy.*` for debtor defaults and receivables basis.

Outputs:
- `AssumptionContextByYear`
- `OpeningState` (cash, receivables, equity)

Assumptions:
- Forecast horizon defaults to 3 years.
- Assumption lookup uses `yearIndex` first, fallback to previous year if explicitly enabled.

## 4. Sales Line and Revenue Generation

Inputs:
- Active sales lines.
- `salesDetails.lines[*]` price, `defaultUnitsPerPeriod`, `seasonalityByMonth`, margin/COGS, payment behavior, GST applicability.
- `years.year*.salesForecast.lineOverrides[*]` unit overrides.
- `years.year*.assumptions.*` growth/CPI/tax context.

Core formulas:

```text
monthlyUnits =
  explicitMonthlyUnitsOverride
  OR (defaultUnitsPerPeriod * seasonalityFactor * growthUnitsFactor)

monthlyRevenueGross = monthlyUnits * effectiveUnitPrice
```

GST split (when line is GST-applicable and model uses GST-exclusive operating basis):

```text
monthlyRevenueNet = monthlyRevenueGross / (1 + gstRate)
monthlyRevenueGst = monthlyRevenueGross - monthlyRevenueNet
```

Growth/CPI default policy:
- `growthPct` affects units YoY unless overridden by line policy.
- CPI does not alter revenue unless line config explicitly enables price indexation.

Outputs:
- Monthly revenue arrays: net, gst, gross.
- Annual and quarterly rollups.

## 5. Debtors / Collection Timing

Inputs:
- Invoiced revenue by month.
- `collectionsPolicy.collectionSplitByMonthBucket` (e.g. `[0.7, 0.2, 0.1]`).
- `collectionsPolicy.badDebtPct` or explicit bad-debt events.
- `collectionsPolicy.openingReceivables`.
- `collectionsPolicy.receivablesBasis`.

Formula:

```text
cashCollected[M] = sum(invoicedRevenue[M-k] * split[k]) for k in bucket range

closingReceivables[M] =
  openingReceivables[M]
  + invoicedRevenueBasis[M]
  - cashCollected[M]
  - badDebtWrittenOff[M]
```

Contract requirement:
- Must explicitly state whether receivables are tracked gross or net of GST; this basis is immutable per scenario.

Outputs:
- `cashCollectionsMonthly`
- `receivablesOpeningMonthly`
- `receivablesClosingMonthly`

## 6. Cost Structure and Margin Logic

Inputs:
- `years.year*.costProfile.fixedMonthlyCost`.
- `years.year*.costProfile.variableCostPctOfRevenue`.
- `years.year*.costProfile.directLaborPctOfRevenue`.
- `years.year*.costProfile.otherOperatingExpenseMonthly`.
- COGS basis (explicit COGS vs gross margin).
- Merchant fee rates and payment method behavior.

Formulas:

```text
variableCost = revenueNet * variableCostRate
merchantFees = feeEligibleRevenueGrossOrNet * merchantFeeRate
grossProfit = revenueNet - cogs
```

Ordering:
1. Determine revenue basis (net/gross).
2. Apply COGS or infer from gross margin (never both without precedence rule).
3. Apply merchant fees per fee basis.
4. Aggregate operating costs.

Outputs:
- `cogsMonthly`
- `operatingExpensesMonthly`
- `grossProfitMonthly`

## 7. Marketing Spend Logic

Inputs:
- `years.year*.marketing.lineItems[*]`.
- Monthly allocation ranges.
- One-off vs recurring flags.

Rules:
- One-off line contributes only in its configured period.
- Recurring line contributes in each month in active range.
- Optional CPI uplift applies at year boundary only if enabled.

Outputs:
- `marketingMonthly` and yearly totals.

## 8. Loan Amortization Logic

Inputs:
- Principal, interest rate, term, drawdown month, repayment start, frequency.

Monthly repayment (standard amortization):

```text
r = annualRate / 12
n = termYears * 12
payment = principal * r / (1 - (1 + r)^(-n))   (if r > 0)
payment = principal / n                          (if r == 0)
```

Per period:
- `interest = openingBalance * r`
- `principal = payment - interest`
- `closingBalance = openingBalance - principal`

Outputs:
- `interestMonthly`, `principalMonthly`, `loanClosingMonthly`.

## 9. Asset Depreciation Logic

Inputs:
- Asset register with purchase timing, useful life, residual, method.

Default method: straight-line.

```text
depreciableBase = purchaseValue - residualValue
monthlyDepreciation = depreciableBase / usefulLifeMonths
```

Outputs:
- `depreciationMonthly`
- `assetNBVMonthly`

## 10. Cash Flow Logic

Inputs:
- Opening cash.
- Collections.
- Operating outflows.
- Financing and investing flows.
- Owner adjustments (`years.year*.ownerAdjustments`) after normalization.

Formula:

```text
netOperating = cashInOperating - cashOutOperating
netCash = netOperating + netFinancing + netInvesting
closingCash = openingCash + netCash
```

Outputs:
- Monthly cash flow sections and year summaries.

## 11. Profit & Loss Logic

P&L must include:
- Revenue
- COGS
- Gross profit
- Operating expenses
- EBITDA
- Depreciation
- Interest
- Net profit before tax
- Tax
- Net profit after tax

Formula chain:

```text
grossProfit = revenueNet - cogs
ebitda = grossProfit - operatingExpensesExclDepreciation
netProfitBeforeTax = ebitda - depreciation - interest
tax = max(netProfitBeforeTax, 0) * taxRate (when enabled)
netProfitAfterTax = netProfitBeforeTax - tax
```

## 12. Balance Sheet Logic

Composition:
- Assets: cash, receivables, asset NBV, optional other assets.
- Liabilities: loan balances, optional payables, optional tax/GST liabilities.
- Equity: opening capital + retained earnings - drawings/distributions.

Retained earnings:

```text
retainedEarnings =
  cumulativeNetProfitAfterTax
  - ownerDrawings
  - distributions
```

Integrity:
- `assets == liabilities + equity` within tolerance.

## 13. Break-even Logic

Service and product break-even models share a common approach:

```text
contributionMarginRatio = (revenue - variableCosts) / revenue
breakEvenRevenue = fixedCosts / contributionMarginRatio
```

Contract:
- Explicitly declare cash-basis or accrual-basis interpretation (default: accrual for P&L, cash view shown separately).

## 14. Quarterly Rollup Logic

Rules:
- Quarter sums monthly flow metrics (revenue, expenses, profit, net cash).
- Quarter-end snapshots for position metrics (cash closing, receivables closing, liabilities).
- Rollup method is deterministic and format-independent.

## 15. Warning Generation

Warning domains:
- Validation warnings (pre-calc)
- Calculation warnings (post-calc)
- Integrity warnings (reconciliation failures)

Examples:
- Negative closing cash.
- Long debtor days.
- Margin below threshold.
- Balance equation mismatch.

Severity:
- `info`, `warning`, `critical`.

## 16. Calculation Order and Purity

Execution order:
1. Normalize inputs
2. Generate revenue
3. Apply collections
4. Build costs/marketing
5. Build financing
6. Build depreciation
7. Build cash flow
8. Build P&L
9. Build balance sheet
10. Build break-even
11. Build quarterly rollups
12. Generate warnings + reconciliation flags

Purity requirement:
- Core domain functions must be pure (`input -> output`, no hidden state mutations).

## 17. Assumptions Requiring Confirmation

1. Receivables tracked net vs gross of GST.
2. Tax calculation detail (carry-forward losses, offsets, timing).
3. Break-even methodology basis for advisory reporting.
4. Personal cash flow boundaries and drawings treatment.
5. Any workbook areas requiring inferred behavior due to broken references.

## Modeling Decisions (Locked)

- **Receivables timing algorithm:** bucketed monthly collection profile.
- **GST/tax treatment:** GST tracked separately; profitability on GST-exclusive basis; income tax at net profit before tax stage.
- **Loan amortization:** standard amortization with monthly periodicity baseline.
- **Depreciation:** straight-line default.
- **Balance reconciliation:** enforced equation checks with warning/block thresholds.
- **Revenue generation method:** explicit monthly units and revenue formula with documented growth order.
- **Statement source of truth:** Sales Forecast (invoiced revenue), Collections (timing + receivables), Cash Flow (liquidity), P&L (profitability), Balance Sheet (position).
