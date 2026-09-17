import { ChronaError, type PlainDate, type PlainDateTime, type PlainTime } from "./temporal";

export type SegmentName = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod";

export interface Translations {
    previousMonth: string;
    nextMonth: string;
    clear: string;
    chooseDate: string;
    unavailable: string;
    invalidRange: string;
    rangeSeparator: string;
    blank: string;
    selected: (value: string) => string;
    placeholder: (segment: SegmentName) => string;
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
    dayPeriod: string;
}

export const translations: Translations = {
    previousMonth: "Previous month",
    nextMonth: "Next month",
    clear: "Clear",
    chooseDate: "Choose date",
    unavailable: "Unavailable",
    invalidRange: "Value is outside the allowed range",
    rangeSeparator: " - ",
    blank: "blank",
    selected: (value) => `Selected ${value}`,
    placeholder: (segment) => (segment === "year" ? "yyyy" : "--"),
    year: "Year",
    month: "Month",
    day: "Day",
    hour: "Hour",
    minute: "Minute",
    second: "Second",
    dayPeriod: "AM/PM",
};

const formatterCaches = new WeakMap<object, Map<string, object>>();

function cached<Value extends object>(owner: object, key: string, create: () => Value): Value {
    let cache = formatterCaches.get(owner);
    if (!cache) {
        cache = new Map();
        formatterCaches.set(owner, cache);
    }
    let value = cache.get(key) as Value | undefined;
    if (value) cache.delete(key);
    else value = create();
    cache.set(key, value);
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return value;
}

function formatterKey(locale: string | undefined, options: object): string {
    return JSON.stringify([locale ?? null, Object.entries(options).filter(([, value]) => value !== undefined).sort(([first], [second]) => first.localeCompare(second))]);
}

export function getDateTimeFormatter(locale?: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
    return cached(Intl.DateTimeFormat, formatterKey(locale, options), () => new Intl.DateTimeFormat(locale, options));
}

export function getNumberFormatter(locale?: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
    return cached(Intl.NumberFormat, formatterKey(locale, options), () => new Intl.NumberFormat(locale, options));
}

export function resolveWeekStart(locale?: string, override?: number): number {
    if (override !== undefined) {
        if (!Number.isInteger(override) || override < 1 || override > 7) {
            throw new ChronaError("INVALID_WEEK_START", "firstDayOfWeek must be an integer from 1 to 7.");
        }
        return override;
    }
    const resolvedLocale = locale ?? getDateTimeFormatter().resolvedOptions().locale;
    const resolved = cached(Intl.Locale, resolvedLocale, () => new Intl.Locale(resolvedLocale)) as Intl.Locale & {
        getWeekInfo?: () => { firstDay: number };
        weekInfo?: { firstDay: number };
    };
    return resolved.getWeekInfo?.().firstDay ?? resolved.weekInfo?.firstDay ?? 1;
}

export function formatDate(value: PlainDate | PlainDateTime, locale?: string, options: Intl.DateTimeFormatOptions = {}): string {
    const display = value.calendarId === "iso8601" ? value.withCalendar("gregory") : value;
    const formatter = getDateTimeFormatter(locale, { ...options, calendar: display.calendarId });
    return (formatter as unknown as { format: (value: PlainDate | PlainDateTime) => string }).format(display);
}

export function formatParts(value: PlainDate | PlainTime, locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
    const formatter = getDateTimeFormatter(locale, options);
    return (formatter as unknown as { formatToParts: (value: PlainDate | PlainTime) => Intl.DateTimeFormatPart[] }).formatToParts(value);
}