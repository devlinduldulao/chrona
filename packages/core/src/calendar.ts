import { ChronaError, assertDate, clampDate, sameDate, startOfWeek, temporal, type PlainDate } from "./temporal";
import { formatDate, resolveWeekStart, type Translations, translations } from "./i18n";

export interface CalendarOptions {
    value?: PlainDate | null;
    focusedValue?: PlainDate;
    placeholderValue?: PlainDate;
    minValue?: PlainDate;
    maxValue?: PlainDate;
    firstDayOfWeek?: number;
    dir?: "ltr" | "rtl";
    disabled?: boolean;
    readOnly?: boolean;
    isDateUnavailable?: (date: PlainDate) => boolean;
    locale?: string;
    calendar?: string;
    timeZone?: string;
    numberOfMonths?: number;
    pagedNavigation?: boolean;
    fixedWeeks?: boolean;
    translations?: Partial<Translations>;
}

export interface CalendarState {
    value: PlainDate | null;
    focusedValue: PlainDate;
    visibleMonth: PlainDate;
}

export type CalendarEvent =
    | { type: "KEY_DOWN"; key: string; shiftKey?: boolean }
    | { type: "FOCUS"; date: PlainDate }
    | { type: "SELECT"; date: PlainDate }
    | { type: "PAGE"; direction: -1 | 1 }
    | { type: "CLEAR" }
    | { type: "RESET"; value: PlainDate | null };

export type CalendarEffect =
    | { type: "focus"; value: PlainDate }
    | { type: "select"; value: PlainDate }
    | { type: "change"; value: PlainDate | null };

function validateOptions(options: CalendarOptions): void {
    for (const [name, candidate] of Object.entries({ value: options.value, focusedValue: options.focusedValue, placeholderValue: options.placeholderValue, minValue: options.minValue, maxValue: options.maxValue })) {
        if (candidate != null) assertDate(candidate, name);
    }
    if (options.minValue && options.maxValue && temporal().PlainDate.compare(options.minValue, options.maxValue) > 0) {
        throw new ChronaError("INVALID_BOUNDS", "minValue must not be after maxValue.");
    }
    const count = options.numberOfMonths ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 12) {
        throw new ChronaError("INVALID_MONTH_COUNT", "numberOfMonths must be an integer from 1 to 12.");
    }
    resolveWeekStart(options.locale, options.firstDayOfWeek);
}

export function createCalendar(options: CalendarOptions = {}): CalendarState {
    validateOptions(options);
    const value = options.value ?? null;
    const anchor = options.focusedValue ?? value ?? options.placeholderValue ?? temporal().Now.plainDateISO(options.timeZone);
    const calendar = options.calendar ?? anchor.calendarId;
    const focusedValue = clampDate(anchor, options.minValue, options.maxValue).withCalendar(calendar);
    return { value, focusedValue, visibleMonth: focusedValue.with({ day: 1 }) };
}

/** Reconciles controlled props into an existing state; returns the same reference when nothing changed. */
export function syncCalendar(state: CalendarState, options: CalendarOptions): CalendarState {
    validateOptions(options);
    const value = options.value !== undefined ? options.value : state.value;
    const calendar = options.calendar ?? state.focusedValue.calendarId;
    const target = options.focusedValue ?? (value !== null && !sameDate(value, state.value) ? value : state.focusedValue);
    const focusedValue = clampDate(target, options.minValue, options.maxValue).withCalendar(calendar);
    const currentMonth = state.visibleMonth.withCalendar(calendar).with({ day: 1 });
    const visibleMonth = isInView(focusedValue, currentMonth, options.numberOfMonths) ? currentMonth : focusedValue.with({ day: 1 });
    if (sameDate(value, state.value) && focusedValue.equals(state.focusedValue) && visibleMonth.equals(state.visibleMonth)) return state;
    return { value, focusedValue, visibleMonth };
}

export function isDateDisabled(date: PlainDate, options: CalendarOptions): boolean {
    return !!options.disabled || temporal().PlainDate.compare(date, clampDate(date, options.minValue, options.maxValue)) !== 0;
}

export function isInView(date: PlainDate, visibleMonth: PlainDate, numberOfMonths = 1): boolean {
    const compare = temporal().PlainDate.compare;
    return compare(date, visibleMonth) >= 0 && compare(date, visibleMonth.add({ months: numberOfMonths })) < 0;
}

export function canPage(state: CalendarState, direction: -1 | 1, options: CalendarOptions): boolean {
    if (options.disabled) return false;
    return direction === -1
        ? !options.minValue || temporal().PlainDate.compare(state.visibleMonth, options.minValue) > 0
        : !options.maxValue || temporal().PlainDate.compare(state.visibleMonth.add({ months: options.numberOfMonths ?? 1 }), options.maxValue) <= 0;
}

