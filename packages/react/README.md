# chrona-react

Headless, Temporal-native React date and time primitives. No legacy `Date`
values, no free-form date parsing, and no CSS — you own every pixel.

Part of [Chrona](https://github.com/devlinduldulao/chrona). Built on
[`chrona-core`](https://www.npmjs.com/package/chrona-core).

> **Status: experimental 0.1.0.** Public APIs and styling attributes are not
> frozen for v1. Automated axe checks pass, but no screen-reader compatibility
> certification is claimed.

## Install

```sh
npm install chrona-react
```

React 18 or 19. Both are gated in CI.

## Temporal Is Application-Owned

Chrona reads `globalThis.Temporal` and never installs a runtime for you. Where
it is not native, load a polyfill before rendering:

```ts
import "temporal-polyfill/global";
```

The TypeScript types come along for free: `chrona-core`'s declarations reference
`temporal-spec/global`, so importing anything from this package puts the ambient
`Temporal` namespace in scope, exactly as the examples below assume.

## Calendar

```tsx
"use client";

import { useState } from "react";
import { Calendar, ChronaProvider } from "chrona-react";

export function BookingCalendar() {
  const [value, setValue] = useState<Temporal.PlainDate | null>(null);
  const reference = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });

  return (
    <ChronaProvider locale="en-US" timeZone="Europe/Copenhagen">
      <Calendar.Root value={value} onChange={setValue} placeholderValue={reference} fixedWeeks>
        <Calendar.Header>
          <Calendar.PrevButton>Previous</Calendar.PrevButton>
          <Calendar.Heading />
          <Calendar.NextButton>Next</Calendar.NextButton>
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader />
          <Calendar.GridBody />
        </Calendar.Grid>
        <Calendar.LiveRegion className="visually-hidden" />
        <Calendar.HiddenInput name="bookingDate" />
      </Calendar.Root>
    </ChronaProvider>
  );
}
```

Supply your own CSS, including the visually-hidden utility. Keyboard support
covers arrows, Home/End, PageUp/PageDown, Shift+PageUp/PageDown, and
Enter/Space, with RTL and locale week starts. Unavailable dates stay focusable
but unselectable; hard-disabled dates are not interactive.

`Calendar.Cell` renders the `role="gridcell"` wrapper and `Calendar.CellTrigger`
the button inside it, so the control keeps its button role in the accessibility
tree; a cell given no children renders its trigger for you. Style the
interactive element as `[data-part="cell-trigger"]`. `PrevButton` and
`NextButton` render a default chevron, pointing the way they page in the
resolved reading direction, when you give them no children; `DatePicker.Trigger`
does the same with a calendar glyph.

## DatePicker

```tsx
<DatePicker.Root value={value} onChange={setValue} placeholderValue={reference}>
  <DatePicker.Label>Appointment</DatePicker.Label>
  <DatePicker.Field />
  <DatePicker.Trigger>Choose date</DatePicker.Trigger>
  <DatePicker.Popover>
    <DatePicker.Calendar />
  </DatePicker.Popover>
  <DatePicker.HiddenInput name="appointment" />
</DatePicker.Root>
```

`DatePicker` accepts every `DateField` prop. `placeholderValue` is one of them,
and it decides the reference date the segments and the calendar open on before a
value exists — supply it (or `value`/`defaultValue`) rather than falling back to
today.

The popover is a native `<dialog>`, modal by default. It anchors to its trigger,
flips above when that fits, shifts to stay in the viewport, and scrolls
internally when oversized. Escape, outside pointer dismissal, and selection all
return focus to the trigger.

## Components

| Export | Subpath | Notes |
| --- | --- | --- |
| `Calendar` | `chrona-react/calendar` | Single or multi-month grid |
| `RangeCalendar` | `chrona-react/range-calendar` | Inclusive `{ start, end }`; draft first endpoint |
| `DateField` | `chrona-react/date-field` | Locale-ordered segments; ISO/Gregorian years 1–9999 |
| `TimeField` | `chrona-react/time-field` | `hourCycle` h11/h12/h23/h24, minute or second granularity |
| `DatePicker` | `chrona-react/date-picker` | Field plus calendar in a native dialog |
| `ChronaProvider` | — | Ambient `locale` and `timeZone` |

A barrel export is also available. Matching hooks — `useCalendar`,
`useRangeCalendar`, `useDateField`, `useTimeField`, `useDatePicker` — expose
`state`, resolved `options`, and `send` for custom shells.

## Styling And Forms

Style via `data-scope`, `data-part`, and state attributes: `data-selected`,
`data-focused`, `data-today`, `data-disabled`, `data-unavailable`,
`data-outside-month`, `data-in-range`, `data-range-start`, `data-range-end`,
`data-preview`, `data-invalid`, `data-placeholder`.

Date cells are two parts: `cell` is the `role="gridcell"` wrapper, `cell-trigger`
is the button that takes focus, hover, and the click. Both carry the state
attributes. The default icons are `data-part="chevron"` on the paging buttons
and `data-part="trigger-icon"` on the picker trigger.

Layout and button parts accept `asChild` with event and ref composition. Input
segments, hidden inputs, and the dialog keep their HTML elements.

Hidden inputs serialize with `.toString()` and are never read back.
`RangeCalendar`'s `HiddenInput name="stay"` emits `stay.start` and `stay.end`.

**`required` is accessibility metadata, not native submit blocking.** Hidden
inputs do not take part in browser constraint validation — validate required,
incomplete, or invalid values in your form layer before submission.

## Notes

- ESM with declarations and source maps, targeting ES2022.
- Size budgets, minified + gzip, excluding React: Calendar 6 kB, DatePicker 12 kB.
- Blank segments read `mm/dd/yyyy` and `hh:mm`; filled numeric segments except
  the year are zero-padded, so a field keeps one width as it fills.
- Typed digits are literal and stepping clamps: 29 February is reachable before
  the year is typed, and a finished date the calendar cannot hold reports
  `onInvalid("nonexistent")` instead of sliding to the 28th. Validation waits for
  a segment to finish, so a half-typed year raises nothing until blur.
- Use `value`/`onChange` or `defaultValue`/`onChange` — do not switch modes
  during a component's lifetime.

## Server Rendering

These are client components: mark the module that renders them `"use client"`.

The polyfill import is a side effect, so it has to reach the *client* bundle.
Importing `temporal-polyfill/global` from a Server Component file installs
Temporal on the server only. Put it at the top of a `"use client"` module that
always loads — a providers file, for example — so it runs before hydration:

```tsx
// app/providers.tsx
"use client";

import "temporal-polyfill/global";
import { ChronaProvider } from "chrona-react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChronaProvider locale="en-US" timeZone="Europe/Copenhagen">{children}</ChronaProvider>;
}
```

Pass the same reference date, value, locale, and time zone on server and client.
`timeZone` matters because today is resolved at render time, and a server in
another zone marks a different cell.

Segment literals are normalized before they reach the DOM: `Intl` emits U+202F
before AM/PM on newer ICU data and a plain space on older data, and Node and the
browser rarely ship the same ICU. Chrona collapses both to a plain space, so a
12-hour `TimeField` hydrates cleanly without forcing `hourCycle="h23"`.

Full documentation lives in the [repository README](https://github.com/devlinduldulao/chrona#readme).

## License

[MIT](./LICENSE) © Devlin Duldulao
