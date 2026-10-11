-- Native KnowMe channels v1: publisher ownership, memberships and feed.
-- Additive only; no existing conversation or post data is changed.
CREATE TYPE "ChannelVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

CREATE TABLE "Channel" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "username" TEXT,
  "description" TEXT,
  "visibility" "ChannelVisibility" NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelSubscription" (
  "channelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelSubscription_pkey" PRIMARY KEY ("channelId","userId")
);

CREATE TABLE "ChannelPost" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Channel_username_key" ON "Channel"("username");
CREATE INDEX "Channel_ownerId_createdAt_idx" ON "Channel"("ownerId","createdAt");
CREATE INDEX "Channel_visibility_createdAt_idx" ON "Channel"("visibility","createdAt");
CREATE INDEX "ChannelSubscription_userId_joinedAt_idx" ON "ChannelSubscription"("userId","joinedAt");
CREATE INDEX "ChannelPost_channelId_createdAt_id_idx" ON "ChannelPost"("channelId","createdAt","id");

ALTER TABLE "Channel" ADD CONSTRAINT "Channel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelSubscription" ADD CONSTRAINT "ChannelSubscription_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelSubscription" ADD CONSTRAINT "ChannelSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelPost" ADD CONSTRAINT "ChannelPost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelPost" ADD CONSTRAINT "ChannelPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
