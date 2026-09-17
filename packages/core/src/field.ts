import { ChronaError, temporal, type PlainDate, type PlainTime } from "./temporal";
import { formatDate, formatParts, getDateTimeFormatter, getNumberFormatter, translations, type SegmentName, type Translations } from "./i18n";

export type FieldKind = "date" | "time";
export type FieldValue<Kind extends FieldKind> = Kind extends "date" ? PlainDate : PlainTime;
export type SegmentType = SegmentName;
export type HourCycle = "h11" | "h12" | "h23" | "h24";
export interface FieldOptions<Kind extends FieldKind> {
    value?: FieldValue<Kind> | null;
    placeholderValue?: FieldValue<Kind>;
    minValue?: FieldValue<Kind>;
    maxValue?: FieldValue<Kind>;
    locale?: string;
    dir?: "ltr" | "rtl";
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    invalid?: boolean;
    hourCycle?: HourCycle;
    granularity?: "minute" | "second";
    wrap?: boolean;
    translations?: Partial<Translations>;
    isDateUnavailable?: (date: PlainDate) => boolean;
}

export interface FieldState<Kind extends FieldKind> {
    kind: Kind;
    value: FieldValue<Kind> | null;
    reference: FieldValue<Kind>;
    parts: Partial<Record<SegmentType, number | null>>;
    buffer: { segment: SegmentType; value: number; length: number } | null;
    invalid: boolean;
}

export type FieldEvent =
    | { type: "DIGIT"; segment: SegmentType; digit: number }
    | { type: "STEP"; segment: SegmentType; direction: -1 | 1 }
    | { type: "EDGE"; segment: SegmentType; edge: "min" | "max" }
    | { type: "CLEAR"; segment?: SegmentType }
    | { type: "PERIOD"; value: 0 | 1 }
    | { type: "BLUR" };

/** `nonexistent` covers calendar-impossible combinations such as 29 February in a common year. */
export type FieldInvalidReason = "range" | "unavailable" | "nonexistent";

export type FieldEffect<Kind extends FieldKind> =
    | { type: "change"; value: FieldValue<Kind> | null }
    | { type: "advance"; segment: SegmentType }
    | { type: "invalid"; reason: FieldInvalidReason };

export function fieldHourCycle<Kind extends FieldKind>(options: FieldOptions<Kind>): HourCycle {
    return options.hourCycle ?? getDateTimeFormatter(options.locale, { hour: "numeric" }).resolvedOptions().hourCycle ?? "h23";
}

function is12Hour(cycle: HourCycle) { return cycle === "h11" || cycle === "h12"; }

const LEAP_PROBE_YEAR = 2024;
const COMMON_PROBE_YEAR = 2023;

export function fieldSegments<Kind extends FieldKind>(kind: Kind, reference: FieldValue<Kind>, options: FieldOptions<Kind>) {
    const display = kind === "date" ? (reference as PlainDate).withCalendar("gregory") : reference;
    const format: Intl.DateTimeFormatOptions = kind === "date"
        ? { year: "numeric", month: "numeric", day: "numeric", calendar: "gregory" }
        : { hour: "numeric", minute: "2-digit", ...(options.granularity === "second" ? { second: "2-digit" } : {}), hourCycle: fieldHourCycle(options) };
    return formatParts(display, options.locale, format).filter((part) => part.type === "literal" || ["year", "month", "day", "hour", "minute", "second", "dayPeriod"].includes(part.type)) as { type: SegmentType | "literal"; value: string }[];
}

function valueParts<Kind extends FieldKind>(kind: Kind, value: FieldValue<Kind>, options: FieldOptions<Kind>): Partial<Record<SegmentType, number | null>> {
    if (kind === "date") {
        const date = value as PlainDate;
        return { year: date.year, month: date.month, day: date.day };
    }
    const time = value as PlainTime;
    const cycle = fieldHourCycle(options);
    const hour = is12Hour(cycle) ? time.hour % 12 || (cycle === "h12" ? 12 : 0) : time.hour || (cycle === "h24" ? 24 : 0);
    return { hour, minute: time.minute, ...(options.granularity === "second" ? { second: time.second } : {}), ...(is12Hour(cycle) ? { dayPeriod: time.hour < 12 ? 0 : 1 } : {}) };
}

