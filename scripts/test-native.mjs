import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

if (typeof globalThis.Temporal === "undefined") {
    console.error("Native Temporal is unavailable in this Node runtime. Use a Temporal-enabled Node build or run pnpm test for the polyfill suite.");
    process.exit(1);
}
const result = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)), "run"], {
    stdio: "inherit",
    env: { ...process.env, CHRONA_TEMPORAL: "native" },
});
process.exit(result.status ?? 1);