-- Persist one current private group avatar without exposing it as a user avatar.
-- Group membership is always checked in the application controller/service.
CREATE TABLE "ConversationAvatar" (
  "conversationId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationAvatar_pkey" PRIMARY KEY ("conversationId")
);
CREATE INDEX "ConversationAvatar_mediaAssetId_idx" ON "ConversationAvatar"("mediaAssetId");

-- The Conversation and MediaAsset models are owned by separate workstreams.
-- This extension intentionally has no Prisma relation fields in their models.
-- Adding SQL FOREIGN KEYs only here makes Prisma migrate diff fail CI.
--
-- Enforce cleanup without introducing schema.prisma conflicts. PostgreSQL
-- triggers are not modeled as Prisma relations and clean up detached metadata
-- atomically whenever a group or its referenced asset is deleted.
CREATE FUNCTION "knowme_cleanup_avatar_conversation"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "ConversationAvatar" WHERE "conversationId" = OLD."id";
  RETURN OLD;
END;
$$;

CREATE TRIGGER "knowme_avatar_conversation_delete"
AFTER DELETE ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION "knowme_cleanup_avatar_conversation"();

CREATE FUNCTION "knowme_cleanup_avatar_asset"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "ConversationAvatar" WHERE "mediaAssetId" = OLD."id";
  RETURN OLD;
END;
$$;

CREATE TRIGGER "knowme_avatar_media_delete"
AFTER DELETE ON "MediaAsset"
FOR EACH ROW EXECUTE FUNCTION "knowme_cleanup_avatar_asset"();

-- Validate both target rows and serialize against concurrent deletes. This
-- emulates the referential checks without requiring schema changes owned by
-- other PRs. Update endpoint separately verifies group and image permissions.
CREATE FUNCTION "knowme_validate_group_avatar_refs"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "Conversation"
    WHERE "id" = NEW."conversationId" AND "isGroup" = true
    FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'group avatar requires an existing group'
    USING ERRCODE = '23503'; END IF;

  PERFORM 1 FROM "MediaAsset"
    WHERE "id" = NEW."mediaAssetId"
    FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'group avatar asset does not exist'
    USING ERRCODE = '23503'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "knowme_validate_group_avatar_refs_before_write"
BEFORE INSERT OR UPDATE ON "ConversationAvatar"
FOR EACH ROW EXECUTE FUNCTION "knowme_validate_group_avatar_refs"();
