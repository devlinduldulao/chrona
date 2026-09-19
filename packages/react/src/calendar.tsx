import * as React from "react";
import { calendarKeys, connectCalendar, createCalendar, createStore, formatDate, getNumberFormatter, resolveWeekStart, sameDate, syncCalendar, temporal, transitionCalendar, translations, weeksInMonthView, type CalendarEvent, type CalendarOptions, type PlainDate } from "chrona-core";
import { Part, composeEvent, type PartProps } from "./part";
import { useChronaConfig } from "./provider";
import { useFormReset, type HiddenInputProps } from "./form";

export interface CalendarProps extends CalendarOptions {
    defaultValue?: PlainDate | null;
    defaultFocusedValue?: PlainDate;
    onChange?: (value: PlainDate | null) => void;
    onSelect?: (value: PlainDate) => void;
    onFocusedValueChange?: (value: PlainDate) => void;
    id?: string;
}

/**
 * `today` depends on when and where the page is rendered, so a server render — including a page
 * prerendered at build time and served days later — cannot know the reader's. Resolving it through
 * `useSyncExternalStore` keeps the hydrating markup identical to the server's (no marker) and lets
 * React correct it right after, instead of leaving the server's day marked for good. Applications
 * that need the marker in the server HTML pass `today` themselves.
 */
const noStoreUpdates = () => () => {};
const noServerToday = () => null;
function useToday(options: CalendarOptions): PlainDate | undefined {
    const iso = React.useSyncExternalStore(noStoreUpdates, () => temporal().Now.plainDateISO(options.timeZone).toString(), noServerToday);
    return options.today ?? (iso === null ? undefined : temporal().PlainDate.from(iso));
}

export function useCalendar(props: CalendarProps = {}) {
    const options = useChronaConfig(props);
    const generatedId = React.useId();
    const id = props.id ?? generatedId;
    const [store] = React.useState(() => createStore(createCalendar({ ...options, value: props.value !== undefined ? props.value : props.defaultValue, focusedValue: props.focusedValue ?? props.defaultFocusedValue })));
    const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
    // The store is the single source of truth; controlled props are reconciled into it by syncCalendar.
    const state = syncCalendar(snapshot, { ...options, value: props.value, focusedValue: props.focusedValue });
    React.useEffect(() => { store.setState(state); });
    const today = useToday(options);
    const rootRef = React.useRef<HTMLElement | null>(null);
    const pendingFocus = React.useRef(false);
    const [announcement, setAnnouncement] = React.useState("");

    React.useEffect(() => {
        if (pendingFocus.current) {
            pendingFocus.current = false;
            rootRef.current?.querySelector<HTMLElement>('[data-part="cell-trigger"][tabindex="0"]')?.focus();
        }
    });

    function send(event: CalendarEvent) {
        const dir = options.dir ?? (rootRef.current?.closest("[dir]")?.getAttribute("dir") === "rtl" ? "rtl" : "ltr");
        const result = transitionCalendar(state, event, { ...options, dir });
        store.setState(result.state);
        for (const effect of result.effects) {
            if (effect.type === "focus") {
                pendingFocus.current = true;
                if (!sameDate(effect.value, state.focusedValue)) props.onFocusedValueChange?.(effect.value);
            } else if (effect.type === "change") {
                props.onChange?.(effect.value);
                setAnnouncement(effect.value ? (options.translations?.selected ?? translations.selected)(formatDate(effect.value, options.locale, { dateStyle: "full" })) : "");
            } else {
                props.onSelect?.(effect.value);
            }
        }
    }

    return {
        state, options, send, rootRef, announcement,
        api: connectCalendar(state, { ...options, id, today }),
        months: Array.from({ length: options.numberOfMonths ?? 1 }, (_, index) => state.visibleMonth.add({ months: index })),
    };
}

type CalendarContextValue = ReturnType<typeof useCalendar>;
const Context = React.createContext<CalendarContextValue | null>(null);
const MonthContext = React.createContext<PlainDate | null>(null);

function useContext() {
    const value = React.useContext(Context);
    if (!value) throw new Error("Calendar parts must be inside Calendar.Root.");
    return value;
}

