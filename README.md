# Chrona

Temporal-native, headless date and time primitives. No legacy `Date` values,
no free-form date parsing, and no CSS in the published packages.

**Status: experimental 0.1.0 implementation.** This is a working first release,
not completion of the full [architecture roadmap](PLANS.md). Packages have not
been published. No screen-reader compatibility certification is claimed.

## Develop

Use Node 22+ and pnpm 12.3.4 for development.

```sh
pnpm install
pnpm dev
```

Vite prints the local workbench URL. The workbench includes live state,
configuration, API examples, and events for every implemented component.
It uses the app-owned polyfill by default; the runtime selector can switch to
native Temporal when available.

```sh
pnpm check                         # types, hook lint, coverage, build, size
pnpm test:native                   # requires a native Temporal-enabled Node
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e                      # Chromium, Firefox, WebKit; desktop/mobile
```

The browser test runner builds the workbench and starts/stops a fresh production
preview on port 4174. It never reuses the development server. On Linux CI, install
browsers with `pnpm exec playwright install --with-deps chromium firefox webkit`.
Package coverage thresholds are 95% lines/statements, 90% functions, and 80%
branches; `pnpm coverage` writes an HTML report to `coverage/`.
See [CONTRIBUTING.md](CONTRIBUTING.md) for formatting and release procedures,
and [SECURITY.md](SECURITY.md) for the provisional reporting policy.

## Packages

| Package | Contents |
| --- | --- |
| `@chrona/core` | Pure Calendar, range, field, and picker transitions; prop getters; locale utilities; external store; focus effect helper |
| `@chrona/react` | `Calendar`, `RangeCalendar`, `DateField`, `TimeField`, `DatePicker`, hooks, and `ChronaProvider` |
| `@chrona/playground` | Private Vite workbench; owns all CSS, icons, and the optional runtime polyfill |

Library output is ESM with declarations and source maps, targeting ES2022.
React 18+ is the peer contract. Tests currently run with React 19.
`temporal-spec` is a **type-only dependency** of core; no runtime date library,
polyfill, locale catalog, or positioning dependency is bundled into core.

Public React subpaths: `/calendar`, `/range-calendar`, `/date-field`,
`/time-field`, and `/date-picker`. A barrel export is also available.

## Temporal Setup

Applications own the Temporal runtime. In environments needing a polyfill,
load its global entry before creating values or rendering Chrona:

```ts
import "temporal-polyfill/global";
```

Chrona always uses `globalThis.Temporal`. The guard runs when an operation
needs Temporal, not at module import. This keeps tree-shaking and SSR imports
safe. Missing Temporal produces an actionable `ChronaError`.

Native support is capability-dependent, not just version-dependent. The local
Node 26.4.0 runtime supports ISO operations but throws `Not yet implemented`
for non-ISO arithmetic. The native test command reports these as explicit
capability skips; the polyfill suite exercises all five calendar systems.
Chrona does not switch runtimes behind the application's back.

## Calendar

