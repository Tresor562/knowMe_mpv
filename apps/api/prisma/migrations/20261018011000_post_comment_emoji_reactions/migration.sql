CREATE TABLE "PostCommentReaction" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostCommentReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostCommentReaction_commentId_userId_key"
 ON "PostCommentReaction"("commentId","userId");
CREATE INDEX "PostCommentReaction_commentId_emoji_idx"
 ON "PostCommentReaction"("commentId","emoji");
ALTER TABLE "PostCommentReaction"
 ADD CONSTRAINT "PostCommentReaction_commentId_fkey" FOREIGN KEY ("commentId")
 REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostCommentReaction"
 ADD CONSTRAINT "PostCommentReaction_userId_fkey" FOREIGN KEY ("userId")
 REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
