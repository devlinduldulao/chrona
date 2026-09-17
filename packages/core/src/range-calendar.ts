import { ChronaError, assertDate, temporal, type PlainDate } from "./temporal";
import { isDateDisabled, type CalendarOptions } from "./calendar";

export interface DateRange { start: PlainDate; end: PlainDate }
export interface RangeState { value: DateRange | null; anchor: PlainDate | null; preview: PlainDate | null; invalid: boolean }
export type RangeEvent = { type: "SELECT"; date: PlainDate } | { type: "PREVIEW"; date: PlainDate } | { type: "CLEAR" } | { type: "CANCEL" };
export type RangeEffect = { type: "change"; value: DateRange | null } | { type: "rangeStart"; value: PlainDate | null } | { type: "invalid" };

export function validateRange(value: DateRange | null): void {
    if (value) {
        assertDate(value.start, "value.start");
        assertDate(value.end, "value.end");
        if (value.start.calendarId !== value.end.calendarId || temporal().PlainDate.compare(value.start, value.end) > 0) {
            throw new ChronaError("INVALID_RANGE", "Range endpoints must use the same calendar and start must not be after end.");
        }
    }
}

export function createRange(value: DateRange | null = null): RangeState {
    validateRange(value);
    return { value, anchor: null, preview: null, invalid: false };
}

function orderedRange(first: PlainDate, second: PlainDate): DateRange {
    const aligned = second.withCalendar(first.calendarId);
    return temporal().PlainDate.compare(first, aligned) <= 0 ? { start: first, end: aligned } : { start: aligned, end: first };
}

export function rangeContains(range: DateRange | null, date: PlainDate): boolean {
    return !!range && temporal().PlainDate.compare(date, range.start) >= 0 && temporal().PlainDate.compare(date, range.end) <= 0;
}

export function transitionRange(state: RangeState, event: RangeEvent, options: Omit<CalendarOptions, "value"> = {}): { state: RangeState; effects: RangeEffect[] } {
    if (options.disabled || options.readOnly) return { state, effects: [] };
    if (event.type === "CANCEL") return { state: { ...state, anchor: null, preview: null, invalid: false }, effects: state.anchor ? [{ type: "rangeStart", value: null }] : [] };
    if (event.type === "CLEAR") return { state: createRange(), effects: [...(state.value ? [{ type: "change" as const, value: null }] : []), ...(state.anchor ? [{ type: "rangeStart" as const, value: null }] : [])] };
    assertDate(event.date);
    if (event.type === "PREVIEW") return { state: state.anchor ? { ...state, preview: event.date } : state, effects: [] };
    if (isDateDisabled(event.date, options) || options.isDateUnavailable?.(event.date)) return { state, effects: [] };
    if (!state.anchor) return { state: { ...state, anchor: event.date, preview: event.date, invalid: false }, effects: [{ type: "rangeStart", value: event.date }] };
    const value = orderedRange(state.anchor, event.date);
    if (isDateDisabled(value.start, options) || isDateDisabled(value.end, options)) {
        return { state: { ...state, invalid: true }, effects: [{ type: "invalid" }] };
    }
    if (options.isDateUnavailable) {
        // Spans beyond the scan limit are rejected instead of walking millions of days on the main thread.
        if (value.start.until(value.end, { largestUnit: "days" }).days > 10000) {
            return { state: { ...state, invalid: true, preview: event.date }, effects: [{ type: "invalid" }] };
        }
        for (let current = value.start; temporal().PlainDate.compare(current, value.end) <= 0; current = current.add({ days: 1 })) {
            if (options.isDateUnavailable(current)) return { state: { ...state, invalid: true, preview: event.date }, effects: [{ type: "invalid" }] };
        }
    }
    return { state: createRange(value), effects: [{ type: "change", value }, { type: "rangeStart", value: null }] };
}

function rangeCellState(state: RangeState, date: PlainDate) {
    const displayed = state.anchor ? orderedRange(state.anchor, state.preview ?? state.anchor) : state.value;
    const selected = rangeContains(displayed, date);
    const same = (value: PlainDate | undefined) => !!value && temporal().PlainDate.compare(date, value) === 0;
    return {
        selected,
        data: {
            "data-scope": "range-calendar",
            "data-selected": selected ? "" : undefined,
            "data-in-range": selected ? "" : undefined,
            "data-range-start": same(displayed?.start) ? "" : undefined,
            "data-range-end": same(displayed?.end) ? "" : undefined,
            "data-preview": state.anchor && selected ? "" : undefined,
            "data-invalid": state.invalid && selected ? "" : undefined,
        },
    };
}

export function getRangeCellProps(state: RangeState, date: PlainDate) {
    const { selected, data } = rangeCellState(state, date);
    return { "aria-selected": selected, ...data };
}

/** The trigger inside a cell carries the styling hooks; `aria-selected` stays on the gridcell. */
export function getRangeCellTriggerProps(state: RangeState, date: PlainDate) {
    return rangeCellState(state, date).data;
}