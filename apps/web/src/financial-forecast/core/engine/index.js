import { validateState } from "../validators.js";
import { normalizeState } from "./normalize.js";
import { buildTimeline } from "./timeline.js";
import { calculateSales } from "./sales.js";
import { calculateCollections } from "./collections.js";
import { calculateCosts } from "./costs.js";
import { calculateMarketing } from "./marketing.js";
import { calculateOwnerAdjustments } from "./owner-adjustments.js";
import { calculateLoans } from "./loans.js";
import { calculateAssets } from "./assets.js";
import { calculateCashFlow } from "./cashflow.js";
import { calculateProfitAndLoss } from "./profit-loss.js";
import { calculateBalanceSheet } from "./balance-sheet.js";
import { calculateBreakEven } from "./break-even.js";
import { calculateQuarterly } from "./quarterly.js";
import { runReconciliation } from "./reconciliation.js";
import { buildWarnings } from "./warnings.js";
import { shapeReport } from "./report-shaping.js";

function mapValidationToWarnings(validation) {
  return (validation.all || []).map((issue) => ({
    code: issue.code,
    severity: issue.severity === "error" ? "critical" : "warning",
    domain: issue.domain,
    message: issue.message,
    blocking: Boolean(issue.blocking),
    year: "all",
    fieldPath: issue.fieldPath
  }));
}

export function runForecastEngine(rawState, options = {}) {
  const mode = options.mode || "lenient";
  const startedAt = Date.now();
  const validation = validateState(rawState);
  const hasBlockingValidationErrors = validation.errors.some((issue) => issue.blocking);

  if (mode === "strict" && hasBlockingValidationErrors) {
    return {
      status: "validation_failed",
      meta: {
        engineVersion: "0.3.1",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        mode
      },
      validation,
      timeline: null,
      normalized: null,
      raw: null,
      warnings: mapValidationToWarnings(validation),
      derived: null
    };
  }

  const normalized = normalizeState(rawState);
  const timeline = buildTimeline(normalized.meta.forecastHorizonYears || 3);

  const sales = calculateSales(normalized);
  const collections = calculateCollections(normalized, sales);
  const costs = calculateCosts(normalized, sales);
  const marketing = calculateMarketing(normalized);
  const ownerAdjustments = calculateOwnerAdjustments(normalized);
  const loans = calculateLoans(normalized);
  const assets = calculateAssets(normalized);
  const cashFlow = calculateCashFlow(normalized, collections, costs, marketing, ownerAdjustments, loans, assets);
  const profitLoss = calculateProfitAndLoss(normalized, sales, costs, marketing, ownerAdjustments, loans, assets);
  const balanceSheet = calculateBalanceSheet(normalized, collections, assets, loans, cashFlow, profitLoss, ownerAdjustments);
  const breakEven = calculateBreakEven(normalized, sales, costs, marketing);
  const quarterly = calculateQuarterly(normalized, sales, cashFlow, profitLoss, balanceSheet, collections);
  const reconciliation = runReconciliation(normalized, collections, cashFlow, balanceSheet, loans, assets, ownerAdjustments);
  const warnings = buildWarnings(validation, reconciliation, normalized, profitLoss, cashFlow);
  const shaped = shapeReport(normalized, { sales, collections, costs, marketing, ownerAdjustments, loans, assets, cashFlow, profitLoss, balanceSheet, breakEven, quarterly }, warnings);

  return {
    meta: {
      engineVersion: "0.3.1",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      mode
    },
    status: "ok",
    validation,
    timeline,
    normalized,
    raw: {
      sales,
      collections,
      costs,
      marketing,
      ownerAdjustments,
      loans,
      assets,
      cashFlow,
      profitLoss,
      balanceSheet,
      breakEven,
      quarterly,
      reconciliation
    },
    warnings,
    derived: shaped
  };
}
