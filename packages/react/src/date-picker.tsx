import * as React from "react";
import { computeAnchorPosition, containTabFocus, transitionPicker, translations, type PlainDate, type PickerEvent } from "chrona-core";
import { Calendar, type CalendarProps } from "./calendar";
import { DateField, type DateFieldProps } from "./date-field";
import { Part, composeEvent, type PartProps } from "./part";
import { useChronaConfig } from "./provider";

export interface DatePickerProps extends DateFieldProps {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    modal?: boolean;
    timeZone?: string;
    firstDayOfWeek?: number;
    fixedWeeks?: boolean;
    numberOfMonths?: number;
    pagedNavigation?: boolean;
}

interface PickerContext {
    props: DatePickerProps;
    options: DatePickerProps;
    state: { value: PlainDate | null; open: boolean };
    id: string;
    value: PlainDate | null;
    change: (value: PlainDate | null) => void;
    open: boolean;
    send: (event: PickerEvent) => void;
    trigger: { current: HTMLElement | null };
    labelled: boolean;
    registerLabel: (present: boolean) => void;
}

const Context = React.createContext<PickerContext | null>(null);
function usePicker() {
    const value = React.useContext(Context);
    if (!value) throw new Error("DatePicker parts must be inside DatePicker.Root.");
    return value;
}

function Root({ children, asChild, className, style, ...input }: DatePickerProps & Pick<PartProps, "children" | "asChild" | "className" | "style">) {
    const picker = useDatePicker(input);
    return <Context.Provider value={picker}><Part asChild={asChild} className={className} style={style} dir={picker.props.dir} data-scope="date-picker" data-part="root"><DateField.Root {...picker.props} id={`${picker.id}-field`} value={picker.value} onChange={picker.change}>{children}</DateField.Root></Part></Context.Provider>;
}

export function useDatePicker(input: DatePickerProps = {}): PickerContext {
    const props = useChronaConfig(input);
    const generatedId = React.useId();
    const id = props.id ?? generatedId;
    const [uncontrolledValue, setValue] = React.useState(props.defaultValue ?? null);
    const [uncontrolledOpen, setOpen] = React.useState(props.defaultOpen ?? false);
    const value = props.value === undefined ? uncontrolledValue : props.value;
    const open = props.open ?? uncontrolledOpen;
    const trigger = React.useRef<HTMLElement | null>(null);
    const [labelled, registerLabel] = React.useState(false);
    function change(next: PlainDate | null) {
        if (props.value === undefined) setValue(next);
        props.onChange?.(next);
    }
    function send(event: PickerEvent) {
        const result = transitionPicker({ open }, event, props);
        for (const effect of result.effects) if (effect.type === "openChange") {
            if (props.open === undefined) setOpen(effect.open);
            props.onOpenChange?.(effect.open);
        }
    }
    return { props, options: props, state: { value, open }, id, value, change, open, send, trigger, labelled, registerLabel };
}

const Label = React.forwardRef<HTMLElement, PartProps>(function Label(props, ref) {
    const { registerLabel } = usePicker();
    React.useEffect(() => {
        registerLabel(true);
        return () => registerLabel(false);
    }, [registerLabel]);
    return <DateField.Label {...props} ref={ref} />;
});

/** Like the paging buttons, the trigger is labelled but has no text of its own to show. */
function CalendarGlyph() {
    return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-scope="date-picker" data-part="trigger-icon"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
}

const Trigger = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }>(function Trigger({ onClick, children, ...props }, ref) {
    const picker = usePicker();
    return <Part as="button" {...props} type="button" ref={(node) => {
        picker.trigger.current = node;
        if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
    }} aria-label={props["aria-label"] ?? picker.props.translations?.chooseDate ?? translations.chooseDate} aria-haspopup="dialog" aria-expanded={picker.open} aria-controls={`${picker.id}-dialog`} disabled={picker.props.disabled} data-scope="date-picker" data-part="trigger" onClick={composeEvent(onClick, () => picker.send({ type: "TOGGLE" }))}>{children ?? <CalendarGlyph />}</Part>;
});

