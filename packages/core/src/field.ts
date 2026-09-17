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

export type FieldEffect<Kind extends FieldKind> =
    | { type: "change"; value: FieldValue<Kind> | null }
    | { type: "advance"; segment: SegmentType }
    | { type: "invalid"; reason: "range" | "unavailable" };

export function fieldHourCycle<Kind extends FieldKind>(options: FieldOptions<Kind>): HourCycle {
    return options.hourCycle ?? getDateTimeFormatter(options.locale, { hour: "numeric" }).resolvedOptions().hourCycle ?? "h23";
}

function is12Hour(cycle: HourCycle) { return cycle === "h11" || cycle === "h12"; }

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
        case "day": return { min: 1, max: (state.reference as PlainDate).with({ year: state.parts.year ?? (state.reference as PlainDate).year, month: state.parts.month ?? (state.reference as PlainDate).month, day: 1 }).daysInMonth };
        case "hour": {
            const cycle = fieldHourCycle(options);
            return { min: cycle === "h12" || cycle === "h24" ? 1 : 0, max: { h11: 11, h12: 12, h23: 23, h24: 24 }[cycle] };
        }
        case "dayPeriod": return { min: 0, max: 1 };
        default: return { min: 0, max: 59 };
    }
}

function materialize<Kind extends FieldKind>(state: FieldState<Kind>, options: FieldOptions<Kind>): FieldValue<Kind> {
    const parts = state.parts;
    if (state.kind === "date") return (state.reference as PlainDate).with({ year: parts.year!, month: parts.month!, day: parts.day! }, { overflow: "constrain" }) as FieldValue<Kind>;
    const cycle = fieldHourCycle(options);
    const hour = is12Hour(cycle) ? parts.hour! % 12 + parts.dayPeriod! * 12 : parts.hour! % 24;
    return (state.reference as PlainTime).with({ hour, minute: parts.minute!, second: parts.second ?? (state.reference as PlainTime).second }) as FieldValue<Kind>;
}

export function transitionField<Kind extends FieldKind>(state: FieldState<Kind>, event: FieldEvent, options: FieldOptions<Kind> = {}): { state: FieldState<Kind>; effects: FieldEffect<Kind>[] } {
    if (event.type === "BLUR") return { state: { ...state, buffer: null }, effects: [] };
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
    const next = { ...state, parts, buffer, invalid: false };
    if (Object.values(parts).some((value) => value == null)) {
        next.value = null;
        if (state.value !== null) effects.push({ type: "change", value: null });
        return { state: next, effects };
    }
    const value = materialize(next, options);
    const outOfBounds = (options.minValue && compareField(state.kind, value, options.minValue) < 0) || (options.maxValue && compareField(state.kind, value, options.maxValue) > 0);
    const unavailable = state.kind === "date" && options.isDateUnavailable?.(value as PlainDate);
    if (outOfBounds || unavailable) {
        next.invalid = true;
        next.value = null;
        effects.push({ type: "invalid", reason: unavailable ? "unavailable" : "range" });
        if (state.value !== null) effects.push({ type: "change", value: null });
    } else {
        next.value = value;
        next.parts = buffer === null ? valueParts(state.kind, value, options) : parts;
        if (state.value === null || compareField(state.kind, state.value, value) !== 0) effects.push({ type: "change", value });
    }
    return { state: next, effects };
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
            let display = value == null ? text.placeholder(segment) : getNumberFormatter(options.locale, { useGrouping: false, minimumIntegerDigits: segment === "minute" || segment === "second" ? 2 : 1 }).format(value);
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