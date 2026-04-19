# Financial Forecast Workbook Audit (Phase 1)

## 1. Executive Summary

This workbook is a multi-sheet financial planning model that combines business setup, revenue planning, operating costs, cash flow, profitability, and balance sheet outputs over a 3-year horizon.

The model can be migrated into a web app, but the spreadsheet should be treated as a **logic source** rather than a UI source. Several defects were already noted (broken links, formula issues, Name Manager problems), so migration should prioritize intended business behavior and explicit domain rules over direct formula cloning.

Minimum viable Phase 2 calculation engine domains:
- Business setup and global assumptions
- Sales and collections timing
- Operating cost planning (including marketing)
- Loan amortization and repayments
- Asset depreciation
- Cash flow (monthly and yearly rollups)
- Profit and loss statements
- Balance sheet statements
- Break-even and quarterly reporting

## 2. Workbook Inventory

Detected/expected sheet set (in business flow order):
1. Set Up Details
2. Personal Cash Flow Budget Y1
3. Assets and Depreciation
4. Business Loans
5. Marketing Action Plan Year 1
6. Marketing Action Plan Year 2
7. Marketing Action Plan Year 3
8. Sales Details
9. Sales Forecast Year 1
10. Sales Forecast Year 2
11. Sales Forecast Year 3
12. Cash Flow Year 1
13. Cash Flow Year 2
14. Cash Flow Year 3
15. Profit & Loss Statements
16. Balance Sheets
17. Key Assumptions Year 1
18. Key Assumptions Year 2
19. Key Assumptions Year 3
20. Breakeven Analysis - Service
21. Breakeven Analysis - Product
22. Quarterly Results
23. Tables and Calculations
24. Table2
25. Debtors Analysis

## 3. Sheet Classification Table

| Sheet | Classification | User Facing | Migration Role | Year Scope | Notes |
|---|---|---:|---|---|---|
| Set Up Details | input | Yes | form_module | multi-year | Global setup and business identity parameters |
| Personal Cash Flow Budget Y1 | mixed | Yes | form_module | year1 | Personal/business boundary assumptions |
| Assets and Depreciation | mixed | Yes | form_module | multi-year | Input table plus derived depreciation logic |
| Business Loans | mixed | Yes | form_module | multi-year | Loan inputs with amortization outputs |
| Marketing Action Plan Year 1 | input | Yes | form_module | year1 | Marketing spend and campaign assumptions |
| Marketing Action Plan Year 2 | input | Yes | form_module | year2 | Repeated year module candidate |
| Marketing Action Plan Year 3 | input | Yes | form_module | year3 | Repeated year module candidate |
| Sales Details | input | Yes | form_module | multi-year | Product/service pricing and quantity assumptions |
| Sales Forecast Year 1 | mixed | Yes | form_module | year1 | Monthly forecast + derived totals |
| Sales Forecast Year 2 | mixed | Yes | form_module | year2 | Repeated year module candidate |
| Sales Forecast Year 3 | mixed | Yes | form_module | year3 | Repeated year module candidate |
| Cash Flow Year 1 | output | Yes | report_module | year1 | Major reporting layer fed by upstream domains |
| Cash Flow Year 2 | output | Yes | report_module | year2 | Repeated year module candidate |
| Cash Flow Year 3 | output | Yes | report_module | year3 | Repeated year module candidate |
| Profit & Loss Statements | output | Yes | report_module | multi-year | Consolidated profitability summary |
| Balance Sheets | output | Yes | report_module | multi-year | Asset/liability/equity statement |
| Key Assumptions Year 1 | input | Yes | form_module | year1 | Taxes, CPI, inflation, and model toggles |
| Key Assumptions Year 2 | input | Yes | form_module | year2 | Repeated year module candidate |
| Key Assumptions Year 3 | input | Yes | form_module | year3 | Repeated year module candidate |
| Breakeven Analysis - Service | output | Yes | report_module | multi-year | Service break-even output view |
| Breakeven Analysis - Product | output | Yes | report_module | multi-year | Product break-even output view |
| Quarterly Results | output | Yes | report_module | multi-year | Quarter-level rollups and summary reporting |
| Tables and Calculations | calculation | No | internal_engine_only | multi-year | Support calculations and lookup logic |
| Table2 | reference | No | internal_engine_only | n/a | Internal supporting table; non-UI |
| Debtors Analysis | calculation | No | internal_engine_only | multi-year | Collection timing and receivables engine |

## 4. Business-Critical Calculation Flow

Primary flow:
1. `Set Up Details` defines global settings (timing, tax posture, setup assumptions).
2. `Sales Details` defines product/service assumptions.
3. `Sales Forecast Year N` generates monthly revenue and related variable components.
4. `Debtors Analysis` applies collection timing assumptions to convert booked revenue to cash receipts.
5. `Marketing Action Plan Year N`, `Personal Cash Flow Budget Y1`, `Business Loans`, `Assets and Depreciation`, and `Key Assumptions Year N` provide operating and financing drivers.
6. `Cash Flow Year N` combines receipts, expenses, debt servicing, and other cash movements.
7. `Profit & Loss Statements` computes accrual-based profitability.
8. `Balance Sheets` computes period position (assets, liabilities, equity).
9. `Quarterly Results` and `Breakeven` sheets provide management summary layers.

Support flow:
- `Tables and Calculations` and `Table2` provide references/derived values used by core sheets.

## 5. Input Domain Catalog

