-- Optional reply pointer; existing messages remain unchanged.
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
