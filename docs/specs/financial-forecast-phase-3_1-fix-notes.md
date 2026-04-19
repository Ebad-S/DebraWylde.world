# Financial Forecast Engine Phase 3.1 Fix Notes

## Scope

Phase 3.1 applies a targeted correctness and debug pass only. It does not introduce Phase 4 UI coupling and does not redesign the canonical model.

## Fixes Applied

### 1) Sales module now emits real line-level units and revenue series

- `calculateSales` now outputs:
  - `monthly.byLineUnits`
  - `monthly.byLineGross`
  - `monthly.byLineNet`
  - `monthly.byLineGst`
- Units are always sourced from the explicit line formula:
  - override units, or
  - `defaultUnitsPerPeriod * seasonalityByMonth[month] * growthFactor`
- Unit inference from aggregate revenue share is removed.

### 2) COGS calculation now uses true line-level drivers

- `calculateCosts` now consumes real line units (`byLineUnits`) and real line revenue (`byLineNet`).
- `costOfGoodsSold` lines are calculated as:
  - `line cost per unit * actual line units`
- `grossMarginPercent` lines are calculated as:
  - `line revenue * (1 - marginRate)`
- `variableCostPctOfRevenue` remains a distinct monthly component (`variableMonthly`) and is no longer merged into `cogsMonthly`.

### 3) GST behavior is explicitly separated by concern

- GST handling now follows one coherent decision path:
  - Invoicing GST applicability: `gstRegistration + chargeGstOnSales + line.gstApplies`
  - Profitability basis: controlled by `reportBasis`
  - Report basis mode retained as explicit context via normalized `gstPolicy`
- `chargeGstOnSales` no longer alone determines internal profitability basis.
- Gross, net, and GST components remain explicit in outputs.

### 4) Strict-mode validation stop added to orchestrator

- `runForecastEngine` now accepts execution options with `mode`:
  - `lenient` (default): existing behavior, engine continues
  - `strict`: aborts before full calculation pipeline when blocking validation errors exist
- Strict-mode returns a structured `validation_failed` payload without calculation outputs.

### 5) Numeric regression coverage expanded

Added targeted fixtures and tests for:
- Multi-line COGS correctness with different line prices/margins
- GST net/gross/GST behavior across report-basis modes
- Loan amortization month-one interest/principal/payment values
- Retained earnings roll-forward with owner distributions
- Strict-mode abort behavior on blocking validation errors

## Output Semantics Changed From Phase 3

- `sales.monthly` now includes explicit per-line unit and revenue component arrays.
- `costs.cogsMonthly` now represents explicit line-driven COGS only.
- `costs.variableMonthly` remains separate and is included downstream in operating expense/cash outflow treatment.
- Engine response now includes `status` and supports strict/lenient mode metadata.

## Remaining Non-Blocking Assumptions

- Report-basis behavior currently treats `cash_basis_view` profitability as gross view while preserving explicit GST component outputs.
- Loan amortization uses standard annuity math with monthly repayment frequency only (as defined in current canonical enums).