export function createField<Kind extends FieldKind>(kind: Kind, options: FieldOptions<Kind> = {}): FieldState<Kind> {
    const platform = temporal();
    const Constructor = kind === "date" ? platform.PlainDate : platform.PlainTime;
    for (const [name, candidate] of Object.entries({ value: options.value, placeholderValue: options.placeholderValue, minValue: options.minValue, maxValue: options.maxValue })) {
        if (candidate != null && !(candidate instanceof Constructor)) throw new ChronaError("INVALID_FIELD_VALUE", `${name} must be a Temporal.${kind === "date" ? "PlainDate" : "PlainTime"}.`);
    }
    const reference = options.value ?? options.placeholderValue ?? (kind === "date" ? platform.Now.plainDateISO() : platform.PlainTime.from({ hour: 12 })) as FieldValue<Kind>;
    if (kind === "date" && !["iso8601", "gregory"].includes((reference as PlainDate).calendarId)) {
        throw new ChronaError("UNSUPPORTED_FIELD_CALENDAR", "DateField currently supports ISO and Gregorian dates. Use Calendar for other calendar systems.");
    }
    if (kind === "date" && ((reference as PlainDate).year < 1 || (reference as PlainDate).year > 9999)) {
        throw new ChronaError("UNSUPPORTED_FIELD_YEAR", "DateField currently supports years 1 through 9999.");
    }
    if (options.minValue && options.maxValue && compareField(kind, options.minValue, options.maxValue) > 0) throw new ChronaError("INVALID_BOUNDS", "minValue must not be after maxValue.");
    const parts = valueParts(kind, reference, options);
    if (options.value == null) for (const segment of Object.keys(parts) as SegmentType[]) parts[segment] = null;
    return { kind, value: options.value ?? null, reference, parts, buffer: null, invalid: false };
}

function compareField<Kind extends FieldKind>(kind: Kind, first: FieldValue<Kind>, second: FieldValue<Kind>): number {
    return kind === "date" ? temporal().PlainDate.compare(first as PlainDate, second as PlainDate) : temporal().PlainTime.compare(first as PlainTime, second as PlainTime);
}

export function segmentBounds<Kind extends FieldKind>(state: FieldState<Kind>, segment: SegmentType, options: FieldOptions<Kind>): { min: number; max: number } {
    switch (segment) {
        case "year": return { min: 1, max: 9999 };
        case "month": return { min: 1, max: 12 };
        case "day": {
            const reference = state.reference as PlainDate;
            const month = state.parts.month;
            // Segments are typed in locale order, so the month or the year may still be blank.
            // Bounding the day by the placeholder's year would put 29 February out of reach in
            // month/day/year locales; allow the longest the segment can ever be and let
            // materialization reject a day the finished date cannot hold.
            if (month == null) return { min: 1, max: 31 };
            const daysIn = (year: number) => reference.with({ year, month, day: 1 }).daysInMonth;
            const year = state.parts.year;
            return { min: 1, max: year == null ? Math.max(daysIn(LEAP_PROBE_YEAR), daysIn(COMMON_PROBE_YEAR)) : daysIn(year) };
        }
        case "hour": {
            const cycle = fieldHourCycle(options);
            return { min: cycle === "h12" || cycle === "h24" ? 1 : 0, max: { h11: 11, h12: 12, h23: 23, h24: 24 }[cycle] };
        }
        case "dayPeriod": return { min: 0, max: 1 };
        default: return { min: 0, max: 59 };
    }
}

/**
 * Typed digits are taken literally: a day the month cannot hold is reported instead of silently
 * clamped. Stepping and Home/End keep clamping, because a spinner that refuses to move is worse
 * than one that lands on the last valid day.
 */