```tsx
"use client";

import { useState } from "react";
import { Calendar, ChronaProvider } from "@chrona/react";

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

Supply your own CSS, including any visually-hidden utility. `GridHeader` and
`GridBody` accept render functions for custom cells. For multi-month views,
set `numberOfMonths` and render one `Calendar.Grid monthIndex={index}` per
month. `useCalendar()` exposes the controller and month list for custom shells.
`translations.rangeSeparator` customizes the multi-month heading separator.

Calendar supports arrows, Home/End, PageUp/PageDown, Shift+PageUp/PageDown,
Enter/Space, RTL, locale week starts, min/max, unavailable dates, fixed weeks,
and paged multi-month navigation. Unavailable dates remain focusable but cannot
be selected; hard-disabled dates are not interactive. Read-only grids retain
navigation. `onSelect` fires for valid selection actions even if the value is
unchanged; `onChange` only fires for changed values.

## Fields And Pickers

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

`DateField` and `TimeField` have `Root`, `Label`, `Field`, `Segment`,
`HiddenInput`, `ClearButton`, and optional `LiveRegion`. Empty fields use `null`. Locale-ordered
segments come from Intl. Numeric editing accepts ASCII and localized digits,
not full strings. Paste/drop input is rejected. Arrow keys step segments,
Home/End choose segment bounds, Left/Right move focus, and Delete/Backspace
clear segments. DateField currently supports ISO/Gregorian years 1-9999.
Mount `LiveRegion` (also available on DatePicker) to announce invalid edits;
style it with your own visually-hidden utility. `translations.invalidRange`
and `translations.unavailable` customize feedback, while `onInvalid` remains
available for application validation UI. Valid edits, clearing, and resets
clear the announcement. Externally supplied `invalid` is application-owned and
does not generate an edit announcement.

TimeField accepts `hourCycle` (`h11`, `h12`, `h23`, `h24`) and `granularity`
(`minute`, `second`). Day periods support arrow stepping and A/P shortcuts;
localized day-period text typing and IME composition are not implemented.
Hidden seconds and subseconds are retained when editing a supplied value.

DatePicker composes the same field and Calendar behavior. `open`,
`defaultOpen`, and `onOpenChange` control its native dialog. Modal behavior is
the default; `modal={false}` opts out of inertness and focus trapping.
Escape/outside pointer dismissal and selection return focus to the trigger.
Popover anchors to its trigger by default, flips above when it fits, and shifts
within the visible viewport. Oversized content is constrained to the viewport
with a 4px gutter and scrolls internally. Positioning updates on scroll, viewport
resize, and trigger/dialog resize, coalesced to one update per animation frame.
`anchored={false}` opts out of positioning;
temporary inline constraints are restored on opt-out or close. Visual styling
remains application-owned.
Focus belongs to the committed dialog lifecycle, not a proposed transition:
rejecting a controlled open/close request does not move focus. Core
`transitionPicker` emits only `openChange`; the experimental unused `focus`
effect has been removed. Dialog label references follow mounted `DatePicker.Label`
parts; an explicit `aria-label` or `aria-labelledby` can supply a custom name.

## Ranges, Forms, And Validation

`RangeCalendar` uses `{ start: Temporal.PlainDate, end: Temporal.PlainDate }`.
Both ends are inclusive. The first selection is draft state, exposed through
`onRangeStartChange`; only complete ranges reach `onChange`. Backward selection
is normalized. Pointer hover and keyboard focus preview the range; Escape
cancels the draft. Ranges crossing unavailable dates are rejected and call
`onInvalid`. Its anatomy matches Calendar. `HiddenInput name="stay"` emits
`stay.start` and `stay.end` form entries.
Hidden inputs share the ordinary input props except `type`, `value`,
`defaultValue`, and `onChange`. Range input `name` remains required because it
creates two entries; `id="stay"` produces `stay-start` and `stay-end`, while
other supplied props apply to both. Root or input `disabled` disables submission.

When `isDateUnavailable` is supplied, endpoints more than 10,000 days apart
are rejected with `onInvalid` before the per-day scan. The draft remains active
and no range change is emitted. Exactly 10,000 days apart is allowed and scans
10,001 inclusive dates. This scan limit does not apply when the callback is absent.

Use `value`/`onChange` or `defaultValue`/`onChange`; do not switch modes during
a component's lifetime. Supply `focusedValue`/`onFocusedValueChange` for a
controlled Calendar cursor, or `defaultFocusedValue` to set its initial cursor
without controlling it. Later changes to `defaultFocusedValue` are ignored.
For deterministic SSR, supply the same reference
date, value, locale, and time zone on server and client. In Server Component
frameworks, consume the React package from a client component.

Field props include `minValue`, `maxValue`, `disabled`, `readOnly`, `required`,
`invalid`, `describedBy`, and `onInvalid`. Invalid edited values are not emitted
as valid values. Clearing a populated field emits `null`; partial drafts stay
internal. Hidden inputs serialize with `.toString()` and are never read back.
Form reset restores the latest `defaultValue` through Temporal state and respects canceled resets.
Changing a hidden input's `form` prop moves its reset subscription to the new
associated form; the former form no longer resets it.
For controlled fields, the application must accept the reset callback.

## Hook Contracts

All public controllers expose `state`, resolved `options`, and `send`. Their
domain-specific helpers are intentionally not forced into identical types:

| Hook | Additional controller fields |
| --- | --- |
| `useCalendar` | `api` prop getters, `months`, `rootRef`, `announcement` |
| `useRangeCalendar` | range-aware `api`, `months`, `rootRef`, `announcement`, `reset`, composed `calendar` |
| `useDateField` / `useTimeField` | `api` segment/group getters, `id`, `groupRef`, `moveFocus`, `reset`, `announcement` |
| `useDatePicker` | `id`, `value`, `open`, `change`, `trigger`; no calendar/field prop getters of its own |

Picker `state` contains `{ value, open }`; existing top-level fields and
`props` aliases remain compatible. Range `props` aliases resolved `options`.
DOM refs and label-registration helpers support compound parts; mutating them
is not a substitute for events. Hook return objects/callbacks are not guaranteed
referentially stable. Field configured state is reused when its inputs are
unchanged, and unchanged Calendar state preserves identity.

Range composition intentionally retains two stores: Calendar owns cursor/view
navigation with a null selection, while the range machine owns committed and
draft endpoints. Range-aware getters overlay selection, and focus/selection
callbacks bridge the stores. This is covered by integration tests, not a new
single-store abstraction. Public contracts remain experimental pending manual
accessibility and release review; they are not frozen for v1 yet.

Intl date/time, number, and locale caches are bounded to 100 entries per
constructor, keyed by locale and normalized options. Replacing an Intl
constructor (for example when installing the app's polyfill) creates a separate
cache. Applications still own runtime initialization.

## Validation Responsibility

**`required` is accessibility metadata, not native submit blocking.** Hidden
inputs do not participate in browser constraint validation. Validate required,
incomplete, or application-supplied invalid values in your form layer before
submission. Async validation, parsing, persistence, and hydration deserialization
are application responsibilities.

## Styling And Accessibility

Use `data-scope`, `data-part`, and state attributes such as `data-selected`,
`data-focused`, `data-today`, `data-disabled`, `data-unavailable`,
`data-outside-month`, `data-in-range`, `data-range-start`, `data-range-end`,
`data-preview`, `data-invalid`, and `data-placeholder`.
Composed pickers retain the scopes of the primitives they reuse.

Layout and button parts support `asChild` with event/ref composition. Input
segments, hidden inputs, and the native dialog intentionally retain their HTML
elements. Auto-rendered grid rows and literals can be styled using data parts.
Size targets, focus-ring styling, and visually hidden announcements are app-owned.

Automated gates cover core/property tests, type rejection, React interactions,
SSR output, axe, Chromium/Firefox/WebKit desktop interactions, and mobile-sized
Chromium/WebKit interactions. Browser screenshots
are written to `test-results/`. NVDA, JAWS, VoiceOver, TalkBack, real virtual
keyboards, and cross-browser manual release testing are still required.
Automated axe success is not equivalent to complete accessibility certification.

Size budgets are minified + gzip, include tree-shaken core code, and exclude
React/ReactDOM: Calendar 6 kB, DatePicker 12 kB, complete core 12 kB.

## Remaining Roadmap

Not implemented: MonthGrid/YearGrid, MonthPicker/YearPicker, DateTimeField,
DateTimePicker, a composed TimePicker, DateRangePicker, zoned fields/pickers,
TimeZoneSelect, DST interaction UX, framework bindings beyond React, the docs
website, adapters, and production error-message stripping. Public APIs and
styling attributes remain experimental until the v1 accessibility/release audit.

The workbench's sample studio photograph is downloaded from
[Unsplash](https://images.unsplash.com/photo-1497366754035-f200968a6e72).

## License

[MIT](LICENSE) © Devlin Duldulao