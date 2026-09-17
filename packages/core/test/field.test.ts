import { describe, expect, it } from "vitest";
import { connectField, createField, digitValue, transitionField } from "../src/index";

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