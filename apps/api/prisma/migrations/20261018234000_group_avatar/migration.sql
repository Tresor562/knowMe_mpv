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

-- A group-photo link must not outlive its group or its stored private asset.
-- The actor ID stays an audit value, so the historical group picture doesn't
-- impose a restriction on deleting an account.
ALTER TABLE "ConversationAvatar"
  ADD CONSTRAINT "ConversationAvatar_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationAvatar"
  ADD CONSTRAINT "ConversationAvatar_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
