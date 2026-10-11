-- Store a durable, authorized attachment reference without embedding external URLs.
ALTER TABLE "Message" ADD COLUMN "mediaAssetId" TEXT;
CREATE INDEX "Message_mediaAssetId_idx" ON "Message"("mediaAssetId");
ALTER TABLE "Message" ADD CONSTRAINT "Message_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