export function CalendarRoot({ children, asChild, className, style, ...props }: CalendarProps & Pick<PartProps, "children" | "asChild" | "className" | "style">) {
    const calendar = useCalendar(props);
    return <CalendarSurface calendar={calendar} id={props.id} asChild={asChild} className={className} style={style}>{children}</CalendarSurface>;
}

export function CalendarSurface({ calendar, ...props }: PartProps & { calendar: CalendarContextValue }) {
    return <Context.Provider value={calendar}><Part {...calendar.api.getRootProps()} {...props} ref={calendar.rootRef} /></Context.Provider>;
}

const Header = React.forwardRef<HTMLElement, PartProps>(function Header(props, ref) {
    return <Part {...props} ref={ref} data-scope="calendar" data-part="header" />;
});

const Heading = React.forwardRef<HTMLElement, PartProps>(function Heading({ children, ...props }, ref) {
    const { months, options } = useContext();
    const month = React.useContext(MonthContext);
    return <Part as="h2" {...props} ref={ref} data-scope="calendar" data-part="heading" aria-live="polite" aria-atomic="true">{children ?? (month ? [month] : months).map((date) => formatDate(date, options.locale, { month: "long", year: "numeric" })).join(options.translations?.rangeSeparator ?? translations.rangeSeparator)}</Part>;
});

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean };

/**
 * Paging buttons carry an `aria-label` but no text, so without a default they render as blank
 * chrome for sighted users. The arrow points the way the button pages in the resolved direction.
 */
function Chevron({ towards }: { towards: "start" | "end" }) {
    const points = towards === "start" ? "15 4 7 12 15 20" : "9 4 17 12 9 20";
    return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-scope="calendar" data-part="chevron"><polyline points={points} /></svg>;
}

const PrevButton = React.forwardRef<HTMLElement, ButtonProps>(function PrevButton({ onClick, children, ...props }, ref) {
    const { api, send, options } = useContext();
    return <Part as="button" {...props} {...api.getPrevButtonProps()} ref={ref} onClick={composeEvent(onClick, () => send({ type: "PAGE", direction: -1 }))}>{children ?? <Chevron towards={options.dir === "rtl" ? "end" : "start"} />}</Part>;
});

const NextButton = React.forwardRef<HTMLElement, ButtonProps>(function NextButton({ onClick, children, ...props }, ref) {
    const { api, send, options } = useContext();
    return <Part as="button" {...props} {...api.getNextButtonProps()} ref={ref} onClick={composeEvent(onClick, () => send({ type: "PAGE", direction: 1 }))}>{children ?? <Chevron towards={options.dir === "rtl" ? "start" : "end"} />}</Part>;
});

const Grid = React.forwardRef<HTMLElement, PartProps & { monthIndex?: number }>(function Grid({ monthIndex = 0, children, ...props }, ref) {
    const { api, months } = useContext();
    const month = months[monthIndex];
    if (!month) throw new Error("Calendar.Grid monthIndex is outside numberOfMonths.");
    return <MonthContext.Provider value={month}><Part {...props} {...api.getGridProps(month)} ref={ref}>{children}</Part></MonthContext.Provider>;
});

function useMonth() {
    const context = useContext();
    const month = React.useContext(MonthContext) ?? context.state.visibleMonth;
    return { ...context, month, weeks: weeksInMonthView(month.toPlainYearMonth(), resolveWeekStart(context.options.locale, context.options.firstDayOfWeek), context.options.fixedWeeks) };
}

export interface Weekday { date: PlainDate; label: string }

const GridHeader = React.forwardRef<HTMLElement, Omit<PartProps, "children"> & { children?: (day: Weekday) => React.ReactNode }>(function GridHeader({ children, ...props }, ref) {
    const { weeks, options } = useMonth();
    return <Part {...props} ref={ref} role="row" data-scope="calendar" data-part="grid-header">{weeks[0]!.map((date) => {
        const day = { date, label: formatDate(date, options.locale, { weekday: "short" }) };
        return <React.Fragment key={date.toString()}>{children ? children(day) : <HeaderCell day={day} />}</React.Fragment>;
    })}</Part>;
});

