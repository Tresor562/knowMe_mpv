-- A reply belongs to an existing post comment. The application verifies that
-- the parent belongs to the same post before inserting the reply.
ALTER TABLE "PostComment" ADD COLUMN "parentId" TEXT;

CREATE INDEX "PostComment_postId_parentId_createdAt_idx"
  ON "PostComment"("postId","parentId","createdAt");

ALTER TABLE "PostComment"
  ADD CONSTRAINT "PostComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "PostComment"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
