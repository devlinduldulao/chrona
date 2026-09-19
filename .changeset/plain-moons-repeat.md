---
"chrona-core": minor
"chrona-react": minor
---

Report a field's value only once the segment being typed is finished, resolve
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

