# Financial Forecast Phase 4.1 Notes

## What Was Stabilized

- Replaced horizontal top-step chips with a sticky sidebar step navigator.
- Moved app shell to a two-column grid (`280px` sidebar + main content).
- Implemented completion as computed state with visited-step gating.

## UX and Rendering Refactor

- Removed full-root rerender behavior during input typing.
- Scoped updates to sidebar/meta while keeping active form controls in place.
- Preserved scroll position during step/content refresh events.

## Autosave Behavior

- Removed per-keystroke autosave.
- Autosave now triggers on:
  - field blur
  - step change
  - page hide
  - before unload
- Save payload now stores:
  - canonical data
  - current step index
  - visited steps
  - scroll position

## Form and Navigation Adjustments

- Added currency dropdown with `AUD`, `USD`, `BTC` and default `AUD`.
- Capitalized labels/buttons/dropdown values in the form flow.
- Moved revenue line add button to the bottom and fixed minimum-line behavior.
- Added month labels in Revenue Streams:
  - `M1 (Jan)` ... `M12 (Dec)`
- Moved Assets & Finance action buttons to the bottom.

## Print Flow Fix

- Replaced popup print window approach with in-page printable layout + `window.print()`.
- Eliminates blank-window behavior in restricted popup environments.
