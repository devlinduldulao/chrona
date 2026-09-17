import type { Temporal as TemporalTypes } from "temporal-spec";

export type PlainDate = TemporalTypes.PlainDate;
export type PlainTime = TemporalTypes.PlainTime;
export type PlainDateTime = TemporalTypes.PlainDateTime;
export type ZonedDateTime = TemporalTypes.ZonedDateTime;
export type PlainYearMonth = TemporalTypes.PlainYearMonth;

export class ChronaError extends Error {
    constructor(public readonly code: string, message: string) {
        super(`[Chrona:${code}] ${message}`);
        this.name = "ChronaError";
    }
}

export function temporal(): typeof TemporalTypes {
    if (typeof globalThis.Temporal === "undefined") {
        throw new ChronaError("TEMPORAL_MISSING", "Import temporal-polyfill/global before using Chrona in this environment.");
    }
    return globalThis.Temporal;
}

export function assertDate(value: unknown, name = "value"): asserts value is PlainDate {
    if (!(value instanceof temporal().PlainDate)) {
        throw new ChronaError("INVALID_DATE", `${name} must be a Temporal.PlainDate, not a string or Date.`);
    }
}

export function sameDate(first: PlainDate | null, second: PlainDate | null): boolean {
    return first === null || second === null ? first === second : first.equals(second);
}

export function clampDate(date: PlainDate, min?: PlainDate, max?: PlainDate): PlainDate {
    const { PlainDate } = temporal();
    if (min && PlainDate.compare(date, min) < 0) return min;
    if (max && PlainDate.compare(date, max) > 0) return max;
    return date;
}

export function startOfWeek(date: PlainDate, firstDayOfWeek: number): PlainDate {
    if (!Number.isInteger(firstDayOfWeek) || firstDayOfWeek < 1 || firstDayOfWeek > 7) {
        throw new ChronaError("INVALID_WEEK_START", "firstDayOfWeek must be an integer from 1 to 7.");
    }
    return date.subtract({ days: (date.dayOfWeek - firstDayOfWeek + 7) % 7 });
}

export function weeksInMonthView(month: PlainYearMonth, firstDayOfWeek = 1, fixedWeeks = false): PlainDate[][] {
    const first = month.toPlainDate({ day: 1 });
    const start = startOfWeek(first, firstDayOfWeek);
    const length = start.until(first.add({ months: 1 }), { largestUnit: "days" }).days;
    const count = fixedWeeks ? Math.max(6, Math.ceil(length / 7)) : Math.ceil(length / 7);
    return Array.from({ length: count }, (_, week) =>
        Array.from({ length: 7 }, (_, day) => start.add({ days: week * 7 + day })),
    );
}