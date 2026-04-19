# Financial Forecast Workbook Risk Register

## Defects and Migration Risks

| ID | Risk | Severity | Confidence | Impact | Recommendation |
|---|---|---|---|---|---|
| R1 | Broken formula references in key calculation sheets | High | High | Incorrect totals in cash flow/P&L/balance outputs | Rebuild formulas as explicit domain functions; add unit tests for every major statement line |
| R2 | Name Manager corruption/missing named ranges | High | High | Silent formula failures and hard-to-trace errors | Replace named-range coupling with typed data model fields and constants |
| R3 | Year-sheet drift (Y2/Y3 formulas no longer matching Y1 intent) | High | Medium | Inconsistent forecasts between years | Generate yearly projections from one reusable engine and a per-year config object |
| R4 | Mixed hard-coded values and formulas | High | Medium | Hidden overrides cause non-repeatable results | Audit all constants and force provenance labels (input, derived, override) |
| R5 | Debtors timing logic ambiguity | High | Medium | Cash collection timing can be materially wrong | Validate with stakeholder examples and lock a single receivables timing algorithm |
| R6 | Balance sheet balancing adjustments may include manual plugs | High | Low | Statement integrity risk and false confidence | Enforce equation checks (`assets = liabilities + equity`) and block publish on failure |
| R7 | Internal support sheets leaking into user workflow | Medium | High | Poor UX and fragile app structure | Keep helper sheets (`Table2`, `Debtors Analysis`) as internal engine only |
| R8 | Break-even methodology unclear (cash vs accrual) | Medium | Medium | Misleading decision support output | Define and document one methodology with explicit formulas and assumptions |
| R9 | Tax/GST treatment may vary by row/domain | Medium | Medium | Misstated net/gross results | Model tax profile per input domain and apply consistent calculation functions |
| R10 | Personal vs business cash-flow boundary unclear | Medium | Medium | Distorted owner and business performance results | Introduce explicit classification rules and mapping in data model |
| R11 | Hidden workbook dependencies not obvious from UI sheets | Medium | Low | Migration gaps if dependencies are missed | Build dependency graph tests and reconciliation checks by domain |
| R12 | External/broken links in workbook chain | Low | Medium | Missing lookups in edge cases | Remove all external dependencies; embed required lookup data in app config |

## Top Risks to Resolve Before Phase 2 Build

1. Revenue-to-cash conversion rules (debtors timing and bad-debt assumptions).
2. Tax/GST handling consistency across income and expense domains.
3. Statement integrity logic (P&L to balance sheet linkage and balancing checks).
4. Source of truth for year-over-year assumption carry-forward.

## Required Safeguards in Web App

- Calculation snapshots and regression test fixtures from known workbook scenarios.
- Domain-level validation errors shown to users before report rendering.
- Deterministic ordering of calculations (no circular or implicit dependencies).
- Reconciliation assertions:
  - Cash movement reconciliation
  - Receivable movement reconciliation
  - Balance sheet equation check
