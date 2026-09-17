import * as React from "react";

export type HiddenInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type" | "value" | "defaultValue" | "onChange">;

export function useFormReset(input: React.RefObject<HTMLInputElement | null>, form: string | undefined, reset: () => void) {
    const latest = React.useRef(reset);
    React.useEffect(() => { latest.current = reset; });
    React.useEffect(() => {
        const owner = input.current?.form;
        if (!owner) return;
        let active = true;
        const handler = (event: Event) => queueMicrotask(() => {
            if (active && !event.defaultPrevented) latest.current();
        });
        owner.addEventListener("reset", handler);
        return () => {
            active = false;
            owner.removeEventListener("reset", handler);
        };
    }, [input, form]);
}