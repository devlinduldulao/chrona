---
"chrona-core": patch
"chrona-react": patch
---

Document that a providers-file `temporal-polyfill/global` import does not order Next.js App Router SSR module init. Client files that read `Temporal` at module scope must import the polyfill themselves or construct values inside the component body.
