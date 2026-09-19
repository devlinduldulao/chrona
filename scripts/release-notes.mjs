// Prints the GitHub Release body for a version, built from the changesets
// changelogs so the release page and the published packages never disagree.
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!version) {
    console.error("Usage: node scripts/release-notes.mjs <version>");
    process.exit(1);
}

/** The section for one version, from its `## x.y.z` heading to the next one. */
function section(changelog) {
    const text = readFileSync(fileURLToPath(new URL(`../${changelog}`, import.meta.url)), "utf8");
    const start = text.indexOf(`\n## ${version}\n`);
    if (start === -1) return "";
    const rest = text.slice(start + 1);
    const next = rest.indexOf("\n## ");
    return rest.slice(rest.indexOf("\n") + 1, next === -1 ? undefined : next).trim();
}

const parts = [];
for (const [name, changelog] of [["chrona-core", "packages/core/CHANGELOG.md"], ["chrona-react", "packages/react/CHANGELOG.md"]]) {
    const body = section(changelog);
    if (body) parts.push(`## ${name}@${version}\n\n${body}`);
}

if (parts.length === 0) {
    console.error(`No changelog entry for ${version} in either package.`);
    process.exit(1);
}

parts.push([
    "## Install",
    "",
    "```sh",
    `npm install chrona-react@${version}   # React primitives`,
    `npm install chrona-core@${version}    # framework-agnostic state machines`,
    "```",
].join("\n"));

console.log(parts.join("\n\n"));
