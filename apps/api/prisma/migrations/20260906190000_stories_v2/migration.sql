-- CreateEnum
CREATE TYPE "StoryType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'GIFT', 'ACHIEVEMENT', 'GAME', 'POLL', 'LINK');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "StoryAudience" AS ENUM ('PUBLIC', 'FRIENDS', 'FOLLOWERS', 'BEST_FRIENDS', 'CUSTOM', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StoryInteractiveAreaType" AS ENUM ('LINK', 'PROFILE', 'HASHTAG', 'LOCATION', 'GAME', 'POLL', 'GIFT', 'APP', 'BOT');

-- CreateTable
CREATE TABLE "Story" (
  "id" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "type" "StoryType" NOT NULL,
  "status" "StoryStatus" NOT NULL DEFAULT 'PUBLISHED',
  "audience" "StoryAudience" NOT NULL DEFAULT 'FRIENDS',
  "caption" TEXT,
  "captionEntities" JSONB,
  "assetId" TEXT,
  "thumbnailAssetId" TEXT,
  "giftInstanceId" TEXT,
  "gameId" TEXT,
  "pollId" TEXT,
  "linkUrl" TEXT,
  "background" JSONB,
  "musicAssetId" TEXT,
  "musicStartMs" INTEGER,
  "musicDurationMs" INTEGER,
  "locationLabel" TEXT,
  "locationLatitude" DOUBLE PRECISION,
  "locationLongitude" DOUBLE PRECISION,
  "albumId" TEXT,
  "albumPosition" INTEGER NOT NULL DEFAULT 0,
  "repostOfId" TEXT,
  "allowReplies" BOOLEAN NOT NULL DEFAULT true,
  "allowReactions" BOOLEAN NOT NULL DEFAULT true,
  "allowSharing" BOOLEAN NOT NULL DEFAULT true,
  "allowDownload" BOOLEAN NOT NULL DEFAULT false,
  "sensitive" BOOLEAN NOT NULL DEFAULT false,
  "isLive" BOOLEAN NOT NULL DEFAULT false,
  "liveEndedAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "pinnedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryAudienceGrant" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryAudienceGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryView" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "viewerUserId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewCount" INTEGER NOT NULL DEFAULT 1,
  "completionBps" INTEGER NOT NULL DEFAULT 0,
  "screenshotAt" TIMESTAMP(3),
  CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryReaction" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reaction" TEXT NOT NULL,
  "customEmojiId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryReply" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "StoryReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryMention" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "startOffset" INTEGER,
  "endOffset" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryMention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryHashtag" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "hashtag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryHashtag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryInteractiveArea" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "type" "StoryInteractiveAreaType" NOT NULL,
  "geometry" JSONB NOT NULL,
  "payload" JSONB NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryInteractiveArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryAlbum" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "coverAssetId" TEXT,
  "audience" "StoryAudience" NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryAlbum_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Story_authorUserId_status_createdAt_idx" ON "Story"("authorUserId", "status", "createdAt");
CREATE INDEX "Story_status_startsAt_expiresAt_idx" ON "Story"("status", "startsAt", "expiresAt");
CREATE INDEX "Story_audience_status_createdAt_idx" ON "Story"("audience", "status", "createdAt");
CREATE INDEX "Story_albumId_albumPosition_idx" ON "Story"("albumId", "albumPosition");
CREATE INDEX "Story_repostOfId_idx" ON "Story"("repostOfId");
CREATE INDEX "Story_pinnedAt_idx" ON "Story"("pinnedAt");
CREATE UNIQUE INDEX "StoryAudienceGrant_storyId_targetUserId_key" ON "StoryAudienceGrant"("storyId", "targetUserId");
CREATE INDEX "StoryAudienceGrant_targetUserId_storyId_idx" ON "StoryAudienceGrant"("targetUserId", "storyId");
CREATE UNIQUE INDEX "StoryView_storyId_viewerUserId_key" ON "StoryView"("storyId", "viewerUserId");
CREATE INDEX "StoryView_storyId_lastViewedAt_idx" ON "StoryView"("storyId", "lastViewedAt");
CREATE INDEX "StoryView_viewerUserId_lastViewedAt_idx" ON "StoryView"("viewerUserId", "lastViewedAt");
CREATE UNIQUE INDEX "StoryReaction_storyId_userId_key" ON "StoryReaction"("storyId", "userId");
CREATE INDEX "StoryReaction_storyId_updatedAt_idx" ON "StoryReaction"("storyId", "updatedAt");
CREATE INDEX "StoryReaction_userId_updatedAt_idx" ON "StoryReaction"("userId", "updatedAt");
CREATE INDEX "StoryReply_storyId_createdAt_idx" ON "StoryReply"("storyId", "createdAt");
CREATE INDEX "StoryReply_authorId_createdAt_idx" ON "StoryReply"("authorId", "createdAt");
CREATE UNIQUE INDEX "StoryMention_storyId_targetUserId_startOffset_key" ON "StoryMention"("storyId", "targetUserId", "startOffset");
CREATE INDEX "StoryMention_targetUserId_createdAt_idx" ON "StoryMention"("targetUserId", "createdAt");
CREATE UNIQUE INDEX "StoryHashtag_storyId_hashtag_key" ON "StoryHashtag"("storyId", "hashtag");
CREATE INDEX "StoryHashtag_hashtag_createdAt_idx" ON "StoryHashtag"("hashtag", "createdAt");
CREATE INDEX "StoryInteractiveArea_storyId_position_idx" ON "StoryInteractiveArea"("storyId", "position");
CREATE INDEX "StoryAlbum_ownerUserId_createdAt_idx" ON "StoryAlbum"("ownerUserId", "createdAt");
