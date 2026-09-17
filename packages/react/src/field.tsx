import * as React from "react";
import { connectField, createField, createStore, digitValue, fieldHourCycle, transitionField, translations, type FieldEvent, type FieldInvalidReason, type FieldKind, type FieldOptions, type FieldValue, type SegmentType } from "chrona-core";
import { Part, composeEvent, type PartProps } from "./part";
import { useChronaConfig } from "./provider";
import { useFormReset, type HiddenInputProps } from "./form";

export interface FieldProps<Kind extends FieldKind> extends FieldOptions<Kind> {
    defaultValue?: FieldValue<Kind> | null;
    onChange?: (value: FieldValue<Kind> | null) => void;
    onInvalid?: (reason: FieldInvalidReason) => void;
    id?: string;
    describedBy?: string;
}

function equalValues(first: { equals: (other: never) => boolean } | null, second: { equals: (other: never) => boolean } | null) {
    return first === null || second === null ? first === second : first.equals(second as never);
}

export function useField<Kind extends FieldKind>(kind: Kind, props: FieldProps<Kind>) {
    const options = useChronaConfig(props);
    const generatedId = React.useId();
    const id = props.id ?? generatedId;
    const [store] = React.useState(() => createStore(createField(kind, { ...options, value: props.value !== undefined ? props.value : props.defaultValue })));
    const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
    const value = props.value !== undefined ? props.value : snapshot.value;
    const placeholderValue = options.placeholderValue ?? snapshot.reference;
    const { minValue, maxValue, locale, hourCycle, granularity } = options;
    const configured = React.useMemo(() => createField(kind, { value, placeholderValue, minValue, maxValue, locale, hourCycle, granularity }), [kind, value, placeholderValue, minValue, maxValue, locale, hourCycle, granularity]);
    const cycle = fieldHourCycle(options);
    const configuration = `${cycle}:${props.granularity ?? "minute"}`;
    const previousConfiguration = React.useRef(configuration);
    const state = props.value !== undefined && !equalValues(snapshot.value, props.value)
        ? configured
        : kind === "time" && configuration !== previousConfiguration.current
            ? configured
            : snapshot;
    React.useEffect(() => {
        if (previousConfiguration.current !== configuration) {
            previousConfiguration.current = configuration;
            store.setState(state);
        }
    }, [configuration, state, store]);
    const groupRef = React.useRef<HTMLElement | null>(null);
    const [invalidReason, setInvalidReason] = React.useState<FieldInvalidReason | null>(null);
    const announcementKey = { range: "invalidRange", unavailable: "unavailable", nonexistent: "nonexistentDate" } as const;
    const announcement = invalidReason === null ? "" : options.translations?.[announcementKey[invalidReason]] ?? translations[announcementKey[invalidReason]];

    function moveFocus(segment: SegmentType, offset: number) {
        const elements = Array.from(groupRef.current?.querySelectorAll<HTMLInputElement>("input[data-segment]") ?? []);
        const index = elements.findIndex((element) => element.dataset.segment === segment);
        elements[index + offset]?.focus();
    }

    function send(event: FieldEvent) {
        const result = transitionField(state, event, options);
        store.setState(result.state);
        if (!result.state.invalid) setInvalidReason(null);
        for (const effect of result.effects) {
            if (effect.type === "change") props.onChange?.(effect.value);
            if (effect.type === "invalid") { setInvalidReason(effect.reason); props.onInvalid?.(effect.reason); }
            if (effect.type === "advance") queueMicrotask(() => moveFocus(effect.segment, 1));
        }
    }

    function reset() {
        setInvalidReason(null);
        const value = props.defaultValue ?? null;
        store.setState(createField(kind, { ...options, value }));
        if (!equalValues(state.value, value)) props.onChange?.(value);
    }

    const [labelled, setLabelled] = React.useState(false);
    return { id, state, options, send, reset, moveFocus, groupRef, announcement, registerLabel: setLabelled, api: connectField(state, { ...options, id, labelId: labelled ? `${id}-label` : undefined }) };
}

