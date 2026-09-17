# chrona-core

Temporal-native, headless date and time state machines. No legacy `Date` values,
no free-form date parsing, and no CSS.

This is the framework-agnostic layer of [Chrona](https://github.com/devlinduldulao/chrona).
It is plain TypeScript: pure transition functions, prop getters, and a tiny
external store. It renders nothing. If you want React components, install
[`chrona-react`](https://www.npmjs.com/package/chrona-react) instead — it is
built on this package.

> **Status: experimental 0.2.0.** Public APIs are not frozen for v1; 0.2.0
> splits the calendar cell getters. See the [changelog](./CHANGELOG.md). No
> screen-reader compatibility certification is claimed.

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

The runtime and the types are separate concerns. This package's declarations
reference `temporal-spec/global`, so importing anything from `chrona-core` also
brings the ambient `Temporal` namespace into scope — the examples below use
`Temporal.PlainDate` with no types import of their own.

Native support is capability-dependent, not merely version-dependent: some Node
builds handle ISO operations but throw `Not yet implemented` for non-ISO
calendar arithmetic.

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
| Temporal | `temporal`, `ChronaError`, `assertDate`, `sameDate`, `clampDate`, `startOfWeek`, `weeksInMonthView` |
| Calendar | `createCalendar`, `transitionCalendar`, `connectCalendar`, `syncCalendar`, `isDateDisabled`, `isInView`, `canPage`, `calendarKeys` |
| Range | `createRange`, `transitionRange`, `validateRange`, `rangeContains`, `getRangeCellProps`, `getRangeCellTriggerProps` |
| Field | `createField`, `transitionField`, `connectField`, `fieldSegments`, `fieldHourCycle`, `segmentBounds`, `digitValue` |
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
clamped. A segment with an open digit buffer is a draft: it emits no `invalid`
effect until it is finished or a `BLUR` event closes it. Ranges are inclusive at
both ends, normalize backward selection, and keep the first endpoint as draft
state.

Intl formatter caches are bounded to 100 entries per constructor, keyed by
locale and normalized options.

## Notes

- Output is ESM with declarations and source maps, targeting ES2022.
- `required` is accessibility metadata; it does not block native form submission.
- Styling hooks are `data-scope`, `data-part`, and state attributes such as
  `data-selected`, `data-today`, and `data-unavailable`.
- Intl output is normalized to plain spaces (U+202F and U+00A0 are collapsed) so
  markup does not depend on which ICU version the runtime shipped with.

Full documentation lives in the [repository README](https://github.com/devlinduldulao/chrona#readme).

## License

[MIT](./LICENSE) © Devlin Duldulao
