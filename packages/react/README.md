# chrona-react

Headless, Temporal-native React date and time primitives. No legacy `Date`
values, no free-form date parsing, and no CSS — you own every pixel.

Part of [Chrona](https://github.com/devlinduldulao/chrona). Built on
[`chrona-core`](https://www.npmjs.com/package/chrona-core).

> **Status: experimental 0.2.1.** Public APIs and styling attributes are not
> frozen for v1; 0.2.0 changes the Calendar cell anatomy. See the
> [changelog](./CHANGELOG.md). Automated axe checks pass, but no screen-reader
> compatibility certification is claimed.

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

## With shadcn/ui

Chrona does not replace shadcn. Keep `Button`, `Popover`, `Label`, and `cn`.
Replace the `react-day-picker` calendar and the native `<input type="time">`.
Values stay `Temporal.PlainDate` / `Temporal.PlainTime` — do not convert through
`Date`. Style days as `[data-part="cell-trigger"]`.

```tsx
"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Calendar as ChronaCalendar, TimeField } from "chrona-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const calendarClassName = cn(
  "bg-background p-3",
  "[&_[data-part=header]]:mb-2 [&_[data-part=header]]:flex [&_[data-part=header]]:items-center [&_[data-part=header]]:justify-between",
  "[&_[data-part=heading]]:text-sm [&_[data-part=heading]]:font-medium",
  "[&_[data-part=grid-header]]:grid [&_[data-part=grid-header]]:grid-cols-7",
  "[&_[data-part=header-cell]]:text-muted-foreground [&_[data-part=header-cell]]:text-center [&_[data-part=header-cell]]:text-[0.8rem]",
  "[&_[data-part=row]]:grid [&_[data-part=row]]:grid-cols-7",
  "[&_[data-part=cell-trigger]]:size-8 [&_[data-part=cell-trigger]]:w-full [&_[data-part=cell-trigger]]:rounded-md [&_[data-part=cell-trigger]]:text-sm",
  "[&_[data-part=cell-trigger][data-selected]]:bg-primary [&_[data-part=cell-trigger][data-selected]]:text-primary-foreground",
  "[&_[data-part=cell-trigger][data-today]]:bg-accent",
  "[&_[data-part=cell-trigger][data-outside-month]]:text-muted-foreground [&_[data-part=cell-trigger][data-outside-month]]:opacity-50",
);

export function ShadcnCalendar({
  value,
  onChange,
  placeholderValue,
  className,
}: {
  value: Temporal.PlainDate | null;
  onChange: (value: Temporal.PlainDate | null) => void;
  placeholderValue: Temporal.PlainDate;
  className?: string;
}) {
  return (
    <ChronaCalendar.Root
      value={value}
      onChange={onChange}
      placeholderValue={placeholderValue}
      fixedWeeks
      className={cn(calendarClassName, className)}
    >
      <ChronaCalendar.Header>
        <ChronaCalendar.PrevButton asChild>
          <Button variant="ghost" size="icon" className="size-8 p-0">
            <ChevronLeftIcon className="size-4" />
          </Button>
        </ChronaCalendar.PrevButton>
        <ChronaCalendar.Heading />
        <ChronaCalendar.NextButton asChild>
          <Button variant="ghost" size="icon" className="size-8 p-0">
            <ChevronRightIcon className="size-4" />
          </Button>
        </ChronaCalendar.NextButton>
      </ChronaCalendar.Header>
      <ChronaCalendar.Grid>
        <ChronaCalendar.GridHeader />
        <ChronaCalendar.GridBody />
      </ChronaCalendar.Grid>
      <ChronaCalendar.LiveRegion className="sr-only" />
    </ChronaCalendar.Root>
  );
}

export function ShadcnDateTimePicker() {
  const reference = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  const [time, setTime] = useState<Temporal.PlainTime | null>(
    Temporal.PlainTime.from("09:30:00"),
  );

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-3">
        <Label className="px-1">Date</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-40 justify-start font-normal">
              {date
                ? date.toLocaleString("en-US", { dateStyle: "medium" })
                : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <ShadcnCalendar
              value={date}
              placeholderValue={reference}
              onChange={(next) => {
                setDate(next);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <TimeField.Root value={time} onChange={setTime} hourCycle="h23" granularity="second">
        <TimeField.Label className="px-1">Time</TimeField.Label>
        <TimeField.Field className="border-input bg-background inline-flex h-9 items-center rounded-md border px-3 text-sm shadow-xs [&_[data-part=segment]]:w-6 [&_[data-part=segment]]:bg-transparent [&_[data-part=segment]]:text-center" />
      </TimeField.Root>
    </div>
  );
}
```

Chrona's `DatePicker` already owns a native `<dialog>` — do not wrap it in
shadcn `Popover`. Use `DatePicker.Trigger asChild` with `Button` instead:

```tsx
import { CalendarIcon } from "lucide-react";
import { DatePicker } from "chrona-react";

<DatePicker.Root value={date} onChange={setDate} placeholderValue={reference}>
  <DatePicker.Label asChild>
    <Label>Appointment</Label>
  </DatePicker.Label>
  <DatePicker.Field className="border-input inline-flex h-9 items-center rounded-md border px-3 text-sm" />
  <DatePicker.Trigger asChild>
    <Button variant="outline" size="icon">
      <CalendarIcon className="size-4" />
    </Button>
  </DatePicker.Trigger>
  <DatePicker.Popover className="bg-popover text-popover-foreground rounded-md border p-3 shadow-md">
    <DatePicker.Calendar />
  </DatePicker.Popover>
</DatePicker.Root>
```

`asChild` uses the child's children, so pass an icon (or omit `asChild` and keep Chrona's default glyph).

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

That covers the client bundle before hydration. It does not order Node module
evaluation. If another `"use client"` file reads `Temporal` at module scope
(`const reference = Temporal.PlainDate.from(...)` at the top of `page.tsx`),
Next.js may evaluate that file during SSR before `providers.tsx` has run and
throw `ReferenceError: Temporal is not defined`. Import the polyfill at the top
of that file too, or move the call inside the component body:

```tsx
"use client";

import "temporal-polyfill/global";
import { Calendar } from "chrona-react";

const REFERENCE = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
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
