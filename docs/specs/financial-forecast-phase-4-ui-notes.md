# Financial Forecast Phase 4 UI Notes

## UI Architecture

- `financial-forecast.html` now mounts a dedicated app shell at `#forecast-app`.
- Phase 4 UI is implemented as Vanilla JS modules under `apps/web/src/financial-forecast/ui/`.
- Engine logic remains isolated in `core/engine`; UI consumes it only through `ui/engine-runner.js`.

## Multi-Step Workflow

- Implemented steps:
  - Get Started
  - Business Setup
  - Revenue Streams
  - Collections
  - Year 1 Plan
  - Year 2 Plan
  - Year 3 Plan
  - Assets & Finance
  - Owner & Personal Inputs
  - Review
  - Results Dashboard
- Company name is captured on the first step and displayed in app context areas and export summary.
- Navigation includes:
  - step chips (jump navigation),
  - progress line,
  - previous/next controls.
- Navigation remains free even when warnings/blockers exist.

## State, Autosave, and Engine Modes

- `ui/state-store.js` tracks canonical state, dirty state, current step, and engine results cache.
- `ui/autosave.js` persists progress in localStorage (`dw_forecast_phase4_v1`) with restore on load.
- Lenient mode runs during editing/navigation with debounce for live preview.
- Strict mode runs on demand for readiness checks and is used for results when successful.

## Review and Results Experience

- Review step surfaces:
  - blocking strict validation issues,
  - advisory warning list,
  - per-step completeness and issue state.
- Results dashboard includes:
  - KPI cards,
  - revenue / net profit / closing cash trend charts,
  - quarterly revenue bar chart,
  - annual and quarterly tables,
  - warnings table,
  - receivables insight,
  - owner adjustment summary,
  - financing summary,
  - asset/depreciation summary,
  - expandable monthly metrics table.
- Print/export summary is delivered via browser print flow in `ui/export-summary.js`.

## Styling and UX Direction

- Dedicated styling added in `apps/web/src/financial-forecast/styles/financial-forecast.css`.
- Palette and typography follow the premium Debra theme direction.
- Mobile-first behavior is implemented with responsive stacking for form grids, KPI cards, and charts.

## Remaining Polish Hooks

- Field-level issue anchors can be expanded further to deep-link to exact controls.
- Chart interactions can be extended with richer tooltips and hover markers.
- Results details can be segmented into tabs if the dashboard needs additional scaling.
