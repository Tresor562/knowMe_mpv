CREATE TABLE "ConversationArchive" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationArchive_pkey" PRIMARY KEY ("userId", "conversationId")
);

CREATE INDEX "ConversationArchive_userId_archivedAt_idx" ON "ConversationArchive"("userId", "archivedAt");
CREATE INDEX "ConversationArchive_conversationId_idx" ON "ConversationArchive"("conversationId");

ALTER TABLE "ConversationArchive"
ADD CONSTRAINT "ConversationArchive_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationArchive"
ADD CONSTRAINT "ConversationArchive_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
