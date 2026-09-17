// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { computeAnchorPosition, containTabFocus } from "../src/index";

it("keeps Tab focus in an empty container and ignores other keys", () => {
    const container = document.createElement("div");
    container.tabIndex = -1;
    document.body.append(container);
    const preventDefault = vi.fn();
    try {
        containTabFocus(container, { key: "Escape", shiftKey: false, preventDefault });
        expect(preventDefault).not.toHaveBeenCalled();
        containTabFocus(container, { key: "Tab", shiftKey: false, preventDefault });
        expect(document.activeElement).toBe(container);
        expect(preventDefault).toHaveBeenCalledOnce();
        containTabFocus(container, { key: "Tab", shiftKey: true, preventDefault });
        expect(document.activeElement).toBe(container);
    } finally { container.remove(); }
});

describe("computeAnchorPosition", () => {
    it("places below the anchor and shifts within the viewport", () => {
        const position = computeAnchorPosition({ top: 10, left: 950, width: 100, height: 40 }, { width: 300, height: 200 }, { width: 1000, height: 800 });
        expect(position).toEqual({ top: 54, left: 696, placement: "bottom" });
    });

    it("flips above when there is no room below", () => {
        const position = computeAnchorPosition({ top: 700, left: 20, width: 100, height: 40 }, { width: 300, height: 200 }, { width: 1000, height: 800 });
        expect(position).toEqual({ top: 496, left: 20, placement: "top" });
    });

    it("shifts vertically when neither side has enough space", () => {
        const position = computeAnchorPosition({ top: 250, left: 20, width: 180, height: 40 }, { width: 300, height: 320 }, { width: 390, height: 500 });
        expect(position).toEqual({ top: 176, left: 20, placement: "bottom" });
        expect(position.top + 320).toBeLessThanOrEqual(496);
    });

    it("aligns oversized content to the viewport gutter", () => {
        const position = computeAnchorPosition({ top: 10, left: 20, width: 100, height: 40 }, { width: 300, height: 900 }, { width: 1000, height: 800 });
        expect(position.placement).toBe("bottom");
        expect(position.top).toBe(4);
    });
});
