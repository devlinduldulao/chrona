import * as React from "react";

export type PartProps = React.HTMLAttributes<HTMLElement> & { asChild?: boolean };

function setRef(ref: React.Ref<HTMLElement> | undefined, value: HTMLElement | null) {
    if (typeof ref === "function") return ref(value);
    if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = value;
}

export const Part = React.forwardRef<HTMLElement, PartProps & { as?: React.ElementType; type?: string; disabled?: boolean }>(function Part({ as: element = "div", asChild, children, ...props }, ref) {
    if (!asChild) return React.createElement(element, { ...props, ref }, children);
    const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
    if (!React.isValidElement(child) || child.type === React.Fragment) throw new Error("Chrona asChild requires one non-Fragment element.");
    // Radix convention: the child's own props win over injected part props (events/className/style are merged).
    const merged: Record<string, unknown> = { ...props, ...child.props };
    for (const name of Object.keys(child.props)) {
        const own = (props as Record<string, unknown>)[name];
        const nested = child.props[name];
        if (/^on[A-Z]/.test(name) && typeof own === "function" && typeof nested === "function") {
            merged[name] = (event: React.SyntheticEvent) => {
                nested(event);
                if (!event.defaultPrevented) own(event);
            };
        }
    }
    merged.className = [props.className, child.props.className].filter(Boolean).join(" ") || undefined;
    merged.style = { ...(props.style as React.CSSProperties), ...(child.props.style as React.CSSProperties) };
    const childRef = (Object.getOwnPropertyDescriptor(child.props, "ref")?.value ?? Object.getOwnPropertyDescriptor(child, "ref")?.value) as React.Ref<HTMLElement> | undefined;
    let cleanup: (() => void) | undefined;
    merged.ref = (node: HTMLElement | null) => {
        cleanup?.();
        cleanup = undefined;
        if (node === null) return;
        const ownCleanup = setRef(ref, node);
        const childCleanup = setRef(childRef, node);
        cleanup = () => {
            if (typeof ownCleanup === "function") ownCleanup(); else setRef(ref, null);
            if (typeof childCleanup === "function") childCleanup(); else setRef(childRef, null);
        };
    };
    return React.cloneElement(child, merged);
});

export function composeEvent<Event extends React.SyntheticEvent>(user: ((event: Event) => void) | undefined, internal: (event: Event) => void) {
    return (event: Event) => {
        user?.(event);
        if (!event.defaultPrevented) internal(event);
    };
}