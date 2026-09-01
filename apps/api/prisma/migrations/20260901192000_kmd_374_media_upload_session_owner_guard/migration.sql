-- KMD-374: make MediaUploadSession creation serialize with account deletion.
--
-- MediaUploadSession.ownerId intentionally has no Prisma relation. KMD-373
-- serialized upload completion with account deletion, but a new upload session
-- could still be inserted after the application-level deletion-fence check.
-- This trigger closes that database race for every insert path.

CREATE OR REPLACE FUNCTION "knowme_guard_media_upload_session_owner"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Lock the owning User row for the duration of the inserting transaction.
  -- Account cleanup takes the same row lock before installing its deletion
  -- marker, so either session creation commits first and cleanup subsequently
  -- removes it, or cleanup wins and the insertion observes the fence/user loss.
  PERFORM 1
  FROM "User"
  WHERE "id" = NEW."ownerId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'MediaUploadSession owner does not exist';
  END IF;

  IF NEW."purpose" <> '__ACCOUNT_DELETION_MEDIA_LOCK__'
     AND EXISTS (
       SELECT 1
       FROM "MediaUploadSession"
       WHERE "ownerId" = NEW."ownerId"
         AND "purpose" = '__ACCOUNT_DELETION_MEDIA_LOCK__'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'MediaUploadSession creation blocked by account deletion fence';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "knowme_guard_media_upload_session_owner" ON "MediaUploadSession";

CREATE TRIGGER "knowme_guard_media_upload_session_owner"
BEFORE INSERT ON "MediaUploadSession"
FOR EACH ROW
EXECUTE FUNCTION "knowme_guard_media_upload_session_owner"();
