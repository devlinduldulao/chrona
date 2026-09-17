import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "es2022",
    sourcemap: true,
    clean: true,
    // Chrona's public types are Temporal types, and every example writes `Temporal.PlainDate`
    // unqualified. The ambient declarations live in temporal-spec, a direct dependency of this
    // package, so referencing them here means consumers do not have to find that out themselves.
    dts: { banner: '/// <reference types="temporal-spec/global" />' },
});
