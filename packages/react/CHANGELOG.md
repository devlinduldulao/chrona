# chrona-react

## 0.3.0

### Minor Changes

- 4e61f43: Report a field's value only once the segment being typed is finished, resolve
  `today` on the client, and let a Server Component import the React package.

  - `transitionField` no longer emits `change` while a digit buffer is open. Typing
    `2026` into a year reported the years 2, 20 and 202 on the way through, and a
    half-typed `02/29/20` committed the year 20 — real dates nobody typed, which
    a Next.js `onChange` would have written to a route, a server action or a form.
    A draft now keeps the previously committed value, and blur settles it.
  - `CalendarOptions` takes `today`. Without it, `useCalendar` resolves today on
    the client instead of at render time: a server render could not know the
    reader's zone, and a prerendered page kept the day it was built on with no way
    to correct itself, since React leaves mismatched attributes alone.
  - `chrona-react` ships a `"use client"` directive. Importing it from a Server
    Component — a shared barrel is enough — failed the build with
    `TypeError: createContext is not a function`.
  - Field segments accept input from soft keyboards, which report no usable `key`
    and often deliver text as a composition. The AM/PM segment also matches its
    locale's own label, through the new `dayPeriodValue` export, so it can be set
    without a hardware keyboard.
  - `RangeCalendar`'s form reset no longer calls `onChange` when the range it
    restores is the one already there.
  - A value from a second Temporal implementation is diagnosed as such
    (`TEMPORAL_MISMATCH`, via the new `isForeignTemporal`) instead of being
    reported as "a string or Date", which sent the reader looking in the wrong
    place. Two implementations land on one page through two copies of a polyfill,
    or a mix of its default and `full` entry points.

### Patch Changes

- Updated dependencies [4e61f43]
  - chrona-core@0.3.0

## 0.2.1

### Patch Changes

- Document that a providers-file `temporal-polyfill/global` import does not
  order Next.js App Router SSR module init.

  The providers import is what gets Temporal into the browser bundle before
  hydration, but it does not decide the order Node evaluates modules in. A
  `"use client"` file that reads `Temporal` at module scope — typically
  `const reference = Temporal.PlainDate.from(...)` at the top of `page.tsx` —
  can be evaluated during SSR before the providers file runs, and Node throws
  `ReferenceError: Temporal is not defined`. Import the polyfill in that file
  too, or construct the value inside the component body.

  No runtime change; `dist` is byte-identical to 0.2.0. This release also puts
  the `AGENTS.md` files on npm.

  Published by hand, like 0.1.0 and 0.2.0, so it carries no provenance
  attestation: trusted publishing still fails with
  `403 OIDC permission denied for this action` even though the registry issues
  the credential. CONTRIBUTING lists everything ruled out.

- Updated dependencies
  - chrona-core@0.2.1

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
