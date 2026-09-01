-- KMD-373: account-media lifecycle fence cleanup.
--
-- MediaUploadSession intentionally has no Prisma relation to User today. The
-- deletion fence introduced by KMD-373 therefore needs a database-level,
-- transactionally atomic cleanup when the owning User row is removed.
--
-- Upload sessions are ephemeral authority records. Any historical row whose
-- owner no longer exists cannot be valid and is privacy-sensitive stale data,
-- so remove such rows before installing the trigger.
DELETE FROM "MediaUploadSession" AS session
WHERE NOT EXISTS (
  SELECT 1
  FROM "User" AS owner
  WHERE owner."id" = session."ownerId"
);

CREATE OR REPLACE FUNCTION "knowme_cleanup_media_upload_sessions_on_user_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM "MediaUploadSession"
  WHERE "ownerId" = OLD."id";
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_cleanup_media_upload_sessions_on_user_delete" ON "User";

CREATE TRIGGER "knowme_cleanup_media_upload_sessions_on_user_delete"
BEFORE DELETE ON "User"
FOR EACH ROW
EXECUTE FUNCTION "knowme_cleanup_media_upload_sessions_on_user_delete"();
