-- Private bookmarks; schema model lives in saved-posts.prisma.
-- No Prisma relation fields: that avoids conflicts with parallel edits of User/Post.
-- PostgreSQL triggers provide cascading cleanup without leaking bookmarks.
CREATE TABLE "SavedPost" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedPost_userId_postId_key" ON "SavedPost"("userId","postId");
CREATE INDEX "SavedPost_userId_createdAt_id_idx" ON "SavedPost"("userId","createdAt","id");

CREATE FUNCTION knowme_saved_post_user_cleanup() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM "SavedPost" WHERE "userId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER knowme_saved_post_user_cleanup
AFTER DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION knowme_saved_post_user_cleanup();

CREATE FUNCTION knowme_saved_post_post_cleanup() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM "SavedPost" WHERE "postId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER knowme_saved_post_post_cleanup
AFTER DELETE ON "Post" FOR EACH ROW EXECUTE FUNCTION knowme_saved_post_post_cleanup();
