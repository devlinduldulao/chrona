// Every path a package's `exports` advertises must actually be in the tarball.
//
// 0.3.0 and 0.3.1 of chrona-react shipped with no declarations at all while
// `exports` pointed at `./dist/*.d.ts` for all six entries, so every TypeScript
// consumer got TS7016 on the first import. Nothing caught it: the build was
// green, the tests ran against source, and size-limit only reads the JS. This
// reads the manifest the way a consumer's resolver does and checks the packed
// contents, so a `files` mistake or a dropped `--dts` fails before publish.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const packages = ["packages/core", "packages/react"];
const failures = [];

for (const directory of packages) {
    const root = fileURLToPath(new URL(`../${directory}/`, import.meta.url));
    const manifest = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

    // `npm pack --dry-run` applies `files`, .npmignore and the rest, so this is
    // the list the registry would receive rather than whatever is on disk.
    // npm 12 keys the report by package name; older npm returns an array.
    const report = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8" }));
    const entries = Array.isArray(report) ? report : Object.values(report);
    const packed = new Set(entries.flatMap((entry) => entry.files.map((file) => file.path)));

    const advertised = new Set();
    const collect = (value) => {
        if (typeof value === "string") advertised.add(value.replace(/^\.\//, ""));
        else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(manifest.exports);
    for (const field of ["main", "module", "types", "typings"]) collect(manifest[field]);

    for (const path of [...advertised].sort()) {
        if (!packed.has(path)) failures.push(`${manifest.name} advertises ${path}, which is not in the tarball.`);
    }
    if (advertised.size === 0) failures.push(`${manifest.name} advertises no entry points.`);
}

if (failures.length > 0) {
    console.error("Published entry points are missing from the package:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}
console.log(`Every entry point advertised by ${packages.length} packages is present in its tarball.`);