export function createFieldComponents<Kind extends FieldKind>(kind: Kind) {
    const Context = React.createContext<ReturnType<typeof useField<Kind>> | null>(null);
    function useContext() {
        const context = React.useContext(Context);
        if (!context) throw new Error(`${kind === "date" ? "DateField" : "TimeField"} parts must be inside their Root.`);
        return context;
    }

    function Root({ children, asChild, className, style, ...props }: FieldProps<Kind> & Pick<PartProps, "children" | "asChild" | "className" | "style">) {
        const context = useField(kind, props);
        return <Context.Provider value={context}><Part asChild={asChild} className={className} style={style} id={props.id} dir={context.options.dir} data-scope={`${kind}-field`} data-part="root">{children}</Part></Context.Provider>;
    }

    const Label = React.forwardRef<HTMLElement, PartProps>(function Label(props, ref) {
        const { id, registerLabel } = useContext();
        React.useEffect(() => {
            registerLabel(true);
            return () => registerLabel(false);
        }, [registerLabel]);
        return <Part as="span" {...props} ref={ref} id={`${id}-label`} data-scope={`${kind}-field`} data-part="label" />;
    });

    const Segment = React.forwardRef<HTMLInputElement, Omit<React.ComponentPropsWithoutRef<"input">, "type" | "value" | "defaultValue" | "onChange" | "children"> & { type: SegmentType }>(function Segment({ type, onKeyDown, onFocus, onBlur, onPaste, onDrop, ...props }, ref) {
        const { state, api, options, send, moveFocus, groupRef } = useContext();
        if (!(type in state.parts)) throw new Error(`The ${type} segment is not enabled in this field.`);
        const { display, ...segmentProps } = api.getSegmentProps(type);
        return <input {...props} {...segmentProps} ref={ref} type="text" inputMode={type === "dayPeriod" ? "text" : "numeric"} autoComplete="off" spellCheck={false} value={display} disabled={options.disabled} readOnly={options.readOnly}
            onFocus={composeEvent(onFocus, (event) => { event.currentTarget.select(); })}
            onBlur={composeEvent(onBlur, () => send({ type: "BLUR" }))}
            onPaste={composeEvent(onPaste, (event) => event.preventDefault())}
            onDrop={composeEvent(onDrop, (event) => event.preventDefault())}
            onChange={(event) => {
                const native = event.nativeEvent as InputEvent;
                const digit = digitValue(native.data ?? "", options.locale);
                event.currentTarget.value = display;
                if (native.inputType === "insertText" && digit !== null) send({ type: "DIGIT", segment: type, digit });
                else if (native.inputType === "deleteContentBackward" || native.inputType === "deleteContentForward") send({ type: "CLEAR", segment: type });
            }}
            onKeyDown={composeEvent(onKeyDown, (event) => {
                if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
                const digit = digitValue(event.key, options.locale);
                const dir = options.dir ?? (groupRef.current?.closest("[dir]")?.getAttribute("dir") === "rtl" ? "rtl" : "ltr");
                if (digit !== null) { event.preventDefault(); send({ type: "DIGIT", segment: type, digit }); return; }
                switch (event.key) {
                    case "ArrowUp": case "ArrowDown": event.preventDefault(); send({ type: "STEP", segment: type, direction: event.key === "ArrowUp" ? 1 : -1 }); break;
                    case "Home": case "End": event.preventDefault(); send({ type: "EDGE", segment: type, edge: event.key === "Home" ? "min" : "max" }); break;
                    case "Backspace": case "Delete": event.preventDefault(); send({ type: "CLEAR", segment: type }); break;
                    case "ArrowLeft": case "ArrowRight": event.preventDefault(); moveFocus(type, (event.key === "ArrowRight" ? 1 : -1) * (dir === "rtl" ? -1 : 1)); break;
                    default:
                        if (type === "dayPeriod" && ["a", "p"].includes(event.key.toLowerCase())) {
                            event.preventDefault(); send({ type: "PERIOD", value: event.key.toLowerCase() === "a" ? 0 : 1 });
                        }
                }
            })} />;
    });

    const Field = React.forwardRef<HTMLElement, PartProps>(function Field({ children, ...props }, ref) {
        const { api, groupRef } = useContext();
        return <Part {...props} {...api.getGroupProps()} ref={(node) => {
            groupRef.current = node;
            if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
        }}>{children ?? api.segments.map((segment, index) => segment.type === "literal" ? <span key={index} aria-hidden="true" data-scope={`${kind}-field`} data-part="literal">{segment.value}</span> : <Segment key={segment.type} type={segment.type} />)}</Part>;
    });

    function HiddenInput(props: HiddenInputProps) {
        const { state, options, reset } = useContext();
        const input = React.useRef<HTMLInputElement>(null);
        useFormReset(input, props.form, reset);
        return <input {...props} ref={input} type="hidden" value={state.value?.toString() ?? ""} disabled={options.disabled || props.disabled} data-scope={`${kind}-field`} data-part="hidden-input" />;
    }

    const ClearButton = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }>(function ClearButton({ onClick, ...props }, ref) {
        const { options, send } = useContext();
        return <Part as="button" {...props} ref={ref} type="button" aria-label={options.translations?.clear ?? translations.clear} disabled={options.disabled || options.readOnly} data-scope={`${kind}-field`} data-part="clear-button" onClick={composeEvent(onClick, () => send({ type: "CLEAR" }))} />;
    });

    const LiveRegion = React.forwardRef<HTMLElement, PartProps>(function LiveRegion(props, ref) {
        const { announcement } = useContext();
        return <Part {...props} ref={ref} role="status" aria-live="polite" aria-atomic="true" data-scope={`${kind}-field`} data-part="live-region">{announcement}</Part>;
    });

    return { Root, Label, Field, Segment, HiddenInput, ClearButton, LiveRegion };
}