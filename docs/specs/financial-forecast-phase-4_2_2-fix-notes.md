# Financial Forecast Phase 4.2.2 Notes

## Focus/Visibility Stability

- Focus and visibility return are treated as non-navigation events.
- Current step is preserved independently of completion derivation.
- Added passive debug traces for blur/save/focus/visibility transitions.
- Persisted and restored:
  - `currentStep`
  - main scroll position
  - active subpanel scroll position

## Completion Badge Persistence

- Persisted step meta (`visited`, `touched`, `completed`) across autosave.
- Completion badges remain stable after autosave and focus return.
- Completed state is only removed when required underlying data no longer satisfies completion thresholds.

## Immediate Prefills and Derived Fields

- Gross Margin (%) now recalculates immediately for all revenue lines, including Line 1.
- Margin remains blank when Unit Price or COGS is missing/invalid.
- Default Units/Month prefill updates visible M1-M12 inputs immediately for untouched month fields.
- Trading Structure tax-rate prefill updates visible untouched tax fields immediately.

## Quarterly Mapping Fixes

- Quarterly Revenue chart data now aggregates month buckets explicitly into:
  - `Y1-Q1` .. `Y3-Q4`
- Quarterly Performance table revenue now uses the same quarterly aggregation pipeline as the chart.
- Quarterly Closing Cash now maps from quarter-end monthly closing cash (`M3`, `M6`, ... `M36`) with correct key shape.

## Print Summary Reliability

- Print flow now waits for print layout readiness before invoking print.
- Added print readiness logging for section counts/heights.
- Print chart cloning now enforces print-safe foreground/background colors.
- Added print CSS safeguards to reduce blank trailing pages and avoid break-inside issues for chart/table blocks.
