-- Attach multiple inspected assets to one post; cascade when deleted.
CREATE TABLE "PostMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostMedia_postId_position_key" ON "PostMedia"("postId","position");
CREATE UNIQUE INDEX "PostMedia_postId_assetId_key" ON "PostMedia"("postId","assetId");
CREATE INDEX "PostMedia_assetId_idx" ON "PostMedia"("assetId");
ALTER TABLE "PostMedia"
  ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
