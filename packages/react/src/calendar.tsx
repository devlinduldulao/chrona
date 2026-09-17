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

export function useCalendar(props: CalendarProps = {}) {
    const options = useChronaConfig(props);
    const generatedId = React.useId();
    const id = props.id ?? generatedId;
    const [store] = React.useState(() => createStore(createCalendar({ ...options, value: props.value !== undefined ? props.value : props.defaultValue, focusedValue: props.focusedValue ?? props.defaultFocusedValue })));
    const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
    // The store is the single source of truth; controlled props are reconciled into it by syncCalendar.
    const state = syncCalendar(snapshot, { ...options, value: props.value, focusedValue: props.focusedValue });
    React.useEffect(() => { store.setState(state); });
    const rootRef = React.useRef<HTMLElement | null>(null);
    const pendingFocus = React.useRef(false);
    const [announcement, setAnnouncement] = React.useState("");

    React.useEffect(() => {
        if (pendingFocus.current) {
            pendingFocus.current = false;
            rootRef.current?.querySelector<HTMLElement>('[data-part="cell"][tabindex="0"]')?.focus();
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
        api: connectCalendar(state, { ...options, id, today: temporal().Now.plainDateISO(options.timeZone) }),
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

const PrevButton = React.forwardRef<HTMLElement, ButtonProps>(function PrevButton({ onClick, ...props }, ref) {
    const { api, send } = useContext();
    return <Part as="button" {...props} {...api.getPrevButtonProps()} ref={ref} onClick={composeEvent(onClick, () => send({ type: "PAGE", direction: -1 }))} />;
});

const NextButton = React.forwardRef<HTMLElement, ButtonProps>(function NextButton({ onClick, ...props }, ref) {
    const { api, send } = useContext();
    return <Part as="button" {...props} {...api.getNextButtonProps()} ref={ref} onClick={composeEvent(onClick, () => send({ type: "PAGE", direction: 1 }))} />;
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

const Cell = React.forwardRef<HTMLElement, ButtonProps & { date: PlainDate }>(function Cell({ date, children, onClick, onKeyDown, onFocus, ...props }, ref) {
    const { api, send, month, options } = useMonth();
    const cellProps = api.getCellProps(date, month);
    // aria-disabled instead of native disabled keeps out-of-range cells discoverable by screen readers.
    return <Part as="button" {...props} {...cellProps} type="button" ref={ref}
        onFocus={composeEvent(onFocus, () => { if (!options.disabled) send({ type: "FOCUS", date }); })}
        onClick={composeEvent(onClick, () => send({ type: "SELECT", date }))}
        onKeyDown={composeEvent(onKeyDown, (event) => {
            if (!calendarKeys.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            send({ type: "KEY_DOWN", key: event.key, shiftKey: event.shiftKey });
        })}>{children ?? getNumberFormatter(options.locale, { useGrouping: false }).format(date.day)}</Part>;
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

export const Calendar = { Root: CalendarRoot, Header, Heading, PrevButton, NextButton, Grid, GridHeader, HeaderCell, GridBody, Cell, LiveRegion, ClearButton, HiddenInput };