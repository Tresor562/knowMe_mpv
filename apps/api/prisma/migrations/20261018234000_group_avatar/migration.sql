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
