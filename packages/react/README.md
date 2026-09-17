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
- For deterministic SSR, pass the same reference date, value, locale, and time
  zone on server and client. In Server Component frameworks, consume this
  package from a client component.
- Use `value`/`onChange` or `defaultValue`/`onChange` — do not switch modes
  during a component's lifetime.

Full documentation lives in the [repository README](https://github.com/devlinduldulao/chrona#readme).

## License

[MIT](./LICENSE) © Devlin Duldulao
