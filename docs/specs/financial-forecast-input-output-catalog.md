# Financial Forecast Input/Output Catalog

## Input Catalog (By Business Domain)

## 1) Business Setup
- Business name and profile metadata
- Forecast start period
- Currency and tax posture
- Opening cash and opening balances
- Planning mode switches (service/product blend)

## 2) Sales Configuration
- Revenue stream list (service/product lines)
- Unit price
- Units sold or utilization assumptions
- Frequency/seasonality factors
- GST applicability by stream

## 3) Collection Timing (Debtors)
- Average debtor days
- Collection split assumptions by month bucket
- Bad debt allowance (if used)
- Opening receivables balance (if applicable)

## 4) Cost Structure
- Fixed monthly operating costs
- Variable costs as percentage of sales (COGS, fees, commissions)
- Merchant/payment processing fee rates
- Direct labor/service delivery cost assumptions

## 5) Marketing Plans
- Campaign line items per year
- Monthly/quarterly spend allocation
- One-off launch costs
- Ongoing marketing baseline

## 6) Financing
- Loan principal
- Annual interest rate
- Loan term and repayment frequency
- Drawdown dates and repayment start dates

## 7) Assets and Depreciation
- Asset purchase value and date
- Asset category
- Useful life and depreciation method
- Residual value assumptions (if any)

## 8) Global Assumptions (Yearly)
- CPI/inflation uplift
- Tax assumptions
- Growth assumptions
- Other policy rates used by formulas

---

## Output Catalog (Critical Business Results)

## A) Revenue and Collections
- Monthly invoiced sales by year
- Annual sales totals by year
- Monthly cash collections (post-debtor timing)
- Receivables closing balances

## B) Cost and Margin
- Variable cost totals
- Fixed cost totals
- Marketing spend totals
- Gross profit and gross margin

## C) Financing and Asset Effects
- Interest expense and principal repayment by period
- Loan closing balances
- Depreciation expense by period
- Closing net book value for assets

## D) Cash Flow Statements
- Net operating cash flow by month
- Net financing cash flow
- Net investing cash flow (if modeled)
- Closing cash balances by month and year

## E) Profit and Loss Statements
- Revenue
- Cost of sales
- Gross profit
- Operating expenses
- Operating profit / EBITDA indicator (if included)
- Net profit before/after tax (as configured)

## F) Balance Sheet Statements
- Current assets (cash, receivables)
- Non-current assets (depreciated assets)
- Current/non-current liabilities (loan balances)
- Equity
- Balance integrity check

## G) Decision Outputs
- Break-even point (service view)
- Break-even point (product view)
- Quarterly trend summaries
- Warning flags (cash shortfall, margin compression, debt stress)

---

## Input-Output Traceability Highlights

- Sales assumptions + debtor timing -> cash collection outputs.
- Cost percentages + sales volume -> margin and profitability outputs.
- Loan and asset inputs -> P&L and balance sheet structural outputs.
- Yearly assumptions -> all downstream projection shifts.

This catalog should be treated as the minimum contract for the web app form model and report model in Phase 2.
