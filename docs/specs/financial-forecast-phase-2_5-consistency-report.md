# Financial Forecast Phase 2.5 Consistency Report

## 1. Executive Summary

Phase 2.5 resolved structural drift between docs, schema, and starter core files by locking one canonical model and updating all references to that model.

## 2. Pre-Fix Inconsistencies

- Domain model markdown described a competing top-level shape compared to schema/code.
- `collectionsPolicy` was referenced by validators/contracts but not present in schema.
- Year-level `costProfile` and `ownerAdjustments` were required conceptually but absent from canonical schema and starter template.
- Validation docs referenced fields not present in schema (for example older `currencyCode`, `forecastStartYear`, `termMonths`, `usefulLifeMonths` style paths).
- Owner drawings and personal-business boundary treatment was not explicit enough for implementation.

## 3. Canonical State Shape Chosen

The canonical model is now:

```text
meta
setup
years.year1|year2|year3
salesDetails
collectionsPolicy
assets
loans
personalCashFlow
derived
warnings
```

Each year contains:
- `assumptions`
- `salesForecast`
- `marketing`
- `costProfile`
- `ownerAdjustments`

## 4. Structural Changes Applied

- Rewrote `docs/specs/financial-forecast-domain-model.md` to match the schema/code shape and remove competing structure.
- Updated `docs/specs/financial-forecast-schema.json`:
  - Added top-level `collectionsPolicy`.
  - Added `setup.reportBasis`.
  - Added `years.year*.costProfile`.
  - Added `years.year*.ownerAdjustments`.
  - Added corresponding `$defs`.
- Updated defaults/enums in:
  - `docs/specs/financial-forecast-enums-and-defaults.json`
  - `apps/web/src/financial-forecast/core/enums.js`
- Updated starter template/factories in `apps/web/src/financial-forecast/core/schema.js` to include canonical domains and factory helpers.

## 5. Validator Alignment Changes

- Updated `apps/web/src/financial-forecast/core/validators.js` to reference only real schema paths.
- Added explicit validation coverage for:
  - `collectionsPolicy.*`
  - `years.year*.costProfile.*`
  - `years.year*.ownerAdjustments.*`
  - `setup.reportBasis`
- Updated `docs/specs/financial-forecast-validation-rules.md` to match canonical field paths and remove ghost-field references.

## 6. Owner Adjustment and Personal/Business Treatment

- `personalCashFlow` remains a Year 1 input domain.
- `years.year*.ownerAdjustments` is the explicit accounting treatment domain.
- Canonical treatment:
  - Sole trader: drawings as equity movement.
  - Company: director salary as expense; distributions as equity movement.
  - Hybrid: both paths allowed explicitly.
- This treatment is now represented across schema, domain model, validators, and contracts.

## 7. Remaining Assumptions for Phase 3

1. Detailed tax logic (loss carry-forward, offsets, period timing) is still an explicit Phase 3 decision.
2. Final break-even basis (cash vs accrual display priorities) remains configurable by report mode.
3. Tolerances for reconciliation thresholds will be finalized during engine implementation.
4. Personal cash flow normalization rules into owner adjustments are structurally defined, but numeric policy tuning remains Phase 3 work.
