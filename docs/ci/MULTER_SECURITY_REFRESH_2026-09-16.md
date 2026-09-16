# Multer security refresh — 2026-09-16

The canonical CI production dependency audit detected three high-severity Multer advisories against `multer@2.2.0`: GHSA-wc9g-mqfw-jrwm, GHSA-qfvm-cv95-jqjf and GHSA-535w-7cp7-47q4.

The API workspace and audited root override are pinned to the patched exact version `multer@2.3.0`. The canonical `pnpm-lock.yaml` was regenerated with the repository-pinned `pnpm@10.13.1`; the one-shot lock refresh workflow removed itself after committing the lock update.

No advisory is suppressed. The normal production dependency audit remains enabled and is expected to verify the patched exact head together with the existing build, test and runtime gates.
