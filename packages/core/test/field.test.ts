import { describe, expect, it } from "vitest";
import { connectField, createField, dayPeriodValue, digitValue, transitionField } from "../src/index";

const date = () => Temporal.PlainDate.from({ year: 2024, month: 1, day: 31 });

describe("segmented fields", () => {
    it("emits only null until every required date segment is set", () => {
        let state = createField("date", { placeholderValue: date() });
        const events = [
            { type: "DIGIT", segment: "month", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 9 },
            { type: "DIGIT", segment: "year", digit: 2 },
            { type: "DIGIT", segment: "year", digit: 0 },
            { type: "DIGIT", segment: "year", digit: 2 },
            { type: "DIGIT", segment: "year", digit: 4 },
        ] as const;
        for (const event of events) state = transitionField(state, event).state;
        expect(state.value?.toString()).toBe("2024-02-29");
        const cleared = transitionField(state, { type: "CLEAR", segment: "month" });
        expect(cleared.state.value).toBeNull();
        expect(cleared.effects).toContainEqual({ type: "change", value: null });
    });

    it("reports nothing until the segment being typed is finished", () => {
        // `2`, `20` and `202` are all real years, and `20` is even a leap year, so a field that
        // committed on every keystroke would hand the binding three dates nobody typed.
        let state = createField("date", { locale: "en-US", placeholderValue: date() });
        const effects: unknown[] = [];
        for (const event of [
            { type: "DIGIT", segment: "month", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 9 },
            { type: "DIGIT", segment: "year", digit: 2 },
            { type: "DIGIT", segment: "year", digit: 0 },
            { type: "DIGIT", segment: "year", digit: 2 },
        ] as const) {
            const result = transitionField(state, event, { locale: "en-US" });
            state = result.state;
            effects.push(...result.effects.filter((effect) => effect.type === "change"));
        }
        expect(effects).toEqual([]);
        expect(state.value).toBeNull();
        const finished = transitionField(state, { type: "DIGIT", segment: "year", digit: 4 }, { locale: "en-US" });
        expect(finished.effects).toContainEqual({ type: "change", value: expect.anything() });
        expect(finished.state.value?.toString()).toBe("2024-02-29");
    });

    it("keeps the committed value while a segment of a complete date is half typed", () => {
        const options = { locale: "en-US" };
        let state = createField("date", { ...options, value: Temporal.PlainDate.from("2026-09-16") });
        const typed = transitionField(state, { type: "DIGIT", segment: "month", digit: 1 }, options);
        expect(typed.effects, "January is not what someone typing December meant").toEqual([]);
        expect(typed.state.value?.toString()).toBe("2026-09-16");
        expect(typed.state.parts.month).toBe(1);
        state = typed.state;
        const finished = transitionField(state, { type: "DIGIT", segment: "month", digit: 2 }, options);
        expect(finished.state.value?.toString()).toBe("2026-12-16");
        expect(finished.effects).toContainEqual({ type: "change", value: expect.anything() });
    });

    it("settles a draft on blur", () => {
        const options = { locale: "en-US", placeholderValue: date() };
        let state = createField("date", options);
        for (const event of [
            { type: "DIGIT", segment: "month", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 9 },
            { type: "DIGIT", segment: "year", digit: 2 },
            { type: "DIGIT", segment: "year", digit: 0 },
            { type: "DIGIT", segment: "year", digit: 2 },
        ] as const) state = transitionField(state, event, options).state;
        const blurred = transitionField(state, { type: "BLUR" }, options);
        expect(blurred.effects).toEqual([{ type: "invalid", reason: "nonexistent" }]);
        expect(blurred.state.invalid).toBe(true);
    });

    it("matches day periods by latin letter and by the locale's own label", () => {
        expect(dayPeriodValue("a", "en-US")).toBe(0);
        expect(dayPeriodValue("P", "en-US")).toBe(1);
        expect(dayPeriodValue("PM", "en-US")).toBe(1);
        expect(dayPeriodValue("\u5348\u5f8c", "ja-JP")).toBe(1);
        expect(dayPeriodValue("\u5348\u524d", "ja-JP")).toBe(0);
        expect(dayPeriodValue("x", "en-US")).toBeNull();
        expect(dayPeriodValue("", "en-US")).toBeNull();
    });

    it("does not emit a value while day and year are blank", () => {
        const result = transitionField(createField("date", { placeholderValue: date() }), { type: "DIGIT", segment: "month", digit: 3 });
        expect(result.effects).toEqual([{ type: "advance", segment: "month" }]);
        expect(result.state.value).toBeNull();
    });

    it("localizes segment placeholders through translations", () => {
        const api = connectField(createField("date", { placeholderValue: date() }), { id: "field", translations: { placeholder: (segment) => (segment === "year" ? "jjjj" : "\u00b7\u00b7") } });
        expect(api.getSegmentProps("year").display).toBe("jjjj");
        expect(api.getSegmentProps("month").display).toBe("\u00b7\u00b7");
        expect(connectField(createField("date", { placeholderValue: date() }), { id: "field" }).getSegmentProps("year").display).toBe("yyyy");
    });

    it("reaches 29 February when the year is typed last", () => {
        // The placeholder year is common, so bounding the day by it would make the leap day
        // unreachable in month/day/year locales.
        let state = createField("date", { placeholderValue: Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 }) });
        for (const event of [
            { type: "DIGIT", segment: "month", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 9 },
        ] as const) state = transitionField(state, event).state;
        expect(state.parts.day).toBe(29);
        for (const digit of [2, 0, 2, 8]) state = transitionField(state, { type: "DIGIT", segment: "year", digit }).state;
        expect(state.value?.toString()).toBe("2028-02-29");
    });

    it("reports a typed day the finished month cannot hold instead of clamping it", () => {
        let state = createField("date", { placeholderValue: Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 }) });
        for (const event of [
            { type: "DIGIT", segment: "month", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 2 },
            { type: "DIGIT", segment: "day", digit: 9 },
            { type: "DIGIT", segment: "year", digit: 2 },
            { type: "DIGIT", segment: "year", digit: 0 },
            { type: "DIGIT", segment: "year", digit: 2 },
        ] as const) state = transitionField(state, event).state;
        const result = transitionField(state, { type: "DIGIT", segment: "year", digit: 6 });
        expect(result.effects).toContainEqual({ type: "invalid", reason: "nonexistent" });
        expect(result.state.value).toBeNull();
        expect(result.state.invalid).toBe(true);
        expect(result.state.parts.day).toBe(29);
    });

    it("stays quiet while a segment is still being typed and reports the draft on blur", () => {
        const options = { value: date(), minValue: Temporal.PlainDate.from({ year: 2024, month: 1, day: 1 }), maxValue: Temporal.PlainDate.from({ year: 2024, month: 12, day: 31 }) };
        let state = createField("date", options);
        const effects = [];
        // 2, 20 and 202 are drafts on the way to 2026, not years in the first three centuries.
        for (const digit of [2, 0, 2]) {
            const result = transitionField(state, { type: "DIGIT", segment: "year", digit }, options);
            state = result.state;
            effects.push(...result.effects);
        }
        expect(effects.filter((effect) => effect.type === "invalid")).toEqual([]);
        expect(state.invalid).toBe(false);
        const blurred = transitionField(state, { type: "BLUR" }, options);
        expect(blurred.effects).toContainEqual({ type: "invalid", reason: "range" });
        expect(blurred.state.buffer).toBeNull();
        expect(transitionField(blurred.state, { type: "BLUR" }, options).effects).toEqual([]);
    });

    it("pads every numeric segment but the year to its placeholder width", () => {
        const api = connectField(createField("date", { value: Temporal.PlainDate.from({ year: 2026, month: 9, day: 2 }) }), { id: "field", locale: "en-US" });
        expect(api.getSegmentProps("month").display).toBe("09");
        expect(api.getSegmentProps("day").display).toBe("02");
        expect(api.getSegmentProps("year").display).toBe("2026");
        const blank = connectField(createField("date", { placeholderValue: date() }), { id: "field", locale: "en-US" });
        expect(["month", "day", "year"].map((segment) => blank.getSegmentProps(segment as "month").display)).toEqual(["mm", "dd", "yyyy"]);
    });

    it("constrains days when editing a complete date", () => {
        const result = transitionField(createField("date", { value: date() }), { type: "STEP", segment: "month", direction: 1 });
        expect(result.state.value?.toString()).toBe("2024-02-29");
        expect(result.state.parts.day).toBe(29);
    });

    it("rejects out-of-range values and does not serialize stale values", () => {
        const options = { value: date(), maxValue: date() };
        const result = transitionField(createField("date", options), { type: "STEP", segment: "month", direction: 1 }, options);
        expect(result.state.invalid).toBe(true);
        expect(result.state.value).toBeNull();
        expect(result.effects).toContainEqual({ type: "invalid", reason: "range" });
    });

    it.each(["h11", "h12", "h23", "h24"] as const)("materializes midnight correctly for %s", (hourCycle) => {
        const options = { value: Temporal.PlainTime.from({ hour: 0 }), hourCycle };
        const state = createField("time", options);
        const next = transitionField(state, { type: "STEP", segment: "minute", direction: 1 }, options);
        expect(next.state.value?.hour).toBe(0);
        expect(next.state.value?.minute).toBe(1);
    });

    it("handles noon and changes day periods without parsing text", () => {
        const options = { value: Temporal.PlainTime.from({ hour: 0 }), hourCycle: "h12" as const };
        const result = transitionField(createField("time", options), { type: "PERIOD", value: 1 }, options);
        expect(result.state.value?.hour).toBe(12);
    });

    it("maps localized and ASCII digits and rejects full strings", () => {
        const localized = new Intl.NumberFormat("ar-EG").format(3);
        expect(digitValue(localized, "ar-EG")).toBe(3);
        expect(digitValue("3", "ar-EG")).toBe(3);
        expect(digitValue("03", "ar-EG")).toBeNull();
        expect(digitValue("2026-09-16")).toBeNull();
    });

    it("derives locale ordering from Intl", () => {
        const state = createField("date", { value: date() });
        const order = (locale: string) => connectField(state, { id: "test", locale }).segments.filter((part) => part.type !== "literal").map((part) => part.type);
        expect(order("en-US")).toEqual(["month", "day", "year"]);
        expect(order("de-DE")).toEqual(["day", "month", "year"]);
    });

    it("guards value types and explicitly rejects unsupported field calendars", () => {
        // @ts-expect-error A date cannot be edited as a time.
        expect(() => createField("time", { value: date() })).toThrow("PlainTime");
        expect(() => createField("date", { value: date().withCalendar("hebrew") })).toThrow("currently supports");
    });
});
describe("a second Temporal implementation", () => {
    /** A stand-in for a value built by another copy of the polyfill: right brand, wrong class. */
    function foreign(kind: "PlainDate" | "PlainTime") {
        return Object.assign(Object.create(null), {
            [Symbol.toStringTag]: `Temporal.${kind}`,
            year: 2026, month: 9, day: 16, hour: 9, minute: 30, second: 0,
            calendarId: "iso8601",
        });
    }

    it("names the real cause instead of blaming a string", () => {
        expect(() => createField("date", { value: foreign("PlainDate") as never }))
            .toThrow(/another Temporal implementation/);
        expect(() => createField("time", { placeholderValue: foreign("PlainTime") as never }))
            .toThrow(/another Temporal implementation/);
        try { createField("date", { value: foreign("PlainDate") as never }); }
        catch (error) { expect((error as { code: string }).code).toBe("TEMPORAL_MISMATCH"); }
    });

    it("still rejects strings and Dates as strings and Dates", () => {
        expect(() => createField("date", { value: "2026-09-16" as never })).toThrow(/not a string or Date|must be a Temporal/);
        expect(() => createField("date", { value: new Date() as never })).toThrow(/must be a Temporal/);
        try { createField("date", { value: "2026-09-16" as never }); }
        catch (error) { expect((error as { code: string }).code).toBe("INVALID_FIELD_VALUE"); }
    });
});
