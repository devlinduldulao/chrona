// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { renderToString } from "react-dom/server";
import { Calendar, type CalendarProps } from "../src/calendar";
import { ChronaProvider, useChronaConfig } from "../src/provider";

afterEach(cleanup);
const date = () => Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });

function Example(props: CalendarProps) {
    return <Calendar.Root locale="en-US" placeholderValue={date()} {...props}>
        <Calendar.Header><Calendar.PrevButton /><Calendar.Heading /><Calendar.NextButton /></Calendar.Header>
        <Calendar.Grid><Calendar.GridHeader /><Calendar.GridBody /></Calendar.Grid>
        <Calendar.LiveRegion />
        <Calendar.HiddenInput name="date" />
    </Calendar.Root>;
}

describe("React Calendar", () => {
    it("reuses warm formatters on a focus move and an unrelated render", () => {
        const value = date();
        const { rerender } = render(<Example defaultValue={value} />);
        const DateFormatter = Intl.DateTimeFormat;
        const NumberFormatter = Intl.NumberFormat;
        const dates = vi.spyOn(Intl, "DateTimeFormat").mockImplementation((locale, options) => new DateFormatter(locale, options));
        const numbers = vi.spyOn(Intl, "NumberFormat").mockImplementation((locale, options) => new NumberFormatter(locale, options));
        try {
            rerender(<Example defaultValue={value} />);
            dates.mockClear();
            numbers.mockClear();
            fireEvent.keyDown(screen.getByRole("gridcell", { name: "Wednesday, September 16, 2026" }), { key: "ArrowRight" });
            rerender(<Example defaultValue={value} />);
            expect(dates).not.toHaveBeenCalled();
            expect(numbers).not.toHaveBeenCalled();
        } finally { dates.mockRestore(); numbers.mockRestore(); }
    });

    it("does not invalidate context consumers on an unchanged provider render", () => {
        const rendered = vi.fn();
        const Consumer = React.memo(function Consumer() {
            const config = useChronaConfig({});
            rendered(config.locale);
            return null;
        });
        const { rerender } = render(<ChronaProvider locale="en-US"><Consumer /></ChronaProvider>);
        rendered.mockClear();
        rerender(<ChronaProvider locale="en-US"><Consumer /></ChronaProvider>);
        expect(rendered).not.toHaveBeenCalled();
        rerender(<ChronaProvider locale="de-DE"><Consumer /></ChronaProvider>);
        expect(rendered).toHaveBeenCalledWith("de-DE");
    });

    it("uses the configured multi-month separator", () => {
        render(<Example numberOfMonths={2} translations={{ rangeSeparator: " to " }} />);
        expect(screen.getByRole("heading").textContent).toBe("September 2026 to October 2026");
    });
    it("uses defaultFocusedValue only for initial focus", () => {
        const { rerender } = render(<Example defaultFocusedValue={date().add({ days: 2 })} />);
        expect(screen.getByRole("gridcell", { name: "Friday, September 18, 2026" }).tabIndex).toBe(0);
        rerender(<Example defaultFocusedValue={date().add({ days: 3 })} />);
        expect(screen.getByRole("gridcell", { name: "Friday, September 18, 2026" }).tabIndex).toBe(0);
    });

    it("resets to the latest defaultValue", async () => {
        const example = (value: Temporal.PlainDate) => <form><Example defaultValue={value} /><button type="reset">Reset</button></form>;
        const { rerender } = render(example(date()));
        rerender(example(date().add({ days: 2 })));
        await userEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(screen.getByRole("gridcell", { selected: true }).getAttribute("data-date")).toBe("2026-09-18");
    });
    it("respects canceled form resets", async () => {
        const { container } = render(<form onReset={(event) => event.preventDefault()}><Example defaultValue={date()} /><button type="reset">Reset</button></form>);
        await userEvent.click(screen.getByRole("gridcell", { name: "Thursday, September 17, 2026" }));
        await userEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(container.querySelector("input")?.value).toBe("2026-09-17");
    });
    it("moves real focus with keys and selects a Temporal value", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Example onChange={onChange} />);
        const cell = screen.getByRole("gridcell", { name: "Wednesday, September 16, 2026" });
        cell.focus();
        await user.keyboard("{ArrowRight}{Enter}");
        expect(document.activeElement?.getAttribute("data-date")).toBe("2026-09-17");
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange.mock.calls[0]?.[0]).toBeInstanceOf(Temporal.PlainDate);
        expect(screen.getByRole("gridcell", { selected: true }).getAttribute("data-date")).toBe("2026-09-17");
        expect(document.querySelector<HTMLInputElement>('input[name="date"]')?.value).toBe("2026-09-17");
    });

    it("does not mutate controlled values when the parent declines a change", async () => {
        const onChange = vi.fn();
        render(<Example value={date()} onChange={onChange} />);
        await userEvent.click(screen.getByRole("gridcell", { name: "Thursday, September 17, 2026" }));
        expect(onChange).toHaveBeenCalledOnce();
        expect(screen.getByRole("gridcell", { selected: true }).getAttribute("data-date")).toBe("2026-09-16");
    });

    it("keeps out-of-range cells perceivable but not selectable", async () => {
        const onChange = vi.fn();
        render(<Example onChange={onChange} maxValue={date()} />);
        const cell = screen.getByRole("gridcell", { name: "Thursday, September 17, 2026" });
        expect((cell as HTMLButtonElement).disabled).toBe(false);
        expect(cell.getAttribute("aria-disabled")).toBe("true");
        await userEvent.click(cell);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("honors controlled focus and parent value updates", async () => {
        const { rerender } = render(<Example value={date()} />);
        rerender(<Example value={date().add({ months: 2 })} />);
        await waitFor(() => expect(screen.getByRole("grid").getAttribute("aria-label")).toBe("November 2026"));
    });

    it("composes child event handlers and refs without submitting forms", async () => {
        const onSubmit = vi.fn();
        const childClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
        const ref = React.createRef<HTMLButtonElement>();
        render(<form onSubmit={onSubmit}><Calendar.Root placeholderValue={date()}><Calendar.NextButton asChild><button ref={ref} onClick={childClick}>Next</button></Calendar.NextButton><Calendar.Heading /></Calendar.Root></form>);
        await userEvent.click(screen.getByRole("button"));
        expect(childClick).toHaveBeenCalledOnce();
        expect(ref.current).toBe(screen.getByRole("button"));
        expect(screen.getByRole("heading").textContent).toBe("September 2026");
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("resets uncontrolled form values through Temporal state", async () => {
        const { container } = render(<form><Example defaultValue={date()} /></form>);
        await userEvent.click(screen.getByRole("gridcell", { name: "Thursday, September 17, 2026" }));
        fireEvent.reset(container.querySelector("form")!);
        await waitFor(() => expect(container.querySelector("input")?.value).toBe("2026-09-16"));
    });

    it("renders deterministically on the server with an explicit reference date", () => {
        const output = renderToString(<Example defaultValue={date()} />);
        expect(output).toContain('role="grid"');
        expect(output).toContain('value="2026-09-16"');
    });

    it("has no automated accessibility violations", async () => {
        const { container } = render(<main><Example defaultValue={date()} /></main>);
        const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
        expect(result.violations).toEqual([]);
    });
});