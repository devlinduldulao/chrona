// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "../src/index";
import { transitionPicker } from "chrona-core";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.show = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);
const date = () => Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });

function Example(props: React.ComponentProps<typeof DatePicker.Root>) {
    return <DatePicker.Root locale="en-US" placeholderValue={date()} {...props}><DatePicker.Label>Appointment</DatePicker.Label><DatePicker.Field /><DatePicker.Trigger /><DatePicker.Popover><DatePicker.Calendar /></DatePicker.Popover><DatePicker.HiddenInput name="date" /></DatePicker.Root>;
}

describe("DatePicker", () => {
    it("coalesces positioning events and cancels pending work on cleanup", () => {
        let scheduled: FrameRequestCallback | undefined;
        const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { scheduled = callback; return 42; });
        const cancel = vi.spyOn(window, "cancelAnimationFrame");
        try {
            const { rerender } = render(<Example open />);
            const trigger = screen.getByRole("button", { name: "Choose date" });
            const measure = vi.spyOn(trigger, "getBoundingClientRect");
            fireEvent.scroll(window);
            fireEvent.resize(window);
            fireEvent.scroll(document);
            expect(request).toHaveBeenCalledOnce();
            expect(measure).not.toHaveBeenCalled();
            act(() => scheduled?.(0));
            expect(measure).toHaveBeenCalledOnce();
            fireEvent.scroll(window);
            rerender(<Example open={false} />);
            expect(cancel).toHaveBeenCalledWith(42);
        } finally { request.mockRestore(); cancel.mockRestore(); }
    });
    it("restores application styles when anchoring is disabled or the popup closes", () => {
        const example = (anchored: boolean, open = true) => <DatePicker.Root open={open} placeholderValue={date()}><DatePicker.Trigger /><DatePicker.Popover anchored={anchored} style={{ maxHeight: "200px", overflow: "hidden" }}><DatePicker.Calendar /></DatePicker.Popover></DatePicker.Root>;
        const { rerender } = render(example(true));
        const dialog = screen.getByRole("dialog");
        expect(dialog.style.position).toBe("fixed");
        expect(dialog.style.overflow).toBe("auto");
        rerender(example(false));
        expect(dialog.style.position).toBe("");
        expect(dialog.style.maxHeight).toBe("200px");
        expect(dialog.style.overflow).toBe("hidden");
        expect(dialog.hasAttribute("data-placement")).toBe(false);
        rerender(example(true));
        expect(dialog.style.position).toBe("fixed");
        rerender(example(true, false));
        expect(dialog.style.position).toBe("");
        expect(dialog.style.maxHeight).toBe("200px");
    });

    it("orchestrates open and close effects in core", () => {
        expect(transitionPicker({ open: false }, { type: "OPEN" }).effects).toEqual([{ type: "openChange", open: true }]);
        expect(transitionPicker({ open: true }, { type: "SELECT" }).state.open).toBe(false);
        expect(transitionPicker({ open: false }, { type: "OPEN" }, { disabled: true }).effects).toEqual([]);
    });

    it("opens, focuses the calendar, selects, closes, and restores focus", async () => {
        const onChange = vi.fn();
        render(<Example onChange={onChange} />);
        const trigger = screen.getByRole("button", { name: "Choose date" });
        await userEvent.click(trigger);
        expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBeTruthy();
        expect(document.activeElement?.getAttribute("data-date")).toBe("2026-09-16");
        await userEvent.keyboard("{ArrowRight}{Enter}");
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(document.activeElement).toBe(trigger);
        expect(onChange.mock.lastCall?.[0].toString()).toBe("2026-09-17");
        expect(screen.getByRole("spinbutton", { name: "Day" }).getAttribute("aria-valuenow")).toBe("17");
    });

    it("respects controlled open state and cancellation", async () => {
        const onOpenChange = vi.fn();
        render(<Example open onOpenChange={onOpenChange} />);
        const focused = document.activeElement;
        fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(document.activeElement).toBe(focused);
    });

    it("only references labels that are mounted", () => {
        const example = (labelled: boolean) => <DatePicker.Root open placeholderValue={date()}>{labelled && <DatePicker.Label>Visit</DatePicker.Label>}<DatePicker.Popover /></DatePicker.Root>;
        const { rerender } = render(example(false));
        expect(screen.getByRole("dialog", { name: "Choose date" }).hasAttribute("aria-labelledby")).toBe(false);
        rerender(example(true));
        expect(screen.getByRole("dialog", { name: "Visit" })).toBeTruthy();
        rerender(example(false));
        expect(screen.getByRole("dialog", { name: "Choose date" }).hasAttribute("aria-labelledby")).toBe(false);
    });

    it("does not open disabled pickers", async () => {
        render(<Example disabled />);
        await userEvent.click(screen.getByRole("button", { name: "Choose date" }));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes when the existing date is selected without emitting a change", async () => {
        const onChange = vi.fn();
        render(<Example defaultValue={date()} onChange={onChange} />);
        await userEvent.click(screen.getByRole("button", { name: "Choose date" }));
        await userEvent.keyboard("{Enter}");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });
});