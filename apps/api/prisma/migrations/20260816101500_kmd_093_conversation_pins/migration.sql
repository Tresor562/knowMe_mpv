CREATE TABLE "ConversationPin" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationPin_pkey" PRIMARY KEY ("userId", "conversationId")
);

CREATE INDEX "ConversationPin_userId_pinnedAt_idx" ON "ConversationPin"("userId", "pinnedAt");
CREATE INDEX "ConversationPin_conversationId_idx" ON "ConversationPin"("conversationId");

ALTER TABLE "ConversationPin"
ADD CONSTRAINT "ConversationPin_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationPin"
ADD CONSTRAINT "ConversationPin_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
