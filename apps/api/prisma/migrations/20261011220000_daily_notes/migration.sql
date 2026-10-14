-- One ephemeral text note per KnowMe user; separate from Story, no media linkage.
CREATE TABLE "DailyNote" (
  "userId" TEXT NOT NULL,
  "content" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyNote_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX "DailyNote_expiresAt_idx" ON "DailyNote"("expiresAt");
ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
