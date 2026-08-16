CREATE TABLE "SavedMessage" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedMessage_pkey" PRIMARY KEY ("userId", "messageId")
);

CREATE INDEX "SavedMessage_userId_savedAt_idx" ON "SavedMessage"("userId", "savedAt");
CREATE INDEX "SavedMessage_messageId_idx" ON "SavedMessage"("messageId");

ALTER TABLE "SavedMessage"
ADD CONSTRAINT "SavedMessage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedMessage"
ADD CONSTRAINT "SavedMessage_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
