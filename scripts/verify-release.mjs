import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const ref = process.argv[2];
if (!ref) {
    console.error("Usage: node scripts/verify-release.mjs <tag>");
    process.exit(1);
}

const expected = ref.replace(/^v/, "");
const published = ["packages/core", "packages/react"];
const failures = [];

for (const directory of published) {
    const path = fileURLToPath(new URL(`../${directory}/package.json`, import.meta.url));
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    if (manifest.private) failures.push(`${manifest.name} is private and must not be published.`);
    if (manifest.version !== expected) failures.push(`${manifest.name} is ${manifest.version}, but the tag says ${expected}.`);
}

if (failures.length > 0) {
    console.error(`Refusing to publish ${ref}:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}

console.log(`Tag ${ref} matches ${published.length} package versions.`);
