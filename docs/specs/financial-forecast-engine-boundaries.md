# Financial Forecast Engine Boundaries

## Purpose

Define strict module boundaries, deterministic execution sequencing, and ownership of business truth so the engine remains testable, maintainable, and extensible.

## Boundary Principles

- Pure calculation modules are isolated from UI rendering concerns.
- Normalization occurs once before domain calculations.
- Warning generation occurs after domain calculations and reconciliations.
- Report shaping is separate from raw calculations.
- Internal-only modules (`debtors`, helper lookups, integrity checks) are not exposed as UI modules.

## Module Topology

1. `normalization`
2. `sales`
3. `collections`
4. `costs`
5. `marketing`
6. `loans`
7. `assets`
8. `cashFlow`
9. `profitAndLoss`
10. `balanceSheet`
11. `breakEven`
12. `quarterly`
13. `reconciliation`
14. `warnings`
15. `reportShaping`

## Module Contracts

## 1) normalization
- **Consumes:** raw scenario input state.
- **Produces:** normalized state, defaults applied, canonical timeline.
- **Notes:** this is the only module allowed to coerce/repair shapes.

## 2) sales
- **Consumes:** normalized setup, assumptions, sales lines.
- **Produces:** monthly/annual/quarterly invoiced revenue (net/gst/gross).

## 3) collections (internal-only)
- **Consumes:** sales outputs + `collectionsPolicy`.
- **Produces:** cash collection timing and receivable movements.

## 4) costs
- **Consumes:** `years.year*.costProfile`, assumptions, sales outputs.
- **Produces:** fixed, variable, merchant, and operating expense arrays.

## 5) marketing
- **Consumes:** yearly marketing plans.
- **Produces:** monthly marketing spend arrays.

## 6) loans
- **Consumes:** loan schedule inputs.
- **Produces:** payment, interest, principal, and closing liability arrays.

## 7) assets
- **Consumes:** asset register and depreciation policy.
- **Produces:** depreciation expense and net book value arrays.

## 8) cashFlow
- **Consumes:** collections, costs, marketing, financing, assets, owner adjustments.
- **Produces:** operating/financing/investing cash flows and closing cash.

## 9) profitAndLoss
- **Consumes:** revenue, cogs, opex, depreciation, interest, tax assumptions.
- **Produces:** full P&L chain through net profit after tax.

## 10) balanceSheet
- **Consumes:** closing cash, receivables, asset NBV, liabilities, retained earnings.
- **Produces:** assets, liabilities, equity and equation check base values.

## 11) breakEven
- **Consumes:** revenue/cost structures.
- **Produces:** service and product break-even thresholds.

## 12) quarterly
- **Consumes:** monthly outputs across statements.
- **Produces:** quarter rollups and quarter-end snapshots.

## 13) reconciliation (internal-only)
- **Consumes:** monthly outputs from statements.
- **Produces:** reconciliation deltas and pass/fail markers.

## 14) warnings
- **Consumes:** validation issues, reconciliation outputs, calculated metrics.
- **Produces:** user-facing warning/error set with severity and blocking flag.

## 15) reportShaping
- **Consumes:** raw calculation outputs + warnings.
- **Produces:** summary cards, tables, chart-ready payloads, export-ready payload.

## Deterministic Execution Order

```text
normalize
-> sales
-> collections
-> costs
-> marketing
-> loans
-> assets
-> cashFlow
-> profitAndLoss
-> balanceSheet
-> breakEven
-> quarterly
-> reconciliation
-> warnings
-> reportShaping
```

No module may read outputs from a downstream module.

## Purity and Side Effects

- `normalization`, `sales`, `collections`, `costs`, `marketing`, `loans`, `assets`, `cashFlow`, `profitAndLoss`, `balanceSheet`, `breakEven`, `quarterly`, and `reconciliation` are pure.
- `warnings` and `reportShaping` are deterministic transforms and should remain side-effect free.
- Persistence, telemetry, and UI notifications are orchestrator concerns outside the core engine.

## Source-of-Truth Ownership

- `sales` owns invoiced revenue truth.
- `collections` owns receipt timing and receivables movement truth.
- `cashFlow` owns liquidity truth.
- `profitAndLoss` owns profitability truth.
- `balanceSheet` owns period-end position truth.

Canonical model path ownership:
- `collectionsPolicy` owns debtor policy configuration.
- `years.year*.costProfile` owns cost-shape configuration.
- `years.year*.ownerAdjustments` owns drawings/salary/distribution configuration.

## Error Handling Boundary

- Validation errors block execution before module graph starts.
- Reconciliation failures can be blocking or warning-level based on thresholds.
- All failures are surfaced through a uniform warning/error envelope.

## Future Extension Hooks

- Add persistence adapters without changing core module signatures.
- Add API orchestration wrapper over the same execution graph.
- Add scenario comparison by running graph over multiple normalized states.
- Add PDF/export layers using `reportShaping` output only.
