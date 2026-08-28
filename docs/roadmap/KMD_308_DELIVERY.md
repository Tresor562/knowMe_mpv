# KMD-308 — Reviewed manual evidence promotion

## Goal

Close the gap between KMD-307 human review receipts and generic `VERIFIED` evidence item creation for the four FULL-scope manual criteria.

## Change

`release:evidence:item:create` now requires `--review-receipt <receipt.json>` for generic physical-device/store evidence. Promotion fails closed unless the receipt:

- is the canonical KMD-307 human-review receipt schema;
- records `APPROVED_FOR_EVIDENCE_PIPELINE` while preserving `certifiesExternalValidation: false`;
- is bound to `FULL` / `PRODUCTION`;
- targets exactly the requested evidence id;
- records canonical release commit/version metadata;
- records a canonical reviewer, review timestamp, validation timestamp and accountable actor/role;
- has at least one attestation;
- references exactly the same retained-proof URI passed to the evidence item creator;
- contains the SHA-256 of the exact retained artifact bytes being promoted;
- uses the human reviewer as the evidence item verifier.

The eight common WEB_V1/FULL criteria remain inaccessible to generic creation and must continue through their dedicated semantic binders.

## Operator flow

1. Generate and complete the KMD-305 worksheet using real external evidence.
2. Pass KMD-306 worksheet preflight.
3. Create a KMD-307 human-review receipt against the exact retained artifact.
4. Run `pnpm release:evidence:item:create -- --artifact <artifact> --review-receipt <receipt> --output <item> --id <manual-id> --scope FULL --verifier <reviewer> --ref <retained-proof-uri> --verified-at <UTC> --valid-until <UTC>`.
5. Apply the item to the unsigned manifest, finalize/sign it and run `check:market-ready`.

## Proof boundary

KMD-308 does not prove that an iOS/Android physical test or an App Store/Google Play submission occurred. It only prevents the generic software promotion step from bypassing the repository's completed worksheet + human-review chain and from promoting different bytes, a different URI, a different criterion or a different verifier than the reviewed evidence.

External validation remains a real-world responsibility and must not be represented as complete without retained evidence.

## Migration

No Prisma migration and no user-data migration. Existing unsigned market evidence workflows must supply a KMD-307 review receipt when creating one of the four generic FULL-scope items.

## Rollback

Revert KMD-308. This restores the previous generic item creator behavior. Existing manifests, signatures, evidence artifacts, receipts, databases and user data are unchanged.
