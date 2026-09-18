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
- A segment with an open digit buffer is a draft and emits no `invalid` effect.
  Send `BLUR` to close the draft and validate what is left.
- `segmentBounds` widens the day when the month or year is still blank, so
  29 February stays reachable in month/day/year locales.

## Intl

Formatter caches are bounded to 100 entries per constructor, keyed by locale and
normalized options. `formatDate`/`formatParts` collapse U+202F and U+00A0 to a
plain space so markup does not depend on the runtime's ICU version.
