import * as React from "react";
import { createRange, createStore, formatDate, getRangeCellProps, getRangeCellTriggerProps, sameDate, transitionRange, translations, validateRange, type DateRange, type PlainDate, type RangeEvent } from "chrona-core";
import { Calendar, CalendarSurface, useCalendar, type CalendarProps } from "./calendar";
import { Part, composeEvent, type PartProps } from "./part";
import { useFormReset, type HiddenInputProps } from "./form";
import { useChronaConfig } from "./provider";

export interface RangeCalendarProps extends Omit<CalendarProps, "value" | "defaultValue" | "onChange"> {
    value?: DateRange | null;
    defaultValue?: DateRange | null;
    onChange?: (value: DateRange | null) => void;
    onRangeStartChange?: (value: PlainDate | null) => void;
    onInvalid?: () => void;
}

function sameRange(first: DateRange | null, second: DateRange | null): boolean {
    return first === null || second === null
        ? first === second
        : sameDate(first.start, second.start) && sameDate(first.end, second.end);
}

export function useRangeCalendar(input: RangeCalendarProps = {}) {
    const props = useChronaConfig(input);
    const [store] = React.useState(() => createStore(createRange(props.value !== undefined ? props.value : props.defaultValue)));
    const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
    if (props.value) validateRange(props.value);
    const state = { ...snapshot, value: props.value === undefined ? snapshot.value : props.value };
    const [announcement, setAnnouncement] = React.useState("");
    function send(event: RangeEvent) {
        const result = transitionRange(state, event, props);
        store.setState(result.state);
        for (const effect of result.effects) {
            if (effect.type === "change") {
                props.onChange?.(effect.value);
                setAnnouncement(effect.value ? [effect.value.start, effect.value.end].map((date) => formatDate(date, props.locale, { dateStyle: "long" })).join(props.translations?.rangeSeparator ?? translations.rangeSeparator) : "");
            }
            if (effect.type === "rangeStart") {
                props.onRangeStartChange?.(effect.value);
                if (effect.value) setAnnouncement(formatDate(effect.value, props.locale, { dateStyle: "long" }));
            }
            if (effect.type === "invalid") { props.onInvalid?.(); setAnnouncement(props.translations?.unavailable ?? translations.unavailable); }
        }
    }
    const calendar = useCalendar({ ...props, value: null, defaultValue: null, placeholderValue: props.placeholderValue ?? state.value?.start, onChange: (date) => { if (date) send({ type: "SELECT", date }); }, onFocusedValueChange: (date) => { props.onFocusedValueChange?.(date); if (state.anchor) send({ type: "PREVIEW", date }); } });
    const baseApi = calendar.api;
    const api = {
        ...baseApi,
        getCellProps: (date: PlainDate, month?: PlainDate) => ({ ...baseApi.getCellProps(date, month), ...getRangeCellProps(state, date) }),
        getCellTriggerProps: (date: PlainDate, month?: PlainDate) => ({ ...baseApi.getCellTriggerProps(date, month), ...getRangeCellTriggerProps(state, date) }),
    };
    return {
        state, send, announcement, props, options: props, api, rootRef: calendar.rootRef, months: calendar.months,
        reset() {
            const value = props.defaultValue ?? null;
            store.setState(createRange(value));
            if (!sameRange(state.value, value)) props.onChange?.(value);
        },
        calendar: { ...calendar, api },
    };
}

const Context = React.createContext<ReturnType<typeof useRangeCalendar> | null>(null);
function useContext() {
    const value = React.useContext(Context);
    if (!value) throw new Error("RangeCalendar parts must be inside RangeCalendar.Root.");
    return value;
}

function Root({ children, asChild, className, style, ...props }: RangeCalendarProps & Pick<PartProps, "children" | "asChild" | "className" | "style">) {
    const context = useRangeCalendar(props);
    return <Context.Provider value={context}><CalendarSurface calendar={context.calendar} asChild={asChild} className={className} style={style} data-scope="range-calendar" onKeyDown={(event) => { if (event.key === "Escape" && context.state.anchor) { event.preventDefault(); context.send({ type: "CANCEL" }); } }}>{children}</CalendarSurface></Context.Provider>;
}

const Cell = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<typeof Calendar.Cell>>(function Cell({ date, onPointerEnter, ...props }, ref) {
    const { send } = useContext();
    return <Calendar.Cell {...props} ref={ref} date={date} onPointerEnter={composeEvent(onPointerEnter, () => send({ type: "PREVIEW", date }))} />;
});

const GridBody = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<typeof Calendar.GridBody>>(function GridBody({ children, ...props }, ref) {
    return <Calendar.GridBody {...props} ref={ref}>{children ?? ((date) => <Cell date={date} />)}</Calendar.GridBody>;
});

const LiveRegion = React.forwardRef<HTMLElement, PartProps>(function LiveRegion(props, ref) {
    const { announcement } = useContext();
    return <Part {...props} ref={ref} role="status" aria-live="polite" aria-atomic="true" data-scope="range-calendar" data-part="live-region">{announcement}</Part>;
});

const ClearButton = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<typeof Calendar.ClearButton>>(function ClearButton({ onClick, ...props }, ref) {
    const { send, props: options } = useContext();
    return <Part as="button" {...props} ref={ref} type="button" disabled={options.disabled || options.readOnly} aria-label={options.translations?.clear ?? translations.clear} data-scope="range-calendar" data-part="clear-button" onClick={composeEvent(onClick, () => send({ type: "CLEAR" }))} />;
});

function HiddenInput({ name, form, id, disabled, ...inputProps }: HiddenInputProps & { name: string }) {
    const { state, props, reset } = useContext();
    const input = React.useRef<HTMLInputElement>(null);
    useFormReset(input, form, reset);
    return <><input {...inputProps} id={id ? `${id}-start` : undefined} ref={input} type="hidden" name={`${name}.start`} form={form} value={state.value?.start.toString() ?? ""} disabled={props.disabled || disabled} data-scope="range-calendar" data-part="hidden-input" /><input {...inputProps} id={id ? `${id}-end` : undefined} type="hidden" name={`${name}.end`} form={form} value={state.value?.end.toString() ?? ""} disabled={props.disabled || disabled} data-scope="range-calendar" data-part="hidden-input" /></>;
}

export const RangeCalendar = { ...Calendar, Root, Cell, GridBody, LiveRegion, ClearButton, HiddenInput };