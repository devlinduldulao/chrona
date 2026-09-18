# Contributing

Chrona is experimental. Read README.md and PLANS.md before changing public APIs.
Use Node 22+ and the pnpm version pinned in package.json. Install with
`pnpm install --frozen-lockfile`.

Keep behavior in core, framework effects in bindings, and styling in apps.
Values are Temporal objects, never strings or legacy Date instances. Do not
bundle a polyfill or locale data. Every bug fix needs a core regression where
possible and a component/browser check when the behavior depends on the DOM.

Run `pnpm check`, `pnpm test:native` on a native-Temporal runtime, and
`pnpm test:e2e` before submitting changes. Capability skips must be explicit;
do not weaken coverage or size budgets to hide failures.

Formatting is intentionally editor-owned for now: four-space TypeScript/JSON,
double quotes, semicolons. Preserve nearby style and avoid unrelated formatting.
A repository-wide formatter migration needs a dedicated change, not incidental
churn in a behavior fix.

## Release Checklist

- Licensed under MIT; keep the `LICENSE` files and package `license` fields in
  sync when adding packages.
- Initialize repository history and choose the initial commit manually.
- Enable GitHub private vulnerability reporting and review SECURITY.md.
- Add an appropriate changeset with `pnpm changeset`; inspect generated versions
  and package contents before releasing. Never publish the private playground.
- Run all gates, the real-device/screen-reader matrix, and inspect package
  tarballs for accidental assets or secrets.
- Review the public API and data-attribute compatibility before tagging v1.

## Publishing

`.github/workflows/release.yml` publishes `chrona-core` and `chrona-react` on
a `v*` tag, with provenance, through npm trusted publishing. There is no
`NPM_TOKEN`: the registry trusts the workflow's OIDC identity, so no long-lived
credential sits in the repository. Releases therefore run in CI, not from a
maintainer's machine — provenance requires an OIDC token that only CI has.

To cut a release, bump both package versions, commit, then push the tag:

```sh
git tag v0.1.1
git push origin v0.1.1
```

The workflow verifies the tag against both package versions, refuses to publish
a package marked private, and runs `pnpm check` before publishing. The private
playground is never published.

It packs with pnpm and publishes with npm, which is deliberate. pnpm rewrites
the `workspace:` protocol to real versions at pack time but has no OIDC
support; npm has OIDC but would publish the `workspace:` specifier verbatim and
break every consumer. Each tool does the half it can.

### Trusted publisher setup

npm only exposes trusted-publisher settings on a package that already exists,
so this could not be configured before the first release. 0.1.0 was published
manually to bootstrap the packages. Before the next release, add the trusted
publisher once per package — in each package's npm settings, name this
repository and `release.yml` — after which tagging is the whole process.

npm does not validate a trusted-publisher configuration when you save it; a
wrong repository or workflow filename only surfaces as a failure at publish
time.

**Trusted publishing does not work yet, as of 0.2.1.** Both packages have a
trusted publisher registered and the registry issues a credential for each —
POSTing the job's id token to
`/-/npm/v1/oidc/token/exchange/package/<name>` returns `201` with a token — and
the upload is still refused with `403 OIDC permission denied for this action`.
0.1.0 and 0.2.0 were therefore published by hand and carry no attestation.
Treat a green Release run as unproven until this is fixed.

These have each been tested and ruled out, so do not spend another release on
them:

| Suspected | Evidence it is not the cause |
| --- | --- |
| Trusted publisher unregistered | Exchange returns `201` for both packages |
| npm too old for OIDC | Runner has npm 11.19.0; OIDC needs >= 11.5.1 |
| `id-token: write` missing | Both `ACTIONS_ID_TOKEN_REQUEST_*` are set in the job |
| Claim mismatch | `sub` carries `repo:<owner>/chrona...:environment:release`, and the exchange accepts it |
| Stale npmrc credential | Fixed separately; `NPM_CONFIG_USERCONFIG` is now unset |
| Package requires 2FA | `npm access set mfa=automation` on both, no change |
| Account requires 2FA for writes | `npm profile` moved from `auth-and-writes` to `auth-only`, no change |
| Explicit `--provenance` | Removed; npm signs the statement either way, same 403 |
| Publishing a tarball path | Published an extracted directory instead, same 403 |

What remains is the registry's own authorization of a correctly issued
credential, which is npm's side to explain. Report it with the exchange status
and the 403 together, since the pair is what makes it unambiguous.

Two things about that workflow are settled and should not be re-litigated. It
must not pass `registry-url` to `actions/setup-node`: that writes
`//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` into the job's npmrc, and
with no such secret npm sends an empty credential, takes a 404, and never
attempts the OIDC exchange at all. And the `404` a missing trusted publisher
produces is indistinguishable from a missing package, so diagnose by calling
`/-/npm/v1/oidc/token/exchange/package/<name>` directly with the job's id token
and reading the status.

Require 2FA on maintainer accounts, keep access least-privilege, and keep npm
credentials out of source files and agent prompts.
