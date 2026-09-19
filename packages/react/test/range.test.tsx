// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RangeCalendar } from "../src/index";

afterEach(cleanup);

it("selects an inclusive range using only the keyboard", async () => {
    const onChange = vi.fn();
    render(<RangeCalendar.Root locale="en-US" placeholderValue={Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 })} onChange={onChange}><RangeCalendar.Grid><RangeCalendar.GridHeader /><RangeCalendar.GridBody /></RangeCalendar.Grid><RangeCalendar.LiveRegion /></RangeCalendar.Root>);
    screen.getByRole("button", { name: "Wednesday, September 16, 2026" }).focus();
    await userEvent.keyboard("{Enter}{ArrowRight}{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.lastCall?.[0].start.toString()).toBe("2026-09-16");
    expect(onChange.mock.lastCall?.[0].end.toString()).toBe("2026-09-18");
    expect(screen.getAllByRole("gridcell", { selected: true })).toHaveLength(3);
});

it("does not announce a change when a form reset leaves the range where it was", async () => {
    const onChange = vi.fn();
    render(<form>
        <RangeCalendar.Root locale="en-US" placeholderValue={Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 })} onChange={onChange}>
            <RangeCalendar.Grid><RangeCalendar.GridBody /></RangeCalendar.Grid>
            <RangeCalendar.HiddenInput name="stay" />
        </RangeCalendar.Root>
        <button type="reset">reset</button>
    </form>);
    await userEvent.click(screen.getByRole("button", { name: "reset" }));
    await new Promise((resolve) => queueMicrotask(() => resolve(null)));
    expect(onChange).not.toHaveBeenCalled();
});
