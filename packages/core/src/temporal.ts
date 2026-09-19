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

/**
 * True when the value really is a Temporal value of this kind, built by a *different* Temporal
 * implementation than the one on `globalThis` — every Temporal class carries its name as
 * `Symbol.toStringTag`, so a foreign value still identifies itself even though `instanceof`
 * rejects it. Two implementations reach one page more easily than it sounds: two copies of a
 * polyfill in the dependency tree, or one file importing `temporal-polyfill/global` while another
 * imports `temporal-polyfill/full/global`. Such a value cannot be used — the arithmetic would
 * survive the mix, but `Intl` would not, failing much later with `TypeError: Cannot use valueOf` —
 * so this exists to say what is actually wrong rather than blame a string.
 */
export function isForeignTemporal(value: unknown, kind: "PlainDate" | "PlainTime"): boolean {
    return typeof value === "object" && value !== null
        && (value as Record<symbol, unknown>)[Symbol.toStringTag] === `Temporal.${kind}`;
}

export function mixedTemporalMessage(name: string, kind: "PlainDate" | "PlainTime"): string {
    return `${name} is a Temporal.${kind} from another Temporal implementation. Load exactly one.`;
}

export function assertDate(value: unknown, name = "value"): asserts value is PlainDate {
    if (value instanceof temporal().PlainDate) return;
    if (isForeignTemporal(value, "PlainDate")) throw new ChronaError("TEMPORAL_MISMATCH", mixedTemporalMessage(name, "PlainDate"));
    throw new ChronaError("INVALID_DATE", `${name} must be a Temporal.PlainDate, not a string or Date.`);
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