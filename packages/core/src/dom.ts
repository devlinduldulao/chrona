export interface AnchorRect { top: number; left: number; width: number; height: number }

/** Minimal flip and viewport shift positioner; oversized content must be constrained by the binding. */
export function computeAnchorPosition(anchor: AnchorRect, size: { width: number; height: number }, viewport: { width: number; height: number }, gutter = 4): { top: number; left: number; placement: "bottom" | "top" } {
    const below = anchor.top + anchor.height + gutter;
    const flip = below + size.height > viewport.height && anchor.top - gutter - size.height >= 0;
    const top = Math.min(Math.max(flip ? anchor.top - gutter - size.height : below, gutter), Math.max(viewport.height - size.height - gutter, gutter));
    const left = Math.min(Math.max(anchor.left, gutter), Math.max(viewport.width - size.width - gutter, gutter));
    return { top, left, placement: flip ? "top" : "bottom" };
}

export function containTabFocus(container: HTMLElement, event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">): void {
    if (event.key !== "Tab") return;
    const candidates = Array.from(container.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'));
    const tabbable = candidates.filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0);
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    const active = container.ownerDocument.activeElement;
    if (!first || !last) {
        event.preventDefault();
        container.focus();
    } else if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (active === last || active === container)) {
        event.preventDefault();
        first.focus();
    }
}