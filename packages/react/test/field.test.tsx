// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { Calendar, DateField, RangeCalendar, TimeField } from "../src/index";
import { useField } from "../src/field";

afterEach(cleanup);
const date = () => Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });

describe("React fields", () => {
    it("announces translated invalid feedback and clears it after a valid edit", () => {
        render(<TimeField.Root defaultValue={Temporal.PlainTime.from({ hour: 9 })} minValue={Temporal.PlainTime.from({ hour: 9 })} hourCycle="h23" translations={{ invalidRange: "Outside working hours" }}><TimeField.Field /><TimeField.LiveRegion /></TimeField.Root>);
        const hour = screen.getByRole("spinbutton", { name: "Hour" });
        fireEvent.keyDown(hour, { key: "ArrowDown" });
        expect(screen.getByRole("status").textContent).toBe("Outside working hours");
        fireEvent.keyDown(hour, { key: "ArrowUp" });
        expect(screen.getByRole("status").textContent).toBe("");
    });
    it("keeps controlled reconciliation stable across unrelated renders", () => {
        const first = date();
        const second = first.add({ days: 1 });
        const { result, rerender } = renderHook(({ value }) => useField("date", { value }), { initialProps: { value: first } });
        rerender({ value: second });
        const state = result.current.state;
        rerender({ value: second });
        expect(result.current.state).toBe(state);
        expect(state.value).toBe(second);
    });
    it.each(["Calendar", "DateField", "TimeField", "RangeCalendar"])("rebinds %s resets when form ownership changes", async (name) => {
        const originalChange = vi.fn();
        const latestChange = vi.fn();
        const field = (form: string | undefined, onChange: () => void) => {
            if (name === "Calendar") return <Calendar.Root value={date()} onChange={onChange}><Calendar.HiddenInput name="date" form={form} /></Calendar.Root>;
            if (name === "DateField") return <DateField.Root value={date()} onChange={onChange}><DateField.HiddenInput name="date" form={form} /></DateField.Root>;
            if (name === "TimeField") return <TimeField.Root value={Temporal.PlainTime.from({ hour: 9 })} onChange={onChange}><TimeField.HiddenInput name="time" form={form} /></TimeField.Root>;
            return <RangeCalendar.Root value={{ start: date(), end: date() }} onChange={onChange}><RangeCalendar.HiddenInput name="range" form={form} /></RangeCalendar.Root>;
        };
        const example = (form: string | undefined, onChange: () => void) => <><form id="first" /><form id="second" />{field(form, onChange)}</>;
        const { container, rerender, unmount } = render(example("first", originalChange));
        const first = container.querySelector<HTMLFormElement>("#first")!;
        const second = container.querySelector<HTMLFormElement>("#second")!;
        const input = container.querySelector("input")!;
        rerender(example("second", latestChange));
        expect(container.querySelector("input")).toBe(input);
        expect(input.form).toBe(second);
        await act(async () => first.reset());
        expect(originalChange).not.toHaveBeenCalled();
        expect(latestChange).not.toHaveBeenCalled();
        second.addEventListener("reset", (event) => event.preventDefault(), { once: true });
        await act(async () => second.reset());
        expect(latestChange).not.toHaveBeenCalled();
        await act(async () => second.reset());
        expect(latestChange).toHaveBeenCalledExactlyOnceWith(null);
        latestChange.mockClear();
        rerender(example(undefined, latestChange));
        expect(input.form).toBeNull();
        await act(async () => second.reset());
        expect(latestChange).not.toHaveBeenCalled();
        rerender(example("first", latestChange));
        await act(async () => first.reset());
        expect(latestChange).toHaveBeenCalledExactlyOnceWith(null);
        latestChange.mockClear();
        unmount();
        await act(async () => first.dispatchEvent(new Event("reset")));
        expect(latestChange).not.toHaveBeenCalled();
    });

    it("rejects strings on controlled prop updates before comparing values", () => {
        const { rerender } = render(<DateField.Root value={date()}><DateField.Label>Date</DateField.Label><DateField.Field /></DateField.Root>);
        const invalidProps = { value: "2026-09-16" };
        // @ts-expect-error Strings remain invalid even when they represent the current value.
        expect(() => rerender(<DateField.Root {...invalidProps}><DateField.Label>Date</DateField.Label><DateField.Field /></DateField.Root>)).toThrow("PlainDate");
    });
    it("preserves the time when switching hour cycles", () => {
        const value = Temporal.PlainTime.from({ hour: 20, minute: 30 });
        const { rerender } = render(<TimeField.Root value={value} hourCycle="h23"><TimeField.Label>Time</TimeField.Label><TimeField.Field /></TimeField.Root>);
        rerender(<TimeField.Root value={value} hourCycle="h12"><TimeField.Label>Time</TimeField.Label><TimeField.Field /></TimeField.Root>);
        expect(screen.getByRole("spinbutton", { name: "Hour" }).getAttribute("aria-valuenow")).toBe("8");
        expect(screen.getByRole("spinbutton", { name: "AM/PM" }).getAttribute("aria-valuenow")).toBe("1");
    });
    it("types an entire date with smart advance", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<DateField.Root locale="en-US" placeholderValue={date()} onChange={onChange}><DateField.Label>Birthday</DateField.Label><DateField.Field /><DateField.HiddenInput name="birthday" /></DateField.Root>);
        await user.click(screen.getByRole("spinbutton", { name: "Month" }));
        await user.keyboard("05231990");
        expect(document.querySelector<HTMLInputElement>('input[name="birthday"]')?.value).toBe("1990-05-23");
        expect(onChange.mock.lastCall?.[0]).toBeInstanceOf(Temporal.PlainDate);
        await user.keyboard("{Backspace}");
        expect(document.querySelector<HTMLInputElement>('input[name="birthday"]')?.value).toBe("");
        expect(onChange.mock.lastCall?.[0]).toBeNull();
    });

    it("rejects paste and whole-string changes", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<DateField.Root onChange={onChange} placeholderValue={date()}><DateField.Label>Date</DateField.Label><DateField.Field /></DateField.Root>);
        const month = screen.getByRole("spinbutton", { name: "Month" });
        await user.click(month);
        await user.paste("05/23/1990");
        fireEvent.change(month, { target: { value: "05/23/1990" } });
        expect(onChange).not.toHaveBeenCalled();
        expect((month as HTMLInputElement).value).toBe("mm");
    });

    it("accepts mobile single-digit InputEvents", () => {
        render(<DateField.Root placeholderValue={date()}><DateField.Label>Date</DateField.Label><DateField.Field /></DateField.Root>);
        const month = screen.getByRole("spinbutton", { name: "Month" });
        fireEvent.input(month, { target: { value: "3" }, data: "3", inputType: "insertText" });
        expect(month.getAttribute("aria-valuenow")).toBe("3");
    });

    it("keeps a controlled value when a change is declined", async () => {
        render(<DateField.Root value={date()}><DateField.Label>Date</DateField.Label><DateField.Field /></DateField.Root>);
        await userEvent.click(screen.getByRole("spinbutton", { name: "Month" }));
        await userEvent.keyboard("{ArrowUp}");
        expect(screen.getByRole("spinbutton", { name: "Month" }).getAttribute("aria-valuenow")).toBe("9");
    });

    it("resets form fields and follows locale ordering", async () => {
        const { container } = render(<form><DateField.Root locale="de-DE" defaultValue={date()}><DateField.Label>Date</DateField.Label><DateField.Field /><DateField.HiddenInput name="date" /></DateField.Root></form>);
        expect(screen.getAllByRole("spinbutton")[0]?.getAttribute("data-segment")).toBe("day");
        await userEvent.click(screen.getByRole("spinbutton", { name: "Month" }));
        await userEvent.keyboard("{ArrowUp}");
        fireEvent.reset(container.querySelector("form")!);
        await waitFor(() => expect(container.querySelector<HTMLInputElement>('input[name="date"]')?.value).toBe("2026-09-16"));
    });

    it("hydrates a 12-hour TimeField when the server and browser ICU disagree about the AM/PM separator", async () => {
        const element = <TimeField.Root locale="en-US" hourCycle="h12" value={Temporal.PlainTime.from({ hour: 9, minute: 30 })}><TimeField.Field /></TimeField.Root>;
        const NativeFormatter = Intl.DateTimeFormat;
        // Two ICU builds: newer data puts U+202F before AM/PM, older data puts a plain space.
        // Rendering with one and hydrating with the other is exactly the Node/browser mismatch.
        const icu = (separator: string) => vi.spyOn(Intl, "DateTimeFormat").mockImplementation((locale, options) => {
            const swap = (text: string) => text.replace(/[\u202F\u00A0 ]/g, separator);
            return {
                format: (value?: never) => swap(new NativeFormatter(locale, options).format(value)),
                formatToParts: (value?: never) => new NativeFormatter(locale, options).formatToParts(value).map((part) => ({ ...part, value: swap(part.value) })),
                resolvedOptions: () => new NativeFormatter(locale, options).resolvedOptions(),
            } as unknown as Intl.DateTimeFormat;
        });
        const server = icu("\u202F");
        let markup = "";
        try { markup = renderToString(element); } finally { server.mockRestore(); }
        expect(markup).not.toContain("\u202F");
        const container = document.createElement("div");
        container.innerHTML = markup;
        document.body.append(container);
        const browser = icu(" ");
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await act(async () => { hydrateRoot(container, element); });
            expect(logged).not.toHaveBeenCalled();
        } finally { logged.mockRestore(); browser.mockRestore(); container.remove(); }
    });

    it("edits 12-hour time and has accessible segment semantics", async () => {
        const { container } = render(<TimeField.Root locale="en-US" hourCycle="h12" defaultValue={Temporal.PlainTime.from({ hour: 0, minute: 30 })}><TimeField.Label>Start time</TimeField.Label><TimeField.Field /><TimeField.HiddenInput name="time" /></TimeField.Root>);
        await userEvent.click(screen.getByRole("spinbutton", { name: "AM/PM" }));
        await userEvent.keyboard("p");
        expect(container.querySelector<HTMLInputElement>('input[name="time"]')?.value).toBe("12:30:00");
        const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
        expect(result.violations).toEqual([]);
    });
});

