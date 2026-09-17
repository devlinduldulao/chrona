import { describe, expect, it, vi } from "vitest";
import { createRange, getRangeCellProps, transitionRange } from "../src/index";

const date = () => Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });

describe("range machine", () => {
    it("revalidates a draft start when bounds change", () => {
        const first = transitionRange(createRange(), { type: "SELECT", date: date() });
        const result = transitionRange(first.state, { type: "SELECT", date: date().add({ days: 2 }) }, { minValue: date().add({ days: 1 }) });
        expect(result.state.value).toBeNull();
        expect(result.effects).toEqual([{ type: "invalid" }]);
    });
    it("keeps the start internal and emits only a complete sorted range", () => {
        const first = transitionRange(createRange(), { type: "SELECT", date: date() });
        expect(first.state.value).toBeNull();
        expect(first.effects).toEqual([{ type: "rangeStart", value: date() }]);
        const end = date().subtract({ days: 2 });
        const second = transitionRange(first.state, { type: "SELECT", date: end });
        expect(second.state.value?.start.equals(end)).toBe(true);
        expect(second.state.value?.end.equals(date())).toBe(true);
        expect(getRangeCellProps(second.state, end)["data-range-start"]).toBe("");
    });

    it("rejects a range crossing an unavailable day", () => {
        const first = transitionRange(createRange(), { type: "SELECT", date: date() });
        const result = transitionRange(first.state, { type: "SELECT", date: date().add({ days: 3 }) }, { isDateUnavailable: (value) => value.day === 18 });
        expect(result.state.value).toBeNull();
        expect(result.state.invalid).toBe(true);
        expect(result.state.anchor?.equals(date())).toBe(true);
    });

    it("marks spans beyond the scan limit invalid instead of walking every day", () => {
        const predicate = vi.fn(() => false);
        const first = transitionRange(createRange(), { type: "SELECT", date: date() });
        const result = transitionRange(first.state, { type: "SELECT", date: date().add({ years: 30 }) }, { isDateUnavailable: predicate });
        expect(result.state.value).toBeNull();
        expect(result.effects).toEqual([{ type: "invalid" }]);
        expect(predicate.mock.calls.length).toBeLessThan(5);
    });

    it("supports single-day ranges and cancels drafts without changing the value", () => {
        const initial = createRange({ start: date(), end: date() });
        const draft = transitionRange(initial, { type: "SELECT", date: date().add({ days: 1 }) });
        expect(transitionRange(draft.state, { type: "CANCEL" }).state.value).toBe(initial.value);
    });
});