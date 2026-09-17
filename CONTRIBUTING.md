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
- Configure npm trusted publishing through the actual repository's CI identity
  with provenance, or an approved provenance-enabled publication workflow.
  Require 2FA on maintainer accounts and least-privilege access. Do not put npm
  credentials in source files or agent prompts.
- Review the public API and data-attribute compatibility before tagging v1.

Release automation is not configured to publish automatically. Publishing,
signing tags, creating commits, and changing repository/account settings require
explicit maintainer authorization.