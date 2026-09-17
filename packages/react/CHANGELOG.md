# chrona-react

## 0.2.0

### Minor Changes

- 4f188b3: Fix the field, cell, and SSR problems found while evaluating 0.1.0.

  **29 February is reachable again.** The day segment was bounded by the
  placeholder's year, so in month/day/year locales `2` `29` `2028` became
  2028-02-09 — the leap day could not be typed at all. The day now accepts the
  longest its month can ever be while the year is still blank.

  **Typed dates are no longer silently corrected.** `2/29/2026` used to
  materialize as 2026-02-28 through `overflow: "constrain"` with no signal. Typed
  digits are now literal and a date the calendar cannot hold reports
  `onInvalid("nonexistent")`. Stepping and Home/End still clamp the day to its
  month. `onInvalid` gains the `"nonexistent"` reason and `translations` gains
  `nonexistentDate`.

  **Validation waits for a segment to finish.** Typing `9/18/2026` against
  min/max emitted `range`, `range`, `unavailable` and then a valid change,
  because `2`, `20` and `202` were treated as finished years. A segment with an
  open digit buffer is now a draft that emits no `invalid` effect; a draft still
  invalid when the field blurs is reported then.

  **12-hour `TimeField` hydrates cleanly.** `Intl` emits U+202F before AM/PM on
  newer ICU data and a plain space on older data, so a field rendered on Node and
  hydrated in the browser produced a React hydration mismatch in that one literal.
  Chrona now collapses U+202F and U+00A0 to a plain space, which removes the need
  for the `hourCycle="h23"` workaround.

  **`Temporal` types come with the package.** `chrona-core`'s declarations
  reference `temporal-spec/global`, so examples that write `Temporal.PlainDate`
  compile without hunting down an undocumented types import.

  **Buttons that are labelled but empty now show something.** `Calendar.PrevButton`
  and `NextButton` render a default chevron that follows the reading direction,
  and `DatePicker.Trigger` a calendar glyph, when given no children. The README's
  `<DatePicker.Calendar />` snippet previously rendered blank 22×18px chrome.

  **Named segment placeholders and stable field width.** Blank segments read
  `mm/dd/yyyy` and `hh:mm` instead of `--/--/yyyy`, and every filled numeric
  segment except the year is zero-padded, so a field no longer reflows as it fills.

  **The picker dialog no longer sets both names.** `aria-label` is dropped when
  `aria-labelledby` resolves, instead of shipping a "Choose date" label that
  `aria-labelledby` silently overrode.

  ### Breaking

  **Date cells are two elements.** A `<button role="gridcell">` overrides the
  button role in the accessibility tree, so `Calendar.Cell` now renders the
  `role="gridcell"` wrapper and the new `Calendar.CellTrigger` renders the button
  inside it. A cell given no children renders its trigger automatically, so markup
  that does not customize cells needs no change, but CSS targeting
  `[data-part="cell"]` as the interactive element must move to
  `[data-part="cell-trigger"]`. Both elements carry the state attributes. Core
  gains `getCellTriggerProps` and `getRangeCellTriggerProps` alongside the
  existing cell getters.

### Patch Changes

- Updated dependencies [4f188b3]
  - chrona-core@0.2.0
