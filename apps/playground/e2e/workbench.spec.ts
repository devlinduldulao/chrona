import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
});

test("renders the Calendar and local image without layout overflow", async ({ page }, info) => {
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await expect(page.getByRole("gridcell")).toHaveCount(42);
    expect(await page.locator(".sample-context img").evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("calendar.png"), fullPage: true });
});

test("keyboard navigation paginates and commits Temporal dates", async ({ page }) => {
    await page.getByRole("gridcell", { name: "Wednesday, September 16, 2026" }).focus();
    await page.keyboard.press("PageDown");
    await expect(page.getByRole("grid")).toHaveAttribute("aria-label", "October 2026");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("value-output")).toHaveText("2026-10-16");
});

test("range selection emits a complete inclusive span", async ({ page }) => {
    await page.getByRole("button", { name: "RangeCalendar", exact: true }).click();
    await page.getByRole("gridcell", { name: "Wednesday, September 16, 2026" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("gridcell", { selected: true })).toHaveCount(3);
    await expect(page.getByTestId("value-output")).toContainText('"end": "2026-09-18"');
});

test("fields support full structured input and hour-cycle changes", async ({ page }) => {
    await page.getByRole("button", { name: "DateField", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Month" }).focus();
    await page.keyboard.type("05231990");
    await expect(page.getByTestId("value-output")).toHaveText("1990-05-23");
    await page.getByRole("button", { name: "TimeField", exact: true }).click();
    await page.getByLabel("Hour cycle").selectOption("h23");
    await page.getByRole("spinbutton", { name: "Hour" }).focus();
    await page.keyboard.type("23");
    await expect(page.getByTestId("value-output")).toHaveText("23:30:00");
});

test("native dialog traps focus, closes on Escape, and restores the trigger", async ({ page }, info) => {
    await page.getByRole("button", { name: "DatePicker", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Choose date", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 7; index++) {
        await page.keyboard.press("Tab");
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.screenshot({ path: info.outputPath("picker.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.keyboard.press("Enter");
    await expect(dialog).not.toBeVisible();
});

test("locale and non-ISO changes keep the grid usable", async ({ page }) => {
    await page.getByLabel("Locale", { exact: true }).selectOption("ar-EG");
    await expect(page.locator('[data-scope="calendar"][data-part="root"]')).toHaveAttribute("dir", "rtl");
    await page.getByLabel("Calendar system").selectOption("hebrew");
    await expect(page.getByRole("gridcell")).toHaveCount(42);
    await page.getByRole("gridcell").filter({ hasNot: page.locator(":disabled") }).nth(15).click();
    await expect(page.getByTestId("value-output")).toContainText("u-ca=hebrew");
});

test("popup stays within short viewports and scrolls oversized content", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await page.getByRole("button", { name: "DatePicker", exact: true }).click();
    await page.addStyleTag({ content: '[data-part="trigger"] { position: fixed; top: 250px; left: 20px; } dialog[data-part="popover"] { height: 320px; }' });
    await page.getByRole("button", { name: "Choose date", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const contained = () => dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const viewport = element.ownerDocument.defaultView!.visualViewport!;
        return rect.top >= viewport.offsetTop + 3 && rect.left >= viewport.offsetLeft + 3 && rect.bottom <= viewport.offsetTop + viewport.height - 3 && rect.right <= viewport.offsetLeft + viewport.width - 3;
    });
    await expect.poll(contained).toBe(true);
    await page.setViewportSize({ width: 320, height: 240 });
    await expect.poll(contained).toBe(true);
    expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight && getComputedStyle(element).overflowY === "auto")).toBe(true);
    await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    expect(await dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath("picker-constrained.png") });
    await page.setViewportSize({ width: 390, height: 500 });
    await dialog.evaluate((element) => { element.style.height = "450px"; });
    await expect.poll(contained).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
});

test("workbench has no automated accessibility violations", async ({ page }) => {
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
        const checker = (globalThis as unknown as { axe: { run: (node: Document) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        return (await checker.run(document)).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
    });
    expect(violations).toEqual([]);
});