import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
    { ignores: ["**/dist/**", "**/node_modules/**", "coverage/**", "test-results/**", "playwright-report/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    { files: ["**/*.{ts,tsx}"], rules: { "no-undef": "off" } },
    { files: ["packages/react/**/*.{ts,tsx}", "apps/playground/src/**/*.{ts,tsx}"], plugins: { "react-hooks": reactHooks }, rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" } },
    { files: ["scripts/*.mjs"], languageOptions: { globals: { process: "readonly", console: "readonly", globalThis: "readonly", fetch: "readonly", setTimeout: "readonly" } } },
);