const Popover = React.forwardRef<HTMLDialogElement, Omit<React.ComponentPropsWithoutRef<"dialog">, "open"> & { anchored?: boolean }>(function Popover({ children, anchored = true, onCancel, onClose, onKeyDown, ...props }, ref) {
    const picker = usePicker();
    const dialog = React.useRef<HTMLDialogElement | null>(null);
    const latest = React.useRef(picker);
    latest.current = picker;

    React.useEffect(() => {
        const element = dialog.current;
        if (!element) return;
        if (picker.open && !element.open) {
            if (picker.props.modal === false) element.show(); else element.showModal();
            element.querySelector<HTMLElement>('[data-part="cell-trigger"][tabindex="0"]')?.focus();
        } else if (!picker.open && element.open) {
            element.close();
            picker.trigger.current?.focus();
        }
    }, [picker.open, picker.props.modal, picker.trigger]);

    React.useEffect(() => {
        if (!picker.open || !anchored) return;
        const element = dialog.current;
        const anchor = picker.trigger.current;
        const window = element?.ownerDocument.defaultView;
        if (!element || !anchor || !window) return;
        const properties = ["position", "margin", "top", "left", "max-width", "max-height", "min-width", "min-height", "box-sizing", "overflow"];
        const original = properties.map((property) => ({ property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
        const originalPlacement = element.getAttribute("data-placement");
        const position = () => {
            const viewport = window.visualViewport;
            const width = viewport?.width ?? element.ownerDocument.documentElement.clientWidth;
            const height = viewport?.height ?? element.ownerDocument.documentElement.clientHeight;
            const offsetTop = viewport?.offsetTop ?? 0;
            const offsetLeft = viewport?.offsetLeft ?? 0;
            Object.assign(element.style, {
                position: "fixed", margin: "0", boxSizing: "border-box", overflow: "auto",
                minWidth: "0", minHeight: "0", maxWidth: `${Math.max(0, width - 8)}px`, maxHeight: `${Math.max(0, height - 8)}px`,
            });
            const rect = anchor.getBoundingClientRect();
            const { top, left, placement } = computeAnchorPosition(
                { top: rect.top - offsetTop, left: rect.left - offsetLeft, width: rect.width, height: rect.height },
                { width: element.offsetWidth, height: element.offsetHeight }, { width, height },
            );
            Object.assign(element.style, { top: `${top + offsetTop}px`, left: `${left + offsetLeft}px` });
            element.setAttribute("data-placement", placement);
        };
        position();
        let frame: number | undefined;
        const schedulePosition = () => {
            if (frame !== undefined) return;
            frame = window.requestAnimationFrame(() => {
                frame = undefined;
                position();
            });
        };
        const observer = window.ResizeObserver ? new window.ResizeObserver(schedulePosition) : undefined;
        observer?.observe(element);
        observer?.observe(anchor);
        window.addEventListener("resize", schedulePosition);
        window.addEventListener("scroll", schedulePosition, true);
        window.visualViewport?.addEventListener("resize", schedulePosition);
        window.visualViewport?.addEventListener("scroll", schedulePosition);
        return () => {
            if (frame !== undefined) window.cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener("resize", schedulePosition);
            window.removeEventListener("scroll", schedulePosition, true);
            window.visualViewport?.removeEventListener("resize", schedulePosition);
            window.visualViewport?.removeEventListener("scroll", schedulePosition);
            for (const { property, value, priority } of original) {
                if (value) element.style.setProperty(property, value, priority);
                else element.style.removeProperty(property);
            }
            if (originalPlacement === null) element.removeAttribute("data-placement");
            else element.setAttribute("data-placement", originalPlacement);
        };
    }, [picker.open, anchored, picker.trigger]);

    React.useEffect(() => {
        const element = dialog.current;
        if (!picker.open || !element) return;
        const dismiss = (event: PointerEvent) => {
            if (!(event.target instanceof Node) || latest.current.trigger.current?.contains(event.target)) return;
            const rect = element.getBoundingClientRect();
            const onBackdrop = event.target === element && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
            if (!element.contains(event.target) || onBackdrop) latest.current.send({ type: "CLOSE" });
        };
        element.ownerDocument.addEventListener("pointerdown", dismiss);
        return () => element.ownerDocument.removeEventListener("pointerdown", dismiss);
    }, [picker.open]);

    // aria-labelledby wins wherever both are present, so the fallback name is only applied when
    // nothing else names the dialog.
    const labelledBy = props["aria-labelledby"] ?? (props["aria-label"] || !picker.labelled ? undefined : `${picker.id}-field-label`);
    const label = props["aria-label"] ?? (labelledBy === undefined ? picker.props.translations?.chooseDate ?? translations.chooseDate : undefined);

    return <dialog {...props} ref={(node) => {
        dialog.current = node;
        if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
    }} id={`${picker.id}-dialog`} aria-label={label} aria-labelledby={labelledBy} aria-modal={picker.props.modal !== false || undefined} data-scope="date-picker" data-part="popover"
        onKeyDown={composeEvent(onKeyDown, (event) => { if (picker.props.modal !== false) containTabFocus(event.currentTarget, event); })}
        onCancel={(event) => { onCancel?.(event); const canceled = event.defaultPrevented; event.preventDefault(); if (!canceled) picker.send({ type: "CLOSE" }); }}
        onClose={composeEvent(onClose, () => { if (picker.open) picker.send({ type: "CLOSE" }); })}>{picker.open ? children : null}</dialog>;
});

function PickerCalendar({ children, ...props }: Omit<CalendarProps, "value" | "defaultValue" | "onChange"> & Pick<PartProps, "children" | "className" | "style">) {
    const picker = usePicker();
    return <Calendar.Root {...picker.props} {...props} value={picker.value} onChange={picker.change} onSelect={() => picker.send({ type: "SELECT" })}>{children ?? <><Calendar.Header><Calendar.PrevButton /><Calendar.Heading /><Calendar.NextButton /></Calendar.Header><Calendar.Grid><Calendar.GridHeader /><Calendar.GridBody /></Calendar.Grid></>}</Calendar.Root>;
}

export const DatePicker = { Root, Label, Field: DateField.Field, Segment: DateField.Segment, HiddenInput: DateField.HiddenInput, ClearButton: DateField.ClearButton, LiveRegion: DateField.LiveRegion, Trigger, Popover, Calendar: PickerCalendar };