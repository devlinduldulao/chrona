import { defineConfig } from "tsup";

export default defineConfig({
    entry: [
        "src/index.ts",
        "src/calendar.tsx",
        "src/date-field.tsx",
        "src/time-field.tsx",
        "src/date-picker.tsx",
        "src/range-calendar.tsx",
    ],
    format: ["esm"],
    // The CLI build this replaced passed --dts. Dropping it published 0.3.0 and
    // 0.3.1 with no declarations at all while `exports` still advertised them,
    // so every TypeScript consumer got TS7016 on the first import.
    dts: true,
    target: "es2022",
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom"],
    // These components use context and state, so they can only run in a client environment.
    // Without the directive, merely importing this package from a React Server Component — a
    // barrel re-export is enough — fails the build with "createContext is not a function".
    // The directive marks the boundary so the framework moves the import to the client for you.
    banner: { js: '"use client";' },
});
