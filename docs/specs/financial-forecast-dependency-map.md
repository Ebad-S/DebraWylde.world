# Financial Forecast Dependency Map

## Domain-Level Flow

```text
Set Up Details
  -> Sales Details
  -> Key Assumptions (Y1/Y2/Y3)
  -> Business Loans
  -> Assets and Depreciation

Sales Details
  -> Sales Forecast Year 1/2/3

Sales Forecast Year 1/2/3
  -> Debtors Analysis
  -> Cash Flow Year 1/2/3
  -> Profit & Loss Statements

Debtors Analysis
  -> Cash Flow Year 1/2/3
  -> Balance Sheets

Marketing Action Plan Year 1/2/3
  -> Cash Flow Year 1/2/3
  -> Profit & Loss Statements

Business Loans
  -> Cash Flow Year 1/2/3
  -> Profit & Loss Statements
  -> Balance Sheets

Assets and Depreciation
  -> Profit & Loss Statements
  -> Balance Sheets

Personal Cash Flow Budget Y1
  -> Cash Flow Year 1

Cash Flow Year 1/2/3 + Profit & Loss Statements + Balance Sheets
  -> Quarterly Results

Profit & Loss Statements
  -> Breakeven Analysis - Service
  -> Breakeven Analysis - Product

Tables and Calculations + Table2
  -> Internal support to multiple sheets
```

## Upstream/Downstream Summary

| Sheet/Domain | Upstream Inputs | Downstream Consumers |
|---|---|---|
| Set Up Details | User-entered setup values | Sales details, assumptions, loan/asset setup |
| Sales Details | Setup context + user sales assumptions | Yearly sales forecast sheets |
| Sales Forecast (Y1/Y2/Y3) | Sales details, yearly assumptions | Debtors, cash flow, P&L |
| Debtors Analysis | Sales forecast + timing assumptions | Cash flow and balance sheet |
| Marketing Action Plan (Y1/Y2/Y3) | Marketing inputs | Cash flow and P&L |
| Business Loans | Financing inputs | Cash flow, P&L, balance sheet |
| Assets & Depreciation | Asset inputs + assumptions | P&L and balance sheet |
| Cash Flow (Y1/Y2/Y3) | Revenue collections + expenses + finance effects | Quarterly reporting |
| Profit & Loss Statements | Revenue, costs, depreciation, finance | Quarterly and break-even reporting |
| Balance Sheets | Cash flow + debtors + loans + assets | Quarterly reporting |
| Quarterly Results | Statement outputs | Final management summary |
| Tables and Calculations / Table2 | Internal references | Internal formula support |

## Migration Implications

- Treat `Debtors Analysis`, `Tables and Calculations`, and `Table2` as internal engine modules.
- Keep UI focused on user inputs and reports; do not expose helper tables.
- Build reusable year-aware logic for `Marketing`, `Sales Forecast`, `Cash Flow`, and `Key Assumptions`.
- Build explicit dependency contracts between domains (typed outputs and validation guards) to prevent hidden spreadsheet-style coupling.
