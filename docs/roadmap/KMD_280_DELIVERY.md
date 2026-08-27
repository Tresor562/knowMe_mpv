# KMD-280 — Release bundle digest integrity guard

## Goal

Prevent the market-release finalizer writer from emitting a digest record that does not cryptographically match the exact signed-manifest bytes written to disk.

## Problem

`writeFinalizedMarketReleaseEvidence()` accepted `bytes` and `sha256` as independent caller inputs. The normal CLI passed values produced together by the finalizer, but the exported writer itself did not enforce that relationship. A direct or future caller could therefore provide mismatched bytes and digest and create a misleading release bundle.

## Delivered

- require signed-manifest bytes to be a non-empty `Buffer`;
- require the supplied digest to be a canonical lowercase 64-character SHA-256;
- recompute SHA-256 from the exact bytes before reserving either output file;
- fail closed when the digest does not match;
- prove that mismatch and non-canonical digest failures leave neither the manifest nor digest artifact behind;
- preserve the existing exclusive pair reservation and cleanup behavior.

## Migration

No Prisma, environment, schema, or user-data migration is required. Existing correctly generated release bundles remain compatible.

## Rollback

Revert KMD-280. This is not recommended because it restores the possibility for an exported writer call to persist a digest that does not match the retained manifest bytes.

## Proof boundary

KMD-280 proves repository-level byte/digest self-consistency before release-bundle creation. It does not prove the truthfulness of external release evidence, storage durability/WORM semantics, off-site replication, operator controls, or production deployment validity.
