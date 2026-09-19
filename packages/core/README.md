# chrona-core

Temporal-native, headless date and time state machines. No legacy `Date` values,
no free-form date parsing, and no CSS.

This is the framework-agnostic layer of [Chrona](https://github.com/devlinduldulao/chrona).
It is plain TypeScript: pure transition functions, prop getters, and a tiny
external store. It renders nothing. If you want React components, install
[`chrona-react`](https://www.npmjs.com/package/chrona-react) instead — it is
built on this package.

> **Status: experimental 0.3.1.** Public APIs are not frozen for v1. 0.3.0
> stops a half-typed segment reporting a value; 0.2.0 split the calendar cell
> getters. See the [changelog](./CHANGELOG.md). No screen-reader compatibility
> certification is claimed.

## Install

```sh
npm install chrona-core
```

`temporal-spec` is a **type-only** dependency. No runtime date library, polyfill,
locale catalog, or positioning code is bundled.

## Temporal Is Application-Owned

Chrona always reads `globalThis.Temporal` and never installs a runtime behind
your back. Where Temporal is not yet native, load a polyfill before creating
values or calling Chrona:

```ts
import "temporal-polyfill/global";
```

The guard runs when an operation needs Temporal, not at module import, so
tree-shaking and SSR imports stay safe. A missing runtime produces an actionable
`ChronaError`.

Load **exactly one** Temporal implementation. Two — two copies of a polyfill in
the dependency tree, or one file importing `temporal-polyfill/global` while
another imports `temporal-polyfill/full/global` — each install their own
`globalThis.Temporal`, and the last one wins. Values built by the loser then
fail `instanceof`, and `Intl` refuses them outright with
`TypeError: Cannot use valueOf`. Chrona detects that case and says so
(`ChronaError` code `TEMPORAL_MISMATCH`) rather than claiming you passed a
string.

`temporal-polyfill` 1.x installs itself **only where Temporal is missing**, and
its default entry ships the ISO calendar alone. Two consequences worth knowing
before you pick a calendar system:

- Node 24+ and current Chrome have native Temporal, so the polyfill is a no-op
  there. A server and a browser can therefore run different implementations of
  Temporal for the same page.
- Non-ISO calendars — including `gregory` — need `temporal-polyfill/full/global`,
  and even then only where the polyfill actually installs.

The runtime and the types are separate concerns. This package's declarations
reference `temporal-spec/global`, so importing anything from `chrona-core` also
brings the ambient `Temporal` namespace into scope — the examples below use
`Temporal.PlainDate` with no types import of their own.

Native support is capability-dependent, not merely version-dependent: some Node
builds handle ISO operations but throw `Not yet implemented` for non-ISO
calendar arithmetic. `gregory` counts as non-ISO. On Node 26, a Calendar built
on a Gregorian date — whether from `calendar: "gregory"` or from a value that
already carries that calendar — throws from `PlainDate.prototype.add` while the
same code works in the browser. Keep values in `iso8601` unless you have
verified the server runtime, and run `pnpm test:native` to see which systems a
given runtime can actually do arithmetic on.

## Use

Every machine is a pure `(state, event, options) => { state, effects }`
transition. You own storage, scheduling, and rendering.

```ts
import { createCalendar, transitionCalendar, connectCalendar } from "chrona-core";

const options = { locale: "en-US", value: null, placeholderValue: Temporal.Now.plainDateISO() };
let state = createCalendar(options);

// Advance one month.
({ state } = transitionCalendar(state, { type: "PAGE", direction: 1 }, options));

// Prop getters for whatever you render with.
const api = connectCalendar(state, { ...options, id: "booking" });
api.getRootProps();
api.getCellProps(someDate);        // the gridcell: role, aria-selected, data-* state
api.getCellTriggerProps(someDate); // the button inside it: tabIndex, aria-label, data-* state
```

## What's In It

| Area | Exports |
| --- | --- |
| Temporal | `temporal`, `ChronaError`, `assertDate`, `isForeignTemporal`, `mixedTemporalMessage`, `sameDate`, `clampDate`, `startOfWeek`, `weeksInMonthView` |
| Calendar | `createCalendar`, `transitionCalendar`, `connectCalendar`, `syncCalendar`, `isDateDisabled`, `isInView`, `canPage`, `calendarKeys` |
| Range | `createRange`, `transitionRange`, `validateRange`, `rangeContains`, `getRangeCellProps`, `getRangeCellTriggerProps` |
| Field | `createField`, `transitionField`, `connectField`, `fieldSegments`, `fieldHourCycle`, `segmentBounds`, `digitValue`, `dayPeriodValue` |
| Picker | `transitionPicker` |
| i18n | `translations`, `resolveWeekStart`, `formatDate`, `formatParts`, `getDateTimeFormatter`, `getNumberFormatter` |
| DOM | `computeAnchorPosition`, `containTabFocus` |
| Store | `createStore` |

Calendar covers arrow/Home/End/PageUp/PageDown navigation, RTL, locale week
starts, min/max, unavailable dates, fixed weeks, and paged multi-month views.
Fields produce locale-ordered segments from Intl and accept ASCII or localized
digits — not free-form strings. Typed digits are literal and stepping clamps, so
29 February can be typed before the year is known and an impossible finished date
is reported as `{ type: "invalid", reason: "nonexistent" }` instead of being
clamped. A segment with an open digit buffer is a draft: it emits neither a
`change` nor an `invalid` effect until the segment is finished or a `BLUR` event
closes it, so typing `2026` reports that year once rather than reporting the
years 2, 20 and 202 on the way. Ranges are inclusive at both ends, normalize
backward selection, and keep the first endpoint as draft state.

Intl formatter caches are bounded to 100 entries per constructor, keyed by
locale and normalized options.

## Notes

- Output is ESM with declarations and source maps, targeting ES2022.
- `required` is accessibility metadata; it does not block native form submission.
- Styling hooks are `data-scope`, `data-part`, and state attributes such as
  `data-selected`, `data-today`, and `data-unavailable`.
- Intl output is normalized to plain spaces (U+202F and U+00A0 are collapsed) so
  markup does not depend on which ICU version the runtime shipped with. Two
  things are outside what that normalization can promise, and both matter only
  when a server and a browser format the same value:
  - Dates before the Gregorian reform of 1582. `formatDate` and `formatParts`
    display through the `gregory` calendar, which ICU treats as Julian before
    the cutover, and runtimes disagree about the shift.
  - `dateStyle` on a date-only value in `ja-JP` and `zh-CN`. V8 — Node *and*
    Chrome — renders `2026/9/16水曜日` where `temporal-polyfill` renders
    `2026年9月16日水曜日`, which is what the same request produces for a legacy
    `Date`. Explicit field options do not avoid it: V8 picks the numeric pattern
    for any Temporal date-only value. Two native runtimes agree with each other
    and two polyfilled ones do, so this only shows up when the two sides of a
    page run different implementations — a Node 22 server with a Chrome client,
    for example.
- `dayPeriodValue` matches typed text against the locale's own AM/PM labels, so
  a binding can accept them from a soft keyboard that gives it no usable `key`.

Full documentation lives in the [repository README](https://github.com/devlinduldulao/chrona#readme).

## License

[MIT](./LICENSE) © Devlin Duldulao