describe("soft keyboards", () => {
    /** Android reports keydown as "Unidentified"; the input event carries the character. */
    function softType(element: HTMLInputElement, text: string, inputType = "insertText") {
        fireEvent.keyDown(element, { key: "Unidentified", keyCode: 229 });
        fireEvent.input(element, { target: { value: text }, data: text, inputType });
    }

    it("accepts digits from a composing keyboard", () => {
        render(<DateField.Root locale="en-US" placeholderValue={date()}><DateField.Field /></DateField.Root>);
        const month = screen.getByRole("spinbutton", { name: "Month" }) as HTMLInputElement;
        softType(month, "1", "insertCompositionText");
        softType(month, "2", "insertCompositionText");
        expect(month.value).toBe("12");
    });

    it("switches the day period from text, with no hardware keyboard", () => {
        render(<TimeField.Root locale="en-US" defaultValue={Temporal.PlainTime.from({ hour: 9 })} hourCycle="h12"><TimeField.Field /></TimeField.Root>);
        const period = screen.getByRole("spinbutton", { name: "AM/PM" }) as HTMLInputElement;
        expect(period.value).toBe("AM");
        softType(period, "p");
        expect(period.value).toBe("PM");
        softType(period, "AM");
        expect(period.value).toBe("AM");
    });

    it("switches the day period from a localized label", async () => {
        render(<TimeField.Root locale="ja-JP" defaultValue={Temporal.PlainTime.from({ hour: 9 })} hourCycle="h12"><TimeField.Field /></TimeField.Root>);
        const period = screen.getByRole("spinbutton", { name: "AM/PM" }) as HTMLInputElement;
        expect(period.value).toBe("\u5348\u524d");
        softType(period, "\u5348\u5f8c");
        expect(period.value).toBe("\u5348\u5f8c");
    });

    it("ignores text that is neither a digit nor a day period", () => {
        render(<DateField.Root locale="en-US" defaultValue={date()}><DateField.Field /></DateField.Root>);
        const day = screen.getByRole("spinbutton", { name: "Day" }) as HTMLInputElement;
        softType(day, "x");
        expect(day.value).toBe("16");
        fireEvent.input(day, { target: { value: "2026-09-16" }, data: "2026-09-16", inputType: "insertFromPaste" });
        expect(day.value).toBe("16");
    });
});