function materialize<Kind extends FieldKind>(state: FieldState<Kind>, options: FieldOptions<Kind>, overflow: "constrain" | "reject"): FieldValue<Kind> | null {
    const parts = state.parts;
    if (state.kind === "date") {
        try {
            return (state.reference as PlainDate).with({ year: parts.year!, month: parts.month!, day: parts.day! }, { overflow }) as FieldValue<Kind>;
        } catch {
            return null;
        }
    }
    const cycle = fieldHourCycle(options);
    const hour = is12Hour(cycle) ? parts.hour! % 12 + parts.dayPeriod! * 12 : parts.hour! % 24;
    return (state.reference as PlainTime).with({ hour, minute: parts.minute!, second: parts.second ?? (state.reference as PlainTime).second }) as FieldValue<Kind>;
}

/**
 * Decides what a set of segment values means once an edit has been applied. A half-typed segment
 * (`buffer` still open) is a draft: `2` on the way to `2026` is not a year in the first century, so
 * drafts never announce themselves invalid. Blur closes the draft and validates what is left.
 */
function settle<Kind extends FieldKind>(previous: FieldState<Kind>, next: FieldState<Kind>, options: FieldOptions<Kind>, overflow: "constrain" | "reject", effects: FieldEffect<Kind>[]): { state: FieldState<Kind>; effects: FieldEffect<Kind>[] } {
    if (Object.values(next.parts).some((value) => value == null)) {
        next.value = null;
        if (previous.value !== null) effects.push({ type: "change", value: null });
        return { state: next, effects };
    }
    const value = materialize(next, options, overflow);
    const outOfBounds = value !== null && ((options.minValue && compareField(next.kind, value, options.minValue) < 0) || (options.maxValue && compareField(next.kind, value, options.maxValue) > 0));
    const unavailable = value !== null && next.kind === "date" && options.isDateUnavailable?.(value as PlainDate);
    if (value === null || outOfBounds || unavailable) {
        const drafting = next.buffer !== null;
        next.invalid = !drafting;
        next.value = null;
        if (!drafting) effects.push({ type: "invalid", reason: value === null ? "nonexistent" : unavailable ? "unavailable" : "range" });
        if (previous.value !== null) effects.push({ type: "change", value: null });
    } else {
        next.value = value;
        next.parts = next.buffer === null ? valueParts(next.kind, value, options) : next.parts;
        if (previous.value === null || compareField(next.kind, previous.value, value) !== 0) effects.push({ type: "change", value });
    }
    return { state: next, effects };
}

export function transitionField<Kind extends FieldKind>(state: FieldState<Kind>, event: FieldEvent, options: FieldOptions<Kind> = {}): { state: FieldState<Kind>; effects: FieldEffect<Kind>[] } {
    // Only a DIGIT can leave a buffer open, so a pending draft is always literal typing.
    if (event.type === "BLUR") return state.buffer === null ? { state, effects: [] } : settle(state, { ...state, buffer: null, invalid: false }, options, "reject", []);
    if (options.disabled || options.readOnly) return { state, effects: [] };
    const parts = { ...state.parts };
    let buffer: FieldState<Kind>["buffer"] = null;
    const effects: FieldEffect<Kind>[] = [];
    if (event.type === "CLEAR") {
        const segments = event.segment ? [event.segment] : Object.keys(parts) as SegmentType[];
        for (const segment of segments) parts[segment] = null;
    } else if (event.type === "PERIOD") {
        if (!("dayPeriod" in parts)) return { state, effects: [] };
        parts.dayPeriod = event.value;
    } else {
        if (!(event.segment in parts)) return { state, effects: [] };
        const { min, max } = segmentBounds(state, event.segment, options);
        if (event.type === "EDGE") parts[event.segment] = event.edge === "min" ? min : max;
        if (event.type === "STEP") {
            const previous = parts[event.segment];
            const candidate = previous == null ? valueParts(state.kind, state.reference, options)[event.segment]! : previous + event.direction;
            parts[event.segment] = options.wrap === false ? Math.min(max, Math.max(min, candidate)) : candidate > max ? min : candidate < min ? max : candidate;
        }
        if (event.type === "DIGIT") {
            if (!Number.isInteger(event.digit) || event.digit < 0 || event.digit > 9) return { state, effects: [] };
            const previous = state.buffer?.segment === event.segment ? state.buffer : null;
            let candidate = (previous?.value ?? 0) * 10 + event.digit;
            let length = (previous?.length ?? 0) + 1;
            if (candidate > max) { candidate = event.digit; length = 1; }
            if (candidate > max) return { state, effects: [] };
            buffer = { segment: event.segment, value: candidate, length };
            parts[event.segment] = candidate < min ? null : candidate;
            if (candidate >= min && (candidate * 10 > max || length >= String(max).length)) {
                effects.push({ type: "advance", segment: event.segment });
                buffer = null;
            }
        }
    }
    return settle(state, { ...state, parts, buffer, invalid: false }, options, event.type === "DIGIT" ? "reject" : "constrain", effects);
}

