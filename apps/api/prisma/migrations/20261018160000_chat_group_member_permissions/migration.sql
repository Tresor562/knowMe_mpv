-- Member permissions. Defaults exactly preserve current behavior:
-- messages/media/stickers allowed, changing group info and adding people restricted to admins.
ALTER TABLE "Conversation"
  ADD COLUMN "membersCanSendMessages" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "membersCanSendMedia" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "membersCanSendStickers" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "membersCanEditInfo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "membersCanAddMembers" BOOLEAN NOT NULL DEFAULT false;
