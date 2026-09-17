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

Require 2FA on maintainer accounts, keep access least-privilege, and keep npm
credentials out of source files and agent prompts.
