export function buildWarnings(validationResult, reconciliation, normalizedState, profitLoss, cashFlow) {
  const warnings = [];

  const pushIssue = (issue) => {
    warnings.push({
      code: issue.code,
      severity: issue.severity === "error" ? "critical" : "warning",
      domain: issue.domain,
      message: issue.message,
      blocking: Boolean(issue.blocking),
      year: "all",
      fieldPath: issue.fieldPath
    });
  };

  (validationResult.all || []).forEach(pushIssue);

  if (!reconciliation.summary.allCashPass) {
    warnings.push({
      code: "RECON_CASH_ROLLFORWARD_FAIL",
      severity: "critical",
      domain: "reconciliation",
      message: "Cash roll-forward reconciliation failed.",
      blocking: true,
      year: "all"
    });
  }
  if (!reconciliation.summary.allReceivablesPass) {
    warnings.push({
      code: "RECON_RECEIVABLES_FAIL",
      severity: "critical",
      domain: "reconciliation",
      message: "Receivables reconciliation failed.",
      blocking: true,
      year: "all"
    });
  }
  if (!reconciliation.summary.allBalancePass) {
    warnings.push({
      code: "RECON_BALANCE_EQUATION_FAIL",
      severity: "critical",
      domain: "reconciliation",
      message: "Balance equation reconciliation failed.",
      blocking: true,
      year: "all"
    });
  }

  if ((normalizedState.collectionsPolicy.defaultDebtorDays || 0) > 60) {
    warnings.push({
      code: "COLLECTIONS_LONG_DEBTOR_DAYS",
      severity: "warning",
      domain: "collections",
      message: "Debtor days are unusually long.",
      blocking: false,
      year: "all"
    });
  }

  const hasNegativeCash = (cashFlow.closingCashMonthly || []).some((value) => value < 0);
  if (hasNegativeCash) {
    warnings.push({
      code: "CASHFLOW_NEGATIVE_CLOSING",
      severity: "warning",
      domain: "cashFlow",
      message: "Negative closing cash occurs in one or more periods.",
      blocking: false,
      year: "all"
    });
  }

  const marginWarnings = (profitLoss.grossProfitMonthly || []).some((grossProfit, i) => {
    const revenue = Number(profitLoss.revenueMonthly[i] || 0);
    if (revenue <= 0) return false;
    return grossProfit / revenue < 0.2;
  });
  if (marginWarnings) {
    warnings.push({
      code: "SALES_LOW_MARGIN",
      severity: "warning",
      domain: "sales",
      message: "Low gross margin detected in one or more periods.",
      blocking: false,
      year: "all"
    });
  }

  return warnings;
}
