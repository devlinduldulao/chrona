import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { connectCalendar, createCalendar, syncCalendar, transitionCalendar, weeksInMonthView } from "../src/index";

describe("calendar machine", () => {
    it("fails actionably when Temporal is missing", () => {
        vi.stubGlobal("Temporal", undefined);
        try { expect(() => createCalendar()).toThrow("temporal-polyfill/global"); }
        finally { vi.unstubAllGlobals(); }
    });

    it("resets read-only state without treating a reset as a user selection", () => {
        const date = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
        const result = transitionCalendar(createCalendar({ value: date }), { type: "RESET", value: null }, { readOnly: true, placeholderValue: date });
        expect(result.state.value).toBeNull();
        expect(result.effects).toEqual([{ type: "change", value: null }]);
    });
    it("crosses months with keyboard navigation without mutating the previous state", () => {
        const date = Temporal.PlainDate.from({ year: 2024, month: 2, day: 29 });
        const initial = createCalendar({ value: date });
        const next = transitionCalendar(initial, { type: "KEY_DOWN", key: "ArrowRight" });
        expect(next.state.focusedValue.toString()).toBe("2024-03-01");
        expect(initial.focusedValue.equals(date)).toBe(true);
        expect(next.effects[0]?.type).toBe("focus");
        expect(transitionCalendar(next.state, { type: "KEY_DOWN", key: "Enter" }).effects).toEqual([
            { type: "change", value: next.state.focusedValue },
            { type: "select", value: next.state.focusedValue },
        ]);
    });

    it("generates a fixed six-week grid", () => {
        const month = Temporal.PlainYearMonth.from({ year: 2024, month: 2 });
        const weeks = weeksInMonthView(month, 1, true);
        expect(weeks).toHaveLength(6);
        expect(weeks.flat()).toHaveLength(42);
        expect(weeks[0]?.[0]?.dayOfWeek).toBe(1);
    });

    it("allows focus but not selection on unavailable dates", () => {
        const date = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
        const options = { value: date, isDateUnavailable: () => true };
        const next = transitionCalendar(createCalendar(options), { type: "KEY_DOWN", key: "ArrowRight" }, options);
        expect(next.state.focusedValue.day).toBe(17);
        expect(transitionCalendar(next.state, { type: "KEY_DOWN", key: "Enter" }, options).effects).toEqual([]);
    });

    it("clamps navigation and honors RTL and readOnly", () => {
        const date = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
        const initial = createCalendar({ value: date });
        expect(transitionCalendar(initial, { type: "KEY_DOWN", key: "ArrowRight" }, { dir: "rtl" }).state.focusedValue.day).toBe(15);
        expect(transitionCalendar(initial, { type: "KEY_DOWN", key: "ArrowDown" }, { maxValue: date }).state.focusedValue.day).toBe(16);
        expect(transitionCalendar(initial, { type: "CLEAR" }, { readOnly: true }).effects).toEqual([]);
        expect(transitionCalendar(initial, { type: "KEY_DOWN", key: "ArrowRight" }, { disabled: true }).state).toBe(initial);
    });

    it("keeps focus within a multi-month view without shifting its anchor", () => {
        const date = Temporal.PlainDate.from({ year: 2026, month: 9, day: 30 });
        const next = transitionCalendar(createCalendar({ value: date }), { type: "KEY_DOWN", key: "ArrowRight" }, { numberOfMonths: 2 });
        expect(next.state.visibleMonth.month).toBe(9);
        expect(next.state.focusedValue.month).toBe(10);
    });

    it("uses locale week starts and supports year paging", () => {
        const date = Temporal.PlainDate.from({ year: 2024, month: 2, day: 29 });
        const state = createCalendar({ value: date });
        expect(transitionCalendar(state, { type: "KEY_DOWN", key: "Home" }, { locale: "en-US" }).state.focusedValue.dayOfWeek).toBe(7);
        expect(transitionCalendar(state, { type: "KEY_DOWN", key: "End" }, { locale: "de-DE" }).state.focusedValue.dayOfWeek).toBe(7);
        expect(transitionCalendar(state, { type: "KEY_DOWN", key: "PageDown", shiftKey: true }).state.focusedValue.toString()).toBe("2025-02-28");
    });

    it("rejects invalid API values and bounds", () => {
        // @ts-expect-error Strings are not Chrona values.
        expect(() => createCalendar({ value: "2026-09-16" })).toThrow("Temporal.PlainDate");
        expect(() => createCalendar({ numberOfMonths: 0 })).toThrow("numberOfMonths");
        expect(() => createCalendar({ firstDayOfWeek: 0 })).toThrow("firstDayOfWeek");
        expect(() => createCalendar({ minValue: Temporal.PlainDate.from({ year: 2026, month: 2, day: 1 }), maxValue: Temporal.PlainDate.from({ year: 2026, month: 1, day: 1 }) })).toThrow("minValue");
    });

    it.for(["iso8601", "hebrew", "islamic-civil", "japanese", "chinese"])("builds consecutive grids for %s", (calendar, context) => {
        if (process.env.CHRONA_TEMPORAL === "native") {
            try {
                Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 }).withCalendar(calendar).subtract({ days: 1 });
            } catch (error) {
                if (error instanceof RangeError && error.message.includes("Not yet implemented")) {
                    context.skip(`Native Temporal does not implement ${calendar} arithmetic in this runtime.`);
                    return;
                }
                throw error;
            }
        }
        fc.assert(fc.property(fc.integer({ min: 2000, max: 2040 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 7 }), (year, month, weekStart) => {
            const date = Temporal.PlainDate.from({ year, month, day: 15 }).withCalendar(calendar);
            const days = weeksInMonthView(date.toPlainYearMonth(), weekStart, true).flat();
            expect(days).toHaveLength(42);
            expect(days[0]?.dayOfWeek).toBe(weekStart);
            expect(days.some((day) => day.equals(date))).toBe(true);
            for (let index = 1; index < days.length; index++) {
                expect(days[index - 1]!.add({ days: 1 }).equals(days[index]!)).toBe(true);
            }
        }), { numRuns: 30 });
    });

    it("exposes one tabbable cell across adjacent grids", () => {
        const date = Temporal.PlainDate.from({ year: 2026, month: 9, day: 30 });
        const state = createCalendar({ value: date });
        const api = connectCalendar(state, { id: "calendar", numberOfMonths: 2 });
        const months = [state.visibleMonth, state.visibleMonth.add({ months: 1 })];
        const tabbable = months.flatMap((month) => weeksInMonthView(month.toPlainYearMonth(), 1, true).flat().map((cell) => api.getCellProps(cell, month))).filter((props) => props.tabIndex === 0);
        expect(tabbable).toHaveLength(1);
        expect(tabbable[0]?.["aria-selected"]).toBe(true);
    });

    it("reconciles controlled updates without discarding unrelated state", () => {
        const date = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
        const state = createCalendar({ value: date });
        expect(syncCalendar(state, {})).toBe(state);
        expect(syncCalendar(state, { value: date })).toBe(state);
        const moved = syncCalendar(state, { value: date.add({ months: 2 }) });
        expect(moved.focusedValue.equals(date.add({ months: 2 }))).toBe(true);
        expect(moved.visibleMonth.month).toBe(11);
        const cleared = syncCalendar(state, { value: null });
        expect(cleared.value).toBeNull();
        expect(cleared.focusedValue.equals(state.focusedValue)).toBe(true);
        const clamped = syncCalendar(state, { focusedValue: date.add({ days: 20 }), maxValue: date });
        expect(clamped.focusedValue.equals(date)).toBe(true);
    });
});