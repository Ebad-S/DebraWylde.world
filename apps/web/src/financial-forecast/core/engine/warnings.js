const YEAR_KEYS = ["year1", "year2", "year3"];
const YEAR_LABELS = { year1: "Year 1", year2: "Year 2", year3: "Year 3" };

function modelIncludesDrawings(modelType) {
  return modelType === "sole_trader_drawings" || modelType === "hybrid";
}

function describeOwnerModel(modelType) {
  if (modelType === "sole_trader_drawings") return "sole trader (drawings)";
  if (modelType === "company_salary_and_distributions") return "company (salary + distributions, no drawings)";
  if (modelType === "hybrid") return "hybrid (salary + drawings)";
  return modelType || "(unset)";
}

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
      message: "Cash roll-forward reconciliation failed. The opening + flows do not reconcile to the closing balance. This is an engine-level issue; re-import your saved file or contact support.",
      blocking: true,
      year: "all"
    });
  }
  if (!reconciliation.summary.allReceivablesPass) {
    warnings.push({
      code: "RECON_RECEIVABLES_FAIL",
      severity: "critical",
      domain: "reconciliation",
      message: "Receivables reconciliation failed. Invoiced + bad debt + cash collected do not tie to the opening/closing receivables balances. Review your Collections inputs.",
      blocking: true,
      year: "all"
    });
  }
  if (!reconciliation.summary.allBalancePass) {
    warnings.push({
      code: "RECON_BALANCE_EQUATION_FAIL",
      severity: "critical",
      domain: "reconciliation",
      message: "Balance equation reconciliation failed (Assets != Liabilities + Equity). This indicates a data inconsistency; review your saved file or try re-running Strict mode.",
      blocking: true,
      year: "all"
    });
  }

  if ((normalizedState.collectionsPolicy.defaultDebtorDays || 0) > 60) {
    warnings.push({
      code: "COLLECTIONS_LONG_DEBTOR_DAYS",
      severity: "warning",
      domain: "collections",
      message: `Debtor days are unusually long (${normalizedState.collectionsPolicy.defaultDebtorDays} days). This will delay cash collection versus invoicing; review the Collections step if this is unintended.`,
      blocking: false,
      year: "all"
    });
  }

  const negativeMonths = (cashFlow.closingCashMonthly || [])
    .map((value, idx) => (value < 0 ? idx : -1))
    .filter((idx) => idx >= 0);
  if (negativeMonths.length > 0) {
    const firstIdx = negativeMonths[0];
    const yearLabel = firstIdx < 12 ? "Year 1" : firstIdx < 24 ? "Year 2" : "Year 3";
    warnings.push({
      code: "CASHFLOW_NEGATIVE_CLOSING",
      severity: "warning",
      domain: "cashFlow",
      message: `Business cash goes negative in ${negativeMonths.length} month${negativeMonths.length === 1 ? "" : "s"} (earliest: ${yearLabel}, month index ${firstIdx + 1}). Likely causes: drawings too high, insufficient opening cash, or slow collections.`,
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
      message: "Gross margin drops below 20% in at least one month. Review unit price vs Cost Of Goods Sold on the Revenue Streams step, or check Direct Labor and Variable Costs on the Year Plans.",
      blocking: false,
      year: "all"
    });
  }

  if (personalCashFlow) {
    const perYear = personalCashFlow.perYear || {};

    // ---------------------------------------------------------------------
    // Phase 4.3.3: surface personal-cash warnings for every year, not just
    // Year 1. Each warning names the specific year so users can tell at a
    // glance which year is at risk.
    // ---------------------------------------------------------------------
    YEAR_KEYS.forEach((yk) => {
      const slice = perYear[yk];
      if (!slice) return;
      const closingMonthly = slice.closingMonthly || [];
      const summary = slice.summary || {};
      const negMonths = closingMonthly.filter((v) => v < 0).length;
      if (negMonths > 0) {
        warnings.push({
          code: "PERSONAL_CASHFLOW_NEGATIVE_CLOSING",
          severity: "warning",
          domain: "personalCashFlow",
          message: `${YEAR_LABELS[yk]}: personal bank balance goes negative in ${negMonths} month${negMonths === 1 ? "" : "s"}. Review Personal Cash Flow inputs: likely fixes are to increase drawings from business, reduce personal outflows, or raise opening personal cash.`,
          blocking: false,
          year: yk
        });
      }

      // Burn-aware low-buffer warning, per year.
      //   threshold = 0.5 * average monthly personal outflows for that year
      //   fire when: the year has activity, min closing is non-negative, and
      //              min closing < threshold (threshold itself meaningful).
      // The $100 floor avoids noise on near-blank drafts.
      const minClosing = Number(summary.minClosingBalance ?? 0);
      const avgMonthlyOutflows = Number(summary.averageMonthlyOutflows ?? 0);
      const burnAwareThreshold = avgMonthlyOutflows * 0.5;
      const thresholdIsMeaningful = burnAwareThreshold >= 100;
      const planHasActivity = closingMonthly.some((v) => v !== 0);
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
          message: `${YEAR_LABELS[yk]}: minimum personal cash buffer ($${minClosing.toFixed(0)}) is below ~half a month of personal outflows (~$${burnAwareThreshold.toFixed(0)}). Consider raising drawings from business, trimming outflows, or increasing opening personal cash.`,
          blocking: false,
          year: yk
        });
      }
    });

    // ---------------------------------------------------------------------
    // Phase 4.3.3-C: contradiction guardrails between owner-compensation
    // settings on each Year Plan and the Personal Cash Flow drawings row.
    //
    // Precedence rule (documented for users + implementation report):
    //   * Year 1: the Personal Cash Flow "drawings from business" row is
    //     authoritative when populated; otherwise the Year 1 Plan
    //     `ownerDrawingsMonthly` is used.
    //   * Year 2 and Year 3: the Year Plan `ownerDrawingsMonthly` is
    //     authoritative (there is no per-year PCF drawings row).
    //   * The year's owner model type determines whether drawings exist at
    //     all (drawings only flow in `sole_trader_drawings` or `hybrid`).
    // The guardrails below do not change engine math; they surface any
    // combination that contradicts the rule above in plain language.
    // ---------------------------------------------------------------------
    const link = personalCashFlow.drawingsLink || {};
    const planByYear = link.yearPlanDrawingsMonthly || {};
    const y1PcfDrawingsTotal = Number(link.personalDrawingsTotalY1 || 0);
    const y1PcfDrawingsPopulated = Boolean(link.personalDrawingsPopulatedY1);

    YEAR_KEYS.forEach((yk) => {
      const plan = planByYear[yk] || {};
      const modelType = plan.modelType;
      const planAnnual = Number(plan.ownerDrawingsMonthly || 0) * 12;
      const modelHasDrawings = modelIncludesDrawings(modelType);

      // Case A: owner model excludes drawings, but drawings exist somewhere.
      if (!modelHasDrawings) {
        const pcfPart = (yk === "year1" && y1PcfDrawingsTotal > 0) ? y1PcfDrawingsTotal : 0;
        if (planAnnual > 0 || pcfPart > 0) {
          const parts = [];
          if (planAnnual > 0) {
            parts.push(`the Year Plan lists drawings of $${plan.ownerDrawingsMonthly.toFixed(0)}/mo`);
          }
          if (pcfPart > 0) {
            parts.push(`the Personal Cash Flow "drawings from business" row totals $${pcfPart.toFixed(0)} for Year 1`);
          }
          warnings.push({
            code: "OWNER_PCF_DRAWINGS_MODEL_CONFLICT",
            severity: "warning",
            domain: "ownerAdjustments",
            message: `${YEAR_LABELS[yk]}: owner model is "${describeOwnerModel(modelType)}", so no drawings should exist, but ${parts.join(" and ")}. Either switch the model to sole trader / hybrid, or clear those drawings inputs.`,
            blocking: false,
            year: yk
          });
        }
        return;
      }

      // Case B (Year 1 only): model includes drawings AND both Y1 Plan drawings
      // and the PCF drawings row are non-zero, but they disagree materially
      // (>5% relative difference, with a $100 absolute floor to suppress
      // rounding noise). The PCF row wins for Y1 in the engine; we just
      // surface the mismatch.
      if (yk === "year1" && y1PcfDrawingsPopulated && planAnnual > 0) {
        const diff = Math.abs(y1PcfDrawingsTotal - planAnnual);
        const relativeDiff = planAnnual === 0 ? 1 : (diff / planAnnual);
        if (diff > 100 && relativeDiff > 0.05) {
          warnings.push({
            code: "OWNER_PCF_DRAWINGS_Y1_MISMATCH",
            severity: "warning",
            domain: "ownerAdjustments",
            message: `Year 1: the Personal Cash Flow "drawings from business" row totals $${y1PcfDrawingsTotal.toFixed(0)} but the Year 1 Plan implies $${planAnnual.toFixed(0)} ($${plan.ownerDrawingsMonthly.toFixed(0)}/mo). Year 1 uses the Personal Cash Flow figure; review both inputs and align them if the difference is unintentional.`,
            blocking: false,
            year: yk
          });
        }
      }

      // Case C (Year 1 only, informational): model includes drawings, Year 1
      // Plan has drawings, and the PCF drawings row is empty. The engine
      // falls back to the Year 1 Plan value, which is fine, but the user
      // may want to know the PCF row is the source of truth when populated.
      if (yk === "year1" && !y1PcfDrawingsPopulated && planAnnual > 0) {
        warnings.push({
          code: "OWNER_PCF_DRAWINGS_Y1_EMPTY",
          severity: "info",
          domain: "personalCashFlow",
          message: `Year 1: the Year 1 Plan drawings are $${plan.ownerDrawingsMonthly.toFixed(0)}/mo, but the Personal Cash Flow "drawings from business" row is empty. The Year Plan value is being used for Year 1. Populate the Personal Cash Flow row if you want month-by-month control over Year 1 drawings.`,
          blocking: false,
          year: yk
        });
      }
    });
  }

  return warnings;
}
