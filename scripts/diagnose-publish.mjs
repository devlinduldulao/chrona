// Reports why a trusted-publishing release cannot get a credential. Temporary,
// for the 0.2.0 publish; delete once that is out.
//
// Prints presence and status only. The id token and any credential the registry
// returns are never logged: this repository is public and its Actions logs are
// world-readable. The subject claim is printed on purpose — it is not a secret,
// and it is the exact string a trusted publisher is matched against.
import { execFileSync } from "node:child_process";

const packages = ["chrona-core", "chrona-react"];
const state = (value) => (value ? "set" : "unset");

console.log(`node ${process.version}, npm ${execFileSync("npm", ["--version"]).toString().trim()} (trusted publishing needs npm >= 11.5.1)`);
console.log(`ACTIONS_ID_TOKEN_REQUEST_URL: ${state(process.env.ACTIONS_ID_TOKEN_REQUEST_URL)}`);
console.log(`ACTIONS_ID_TOKEN_REQUEST_TOKEN: ${state(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)}`);
console.log(`NPM_CONFIG_USERCONFIG: ${process.env.NPM_CONFIG_USERCONFIG ?? "unset"}`);

const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if (!requestUrl || !requestToken) {
    console.log("No OIDC request credentials in the environment; nothing to probe.");
    process.exit(0);
}

const response = await fetch(`${requestUrl}&audience=npm:registry.npmjs.org`, {
    headers: { Authorization: `bearer ${requestToken}` },
});
if (!response.ok) {
    console.log(`Could not mint an id token: HTTP ${response.status}`);
    process.exit(0);
}
const { value: idToken } = await response.json();

const claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
console.log("id token claims a trusted publisher must match:");
for (const name of ["sub", "repository", "environment", "workflow_ref"]) {
    console.log(`  ${name}: ${claims[name]}`);
}

for (const name of packages) {
    const exchange = await fetch(`https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${name}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    });
    const body = await exchange.text();
    let parsed;
    try {
        parsed = JSON.parse(body);
    } catch {
        console.log(`${name} exchange: HTTP ${exchange.status} — non-JSON body`);
        continue;
    }
    if (!exchange.ok) {
        console.log(`${name} exchange: HTTP ${exchange.status} — ${parsed.message ?? parsed.error}`);
        continue;
    }
    // Never print the body itself; it carries a publish credential.
    console.log(`${name} exchange: HTTP ${exchange.status} — ${parsed.token_type} credential, expires ${parsed.expires}`);

    // The credential exists but the registry refuses to publish with it, so ask
    // what it is actually allowed to do. Identity and policy, never the token.
    const authed = (path) => fetch(`https://registry.npmjs.org${path}`, { headers: { Authorization: `Bearer ${parsed.token}` } });
    const whoami = await authed("/-/whoami");
    const who = await whoami.json().catch(() => ({}));
    console.log(`  whoami: HTTP ${whoami.status} — ${who.username ?? who.message ?? "no username"}`);

    const access = await authed(`/-/package/${name}/access`);
    console.log(`  access policy: HTTP ${access.status} — ${(await access.text()).slice(0, 300)}`);
}
