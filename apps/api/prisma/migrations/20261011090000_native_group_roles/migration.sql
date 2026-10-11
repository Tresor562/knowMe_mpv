-- Additive native group management. The original chat and message data are preserved.
CREATE TYPE "ConversationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
ALTER TABLE "Conversation" ADD COLUMN "description" TEXT;
ALTER TABLE "ConversationMember"
  ADD COLUMN "role" "ConversationRole" NOT NULL DEFAULT 'MEMBER';

-- Legacy groups predate stored ownership. The earliest recorded member is
-- deterministically designated initial owner, consistent with the original
-- createConversation() insertion ordering. Chat histories are unchanged.
WITH ranked AS (
  SELECT cm."id",
         ROW_NUMBER() OVER (
           PARTITION BY cm."conversationId"
           ORDER BY cm."joinedAt" ASC, cm."id" ASC
         ) AS rank
  FROM "ConversationMember" cm
  INNER JOIN "Conversation" c ON c."id" = cm."conversationId"
  WHERE c."isGroup" = true
)
UPDATE "ConversationMember" AS cm
SET "role" = 'OWNER'
FROM ranked
WHERE cm."id" = ranked."id" AND ranked.rank = 1;

CREATE INDEX "ConversationMember_conversationId_role_idx"
  ON "ConversationMember"("conversationId", "role");
-- Database-level last line of defense for exactly *at most one* owner per group.
CREATE UNIQUE INDEX "Conversation_one_owner_per_group"
  ON "ConversationMember"("conversationId") WHERE "role" = 'OWNER';
