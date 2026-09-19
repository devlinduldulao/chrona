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
the `workspace:` protocol to real versions at pack time but has no publish auth;
npm has the auth but would publish the `workspace:` specifier verbatim and break
every consumer. Each tool does the half it can.

The run ends by reading both versions back off the registry. A Release run that
skipped both packages is green and has published nothing, which is how 0.2.1
looked after it was published by hand — the readback makes that impossible to
mistake for a release.

### Why this publishes with a token and not a trusted publisher

Trusted publishing is registered for both packages and cannot work here, for a
reason that is neither package's fault.

GitHub issues an **immutable** OIDC subject for repositories created after
2026-07-15. This one gets:

```
repo:devlinduldulao@22025912/chrona@1374885228:environment:release
```

The registry matches trusted publishers against the legacy
`repo:<owner>/<repo>:...` form and does not understand the `@OWNER_ID/@REPO_ID`
one. The token exchange still returns `201`, because that step matches on the
`repository` claim — which is why this looked like a registry authorization bug
for three releases — and the upload is then refused with
`403 OIDC permission denied for this action`.

That is [npm/cli#9969](https://github.com/npm/cli/issues/9969), it is open, and
it needs a registry-side change. The repository setting that would turn
immutable subjects off cannot be used either: `PUT
/repos/{owner}/{repo}/actions/oidc/customization/sub` with
`use_immutable_subject: false` returns `200` and leaves the value at `true`.
Confirm the state before reopening this:

```sh
gh api /repos/devlinduldulao/chrona/actions/oidc/customization/sub
```

Every suspect chased before this — trusted publisher registration, npm version,
`id-token: write`, the npmrc credential, per-package and per-account 2FA,
explicit `--provenance`, publishing a tarball versus a directory — was
downstream of the subject mismatch. None of them is worth testing again.

**When npm/cli#9969 closes:** delete `registry-url` and `NODE_AUTH_TOKEN` from
`release.yml`, delete the `NPM_TOKEN` secret, and revoke the token. Nothing else
changes; provenance already works either way.

### The publish credential

`release.yml` needs an `NPM_TOKEN` secret. Use a **granular** access token, not
a classic one, so it can reach these two packages and nothing else:

1. npmjs.com → Access Tokens → Generate New Token → Granular Access Token.
2. Packages and scopes: select `chrona-core` and `chrona-react`, permission
   **Read and write**. Leave organizations empty.
3. Set an expiry you will actually notice, and put its date in the changelog of
   your own calendar — an expired token fails the release, not the build.
4. Add it to this repository under Settings → Environments → `release` →
   environment secrets, named `NPM_TOKEN`, or:

   ```sh
   gh secret set NPM_TOKEN --env release
   ```

Scoping the secret to the `release` environment rather than the repository keeps
it out of every other workflow, including anything a pull request can reach.

Provenance is the one real casualty. npm 11.5+ tries trusted publishing whenever
GitHub's OIDC variables are in the environment, and here the exchange *succeeds*
— only the upload is refused — so npm commits to the OIDC credential and never
falls back to the npmrc token. The publish step therefore empties
`ACTIONS_ID_TOKEN_REQUEST_URL` and `ACTIONS_ID_TOKEN_REQUEST_TOKEN`, and
`--provenance` reads those same variables. Releases published this way carry no
attestation. Restore `--provenance` together with trusted publishing when
npm/cli#9969 closes.

An automation-style token is not blocked by account 2FA, so the account can go
back to requiring 2FA for writes — it was moved to `auth-only` chasing the 403
above, and that loosening bought nothing:

```sh
npm profile enable-2fa auth-and-writes
```

Require 2FA on maintainer accounts, keep access least-privilege, and keep npm
credentials out of source files and agent prompts.