### Business setup
- Entity and business metadata
- Model start date and horizon controls
- Tax/GST registration switches

### Revenue model inputs
- Product/service lines
- Unit prices and quantities
- Sales frequency and seasonality assumptions
- GST treatment by revenue category

### Collections and receivables
- Debtor terms (days to collect)
- Collection distribution assumptions by period
- Potential bad debt provisions (if represented)

### Cost and operations
- Fixed operating expenses
- Variable cost rates (COGS, merchant fees, commission)
- Personal-to-business cost boundaries

### Marketing
- Campaign-level spending by year
- Timing and category allocations
- Growth/investment assumptions

### Financing and assets
- Loan principal, interest, term, repayment frequency
- Asset purchases, useful life, depreciation basis
- Opening balances where applicable

### Global assumptions
- CPI/inflation uplift
- Tax assumptions
- Manual override inputs in key assumptions sheets

## 6. Output and Summary Catalog

Business outputs expected from the model:
- Monthly and annual sales totals
- Cash collections (vs invoiced sales)
- Monthly and annual net cash movement
- Cash closing balance per period
- Gross profit and net profit measures
- EBITDA/operating profit style indicators (where defined)
- Balance sheet line groups: cash, receivables, assets, liabilities, equity
- Break-even volume/revenue thresholds (service and product views)
- Quarterly rollups for management reporting

## 7. Cross-Sheet Dependency Map

High-level dependency graph:
- `Set Up Details` -> `Sales Details`, `Key Assumptions Year N`, `Sales Forecast Year N`
- `Sales Details` -> `Sales Forecast Year N`
- `Sales Forecast Year N` -> `Debtors Analysis`, `Cash Flow Year N`, `Profit & Loss Statements`
- `Debtors Analysis` -> `Cash Flow Year N`, `Balance Sheets`
- `Marketing Action Plan Year N` -> `Cash Flow Year N`, `Profit & Loss Statements`
- `Business Loans` -> `Cash Flow Year N`, `Balance Sheets`, `Profit & Loss Statements`
- `Assets and Depreciation` -> `Profit & Loss Statements`, `Balance Sheets`
- `Personal Cash Flow Budget Y1` -> `Cash Flow Year 1` (and possibly assumptions for later years)
- `Key Assumptions Year N` -> multiple forecast/cash/profit sheets
- `Cash Flow Year N` + `Profit & Loss Statements` -> `Quarterly Results`
- `Tables and Calculations` + `Table2` -> multiple sheets as internal references

## 8. Major Calculation Patterns

Recurring logic patterns that should become code modules:
- GST split and net/gross conversion
- Revenue to cash timing (debtor lag)
- COGS and variable expense rates against revenue
- Merchant/transaction fee percentages
- Loan amortization (interest/principal split)
- Depreciation schedules by asset class
- CPI/inflation uplifts year-over-year
- Quarter aggregation from monthly values
- Opening -> movement -> closing balance rolls

## 9. Defects and Broken Logic

Known and probable defect classes:
- Broken references from named ranges or moved cells
- Name Manager entries that no longer resolve
- Mixed hard-coded values and formulas in repeating blocks
- Inconsistent year-sheet formulas (Y2/Y3 not aligned with Y1 pattern)
- Potential circular references in summary layers
- External/broken links where lookup tables were changed
- Reporting totals referencing presentation cells rather than canonical calculation cells

Impact:
- Some outputs are likely trustworthy only as directional.
- Migration must include explicit formula-by-domain validation tests.

## 10. Inferred Intended Behavior

When formulas are broken, intended behavior should be inferred with confidence labels:

- **High confidence:** Year 2/3 sheets are patterned extensions of Year 1 logic with changed assumptions.
- **High confidence:** Debtors analysis transforms invoiced sales into cash receipt timing.
- **Medium confidence:** Personal cash flow entries feed business owner drawings/cash adjustments.
- **Medium confidence:** Tables and Calculations centralizes reusable lookups and bridge formulas.
- **Low confidence:** Certain balancing adjustments in balance sheet may be manual plugs if formulas are broken.

## 11. Recommended Migration Strategy

Recommended module boundaries:
- `form_module`: setup, sales details, marketing plans, key assumptions, assets, loans
- `report_module`: cash flow statements, P&L, balance sheet, break-even, quarterly summaries
- `internal_engine_only`: debtors timing, table lookups, helper calculations (`Table2`, `Debtors Analysis`, `Tables and Calculations`)
- `later_phase_optional`: any workbook features that are presentational-only or low-value one-off tables

Implementation guidance:
- Build shared year-aware components (Year N config) rather than duplicating Year 1/2/3 codepaths.
- Treat all internal calculation sheets as non-UI engine logic.
- Use domain-level formulas in code with traceable unit tests.
- Preserve outputs that matter to user decisions, not spreadsheet layout.

## 12. Open Questions and Unknowns

Questions to resolve before full implementation:
1. Exact tax treatment rules (GST/BAS, income tax assumptions, timing).
2. Whether inventory accounting is represented or if the model is service-heavy.
3. Treatment of owner drawings and personal cash movement in final reporting.
4. Source of truth when sheet totals disagree due to broken references.
5. Whether break-even views use contribution margin, cash basis, or accrual basis.
6. Final confidence thresholds for accepting inferred formulas vs requiring stakeholder confirmation.

---

Phase 1 conclusion: the workbook can be migrated to a clean web architecture with high confidence if the app is built as a domain-driven calculation engine with reusable yearly modules and a strong validation suite for known defect areas.