-- KMD-377: serialize download-token authority with access revocation.
--
-- KMD-376 prevents grant creation from surviving an asset tombstone, but a
-- grantee can still race download-token issuance against revocation. The
-- access-grant row becomes the serialization point for non-owner download
-- tokens, and revocation purges every outstanding token for that grantee.

-- Remove historical non-owner download grants that no longer have current
-- access authority. Owner download grants remain valid while the asset is
-- active and are still covered by the KMD-376 tombstone purge.
DELETE FROM "MediaDownloadGrant" AS download_grant
WHERE EXISTS (
  SELECT 1
  FROM "MediaAsset" AS asset
  WHERE asset."id" = download_grant."assetId"
    AND asset."ownerId" <> download_grant."userId"
)
AND NOT EXISTS (
  SELECT 1
  FROM "MediaAccessGrant" AS access_grant
  WHERE access_grant."assetId" = download_grant."assetId"
    AND access_grant."granteeId" = download_grant."userId"
    AND access_grant."revokedAt" IS NULL
    AND (access_grant."expiresAt" IS NULL OR access_grant."expiresAt" > CURRENT_TIMESTAMP)
);

CREATE OR REPLACE FUNCTION "knowme_guard_media_download_authority"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  asset_owner TEXT;
BEGIN
  SELECT asset."ownerId"
  INTO asset_owner
  FROM "MediaAsset" AS asset
  WHERE asset."id" = NEW."assetId"
    AND asset."deletedAt" IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Media download grant requires an active asset';
  END IF;

  -- Owners retain authority over their own active asset without an explicit
  -- MediaAccessGrant row.
  IF asset_owner = NEW."userId" THEN
    RETURN NEW;
  END IF;

  -- Lock the exact access row so a concurrent revocation cannot commit while
  -- this token is being created. If issuance wins, revocation waits and then
  -- purges the token. If revocation wins, issuance observes no active access
  -- and fails closed.
  PERFORM 1
  FROM "MediaAccessGrant" AS access_grant
  WHERE access_grant."assetId" = NEW."assetId"
    AND access_grant."granteeId" = NEW."userId"
    AND access_grant."revokedAt" IS NULL
    AND (access_grant."expiresAt" IS NULL OR access_grant."expiresAt" > CURRENT_TIMESTAMP)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'Media download grant requires active access authority';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_guard_media_download_authority" ON "MediaDownloadGrant";
CREATE TRIGGER "knowme_guard_media_download_authority"
BEFORE INSERT OR UPDATE OF "assetId", "userId" ON "MediaDownloadGrant"
FOR EACH ROW
EXECUTE FUNCTION "knowme_guard_media_download_authority"();

CREATE OR REPLACE FUNCTION "knowme_purge_download_grants_on_access_revocation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."revokedAt" IS NULL AND NEW."revokedAt" IS NOT NULL THEN
    DELETE FROM "MediaDownloadGrant"
    WHERE "assetId" = NEW."assetId"
      AND "userId" = NEW."granteeId";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_purge_download_grants_on_access_revocation" ON "MediaAccessGrant";
CREATE TRIGGER "knowme_purge_download_grants_on_access_revocation"
AFTER UPDATE OF "revokedAt" ON "MediaAccessGrant"
FOR EACH ROW
EXECUTE FUNCTION "knowme_purge_download_grants_on_access_revocation"();

CREATE OR REPLACE FUNCTION "knowme_purge_download_grants_on_access_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM "MediaDownloadGrant"
  WHERE "assetId" = OLD."assetId"
    AND "userId" = OLD."granteeId";
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_purge_download_grants_on_access_delete" ON "MediaAccessGrant";
CREATE TRIGGER "knowme_purge_download_grants_on_access_delete"
AFTER DELETE ON "MediaAccessGrant"
FOR EACH ROW
EXECUTE FUNCTION "knowme_purge_download_grants_on_access_delete"();
