CREATE TYPE "StoryOwnerType" AS ENUM ('PROFILE', 'PROFILE_CIRCLE', 'COMMUNITY', 'CHANNEL');

ALTER TABLE "Story"
  ADD COLUMN "ownerType" "StoryOwnerType" NOT NULL DEFAULT 'PROFILE',
  ADD COLUMN "ownerId" TEXT;

CREATE INDEX "Story_ownerType_ownerId_status_createdAt_idx"
  ON "Story"("ownerType", "ownerId", "status", "createdAt");
