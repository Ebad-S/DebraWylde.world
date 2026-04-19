# Financial Forecast Phase 4.2 Notes

## UX And Layout Corrections

- Kept sidebar navigation as the primary step control and preserved granular rendering behavior.
- Updated top area alignment and removed duplicate company echo from top meta.
- Moved `Run Readiness Check` and `Reset Session` actions above the step title.
- Removed step-level `h2` headings inside form panels so each step uses one primary title.

## Autosave And Step Persistence

- Preserved `currentStep` independently from completion state.
- Ensured save/restore respects saved step index and does not normalize to first incomplete step.
- Autosave still triggers on blur, step change, hidden visibility, and before unload.
- Added restore of saved scroll coordinates after hydration.

## Step Completion Truthiness

- Completion badges now depend on:
  - visited step,
  - meaningful touch/edit activity,
  - leaving the step,
  - required threshold checks.
- Unvisited and untouched steps no longer show Completed badges.

## Revenue Streams And Dependent Fields

- Added auto-calculation for `Gross Margin (%)` from `Unit Price ($)` and `COGS Per Unit ($)`.
- Added monthly units prefill behavior using `Default Units/Month (Qty)` into `M1..M12` UI fields.
- Manual month edits are preserved and not overwritten by future prefills.
- Internal engine keys remain unchanged; UI month-unit values map to seasonality consistently.

## Year Plan Prefills

- Added Trading Structure tax prefill mapping:
  - Company -> 25%
  - Sole Trader -> 10%
- Prefill respects manual tax-rate overrides once touched.

## Review, Dashboard, And Print

- Review list punctuation and capitalization corrected (`:` and Title-style list labels).
- Review action placement moved below main step view.
- Dashboard titles normalized to Title Case.
- Quarterly Revenue chart now uses month-to-quarter aggregation from monthly revenue series.
- Quarterly closing cash now maps from quarter-end monthly closing cash snapshots.
- Print Summary upgraded to include live dashboard cards, key charts, key tables, and warnings summary in-page before `window.print()`.
- Added print-safe chart styling for legible chart output.
