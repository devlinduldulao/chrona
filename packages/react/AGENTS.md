# chrona-react for agents

Headless React date/time primitives over the Temporal proposal. Full docs:
https://github.com/devlinduldulao/chrona#readme

## Setup that is easy to get wrong

1. **Runtime.** Chrona reads `globalThis.Temporal` and never installs it. Where
   Temporal is not native, `import "temporal-polyfill/global"` before rendering.
2. **Types.** No extra import is needed. `chrona-core`'s declarations reference
   `temporal-spec/global`, so `Temporal.PlainDate` resolves as an ambient global
   in any file that imports from Chrona. A file that uses Temporal types without
   importing Chrona needs `import "temporal-spec/global"` of its own.
3. **Server Components.** These components hold state: mark their module
   `"use client"`. The polyfill import is a side effect, so it must reach the
   client bundle — put it at the top of a `"use client"` module that always
   loads (a providers file), not in a Server Component. That covers hydration.
4. **SSR module init.** The providers import does not order Node module
   evaluation. If another `"use client"` file reads `Temporal` at module scope
   (`const reference = Temporal.PlainDate.from(...)` at the top of `page.tsx`),
   Next.js may evaluate that file during SSR before `providers.tsx` has run and
   throw `ReferenceError: Temporal is not defined`. Import the polyfill at the
   top of *that* file too, or move the call inside the component body.
5. **Values are Temporal objects.** Strings and `Date` are rejected with a
   `ChronaError`; there is no parsing layer.

## Anatomy

```tsx
<Calendar.Root value={value} onChange={setValue} placeholderValue={reference}>
  <Calendar.Header><Calendar.PrevButton /><Calendar.Heading /><Calendar.NextButton /></Calendar.Header>
  <Calendar.Grid><Calendar.GridHeader /><Calendar.GridBody /></Calendar.Grid>
</Calendar.Root>
```

`Calendar.Cell` is the `role="gridcell"` wrapper and `Calendar.CellTrigger` the
button inside it; a cell with no children renders its trigger. Style the
interactive element as `[data-part="cell-trigger"]`. Paging buttons render a
default chevron when given no children, and `DatePicker.Trigger` a calendar
glyph.

`DatePicker` takes every `DateField` prop, `placeholderValue` included — it is
what the field and calendar open on before a value exists.

## Field behavior

- Blank segments read `mm/dd/yyyy` and `hh:mm`; filled numeric segments other
  than the year are zero-padded.
- Typed digits are literal, stepping clamps. 29 February is reachable before the
  year is typed; a finished date that cannot exist reports
  `onInvalid("nonexistent")` rather than clamping to the 28th.
- Validation waits for a segment to finish. A half-typed year emits nothing
  until it is complete or the field blurs.
- Empty fields are `null`. Partial drafts stay internal; `onChange` only sees
  complete, valid values.

## SSR determinism

Pass the same reference date, value, locale, and `timeZone` on server and
client — today is resolved at render time. Segment literals are normalized
(U+202F and U+00A0 collapse to a plain space), so a 12-hour `TimeField` hydrates
cleanly across differing ICU versions; `hourCycle="h23"` is not a requirement.

## Not implemented

MonthPicker/YearPicker, DateTimeField, DateTimePicker, TimePicker,
DateRangePicker, zoned fields/pickers, TimeZoneSelect. Public APIs are
experimental at 0.x and not frozen for v1.