export function transitionCalendar(state: CalendarState, event: CalendarEvent, options: CalendarOptions = {}): { state: CalendarState; effects: CalendarEffect[] } {
    if (event.type === "RESET") {
        const next = createCalendar({ ...options, value: event.value, focusedValue: undefined });
        return { state: next, effects: sameDate(state.value, next.value) ? [] : [{ type: "change", value: next.value }] };
    }
    if (options.disabled) return { state, effects: [] };
    if (event.type === "PAGE" && !canPage(state, event.direction, options)) return { state, effects: [] };
    if (event.type === "CLEAR" || event.type === "SELECT") {
        const value = event.type === "CLEAR" ? null : event.date;
        if (value) assertDate(value);
        if (options.readOnly || (value && (isDateDisabled(value, options) || options.isDateUnavailable?.(value)))) {
            return { state, effects: [] };
        }
        const effects: CalendarEffect[] = sameDate(value, state.value) ? [] : [{ type: "change", value }];
        if (value) effects.push({ type: "select", value });
        return { state: { ...state, value }, effects };
    }
    let target = state.focusedValue;
    if (event.type === "FOCUS") {
        assertDate(event.date);
        target = event.date;
    }
    if (event.type === "PAGE") target = target.add({ months: event.direction * (options.pagedNavigation ? options.numberOfMonths ?? 1 : 1) });
    if (event.type === "KEY_DOWN") {
        const horizontal = options.dir === "rtl" ? -1 : 1;
        switch (event.key) {
            case "ArrowLeft": target = target.subtract({ days: horizontal }); break;
            case "ArrowRight": target = target.add({ days: horizontal }); break;
            case "ArrowUp": target = target.subtract({ days: 7 }); break;
            case "ArrowDown": target = target.add({ days: 7 }); break;
            case "Home": target = startOfWeek(target, resolveWeekStart(options.locale, options.firstDayOfWeek)); break;
            case "End": target = startOfWeek(target, resolveWeekStart(options.locale, options.firstDayOfWeek)).add({ days: 6 }); break;
            case "PageUp": target = target.subtract(event.shiftKey ? { years: 1 } : { months: 1 }); break;
            case "PageDown": target = target.add(event.shiftKey ? { years: 1 } : { months: 1 }); break;
            case "Enter":
            case " ": return transitionCalendar(state, { type: "SELECT", date: target }, options);
            default: return { state, effects: [] };
        }
    }
    target = clampDate(target, options.minValue, options.maxValue).withCalendar(state.focusedValue.calendarId);
    const visibleMonth = event.type === "PAGE"
        ? state.visibleMonth.add({ months: event.direction * (options.pagedNavigation ? options.numberOfMonths ?? 1 : 1) })
        : state.visibleMonth;
    return {
        state: { ...state, focusedValue: target, visibleMonth: isInView(target, visibleMonth, options.numberOfMonths) ? visibleMonth : target.with({ day: 1 }) },
        effects: [{ type: "focus", value: target }],
    };
}

export const calendarKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Enter", " "]);

/** Styling hooks are mirrored onto both cell elements so either can carry the visual treatment. */
function describeCell(state: CalendarState, options: CalendarOptions & { today?: PlainDate }, date: PlainDate, month: PlainDate) {
    const outside = !date.toPlainYearMonth().equals(month.toPlainYearMonth());
    const disabled = isDateDisabled(date, options);
    const unavailable = !!options.isDateUnavailable?.(date);
    const selected = state.value !== null && temporal().PlainDate.compare(date, state.value) === 0;
    const focused = sameDate(date, state.focusedValue) && !outside;
    const today = options.today ? temporal().PlainDate.compare(date, options.today) === 0 : false;
    return {
        disabled, unavailable, selected, focused, today,
        data: {
            "data-date": date.toString(),
            "data-selected": selected ? "" : undefined,
            "data-focused": focused ? "" : undefined,
            "data-disabled": disabled ? "" : undefined,
            "data-unavailable": unavailable ? "" : undefined,
            "data-outside-month": outside ? "" : undefined,
            "data-today": today ? "" : undefined,
        },
    };
}

export function connectCalendar(state: CalendarState, options: CalendarOptions & { id: string; today?: PlainDate }) {
    const text = { ...translations, ...options.translations };
    const part = (name: string) => ({ "data-scope": "calendar", "data-part": name });
    return {
        getRootProps: () => ({ ...part("root"), dir: options.dir, "data-disabled": options.disabled ? "" : undefined, "data-readonly": options.readOnly ? "" : undefined }),
        getGridProps: (month = state.visibleMonth) => ({ ...part("grid"), role: "grid" as const, "aria-label": formatDate(month, options.locale, { month: "long", year: "numeric" }), "aria-readonly": options.readOnly || undefined, "aria-disabled": options.disabled || undefined }),
        getCellProps: (date: PlainDate, month = state.visibleMonth) => {
            const cell = describeCell(state, options, date, month);
            return {
                ...part("cell"),
                role: "gridcell" as const,
                "aria-selected": cell.selected,
                "aria-disabled": cell.disabled || cell.unavailable || undefined,
                ...cell.data,
            };
        },
        /**
         * The interactive element inside the cell. A button that claims `role="gridcell"` stops
         * being a button in the accessibility tree, so the grid semantics and the control are
         * kept on separate elements.
         */
        getCellTriggerProps: (date: PlainDate, month = state.visibleMonth) => {
            const cell = describeCell(state, options, date, month);
            return {
                ...part("cell-trigger"),
                id: `${options.id}-${month.toString()}-${date.toString()}`,
                type: "button" as const,
                tabIndex: cell.focused && !options.disabled ? 0 : -1,
                "aria-label": `${formatDate(date, options.locale, { dateStyle: "full" })}${cell.unavailable ? `, ${text.unavailable}` : ""}`,
                "aria-disabled": cell.disabled || cell.unavailable || undefined,
                "aria-current": cell.today ? "date" as const : undefined,
                ...cell.data,
            };
        },
        getPrevButtonProps: () => ({ ...part("prev-button"), type: "button" as const, "aria-label": text.previousMonth, disabled: !canPage(state, -1, options) }),
        getNextButtonProps: () => ({ ...part("next-button"), type: "button" as const, "aria-label": text.nextMonth, disabled: !canPage(state, 1, options) }),
    };
}