-- KMD-376: serialize grant creation with MediaAsset tombstoning.
--
-- KMD-375 made provider deletion fail closed, but grant/token issuance can
-- race the later database tombstone. These database guards make the asset row
-- the authority for every grant insertion/update and remove grants again at
-- the tombstone boundary, so no late authority row can survive deletion.

-- Historical stale authority is invalid once its asset is absent/tombstoned.
DELETE FROM "MediaDownloadGrant" AS grant
WHERE NOT EXISTS (
  SELECT 1 FROM "MediaAsset" AS asset
  WHERE asset."id" = grant."assetId"
    AND asset."deletedAt" IS NULL
);

DELETE FROM "MediaAccessGrant" AS grant
WHERE NOT EXISTS (
  SELECT 1 FROM "MediaAsset" AS asset
  WHERE asset."id" = grant."assetId"
    AND asset."deletedAt" IS NULL
);

CREATE OR REPLACE FUNCTION "knowme_guard_active_media_asset_grant"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Taking the asset row lock serializes authority creation with the update
  -- that transitions deletedAt from NULL to a tombstone timestamp.
  PERFORM 1
  FROM "MediaAsset"
  WHERE "id" = NEW."assetId"
    AND "deletedAt" IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Media grant requires an active asset';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_guard_media_access_grant_asset" ON "MediaAccessGrant";
CREATE TRIGGER "knowme_guard_media_access_grant_asset"
BEFORE INSERT OR UPDATE OF "assetId" ON "MediaAccessGrant"
FOR EACH ROW
EXECUTE FUNCTION "knowme_guard_active_media_asset_grant"();

DROP TRIGGER IF EXISTS "knowme_guard_media_download_grant_asset" ON "MediaDownloadGrant";
CREATE TRIGGER "knowme_guard_media_download_grant_asset"
BEFORE INSERT OR UPDATE OF "assetId" ON "MediaDownloadGrant"
FOR EACH ROW
EXECUTE FUNCTION "knowme_guard_active_media_asset_grant"();

CREATE OR REPLACE FUNCTION "knowme_purge_media_grants_on_tombstone"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL THEN
    DELETE FROM "MediaDownloadGrant" WHERE "assetId" = NEW."id";
    DELETE FROM "MediaAccessGrant" WHERE "assetId" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_purge_media_grants_on_tombstone" ON "MediaAsset";
CREATE TRIGGER "knowme_purge_media_grants_on_tombstone"
BEFORE UPDATE OF "deletedAt" ON "MediaAsset"
FOR EACH ROW
EXECUTE FUNCTION "knowme_purge_media_grants_on_tombstone"();
