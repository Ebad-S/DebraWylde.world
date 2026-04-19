# Financial Forecast Phase 3 Engine Notes

## What Was Implemented

Phase 3 delivered a pure calculation engine with deterministic pipeline orchestration and test fixtures.

Implemented modules:
- `normalize.js`
- `timeline.js`
- `sales.js`
- `collections.js`
- `costs.js`
- `marketing.js`
- `owner-adjustments.js`
- `loans.js`
- `assets.js`
- `cashflow.js`
- `profit-loss.js`
- `balance-sheet.js`
- `break-even.js`
- `quarterly.js`
- `reconciliation.js`
- `warnings.js`
- `report-shaping.js`
- `index.js` orchestrator

## Finalized Formula Baselines

- Sales:
  - `monthlyUnits = override OR (defaultUnitsPerPeriod * seasonalityFactor * growthFactor)`
  - `monthlyRevenueGross = monthlyUnits * unitPrice`
  - If GST applies and GST-exclusive reporting is active, derive net and GST components.
- Collections:
  - Bucketed split across current and future buckets.
  - Receivables roll-forward uses opening + invoiced - collected - bad debt.
- Costs:
  - Variable costs from year cost profile.
  - COGS from line COGS or gross-margin fallback.
  - Merchant fees from line revenue and fee rate.
- Loans:
  - Standard amortization with zero-rate branch.
- Assets:
  - Straight-line depreciation with purchase timing and residual floor.
- P&L:
  - Revenue -> COGS -> gross profit -> operating expenses -> EBITDA -> depreciation/interest -> tax -> net profit after tax.
- Balance sheet:
  - Assets = cash + receivables + asset NBV
  - Liabilities = loan balances (current model)
  - Equity = opening equity + retained earnings (after drawings/distributions)

## Reconciliation and Warnings

Implemented:
- Cash roll-forward reconciliation.
- Receivables roll-forward reconciliation.
- Balance equation reconciliation.
- Structured warnings for validation + reconciliation + model condition flags.

## Remaining Configurable Assumptions

- Detailed tax logic remains a baseline model (no advanced loss carry-forward yet).
- Break-even segmentation can be refined further with direct line-level variable-cost mapping.
- Additional liabilities (payables, tax liabilities) can be added in future extensions.

## Test Harness

Fixtures added for:
- minimal valid scenario
- service-led scenario
- product-led scenario
- sole trader drawings scenario
- company salary/distribution scenario

Regression tests verify:
- deterministic outputs
- warning behavior (negative cash, long debtor days, low margin)
- collections split validation
- reconciliation output structure
