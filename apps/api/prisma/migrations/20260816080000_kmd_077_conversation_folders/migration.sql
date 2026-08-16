CREATE TABLE "ConversationFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationFolderAssignment" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationFolderAssignment_pkey" PRIMARY KEY ("userId", "conversationId")
);

CREATE UNIQUE INDEX "ConversationFolder_userId_normalizedName_key" ON "ConversationFolder"("userId", "normalizedName");
CREATE INDEX "ConversationFolder_userId_position_updatedAt_idx" ON "ConversationFolder"("userId", "position", "updatedAt");
CREATE INDEX "ConversationFolderAssignment_folderId_assignedAt_idx" ON "ConversationFolderAssignment"("folderId", "assignedAt");

ALTER TABLE "ConversationFolder"
ADD CONSTRAINT "ConversationFolder_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationFolderAssignment"
ADD CONSTRAINT "ConversationFolderAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationFolderAssignment"
ADD CONSTRAINT "ConversationFolderAssignment_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationFolderAssignment"
ADD CONSTRAINT "ConversationFolderAssignment_folderId_fkey"
FOREIGN KEY ("folderId") REFERENCES "ConversationFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
