-- Ordered attachments for public feed posts, with durable MediaAsset ownership validation in PostsService.
CREATE TABLE "PostAttachment" (
  "postId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostAttachment_pkey" PRIMARY KEY ("postId", "assetId")
);

CREATE UNIQUE INDEX "PostAttachment_postId_position_key" ON "PostAttachment"("postId", "position");
CREATE INDEX "PostAttachment_assetId_idx" ON "PostAttachment"("assetId");
ALTER TABLE "PostAttachment" ADD CONSTRAINT "PostAttachment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostAttachment" ADD CONSTRAINT "PostAttachment_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
