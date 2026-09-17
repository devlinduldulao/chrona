import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const version = process.argv[2];
if (!version) {
    console.error("Usage: node scripts/pin-react.mjs <react-version>");
    process.exit(1);
}

// React 18 ships its own type packages; 19's are a separate major.
const types = version.startsWith("18") ? { react: "18.3.12", dom: "18.3.1" } : { react: version, dom: version };
const pins = {
    react: version,
    "react-dom": version,
    "@types/react": types.react,
    "@types/react-dom": types.dom,
};

function patch(relative, apply) {
    const path = fileURLToPath(new URL(relative, import.meta.url));
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    apply(manifest);
    writeFileSync(path, `${JSON.stringify(manifest, null, 4)}\n`);
}

// Overrides alone are not enough: the private playground pins React directly,
// and a second copy in the store makes react-dom render foreign elements.
patch("../package.json", (manifest) => {
    manifest.pnpm = { ...manifest.pnpm, overrides: { ...manifest.pnpm?.overrides, ...pins } };
    Object.assign(manifest.devDependencies, pins);
});
patch("../apps/playground/package.json", (manifest) => {
    manifest.dependencies.react = version;
    manifest.dependencies["react-dom"] = version;
});

// The committed lockfile pins the default resolution, and pnpm will happily
// reuse it and ignore the overrides. This job exists to test the other one.
rmSync(fileURLToPath(new URL("../pnpm-lock.yaml", import.meta.url)), { force: true });

console.log(`Pinned react and react-dom to ${version}. Removed the lockfile; install with --no-frozen-lockfile.`);
