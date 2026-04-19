# Financial Forecast Domain Model (Phase 2.5 Canonical)

This file is the single canonical model description for Phase 2.5.  
It intentionally aligns to `docs/specs/financial-forecast-schema.json` and `apps/web/src/financial-forecast/core/schema.js`.

## 1. Executive Summary

One state shape is used across docs, schema, and starter core files. The model is monthly-first, year-aware, deterministic, and explicit about collections, costs, and owner adjustments.

## 2. Canonical Top-Level State Shape

```json
{
  "meta": {},
  "setup": {},
  "years": {
    "year1": {},
    "year2": {},
    "year3": {}
  },
  "salesDetails": { "lines": [] },
  "collectionsPolicy": {},
  "assets": { "items": [] },
  "loans": { "items": [] },
  "personalCashFlow": { "year1Only": true, "items": [] },
  "derived": {},
  "warnings": []
}
```

Required top-level domains:
- `meta`
- `setup`
- `years`
- `salesDetails`
- `collectionsPolicy`
- `assets`
- `loans`
- `personalCashFlow`
- `derived`
- `warnings`

## 3. Meta Domain

Fields:
- `appVersion`
- `schemaVersion`
- `createdAt`
- `updatedAt`
- `forecastHorizonYears`
- `currency`

## 4. Setup Domain

Fields:
- `businessName`
- `startMonth`
- `tradingStructure`
- `gstRegistration`
- `chargeGstOnSales`
- `basFrequency`
- `openingCash`
- `reportBasis` (`cash_basis_view | accrual_basis_view | dual_view`)

## 5. Year-Aware Domain Structure

Each year (`year1`, `year2`, `year3`) contains:
- `assumptions`
- `salesForecast`
- `marketing`
- `costProfile`
- `ownerAdjustments`

### 5.1 assumptions

Fields:
- `growthPct`
- `cpiPct`
- `taxRatePct`
- `gstRatePct`

### 5.2 salesForecast

Fields:
- `lineOverrides[]` with:
  - `salesLineId`
  - `monthIndex`
  - `unitsOverride`

### 5.3 marketing

Fields:
- `lineItems[]` with:
  - `id`
  - `name`
  - `monthlyAmount`
  - `startMonth`
  - `endMonth`
  - `isOneOff`

### 5.4 costProfile

Fields:
- `fixedMonthlyCost`
- `variableCostPctOfRevenue`
- `directLaborPctOfRevenue`
- `otherOperatingExpenseMonthly`

### 5.5 ownerAdjustments

Fields:
- `modelType` (`sole_trader_drawings | company_salary_and_distributions | hybrid`)
- `ownerDrawingsMonthly`
- `directorSalaryMonthly`
- `distributionsMonthly`
- `notes`

## 6. Sales Details Domain

`salesDetails.lines[]` fields:
- `id`
- `name`
- `type`
- `unitPrice`
- `defaultUnitsPerPeriod`
- `seasonalityByMonth` (12 monthly factors)
- `costOfGoodsSold`
- `grossMarginPercent`
- `paymentMethod`
- `merchantFeePercent`
- `collectionProfile`
- `gstApplies`
- `isActive`

## 7. Collections Policy Domain

`collectionsPolicy` fields:
- `defaultDebtorDays`
- `badDebtPct`
- `collectionSplitByMonthBucket`
- `receivablesBasis` (`gross | net`)
- `openingReceivables`

This location is canonical for collections behavior; validators and contracts reference this same path.

## 8. Assets, Loans, and Personal Cash Flow Domains

### 8.1 assets
- `assets.items[]` with asset metadata and depreciation fields.

### 8.2 loans
- `loans.items[]` with principal/rate/term/timing fields.

### 8.3 personalCashFlow
- `year1Only`
- `items[]` for personal/business allocation inputs.

Personal cash flow is retained as a direct Year 1 input domain and interpreted into `years.year1.ownerAdjustments` during normalization.

## 9. Owner Drawings and Personal-Business Boundary Model

Canonical treatment:
- `personalCashFlow` captures raw owner/personal inputs.
- `years.yearN.ownerAdjustments` captures normalized accounting treatment.

Model rules:
- **Sole trader**: owner withdrawals are treated as drawings (equity movement, not operating expense).
- **Company**: director salary/wages are expense (P&L impact), distributions are equity movement.
- **Hybrid**: both salary and drawings/distributions may apply, explicitly captured.

Retained earnings reference:

```text
retainedEarnings =
  cumulativeNetProfitAfterTax
  - ownerDrawingsMonthly
  - distributionsMonthly
```

## 10. Derived and Warning Domains

### 10.1 derived

```json
{
  "monthly": {},
  "annual": {},
  "quarterly": {},
  "summaryCards": {},
  "charts": {}
}
```

### 10.2 warnings

`warnings[]` object fields:
- `code`
- `severity`
- `domain`
- `message`
- `blocking`
- `year`

## 11. Revenue, GST, Collections, and Statement Source of Truth

Revenue generation:
- Computed from sales lines + year assumptions + line overrides.
- Growth/order behavior defined in calculation contract.

GST and tax treatment:
- Profitability view is GST-exclusive.
- GST components tracked separately for reporting/collections.
- Income tax modeled at net-profit-before-tax stage when enabled.

Collections and receivables:
- `collectionsPolicy.collectionSplitByMonthBucket` controls invoice-to-cash timing.
- Receivables basis (`gross` or `net`) is explicit and consistent per scenario.

Statement source of truth:
- Sales Forecast -> invoiced revenue
- Collections -> cash timing + receivables movement
- Cash Flow -> liquidity + closing cash
- Profit & Loss -> profitability
- Balance Sheet -> period-end financial position

## 12. Naming Convention and Consistency Rules

- Use `camelCase` for field names.
- Use `years.year1|year2|year3` (not competing year array patterns).
- Use one location per domain (no duplicate parallel structures).
- Validation paths must point to real schema paths only.