const HeaderCell = React.forwardRef<HTMLElement, PartProps & { day: Weekday }>(function HeaderCell({ day, children, ...props }, ref) {
    const { options } = useContext();
    return <Part {...props} ref={ref} role="columnheader" aria-label={formatDate(day.date, options.locale, { weekday: "long" })} data-scope="calendar" data-part="header-cell">{children ?? day.label}</Part>;
});

const GridBody = React.forwardRef<HTMLElement, Omit<PartProps, "children"> & { children?: (date: PlainDate) => React.ReactNode }>(function GridBody({ children, ...props }, ref) {
    const { weeks } = useMonth();
    return <Part {...props} ref={ref} role="rowgroup" data-scope="calendar" data-part="grid-body">{weeks.map((week) => <div key={week[0]!.toString()} role="row" data-scope="calendar" data-part="row">{week.map((date) => <React.Fragment key={date.toString()}>{children ? children(date) : <Cell date={date} />}</React.Fragment>)}</div>)}</Part>;
});

const CellContext = React.createContext<PlainDate | null>(null);

const CellTrigger = React.forwardRef<HTMLElement, ButtonProps>(function CellTrigger({ children, onClick, onKeyDown, onFocus, ...props }, ref) {
    const { api, send, month, options } = useMonth();
    const date = React.useContext(CellContext);
    if (!date) throw new Error("Calendar.CellTrigger must be inside Calendar.Cell.");
    // aria-disabled instead of native disabled keeps out-of-range dates discoverable by screen readers.
    return <Part as="button" {...props} {...api.getCellTriggerProps(date, month)} ref={ref}
        onFocus={composeEvent(onFocus, () => { if (!options.disabled) send({ type: "FOCUS", date }); })}
        onClick={composeEvent(onClick, () => send({ type: "SELECT", date }))}
        onKeyDown={composeEvent(onKeyDown, (event) => {
            if (!calendarKeys.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            send({ type: "KEY_DOWN", key: event.key, shiftKey: event.shiftKey });
        })}>{children ?? getNumberFormatter(options.locale, { useGrouping: false }).format(date.day)}</Part>;
});

/** The grid semantics live on the cell; the button inside it stays a button. */
const Cell = React.forwardRef<HTMLElement, PartProps & { date: PlainDate }>(function Cell({ date, children, ...props }, ref) {
    const { api, month } = useMonth();
    return <CellContext.Provider value={date}><Part {...props} {...api.getCellProps(date, month)} ref={ref}>{children ?? <CellTrigger />}</Part></CellContext.Provider>;
});

const LiveRegion = React.forwardRef<HTMLElement, PartProps>(function LiveRegion(props, ref) {
    const { announcement } = useContext();
    return <Part {...props} ref={ref} role="status" aria-live="polite" aria-atomic="true" data-scope="calendar" data-part="live-region">{announcement}</Part>;
});

const ClearButton = React.forwardRef<HTMLElement, ButtonProps>(function ClearButton({ onClick, ...props }, ref) {
    const { options, send, state } = useContext();
    return <Part as="button" {...props} ref={ref} type="button" data-scope="calendar" data-part="clear-button" aria-label={options.translations?.clear ?? translations.clear} disabled={options.disabled || options.readOnly || state.value === null} onClick={composeEvent(onClick, () => send({ type: "CLEAR" }))} />;
});

function HiddenInput(props: HiddenInputProps) {
    const { state, options, send } = useContext();
    const input = React.useRef<HTMLInputElement>(null);
    useFormReset(input, props.form, () => send({ type: "RESET", value: options.defaultValue ?? null }));
    return <input {...props} ref={input} type="hidden" disabled={options.disabled || props.disabled} value={state.value?.toString() ?? ""} data-scope="calendar" data-part="hidden-input" />;
}

export const Calendar = { Root: CalendarRoot, Header, Heading, PrevButton, NextButton, Grid, GridHeader, HeaderCell, GridBody, Cell, CellTrigger, LiveRegion, ClearButton, HiddenInput };