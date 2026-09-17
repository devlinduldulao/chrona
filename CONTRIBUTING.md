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

`.github/workflows/release.yml` publishes `@chrona/core` and `@chrona/react` on
a `v*` tag, with provenance. Releases run in CI because provenance requires an
OIDC token; do not publish from a maintainer's machine. The workflow verifies
the tag against both package versions, runs `pnpm check`, and publishes core
before react so the workspace dependency resolves. The private playground is
never published.

To cut a release, bump both package versions, commit, then push the tag:

```sh
git tag v0.1.1
git push origin v0.1.1
```

Authentication is a deliberate two-stage arrangement:

- **First publish of any package** uses the `NPM_TOKEN` secret on the `release`
  environment. npm only exposes trusted-publisher settings on a package that
  already exists, so a brand-new package cannot have one.
- **Every release after that** should use trusted publishing. Add this
  repository and `release.yml` as a trusted publisher in each package's npm
  settings, then delete `NPM_TOKEN` — the workflow already requests the
  `id-token` permission it needs.

Use a granular access token scoped to these packages only, require 2FA on
maintainer accounts, and keep npm credentials out of source files and agent
prompts.