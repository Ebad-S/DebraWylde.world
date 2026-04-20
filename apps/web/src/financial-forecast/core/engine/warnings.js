export function buildWarnings(validationResult, reconciliation, normalizedState, profitLoss, cashFlow, personalCashFlow) {
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

  if (personalCashFlow) {
    const pcfClosing = personalCashFlow.closingMonthly || [];
    const negMonths = pcfClosing.filter((v) => v < 0).length;
    if (negMonths > 0) {
      warnings.push({
        code: "PERSONAL_CASHFLOW_NEGATIVE_CLOSING",
        severity: "warning",
        domain: "personalCashFlow",
        message: `Negative personal bank balance in ${negMonths} month${negMonths === 1 ? "" : "s"} of Year 1.`,
        blocking: false,
        year: "year1"
      });
    }
    // Burn-aware low-buffer warning (Phase 4.2.8).
    // Instead of a fixed $1,000 threshold (which is meaningless for a $50k/mo
    // lifestyle and overly loud for a $500/mo lifestyle), compare the minimum
    // personal cash buffer to ~half a month of average personal outflows.
    //
    // Rules:
    //   threshold = 0.5 * average monthly personal outflows
    //   fire if the plan has non-zero activity, minClosing is non-negative,
    //   and minClosing < threshold (and the threshold itself is meaningful).
    //
    // A threshold floor of $100 avoids noisy near-zero false positives on
    // minimal/blank scenarios. When outflows are zero the threshold is zero
    // and the warning stays silent, preserving the existing "no-noise on
    // blank draft" guarantee.
    const minClosing = personalCashFlow.summary?.minClosingBalance ?? 0;
    const avgMonthlyOutflows = personalCashFlow.summary?.averageMonthlyOutflows ?? 0;
    const burnAwareThreshold = avgMonthlyOutflows * 0.5;
    const thresholdIsMeaningful = burnAwareThreshold >= 100;
    const planHasActivity = pcfClosing.some((v) => v !== 0);
    if (
      planHasActivity
      && thresholdIsMeaningful
      && minClosing >= 0
      && minClosing < burnAwareThreshold
    ) {
      warnings.push({
        code: "PERSONAL_CASHFLOW_LOW_BUFFER",
        severity: "info",
        domain: "personalCashFlow",
        message: `Minimum personal cash buffer ($${minClosing.toFixed(0)}) is below ~0.5 months of personal outflows (~$${burnAwareThreshold.toFixed(0)}).`,
        blocking: false,
        year: "year1"
      });
    }
  }

  return warnings;
}
