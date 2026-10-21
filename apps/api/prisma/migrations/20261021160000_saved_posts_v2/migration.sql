-- KnowMe private bookmarks; only the authenticated user's records are addressable by the API.
CREATE TABLE "SavedPost" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedPost_userId_postId_key" ON "SavedPost"("userId","postId");
CREATE INDEX "SavedPost_userId_createdAt_id_idx" ON "SavedPost"("userId","createdAt","id");
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
