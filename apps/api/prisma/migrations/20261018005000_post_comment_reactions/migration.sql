-- One reaction per account per post comment; changing an emoji updates
-- the existing reaction, and deleting a comment cascades to its reactions.
CREATE TABLE "PostCommentReaction" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostCommentReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostCommentReaction_commentId_userId_key" ON "PostCommentReaction"("commentId", "userId");
CREATE INDEX "PostCommentReaction_commentId_emoji_idx" ON "PostCommentReaction"("commentId", "emoji");
CREATE INDEX "PostCommentReaction_userId_createdAt_idx" ON "PostCommentReaction"("userId", "createdAt");
ALTER TABLE "PostCommentReaction"
  ADD CONSTRAINT "PostCommentReaction_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "PostComment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostCommentReaction"
  ADD CONSTRAINT "PostCommentReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
