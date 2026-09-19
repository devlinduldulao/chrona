# chrona-core for agents

Framework-agnostic date/time state machines over the Temporal proposal. It
renders nothing. For React components install `chrona-react`. Full docs:
https://github.com/devlinduldulao/chrona#readme

## Setup that is easy to get wrong

1. **Runtime.** Chrona reads `globalThis.Temporal` and never installs it. Where
   Temporal is not native, `import "temporal-polyfill/global"` before use, in
   the same module that first constructs Temporal values — a sibling providers
   file does not order Node module init under Next.js SSR.
2. **Types.** No extra import is needed: this package's declarations reference
   `temporal-spec/global`, so `Temporal.PlainDate` resolves as an ambient global
   in any file importing from Chrona.
3. **Values are Temporal objects.** Strings and `Date` are rejected with a
   `ChronaError`; there is no parsing layer.

## Shape

Every machine is a pure `(state, event, options) => { state, effects }`
transition, paired with a `connect*` prop getter. You own storage and rendering.

```ts
let state = createCalendar(options);
({ state } = transitionCalendar(state, { type: "PAGE", direction: 1 }, options));
const api = connectCalendar(state, { ...options, id: "booking" });
api.getCellProps(date);        // the gridcell: role, aria-selected, data-* state
api.getCellTriggerProps(date); // the button inside it: tabIndex, aria-label
```

Cells are two elements on purpose: a button that claims `role="gridcell"` stops
being a button in the accessibility tree.

## Field transitions

- `DIGIT` is literal (`overflow: "reject"`); `STEP` and `EDGE` clamp
  (`overflow: "constrain"`). An impossible finished date yields
  `{ type: "invalid", reason: "nonexistent" }`.
- A segment with an open digit buffer is a draft and emits **neither `change`
  nor `invalid`**. Typing `2026` into a year reports that year once, not the
  years 2, 20 and 202 on the way. Send `BLUR` to close the draft and settle.
- `segmentBounds` widens the day when the month or year is still blank, so
  29 February stays reachable in month/day/year locales. It governs *typing*;
  `connectField` announces a narrower `aria-valuemin`/`aria-valuemax` when
  `minValue`/`maxValue` make one certain. Do not use the announced range to
  decide what input to accept — an out-of-range year must stay typeable so it
  can be reported as out of range.
- `dayPeriodValue` matches typed text against the locale's own AM/PM labels, for
  bindings that must accept a day period from something other than a keydown.

## Two ways the runtime bites, both server-side only

1. **A calendar the runtime cannot do.** Node's native Temporal handles
   `iso8601` and throws `Not yet implemented` for everything else — `gregory`
   included, which arrives by accident from a `ZonedDateTime`. `createCalendar`
   probes once and raises `CALENDAR_UNSUPPORTED`. The same code works in a
   browser, so this looks like an SSR-only bug. Keep values in `iso8601`, or
   give the server `temporal-polyfill/full/global`.
2. **Two Temporal implementations on one page.** Two copies of a polyfill, or a
   mix of its default and `full` entry points, each install their own
   `globalThis.Temporal`; the loser's values then fail `instanceof`. They are
   refused with `TEMPORAL_MISMATCH` rather than being called strings, because
   the arithmetic would survive the mix and `Intl` would not.

`options.today` fixes the date a calendar marks, and `FieldOptions.timeZone`
fixes the zone a field resolves today in. Supply them where the answer must not
depend on when or where the code runs.

## Error codes

`ChronaError.code` is stable; the message is not. Match on the code.

| Code | Means |
| --- | --- |
| `TEMPORAL_MISSING` | No `globalThis.Temporal`. Load a polyfill. |
| `TEMPORAL_MISMATCH` | A Temporal value from a *different* implementation. |
| `CALENDAR_UNSUPPORTED` | This runtime cannot do arithmetic on that calendar. |
| `INVALID_DATE` | Not a `Temporal.PlainDate` — a string or `Date`, probably. |
| `INVALID_FIELD_VALUE` | Not the `PlainDate`/`PlainTime` the field wanted. |
| `INVALID_RANGE` | Range endpoints disagree on calendar, or start is after end. |
| `INVALID_BOUNDS` | `minValue` is after `maxValue`. |
| `INVALID_WEEK_START` | `firstDayOfWeek` outside 1–7. |
| `INVALID_MONTH_COUNT` | `numberOfMonths` outside 1–12. |
| `UNSUPPORTED_FIELD_CALENDAR` | `DateField` takes ISO or Gregorian only. |
| `UNSUPPORTED_FIELD_YEAR` | `DateField` takes years 1–9999. |

## Intl

Formatter caches are bounded to 100 entries per constructor, keyed by locale and
normalized options. `formatDate`/`formatParts` collapse U+202F and U+00A0 to a
plain space so markup does not depend on the runtime's ICU version.
