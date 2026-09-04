-- KMD-378: keep durable download-token authority aligned with every media
-- authorization path used by MediaService.authorizedAsset().
--
-- KMD-377 correctly fenced explicit MediaAccessGrant revocation, but its
-- database guard rejected legitimate FRIENDS and CONVERSATION authority.
-- This migration recognizes those derived authorities and serializes their
-- removal with token persistence.

CREATE OR REPLACE FUNCTION "knowme_guard_media_download_authority"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  asset_owner TEXT;
  asset_visibility TEXT;
  asset_conversation_id TEXT;
BEGIN
  SELECT asset."ownerId", asset."visibility", asset."conversationId"
  INTO asset_owner, asset_visibility, asset_conversation_id
  FROM "MediaAsset" AS asset
  WHERE asset."id" = NEW."assetId"
    AND asset."deletedAt" IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Media download grant requires an active asset';
  END IF;

  IF asset_owner = NEW."userId" THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM "MediaAccessGrant" AS access_grant
  WHERE access_grant."assetId" = NEW."assetId"
    AND access_grant."granteeId" = NEW."userId"
    AND access_grant."revokedAt" IS NULL
    AND (access_grant."expiresAt" IS NULL OR access_grant."expiresAt" > CURRENT_TIMESTAMP)
  FOR UPDATE;

  IF FOUND THEN
    RETURN NEW;
  END IF;

  IF asset_visibility = 'CONVERSATION' AND asset_conversation_id IS NOT NULL THEN
    PERFORM 1
    FROM "ConversationMember" AS member
    WHERE member."conversationId" = asset_conversation_id
      AND member."userId" = NEW."userId"
    FOR UPDATE;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  IF asset_visibility = 'FRIENDS' THEN
    PERFORM 1
    FROM "Friendship" AS friendship
    WHERE friendship."status" = 'ACCEPTED'
      AND (
        (friendship."requesterId" = NEW."userId" AND friendship."addresseeId" = asset_owner)
        OR
        (friendship."requesterId" = asset_owner AND friendship."addresseeId" = NEW."userId")
      )
    FOR UPDATE;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = 'insufficient_privilege',
    MESSAGE = 'Media download grant requires active access authority';
END;
$$;

CREATE OR REPLACE FUNCTION "knowme_purge_conversation_download_grants_on_membership_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM "MediaDownloadGrant" AS download_grant
  USING "MediaAsset" AS asset
  WHERE download_grant."assetId" = asset."id"
    AND download_grant."userId" = OLD."userId"
    AND asset."ownerId" <> OLD."userId"
    AND asset."deletedAt" IS NULL
    AND asset."visibility" = 'CONVERSATION'
    AND asset."conversationId" = OLD."conversationId"
    AND NOT EXISTS (
      SELECT 1
      FROM "MediaAccessGrant" AS access_grant
      WHERE access_grant."assetId" = asset."id"
        AND access_grant."granteeId" = OLD."userId"
        AND access_grant."revokedAt" IS NULL
        AND (access_grant."expiresAt" IS NULL OR access_grant."expiresAt" > CURRENT_TIMESTAMP)
    );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_purge_conversation_download_grants_on_membership_delete" ON "ConversationMember";
CREATE TRIGGER "knowme_purge_conversation_download_grants_on_membership_delete"
AFTER DELETE ON "ConversationMember"
FOR EACH ROW
EXECUTE FUNCTION "knowme_purge_conversation_download_grants_on_membership_delete"();

CREATE OR REPLACE FUNCTION "knowme_purge_friend_download_grants_on_authority_loss"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  left_user TEXT;
  right_user TEXT;
BEGIN
  left_user := OLD."requesterId";
  right_user := OLD."addresseeId";

  DELETE FROM "MediaDownloadGrant" AS download_grant
  USING "MediaAsset" AS asset
  WHERE download_grant."assetId" = asset."id"
    AND asset."deletedAt" IS NULL
    AND asset."visibility" = 'FRIENDS'
    AND (
      (asset."ownerId" = left_user AND download_grant."userId" = right_user)
      OR
      (asset."ownerId" = right_user AND download_grant."userId" = left_user)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "MediaAccessGrant" AS access_grant
      WHERE access_grant."assetId" = asset."id"
        AND access_grant."granteeId" = download_grant."userId"
        AND access_grant."revokedAt" IS NULL
        AND (access_grant."expiresAt" IS NULL OR access_grant."expiresAt" > CURRENT_TIMESTAMP)
    );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_purge_friend_download_grants_on_status_loss" ON "Friendship";
CREATE TRIGGER "knowme_purge_friend_download_grants_on_status_loss"
AFTER UPDATE OF "status" ON "Friendship"
FOR EACH ROW
WHEN (OLD."status" = 'ACCEPTED' AND NEW."status" <> 'ACCEPTED')
EXECUTE FUNCTION "knowme_purge_friend_download_grants_on_authority_loss"();

DROP TRIGGER IF EXISTS "knowme_purge_friend_download_grants_on_delete" ON "Friendship";
CREATE TRIGGER "knowme_purge_friend_download_grants_on_delete"
AFTER DELETE ON "Friendship"
FOR EACH ROW
WHEN (OLD."status" = 'ACCEPTED')
EXECUTE FUNCTION "knowme_purge_friend_download_grants_on_authority_loss"();
