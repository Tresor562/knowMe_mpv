CREATE TABLE "ConversationDraft" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationDraft_pkey" PRIMARY KEY ("userId", "conversationId")
);

CREATE INDEX "ConversationDraft_userId_updatedAt_idx" ON "ConversationDraft"("userId", "updatedAt");
CREATE INDEX "ConversationDraft_conversationId_idx" ON "ConversationDraft"("conversationId");

ALTER TABLE "ConversationDraft"
ADD CONSTRAINT "ConversationDraft_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationDraft"
ADD CONSTRAINT "ConversationDraft_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
