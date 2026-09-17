import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            "@chrona/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
            "@chrona/react": fileURLToPath(new URL("./packages/react/src/index.ts", import.meta.url)),
        },
    },
    test: {
        setupFiles: ["./packages/core/test/setup.ts"],
        include: ["packages/**/*.test.{ts,tsx}"],
        coverage: {
            provider: "v8",
            include: ["packages/core/src/**/*.{ts,tsx}", "packages/react/src/**/*.{ts,tsx}"],
            reporter: ["text", "html", "json-summary"],
            thresholds: { statements: 95, lines: 95, functions: 90, branches: 80 },
        },
    },
});