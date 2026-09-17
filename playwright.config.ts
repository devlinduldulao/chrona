import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./apps/playground/e2e",
    fullyParallel: true,
    workers: 2,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: "list",
    use: { baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure", screenshot: "only-on-failure", reducedMotion: "reduce" },
    projects: [
        { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
        { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
        { name: "firefox", use: { browserName: "firefox", viewport: { width: 1440, height: 1000 } } },
        { name: "webkit", use: { browserName: "webkit", viewport: { width: 1440, height: 1000 } } },
        { name: "webkit-mobile", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ],
    webServer: {
        command: "pnpm --filter @chrona/playground build && pnpm --filter @chrona/playground preview --host 127.0.0.1 --port 4174 --strictPort",
        url: "http://127.0.0.1:4174",
        reuseExistingServer: false,
    },
});