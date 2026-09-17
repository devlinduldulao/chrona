import { describe, expect, it, vi } from "vitest";
import { formatDate, formatParts, getDateTimeFormatter, getNumberFormatter, resolveWeekStart } from "../src/index";

describe("Intl cache", () => {
    it("reuses formatters for equivalent options, keeping locales and options isolated", () => {
        const formatter = getDateTimeFormatter("de-DE", { month: "long", year: "numeric" });
        expect(getDateTimeFormatter("de-DE", { year: "numeric", month: "long" })).toBe(formatter);
        expect(getDateTimeFormatter("en-US", { month: "long", year: "numeric" })).not.toBe(formatter);
        expect(getNumberFormatter("en-US", { useGrouping: false })).toBe(getNumberFormatter("en-US", { useGrouping: false }));
        expect(getNumberFormatter("en-US", { minimumIntegerDigits: 2 })).not.toBe(getNumberFormatter("en-US"));
    });

    it("evicts old entries instead of growing indefinitely", () => {
        const formatter = getNumberFormatter("en-US-x-first");
        for (let index = 0; index < 101; index++) getNumberFormatter(`en-US-x-${index}`);
        expect(getNumberFormatter("en-US-x-first")).not.toBe(formatter);
    });

    it("keeps cached native and replacement constructors separate", () => {
        const before = getDateTimeFormatter("en-US");
        const NativeFormatter = Intl.DateTimeFormat;
        const replacement = vi.spyOn(Intl, "DateTimeFormat").mockImplementation((locale, options) => new NativeFormatter(locale, options));
        try {
            expect(getDateTimeFormatter("en-US")).not.toBe(before);
            expect(getDateTimeFormatter("en-US")).toBe(getDateTimeFormatter("en-US"));
            expect(replacement).toHaveBeenCalledOnce();
        } finally { replacement.mockRestore(); }
    });

    it("normalizes the no-break spaces ICU versions disagree about", () => {
        // Newer ICU puts U+202F before AM/PM where older ICU puts a plain space, so the same call
        // produces different markup on Node and in the browser and hydration fails.
        const time = Temporal.PlainTime.from({ hour: 9, minute: 30 });
        const NativeFormatter = Intl.DateTimeFormat;
        const narrow = vi.spyOn(Intl, "DateTimeFormat").mockImplementation((locale, options) => {
            const formatter = new NativeFormatter(locale, options);
            return {
                formatToParts: (value?: never) => formatter.formatToParts(value).map((part) => ({ ...part, value: part.value.replace(/ /g, "\u202F") })),
                format: (value?: never) => formatter.format(value).replace(/ /g, "\u202F"),
                resolvedOptions: () => formatter.resolvedOptions(),
            } as unknown as Intl.DateTimeFormat;
        });
        try {
            const literals = formatParts(time, "en-US", { hour: "numeric", minute: "2-digit", hourCycle: "h12" }).filter((part) => part.type === "literal");
            expect(literals.map((part) => part.value)).not.toContain("\u202F");
            expect(literals.some((part) => part.value === " ")).toBe(true);
            expect(formatDate(Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 }), "en-US", { dateStyle: "full" })).not.toContain("\u202F");
        } finally { narrow.mockRestore(); }
    });

    it("preserves Temporal formatting and locale ordering", () => {
        const date = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
        expect(formatDate(date, "en-US", { dateStyle: "full" })).toBe("Wednesday, September 16, 2026");
        expect(formatParts(date.withCalendar("gregory"), "de-DE", { calendar: "gregory", year: "numeric", month: "numeric", day: "numeric" }).filter((part) => part.type !== "literal").map((part) => part.type)).toEqual(["day", "month", "year"]);
        expect(resolveWeekStart("en-US")).toBe(7);
        expect(resolveWeekStart("de-DE")).toBe(1);
    });
});