const localizedDigits = new Map<string, string[]>();

export function digitValue(key: string, locale?: string): number | null {
    const ascii = "0123456789".indexOf(key);
    if (ascii >= 0 && key.length === 1) return ascii;
    const cacheKey = locale ?? "";
    let digits = localizedDigits.get(cacheKey);
    if (!digits) {
        const formatter = getNumberFormatter(locale, { useGrouping: false });
        digits = Array.from({ length: 10 }, (_, digit) => formatter.format(digit));
        localizedDigits.set(cacheKey, digits);
        if (localizedDigits.size > 100) localizedDigits.delete(localizedDigits.keys().next().value!);
    }
    const index = digits.indexOf(key);
    return index >= 0 ? index : null;
}

export function connectField<Kind extends FieldKind>(state: FieldState<Kind>, options: FieldOptions<Kind> & { id: string; labelId?: string; describedBy?: string }) {
    const text = { ...translations, ...options.translations };
    const scope = `${state.kind}-field`;
    return {
        segments: fieldSegments(state.kind, state.reference, options),
        getGroupProps: () => ({ role: "group" as const, "aria-labelledby": options.labelId, "aria-describedby": options.describedBy, "aria-invalid": options.invalid || state.invalid || undefined, "data-scope": scope, "data-part": "field", "data-invalid": options.invalid || state.invalid ? "" : undefined, "data-disabled": options.disabled ? "" : undefined, "data-readonly": options.readOnly ? "" : undefined, dir: options.dir }),
        getSegmentProps: (segment: SegmentType) => {
            const value = state.parts[segment];
            const { min, max } = segmentBounds(state, segment, options);
            // Every numeric segment but the year pads to its placeholder width, so a field keeps
            // one width from `mm/dd/yyyy` through `09/22/2026` instead of reflowing as it fills.
            const minimumIntegerDigits = segment === "year" || segment === "dayPeriod" ? 1 : 2;
            let display = value == null ? text.placeholder(segment) : getNumberFormatter(options.locale, { useGrouping: false, minimumIntegerDigits }).format(value);
            if (segment === "dayPeriod" && value != null) display = formatParts(temporal().PlainTime.from({ hour: value * 12 }), options.locale, { hour: "numeric", hourCycle: fieldHourCycle(options) }).find((part) => part.type === "dayPeriod")?.value ?? display;
            const valueText = value == null ? text.blank : segment === "month" ? formatDate((state.reference as PlainDate).with({ month: value }), options.locale, { month: "long" }) : display;
            return {
                role: "spinbutton" as const,
                "aria-label": text[segment],
                "aria-valuemin": min,
                "aria-valuemax": max,
                "aria-valuenow": value ?? undefined,
                "aria-valuetext": valueText,
                "aria-required": options.required || undefined,
                "aria-invalid": options.invalid || state.invalid || undefined,
                "aria-describedby": options.describedBy,
                "aria-readonly": options.readOnly || undefined,
                "data-scope": scope,
                "data-part": "segment",
                "data-segment": segment,
                "data-placeholder": value == null ? "" : undefined,
                "data-invalid": options.invalid || state.invalid ? "" : undefined,
                display,
            };
        },
    };
}