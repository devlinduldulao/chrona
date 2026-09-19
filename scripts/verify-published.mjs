// Confirms a release actually reached the registry, attested.
//
// This lived as inline shell in release.yml and was wrong twice, in the same way
// each time: nothing npm exposes after a publish is immediately consistent. The
// version endpoint lags the upload and the attestation endpoint lags the version
// endpoint, so a check that reads once reports a good release as a failure —
// 0.3.4 published and attested both packages and went red anyway. Here it is a
// script instead, so the waiting is written once and can be run by hand.
//
//   node scripts/verify-published.mjs 0.3.4
//   node scripts/verify-published.mjs 0.3.4 --attempts 1   (no waiting; for tests)

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!version) {
    console.error("Usage: node scripts/verify-published.mjs <version> [--attempts n]");
    process.exit(1);
}
const attemptsFlag = process.argv.indexOf("--attempts");
const attempts = attemptsFlag === -1 ? 30 : Number(process.argv[attemptsFlag + 1]);
const packages = ["chrona-core", "chrona-react"];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries `check` until it returns true, because "not yet" and "never" look alike here. */
async function settle(label, check) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        if (await check()) return true;
        if (attempt < attempts) await wait(10_000);
    }
    console.error(`::error::${label}`);
    return false;
}

const json = async (url) => {
    try {
        const response = await fetch(url);
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
};

let ok = true;
for (const name of packages) {
    const published = await settle(`${name}@${version} never appeared on the registry.`, async () => {
        const body = await json(`https://registry.npmjs.org/${name}`);
        return Boolean(body?.versions?.[version]);
    });
    if (!published) { ok = false; continue; }
    console.log(`${name}@${version} is published.`);

    const attested = await settle(`${name}@${version} has no provenance attestation.`, async () => {
        const body = await json(`https://registry.npmjs.org/-/npm/v1/attestations/${name}@${version}`);
        return Array.isArray(body?.attestations) && body.attestations.length > 0;
    });
    if (!attested) { ok = false; continue; }
    console.log(`${name}@${version} carries a provenance attestation.`);
}

process.exit(ok ? 0 : 1);
